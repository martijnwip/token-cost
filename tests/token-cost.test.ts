import { expect, mock, test } from 'claude-code/testing'

import { formatNumber } from '../hooks/i18n'
import { pickCurrency, pickLang } from '../hooks/locale'
import { costOf } from '../hooks/prices'
import { amount, countLines, newTally, report } from '../hooks/report'

const round = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * 1e6) / 1e6)

const COMMAND = { command: 'token-cost', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } } as const

const line = (id: string, model: string, usage: object, timestamp = '2026-10-14T10:00:00.000Z') =>
  JSON.stringify({ type: 'assistant', timestamp, requestId: `req_${id}`, message: { id, model, usage } })

const OPUS = {
  input_tokens: 1_000_000,
  output_tokens: 100_000,
  cache_creation_input_tokens: 1_000_000,
  cache_read_input_tokens: 1_000_000,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1_000_000 },
}

const EN = { lang: 'en', currency: 'usd', eurPerUsd: 0.86 } as const
const NL = { lang: 'nl', currency: 'eur', eurPerUsd: 0.86 } as const
const NOW = new Date('2026-10-14T12:00:00Z')

test('prices Opus 5.5 with caching at API rates', async () => {
  // 4 input + 2 output + 8 cache write (1h, 2x) + 0.20 cache read
  expect(round(costOf('claude-opus-5-5', OPUS))).toBe(14.2)
  expect(round(costOf('claude-opus-5-5', { ...OPUS, speed: 'fast' }))).toBe(28.4)
  expect(round(costOf('claude-sonnet-4-5-20250929', { input_tokens: 1_000_000 }))).toBe(3)
  expect(costOf('unknown-model', OPUS)).toBeUndefined()
})

test('counts a response written on several lines once', async () => {
  const tally = newTally()
  const text = [
    line('a', 'claude-opus-5-5', OPUS),
    line('a', 'claude-opus-5-5', OPUS),
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    line('b', 'claude-haiku-5-5', { input_tokens: 1_000_000, output_tokens: 0 }),
    line('c', 'something-new', { input_tokens: 10 }),
  ].join('\n')

  countLines(text, tally)

  const day = tally.days.get('2026-10-14')
  expect(day?.get('claude-opus-5-5')?.responses).toBe(1)
  expect(round(day?.get('claude-haiku-5-5')?.dollars)).toBe(0.1)
  expect([...tally.unknown]).toEqual(['something-new'])
})

test('formats numbers and amounts per language', async () => {
  expect(formatNumber(1234.5, 2, 'en')).toBe('1,234.50')
  expect(formatNumber(1234.5, 2, 'nl')).toBe('1.234,50')
  expect(amount(1234.5, EN)).toBe('$1,234.50')
  expect(amount(1, NL)).toBe('€ 0,86')
})

test('renders the overview in English and in Dutch', async () => {
  const tally = newTally()
  countLines(line('a', 'claude-opus-5-5', OPUS), tally)

  const en = report(tally, 'overview', NOW, EN)
  expect(en).toContain('| Period | Tokens | Responses | API value |')
  expect(en).toContain('| Today | 3.1M | 1 | $14.20 |')
  expect(en).toContain('| **Total** |')
  expect(en).toContain('$14.20')
  expect(en).toContain('Per model, this month')

  const nl = report(tally, 'overview', NOW, NL)
  expect(nl).toContain('| Vandaag | 3,1 mln | 1 | € 12,21 |')
  expect(nl).toContain('€ 12,21')
})

test('/token-cost reads the transcripts and shows the overview', async ($, on) => {
  mock.env(on, { HOME: '/home' })
  mock.clock(on, { now: NOW.getTime() })
  on('fs.list', ($, e) => ({
    value:
      e.path === '/home/.claude/projects'
        ? [{ name: 'proj', kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false }]
        : [{ name: 'session.jsonl', kind: 'file' as const, size: 100, mtimeMs: 0, isLink: false }],
  }))
  on('fs.read', () => ({ value: line('a', 'claude-opus-5-5', OPUS) }))

  const { text } = await $.command.run({ ...COMMAND, args: '' })

  expect(text).toContain('This month')
  expect(text).toContain('$14.20')
})

test('/token-cost in Dutch with euros', { options: { language: 'nl', currency: 'eur' } }, async ($, on) => {
  mock.env(on, { HOME: '/home' })
  mock.clock(on, { now: NOW.getTime() })
  on('fs.list', ($, e) => ({
    value:
      e.path === '/home/.claude/projects'
        ? [{ name: 's.jsonl', kind: 'file' as const, size: 100, mtimeMs: 0, isLink: false }]
        : [],
  }))
  on('fs.read', () => ({ value: line('a', 'claude-opus-5-5', OPUS) }))

  const { text } = await $.command.run({ ...COMMAND, args: 'maand' })

  expect(text).toContain('Per maand')
  expect(text).toContain('€ 12,21')
})

test('/token-cost with an unknown argument explains the usage', async ($, on) => {
  mock.env(on, { HOME: '/home' })
  const { text } = await $.command.run({ ...COMMAND, args: 'year' })
  expect(text).toContain('Usage: /token-cost')
})

test('the status line shows the session cost and the 5-hour limit', async ($, on) => {
  const status: (string | undefined)[] = []
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 1_000_000 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }],
      cost: { usd: 1.5 },
    },
  }))
  on('ui.status', ($, e) => {
    status.push(e.text)
    return { value: undefined }
  })
  mock.env(on, { HOME: '/home', LANG: 'en_US.UTF-8' })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))

  await $.session.start({ cwd: '/home', surface: 'terminal', isInteractive: true })

  expect(status.at(-1)).toBe('≈ $1.50 API value · 5h limit 23.5%')
})

test('detects language and currency, an explicit setting wins', async () => {
  const nl = { systemLocales: [undefined, undefined, 'nl_NL.UTF-8'] }
  const us = { systemLocales: [undefined, undefined, 'en_US.UTF-8'] }
  const be = { systemLocales: ['fr_BE.UTF-8', undefined, 'en_US.UTF-8'] }

  expect(pickLang('auto', nl)).toBe('nl')
  expect(pickCurrency('auto', nl)).toBe('eur')
  expect(pickLang('auto', us)).toBe('en')
  expect(pickCurrency('auto', us)).toBe('usd')
  expect(pickLang('auto', be)).toBe('en')
  expect(pickCurrency('auto', be)).toBe('eur')
  expect(pickLang('auto', { claudeLanguage: 'Dutch', systemLocales: ['en_US.UTF-8'] })).toBe('nl')
  expect(pickLang('auto', { claudeLanguage: 'japanese', systemLocales: ['nl_NL.UTF-8'] })).toBe('en')
  expect(pickLang('auto', { systemLocales: ['C'] })).toBe('en')
  expect(pickLang('en', nl)).toBe('en')
  expect(pickCurrency('usd', nl)).toBe('usd')
})

test('/token-cost follows a Dutch system locale on auto', async ($, on) => {
  mock.env(on, { HOME: '/home', LANG: 'nl_NL.UTF-8' })
  mock.clock(on, { now: NOW.getTime() })
  on('fs.list', ($, e) => ({
    value:
      e.path === '/home/.claude/projects'
        ? [{ name: 's.jsonl', kind: 'file' as const, size: 100, mtimeMs: 0, isLink: false }]
        : [],
  }))
  on('fs.read', () => ({ value: line('a', 'claude-opus-5-5', OPUS) }))

  const { text } = await $.command.run({ ...COMMAND, args: '' })

  expect(text).toContain('**Overzicht**')
  expect(text).toContain('€ 12,21')
})

test('groups usage per session, with its title and subagents included', async () => {
  const tally = newTally()
  const withSession = (id: string, session: string, cwd: string) =>
    JSON.stringify({ ...JSON.parse(line(id, 'claude-opus-5-5', OPUS)), sessionId: session, cwd })
  countLines(
    [
      withSession('a', 's1', '/home/me/shop'),
      withSession('b', 's1', '/home/me/shop'),
      withSession('c', 's2', '/home/me/blog'),
      JSON.stringify({ type: 'ai-title', aiTitle: 'Fix | checkout', sessionId: 's1' }),
      JSON.stringify({ type: 'custom-title', customTitle: 'Blog redesign', sessionId: 's2' }),
    ].join('\n'),
    tally,
  )

  const text = report(tally, 'sessions', NOW, EN)

  expect(text).toContain('| Session | Project | Last active | Tokens | Responses | API value |\n| :--- | :--- | :--- | ---: | ---: | ---: |')
  expect(text).toContain('| Fix / checkout | shop | 2026-10-14 | 6.2M | 2 | $28.40 |')
  expect(text).toContain('| Blog redesign | blog | 2026-10-14 | 3.1M | 1 | $14.20 |')
  expect(text).toContain('| **Total** |  |  | **9.3M** | **3** | **$42.60** |')
})

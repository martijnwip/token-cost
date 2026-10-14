import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { formatNumber, STRINGS } from './i18n'
import { pickCurrency, pickLang, type LocaleHints } from './locale'
import { amount, countLines, newTally, report, type Settings, type Tally, type View } from './report'

// $.fs.read reads up to 4 MiB; larger transcripts are read filtered through grep.
const MAX_READ = 4 * 1024 * 1024

const VIEWS: Record<string, View> = {
  '': 'overview',
  day: 'days',
  days: 'days',
  dag: 'days',
  dagen: 'days',
  month: 'months',
  months: 'months',
  maand: 'months',
  maanden: 'months',
  session: 'sessions',
  sessions: 'sessions',
  sessie: 'sessions',
  sessies: 'sessions',
}

async function projectsDir($: EngineInterface): Promise<string | undefined> {
  const custom = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE'))
  const base = custom ?? (home === undefined ? undefined : `${home}/.claude`)
  return base === undefined ? undefined : `${base}/projects`
}

async function transcripts($: EngineInterface, dir: string): Promise<{ path: string; size: number }[]> {
  const found: { path: string; size: number }[] = []
  const entries = await $.fs.list(dir).catch(() => [])
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`
    if (entry.kind === 'dir') found.push(...(await transcripts($, path)))
    else if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) found.push({ path, size: entry.size })
  }
  return found
}

// Reads a large file in pieces, filtered to the lines with usage or a title.
async function countLarge($: EngineInterface, path: string, tally: Tally): Promise<boolean> {
  try {
    let rest = ''
    for await (const { stream, text } of $.process.spawn({ argv: ['grep', '-E', '"usage"|"ai-title"|"custom-title"', path] })) {
      if (stream !== 'stdout') continue
      const chunk = rest + text
      const cut = chunk.lastIndexOf('\n')
      countLines(chunk.slice(0, cut + 1), tally)
      rest = chunk.slice(cut + 1)
    }
    countLines(rest, tally)
    return true
  } catch {
    return false
  }
}

async function countAll($: EngineInterface): Promise<{ tally: Tally; skipped: number }> {
  const tally = newTally()
  let skipped = 0
  const dir = await projectsDir($)
  if (dir === undefined) return { tally, skipped }

  for (const { path, size } of await transcripts($, dir)) {
    if (size <= MAX_READ) {
      const text = await $.fs.read(path).catch(() => undefined)
      if (text === undefined) skipped += 1
      else countLines(text, tally)
    } else if (!(await countLarge($, path, tally))) {
      skipped += 1
    }
  }
  return { tally, skipped }
}

async function showStatus($: EngineInterface, s: Settings): Promise<void> {
  const { cost, rateLimits } = await $.session.usage()
  if (cost === undefined) return
  const t = STRINGS[s.lang]
  const fiveHour = rateLimits.find(r => r.kind === 'five_hour')
  const limit = fiveHour === undefined ? '' : t.fiveHourLimit(formatNumber(fiveHour.percentUsed, fiveHour.percentUsed % 1 === 0 ? 0 : 1, s.lang))
  $.ui.status(t.status(amount(cost.usd, s), limit))
}

// Language and currency: an explicit option wins, `auto` detects them from
// Claude Code's own `language` setting and the system locale.
async function resolveSettings($: EngineInterface, options: PluginOptions): Promise<Settings> {
  const hints: LocaleHints = {
    claudeLanguage: (await $.settings.read().catch(() => ({}) as Record<string, unknown>)).language,
    systemLocales: [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')],
  }
  return {
    lang: pickLang(options.language, hints),
    currency: pickCurrency(options.currency, hints),
    eurPerUsd: typeof options.eurPerUsd === 'number' && options.eurPerUsd > 0 ? options.eurPerUsd : 0.86,
  }
}

export const register: Register = (on, options) => {
  const withStatus = options.statusLine !== false

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const settings = await resolveSettings($, options)
    await $.command.register({ name: 'token-cost', description: STRINGS[settings.lang].commandDescription })
    if (withStatus) await showStatus($, settings)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (withStatus) await showStatus($, await resolveSettings($, options))
    return result
  })

  on('command.run', { command: 'token-cost' }, async ($, e) => {
    const settings = await resolveSettings($, options)
    const t = STRINGS[settings.lang]
    const view = VIEWS[(e.args ?? '').trim().toLowerCase()]
    if (view === undefined) return { text: t.usage }

    const { tally, skipped } = await countAll($)
    const now = new Date(await $.clock.now())
    const warning = skipped === 0 ? '' : `\n${t.unreadable(skipped)}`

    return { text: `\n${report(tally, view, now, settings)}${warning}` }
  })
}

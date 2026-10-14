import { formatNumber, STRINGS, type Lang } from './i18n'
import { costOf, tokensOf, type Tokens, type Usage } from './prices'

export type Entry = Tokens & { dollars: number; responses: number }

// Per day (YYYY-MM-DD, local time) and per model, the summed tokens and cost.
export type Tally = {
  days: Map<string, Map<string, Entry>>
  seen: Set<string>
  unknown: Set<string>
}

export const newTally = (): Tally => ({
  days: new Map(),
  seen: new Set(),
  unknown: new Set(),
})

const empty = (): Entry => ({
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
  dollars: 0,
  responses: 0,
})

export const dayOf = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

type Line = {
  type?: string
  timestamp?: string
  requestId?: string
  message?: { id?: string; model?: string; usage?: Usage }
}

// Counts the assistant responses in (a piece of) a JSONL transcript.
// Claude Code sometimes writes one response on several lines; those count once.
export function countLines(text: string, tally: Tally): void {
  for (const raw of text.split('\n')) {
    if (!raw.includes('"usage"') || !raw.includes('"assistant"')) continue

    let line: Line
    try {
      line = JSON.parse(raw)
    } catch {
      continue
    }

    const m = line.message
    if (line.type !== 'assistant' || !m?.usage || !m.model || !line.timestamp) continue
    if (m.model === '<synthetic>') continue

    const key = `${m.id ?? ''}:${line.requestId ?? ''}`
    if (key !== ':') {
      if (tally.seen.has(key)) continue
      tally.seen.add(key)
    }

    const dollars = costOf(m.model, m.usage)
    if (dollars === undefined) {
      tally.unknown.add(m.model)
      continue
    }

    const day = dayOf(new Date(line.timestamp))
    const model = m.model.replace(/-\d{8}$/, '')
    const perModel = tally.days.get(day) ?? new Map<string, Entry>()
    const entry = perModel.get(model) ?? empty()
    const t = tokensOf(m.usage)

    entry.input += t.input
    entry.output += t.output
    entry.cacheWrite += t.cacheWrite
    entry.cacheRead += t.cacheRead
    entry.dollars += dollars
    entry.responses += 1

    perModel.set(model, entry)
    tally.days.set(day, perModel)
  }
}

const add = (a: Entry, b: Entry): Entry => ({
  input: a.input + b.input,
  output: a.output + b.output,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  cacheRead: a.cacheRead + b.cacheRead,
  dollars: a.dollars + b.dollars,
  responses: a.responses + b.responses,
})

const sumOf = (tally: Tally, matches: (day: string) => boolean): Entry => {
  let sum = empty()
  for (const [day, perModel] of tally.days) {
    if (!matches(day)) continue
    for (const entry of perModel.values()) sum = add(sum, entry)
  }
  return sum
}

const perModelOf = (tally: Tally, matches: (day: string) => boolean) => {
  const models = new Map<string, Entry>()
  for (const [day, perModel] of tally.days) {
    if (!matches(day)) continue
    for (const [model, entry] of perModel) {
      models.set(model, add(models.get(model) ?? empty(), entry))
    }
  }
  return [...models].sort((a, b) => b[1].dollars - a[1].dollars)
}

export type Settings = { lang: Lang; currency: 'usd' | 'eur'; eurPerUsd: number }

export function amount(dollars: number, s: Settings): string {
  const value = s.currency === 'eur' ? dollars * s.eurPerUsd : dollars
  const number = formatNumber(value, 2, s.lang)
  const symbol = s.currency === 'eur' ? '€' : '$'
  // Dutch writes "€ 1,23", English "$1.23".
  return s.lang === 'nl' ? `${symbol} ${number}` : `${symbol}${number}`
}

export function shortTokens(n: number, lang: Lang): string {
  const t = STRINGS[lang]
  if (n >= 1_000_000_000) return `${formatNumber(n / 1_000_000_000, 1, lang)}${t.billion}`
  if (n >= 1_000_000) return `${formatNumber(n / 1_000_000, 1, lang)}${t.million}`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

const totalTokens = (e: Entry) => e.input + e.output + e.cacheWrite + e.cacheRead

// A markdown table; the CommandOutput row draws its text as markdown on every
// surface, so the terminal and the desktop app both show a real table.
// Number columns align right, and `footer` is a bold total row.
const table = (header: string[], rows: string[][], footer?: string[]): string => {
  const cells = (r: string[]) => `| ${r.join(' | ')} |`
  const align = `|${header.map((_, i) => (i === 0 ? ' :--- ' : ' ---: ')).join('|')}|`
  const total = footer ? [cells(footer.map(cell => `**${cell}**`))] : []
  return [cells(header), align, ...rows.map(cells), ...total].join('\n')
}

export type View = 'overview' | 'days' | 'months'

export function report(tally: Tally, view: View, now: Date, s: Settings): string {
  const t = STRINGS[s.lang]
  if (tally.days.size === 0) return t.noUsage

  const today = dayOf(now)
  const weekAgo = dayOf(new Date(now.getTime() - 6 * 86_400_000))
  const month = today.slice(0, 7)
  const header = (first: string) => [first, t.tokens, t.responses, t.apiValue]
  const row = (label: string, e: Entry) => [
    label,
    shortTokens(totalTokens(e), s.lang),
    formatNumber(e.responses, 0, s.lang),
    amount(e.dollars, s),
  ]
  const total = (matches: (day: string) => boolean) => row(t.total, sumOf(tally, matches))

  let body: string
  if (view === 'days') {
    const days = [...tally.days.keys()].sort().slice(-14)
    body = `**${t.perDay}**\n\n${table(
      header(t.day),
      days.map(d => row(d, sumOf(tally, x => x === d))),
      total(d => days.includes(d)),
    )}`
  } else if (view === 'months') {
    const months = [...new Set([...tally.days.keys()].map(d => d.slice(0, 7)))].sort()
    body = `**${t.perMonth}**\n\n${table(
      header(t.month),
      months.map(m => row(m, sumOf(tally, d => d.startsWith(m)))),
      total(() => true),
    )}`
  } else {
    const periods = `**${t.overview}**\n\n${table(
      header(t.period),
      [
        row(t.today, sumOf(tally, d => d === today)),
        row(t.last7Days, sumOf(tally, d => d >= weekAgo)),
        row(t.thisMonth, sumOf(tally, d => d.startsWith(month))),
      ],
      total(() => true),
    )}`
    const models = perModelOf(tally, d => d.startsWith(month))
    const perModel =
      models.length === 0 ? '' : `\n\n**${t.perModel}**\n\n${table(header(t.model), models.map(([m, e]) => row(m, e)))}`
    body = periods + perModel
  }

  const unknown = tally.unknown.size === 0 ? '' : `\n${t.notCounted}: ${[...tally.unknown].join(', ')}`

  return `${body}\n\n_${t.note}_${unknown}`
}

// Anthropic first-party API prices in US dollars per million tokens (October 2026).
// Cache writes cost 1.25x (5 minutes) or 2x (1 hour) the input price.
export type Price = { input: number; output: number; cacheRead: number }

// Longest prefix first, so `claude-opus-5-5` does not match `claude-opus-5`.
const PRICES: ReadonlyArray<readonly [string, Price]> = [
  ['claude-fable-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['claude-mythos-5-1', { input: 10, output: 50, cacheRead: 0.25 }],
  ['claude-fable-5', { input: 10, output: 50, cacheRead: 1 }],
  ['claude-mythos-5', { input: 10, output: 50, cacheRead: 1 }],
  ['claude-opus-5-5', { input: 4, output: 20, cacheRead: 0.2 }],
  ['claude-opus-5', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-8', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-7', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-6', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4-5', { input: 5, output: 25, cacheRead: 0.5 }],
  ['claude-opus-4', { input: 15, output: 75, cacheRead: 1.5 }],
  ['claude-sonnet-5-5', { input: 2, output: 10, cacheRead: 0.2 }],
  ['claude-sonnet-5', { input: 2, output: 10, cacheRead: 0.2 }],
  ['claude-sonnet-4', { input: 3, output: 15, cacheRead: 0.3 }],
  ['claude-haiku-5-5', { input: 0.1, output: 0.5, cacheRead: 0.01 }],
  ['claude-haiku-4-5', { input: 1, output: 5, cacheRead: 0.1 }],
  ['claude-3-5-haiku', { input: 0.8, output: 4, cacheRead: 0.08 }],
]

export function priceFor(model: string): Price | undefined {
  const name = model.replace(/^(us\.|eu\.|global\.)?anthropic\./, '')
  return PRICES.find(([prefix]) => name.startsWith(prefix))?.[1]
}

// The token counts Claude Code records for each API response.
export type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  cache_creation?: {
    ephemeral_5m_input_tokens?: number
    ephemeral_1h_input_tokens?: number
  }
  speed?: string
}

export type Tokens = {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

export function tokensOf(u: Usage): Tokens {
  return {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
  }
}

// The cost in dollars of one API response; undefined for an unknown model.
export function costOf(model: string, u: Usage): number | undefined {
  const p = priceFor(model)
  if (p === undefined) return undefined

  const written = u.cache_creation_input_tokens ?? 0
  const hour = u.cache_creation?.ephemeral_1h_input_tokens ?? 0
  const fiveMin = u.cache_creation?.ephemeral_5m_input_tokens ?? written - hour
  // Fast mode costs twice the standard rate.
  const factor = u.speed === 'fast' ? 2 : 1

  const dollars =
    (u.input_tokens ?? 0) * p.input +
    (u.output_tokens ?? 0) * p.output +
    fiveMin * p.input * 1.25 +
    hour * p.input * 2 +
    (u.cache_read_input_tokens ?? 0) * p.cacheRead

  return (dollars * factor) / 1_000_000
}

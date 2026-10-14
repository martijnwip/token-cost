# token-cost

How much would your Claude Code usage cost if you paid per token?

On a Pro or Max subscription you pay a fixed fee and never see what your usage is worth. This plugin converts your tokens to Anthropic's official API prices, so you can see what your subscription gets you.

## What you get

**Live in the status line**, after every turn:

```
≈ $3.98 API value · 5h limit 23.5%
```

**An overview with `/token-cost`**, across all your sessions on this machine:

> **Overview**
>
> | Period | Tokens | Responses | API value |
> | :--- | ---: | ---: | ---: |
> | Today | 120.5M | 638 | $43.47 |
> | Last 7 days | 159.4M | 862 | $61.45 |
> | This month | 424.6M | 2,208 | $169.37 |
> | **Total** | **647.8M** | **3,158** | **$243.41** |
>
> **Per model, this month**
>
> | Model | Tokens | Responses | API value |
> | :--- | ---: | ---: | ---: |
> | claude-opus-5-5 | 424.6M | 2,208 | $169.37 |

- `/token-cost`: today, the last 7 days, this month and the total, plus a breakdown per model
- `/token-cost day`: the last 14 days
- `/token-cost month`: per month

## Install

In Claude Code, type:

```
/plugin install token-cost --marketplace martijnwip/token-cost
```

Answer `y` to add the marketplace and pick a scope (user is the default). The plugin works right away, no restart needed.

Requires a recent Claude Code: the one-step install line needs 2.1.275 or later. The plugin runs in the terminal and in the desktop app's Code tab; the `/plugin install` command itself is terminal-only.

## Settings

Set them during install or with `/plugin configure token-cost@token-cost`:

| Setting | Default | What it does |
| --- | --- | --- |
| `language` | `en` | `en` or `nl` (Dutch): the language of the tables and the status line |
| `currency` | `usd` | `usd` or `eur` |
| `eurPerUsd` | `0.86` | The exchange rate used for `eur` |
| `statusLine` | on | Show the session's cost in the status line |

## How it calculates

- The status line shows the current session's cost as Claude Code itself tracks it.
- `/token-cost` reads the transcripts Claude Code keeps locally (`~/.claude/projects`) and adds up the input, output and cache tokens of every API response. Responses that appear twice in the logs count once.
- Prices: Anthropic's first-party API rates (October 2026). Cache writes cost 1.25x (5 minutes) or 2x (1 hour) the input price, and fast mode costs twice the standard rate.

## Good to know

- This is an **estimate** of the API value. On a subscription you simply pay your fixed monthly fee.
- Only Claude Code usage on this machine counts, not claude.ai chats.
- Haiku 5.5's long-context rate (above 100K tokens) is not taken into account.
- Models without a known price are listed separately and not counted.
- On Windows, transcripts larger than 4 MB are skipped (they are read with `grep`), and the output says how many.
- The plugin sends nothing anywhere: everything is calculated locally.

## About

Made by Martijn. More about my work: **[martijnwip.nl](https://martijnwip.nl)**

Questions or found a bug? Open an [issue](https://github.com/martijnwip/token-cost/issues).

## License

MIT

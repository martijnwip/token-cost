# Privacy

token-cost runs entirely on your own machine. It collects nothing, stores nothing and sends nothing anywhere: it makes no network connections at all.

## What it reads

- **Claude Code's local transcripts**: the `.jsonl` files in `~/.claude/projects` (or `$CLAUDE_CONFIG_DIR/projects`). From each file it uses only, per API response, the model name, the token counts, the timestamp and the session id, plus each session's title and the name of the folder it ran in. It does not read, show or keep the content of your conversations.
- **The current session's usage**, through Claude Code's plugin API: the session cost and your rate-limit windows, for the status line.
- **Settings and environment**: `HOME` or `USERPROFILE` and `CLAUDE_CONFIG_DIR` to find the transcripts, and Claude Code's `language` setting plus `LC_ALL`, `LC_MESSAGES` and `LANG` to pick a language and currency when they are set to `auto`.

## What it runs

- `grep`, only for transcripts larger than 4 MB, to filter them down to the lines that carry token usage or a session title before counting. On systems without `grep` those files are skipped.

## What it shows

The totals appear only in your own Claude Code session: in the status line and in the output of `/token-cost`.

## Contact

Questions: open an [issue](https://github.com/martijnwip/token-cost/issues) or see [martijnwip.nl](https://martijnwip.nl).

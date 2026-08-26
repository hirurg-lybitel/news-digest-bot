# Contributing

Thanks for interest in improving the digest bot.

## Development

1. Fork and clone the repo.
2. `cp .env.example .env` and fill secrets locally (never commit `.env`).
3. `npm install`
4. `npm run digest:dry` — generate a message without posting.
5. `npm run typecheck`

## Pull requests

- Keep changes focused (one concern per PR).
- Do not commit API keys, tokens, or channel dumps.
- If you add a news source, prefer an official public RSS URL and update `src/sources.ts` + README.
- Respect [NOTICE.md](NOTICE.md): no full-article scraping/republication.

## Code style

- TypeScript, strict mode
- Small modules, clear error messages
- Prefer structured JSON from OpenAI and validate with Zod

## Security

See [SECURITY.md](SECURITY.md).

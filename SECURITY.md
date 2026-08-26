# Security Policy

## Supported versions

Security fixes are applied to the latest commit on `main`.

## Reporting a vulnerability

Do **not** open a public GitHub issue for security problems.

Please report privately:

1. GitHub: **Security → Report a vulnerability** (private advisory) for this repository, or
2. Contact the repository owner via GitHub profile.

Include:

- description of the issue
- steps to reproduce
- impact (token leak, RCE in CI, dependency compromise, etc.)
- suggested fix if you have one

We aim to acknowledge reports within 7 days.

## Secrets and tokens

Never commit:

- `OPENAI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `.env` / `.env.local`
- any channel admin credentials

Use GitHub Actions secrets for CI and a local `.env` (gitignored) for development.

If a secret was exposed:

1. Revoke/rotate it immediately (OpenAI + BotFather).
2. Remove it from git history if it was committed.
3. Re-add the new value only via secrets / local env.

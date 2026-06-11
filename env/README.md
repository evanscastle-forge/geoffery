# env/

Three deployment postures, code-path identical. See `docs/deployments.md` for the operational picture.

| File | Used by | Posture |
|---|---|---|
| `.env` | `scripts/run.sh local …` | Local SQLite, http preview, tip jar disabled, noindex |
| `.env.qa` | `scripts/run.sh qa …` | Hidden behind Cloudflare Access, robots deny-all, tip jar disabled, noindex |
| `.env.prod` | `scripts/run.sh prod …` | Public, indexed, real Stripe payment links |

The `.example` files in this directory are templates. Copy → fill in → never commit.

```
cp env/.env.local.example .env
cp env/.env.qa.example    .env.qa
cp env/.env.prod.example  .env.prod
```

`.env*` is gitignored. Secrets — including Stripe URLs — go directly into the file, never into chat (per global rule).

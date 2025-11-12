# Secrets & Tokens

## Git-integrated Pages
- No API tokens required for builds/deploys.

## When tokens are needed
Only if you keep any **Direct Upload** projects (Wrangler deploys) or automation that edits DNS:
- `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (permission: Account → Cloudflare Pages → Edit)
- DNS changes require a zone-scoped token (Zone.DNS). Not needed for Pages.

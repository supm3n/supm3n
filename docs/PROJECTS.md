# Projects & Build Settings

All projects are built from the monorepo root (`/`). Pushing to the default branch triggers all projects to rebuild.

### Cloudflare Build Configuration

| Project | Cloudflare "Root Directory" | Cloudflare "Build Output Directory" | Domain |
| :--- | :--- | :--- | :--- |
| `landingpage` | `/` | `dist/landingpage` | `supm3n.com` |
| `disasters` | `/` | `dist/disasters` | `disasters.supm3n.com` |
| `stock-viewer` | `/` | `dist/stock-viewer` | `stocks.supm3n.com` |
| `snake` | `/` | `dist/snake` | `snake.supm3n.com` |
| `settleup` | `/` | `dist/settleup` | `settleup.supm3n.com` |

See `docs/DEPLOYMENT.md` for more details on the build system.
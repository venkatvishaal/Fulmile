# Deploying Fulmile

Production setup: **Neon** (PostgreSQL) → **Render** (Node/Express API + Socket.io) → **Vercel** (React build).
All three have free tiers. Total time: about 20–30 minutes.

```
Browser ──HTTPS──▶ Vercel (frontend/build)
   │
   └──HTTPS + WebSocket──▶ Render (backend, /api + socket.io) ──SSL──▶ Neon (Postgres)
```

---

## 0. Before you start

1. Accounts: GitHub, [Neon](https://neon.tech), [Render](https://render.com), [Vercel](https://vercel.com).
2. Commit and push everything to GitHub (including `frontend/package-lock.json`, which pins the export libraries):
   ```bash
   git add -A
   git commit -m "Prepare for deployment"
   git push origin main
   ```
3. Optional local sanity check (this is exactly what Vercel runs):
   ```bash
   cd frontend
   CI=true npm run build
   ```

---

## 1. Database — Neon

1. Neon dashboard → **New Project** → name `fulmile`, Postgres 16, pick a region close to your users (e.g. *AWS Asia Pacific (Singapore)*).
2. **Connection Details** → turn **off** "Pooled connection" and copy the **direct** connection string. It looks like:
   `postgresql://<user>:<password>@<host>.neon.tech/neondb?sslmode=require`
   Keep it secret — it is your `DATABASE_URL`.
3. Neon → **SQL Editor** → paste the whole of [`database/schema.sql`](database/schema.sql) → **Run**.
   This creates all 10 tables, indexes and the `vehicle_operational_costs` view used by Reports.
4. Seed data — choose one:
   - **Demo / staging (roles + demo users + sample fleet):** from your machine
     ```bash
     cd backend
     npm install
     # macOS / Linux / Git Bash
     DATABASE_URL="<your neon url>" npm run db:seed
     # Windows PowerShell
     $env:DATABASE_URL="<your neon url>"; npm run db:seed
     ```
     Demo logins created (all with password `password123` — change or delete them before real use):
     `manager@fulmile.com` (fleet manager), `alex@fulmile.com` (driver),
     `safety@fulmile.com` (safety officer), `analyst@fulmile.com` (financial analyst).
   - **Clean production start:** in the SQL Editor run only the `INSERT INTO roles …` block at the top of
     [`database/seed.sql`](database/seed.sql). Roles **must** exist or registration fails.
5. **Auth + row-level security migration** (adds the session columns, creates the
   restricted `fulmile_app` role and the RLS policies). Safe to re-run; run it again after any restore:
   ```bash
   cd backend
   DATABASE_URL="<your neon url>" npm run db:migrate-auth
   ```
   Until this has run, the API logs `Row-level security is OFF` at startup.
6. **Existing databases only:** refresh the Reports cost view (it now adds tolls and other expenses to each vehicle's operational cost):
   ```bash
   cd backend
   DATABASE_URL="<your neon url>" npm run db:view
   ```

### Backups
- **Neon point-in-time restore** is built in (Neon → Branches → Restore). The free plan keeps a short history window, so also:
- **Nightly encrypted dump** via [`.github/workflows/db-backup.yml`](.github/workflows/db-backup.yml). In GitHub → Settings → Secrets → Actions add
  `DATABASE_URL` and `BACKUP_PASSPHRASE` (a long random string; store it in your password manager, since without it the dumps can't be read).
  Run it once by hand from the Actions tab to check it works. Each run uploads `fulmile.sql.gz.gpg` as an artifact kept 30 days.
- **Restore a dump:**
  ```bash
  gpg --batch --passphrase "$BACKUP_PASSPHRASE" -d fulmile.sql.gz.gpg | gunzip | psql "$TARGET_DATABASE_URL"
  cd backend && DATABASE_URL="$TARGET_DATABASE_URL" npm run db:migrate-auth   # dumps skip role grants
  ```

---

## 2. Backend API — Render

1. Render dashboard → **New → Web Service** → connect your GitHub repo.
2. Settings:

   | Field | Value |
   |---|---|
   | Name | `fulmile-backend` (becomes `https://fulmile-backend.onrender.com`) |
   | Root Directory | `backend` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Health Check Path | `/api/health` |
   | Instance Type | Free (or Starter to avoid cold starts) |

3. **Environment Variables:**

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon direct connection string |
   | `JWT_SECRET` | **required** (the server won't start without it): a long random string — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
   | `JWT_EXPIRE` | `7d` |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | your Vercel URL, e.g. `https://fulmile.vercel.app` |
   | `SENTRY_DSN` | optional; from a Sentry **Node/Express** project. Error tracking is off without it |

   Do **not** set `PORT`; Render injects it.
4. **Create Web Service** and wait for "Live". Check:
   ```bash
   curl https://fulmile-backend.onrender.com/api/health
   # {"ok":true}
   ```
   The logs should show `Database connection has been established successfully.`

> Free instances sleep after ~15 min idle; the first request then takes 30–60 s. WebSockets (live tracking) work on Render.

---

## 3. Frontend — Vercel

1. Vercel → **Add New → Project** → import the same repo.
2. Settings:

   | Field | Value |
   |---|---|
   | Root Directory | `frontend` |
   | Framework Preset | Create React App |
   | Build Command | `npm run build` |
   | Output Directory | `build` |

3. **Environment Variable:**

   | Key | Value |
   |---|---|
   | `REACT_APP_API_BASE_URL` | `https://fulmile-backend.onrender.com/api` (your Render URL + `/api`, no trailing slash) |
   | `REACT_APP_SENTRY_DSN` | optional; from a Sentry **React** project |

   The Socket.io URL is derived from this automatically (it strips `/api`).
   **Analytics:** Vercel project → Analytics → Enable. The script is already in `public/index.html`; no env var needed.
4. **Deploy.** [`frontend/vercel.json`](frontend/vercel.json) rewrites every path to `index.html`, so deep links such as `/login`, `/reports` or `/track/<id>` survive a refresh.

> CRA bakes `REACT_APP_*` values in at build time — after changing one, **Redeploy** the project.

---

## 4. Optional hardening

- **Lock CORS to your site.** `backend/src/server.js` currently accepts any origin for both Express and Socket.io. Replace the two `origin` callbacks with your Vercel domain, e.g. `origin: ['https://fulmile.vercel.app']`.
- **Custom domains:** add on Vercel (frontend) and/or Render (API). If the API domain changes, update `REACT_APP_API_BASE_URL` and redeploy the frontend.
- **Remove demo users** (or change their passwords) if you seeded them.
- **Keep the API warm** on the free tier with an uptime pinger hitting `/api/health` every 10 minutes.

---

## 5. Smoke test after deploying

1. Open the Vercel URL → landing page loads and the 3D scenes render.
2. Register a user (or sign in with a demo login) → dashboard numbers load.
3. As fleet manager: add a vehicle and a driver → draft and dispatch a trip.
4. Open `/track/<tripId>` in another tab → driver **Go Live** updates move on the map (WebSocket to Render).
5. **Fuel & expenses / Reports → Export**: Excel and PDF download for fleet manager and financial analyst; the menu is absent for a driver.
6. Refresh on `/reports` → no 404.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Vercel build: *"Treating warnings as errors because process.env.CI = true"* | Fix the ESLint warning it lists (`npx eslint src` locally), or temporarily set `CI=false` in Vercel env vars. |
| 404 when refreshing a page | `frontend/vercel.json` missing or Root Directory isn't `frontend`. |
| "Network Error" / CORS errors in the browser | `REACT_APP_API_BASE_URL` wrong or missing, or you didn't redeploy after setting it. |
| Register returns 500 | Roles not seeded — run the roles insert (step 1.4). |
| Render log: SSL / `ECONNREFUSED` / timeout to Postgres | Use the **direct** Neon string with `sslmode=require`; check the Neon project isn't suspended. |
| First request very slow | Render free-tier cold start; upgrade or use an uptime pinger. |
| Live tracking never updates | Socket must reach the Render host (not Vercel); confirm `REACT_APP_API_BASE_URL` points at Render. |
| Reports page empty / errors | Ensure `schema.sql` ran fully — the `vehicle_operational_costs` view is required. |

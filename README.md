# FinMan

A personal finance tracker for a NoSQL Database course project. Paste a bank SMS or upload a bill photo, a Hugging Face model pulls out the transaction, you check the fields, and the dashboard charts your spending. Built on MongoDB, Express 5, React 19 and TypeScript.

The full write-up is in [docs/FinMan-Project-Report.docx](docs/FinMan-Project-Report.docx). The build plan is in [ROADMAP.md](ROADMAP.md).

## Setup

You need Node 24. For the database, use either a MongoDB Atlas cluster or the local one that `npm run db:local` starts. The AI parser needs a Hugging Face token with Inference Providers access; without one, entry still works through the regex fallback.

1. Copy `backend/.env.example` to `backend/.env` and fill it in. `JWT_SECRET` needs at least 32 random characters. `ADMIN_EMAIL` and `ADMIN_PASSWORD` become your login.
2. Start a database, then seed it:

```bash
cd backend
npm install
npm run db:local
```

In a second terminal:

```bash
cd backend
npm run seed -- --demo
npm run dev
```

3. Start the web app in a third terminal, then sign in with the admin email and password:

```bash
cd frontend
npm install
npm run dev
```

Vite serves on http://localhost:5173 (or the next free port) and proxies `/api` to the backend on port 4000.

## Docker

Compose runs three services: MongoDB as a one-node replica set (category renames need transactions), the API, and nginx serving the built web app. Nginx proxies `/api` to the API, so the browser stays on one origin and the session cookie works.

1. Copy `.env.example` to `.env` and fill it in. `JWT_SECRET` needs at least 32 random characters. `HF_TOKEN` must start with `hf_`. `ADMIN_EMAIL` and `ADMIN_PASSWORD` become your login.
2. From the repo root:

```bash
docker compose up --build
```

Open http://localhost:8080. Sign in with the admin username or email, or create an account. The API is also on http://localhost:4000 from the laptop itself. Startup creates the categories and the admin login. Add demo transactions once, after the stack is up:

```bash
docker compose exec backend node dist/scripts/seed.js --demo 60
```

Leave `COOKIE_SECURE=false` for this HTTP setup. Set it to `true` only when the site is served over HTTPS.

`docker compose down` stops the stack and keeps the database volume. `docker compose down -v` deletes that data.

## Portainer (Git stack)

Compose does not use `env_file: .env`, so a Git pull does not need a `.env` in the repo. Put the secrets in Portainer instead.

1. Edit stack settings → **Environment variables** → **Advanced mode**.
2. Paste the same keys as `.env.example`. At minimum:

```env
MONGODB_DB=finman
JWT_SECRET=replace-with-at-least-32-random-characters
ADMIN_EMAIL=admin@finman.com
ADMIN_PASSWORD=your-strong-password
CORS_ORIGIN=https://finman.aamoghtech.org
COOKIE_SECURE=true
WEB_PORT=8080
```

Use your real public origin for `CORS_ORIGIN`. Set `COOKIE_SECURE=true` when the site is HTTPS. Leave `HF_TOKEN` blank if you are fine with the regex SMS fallback.
3. Pull and redeploy the stack. Open the site on port `WEB_PORT` (or through your reverse proxy).

## Laptop server

Compose is the way to host FinMan on a personal laptop. MongoDB stays on the Docker network and is not published. Accounts, password hashes, and transactions all live in that database. Other devices on the same Wi-Fi open the web app; they never connect to MongoDB directly.

1. Install Docker Desktop and leave it running.
2. Copy `.env.example` to `.env`. Replace `JWT_SECRET` with at least 32 random characters of your own before anyone else can reach the machine. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`. `ADMIN_USERNAME` is optional; blank uses the part of the admin email before `@`.
3. From the repo root, `docker compose up --build -d`.
4. On the laptop, open http://localhost:8080.
5. On a phone or another computer on the same Wi-Fi, open `http://<laptop-ip>:8080`. On Windows, `ipconfig` shows the Wi-Fi IPv4 address. Change `WEB_PORT` in `.env` if 8080 is taken.
6. If that page does not load, allow inbound TCP 8080 in Windows Firewall.

Leave `COOKIE_SECURE=false` while the site is plain HTTP. Each account only sees its own transactions. Passwords are stored as a salted scrypt hash, never as the password itself. The containers come back when Docker starts, until you run `docker compose down`. Port 4000 is bound to the laptop only, for debugging the API.

From the repo root, `npm install` then `npm run dev` starts the API and the Vite app together without Docker. That still needs `backend/.env` and a database, as in Setup above.

## Commands

| Where | Command | What it does |
|---|---|---|
| root | `npm run dev` | API and Vite together |
| root | `npm run docker:up` | Build and start the Compose stack in the background |
| backend | `npm run db:local` | One-node MongoDB replica set on port 27017, data kept in `backend/.localdb` |
| backend | `npm run seed -- --demo 60` | Upserts categories and the login user, adds 60 fake transactions |
| backend | `npm run dev` | API with reload |
| backend | `npm test` | Unit and integration tests (in-memory MongoDB, Hugging Face faked) |
| backend | `npm run explain -- 5000` | Index scan against collection scan on 5,000 documents |
| backend | `npm run build` | Type-checks and compiles to `dist/` |
| frontend | `npm run build` | Type-checks and builds to `dist/` |

`api.http` has ready-made requests for the VS Code REST Client extension. Run the sign-in request first.

## Notes

- Sign-up is on the login screen. The seed script also creates or updates the admin login from `.env`, plus an optional demo account (`DEMO_EMAIL` / `DEMO_PASSWORD`). The demo password is weak on purpose, so remove those two lines before any real use. A new account gets its own transactions; categories stay a shared list.
- Passwords are hashed with scrypt. The API never returns the hash or the password.
- Every day is an IST day. Dates are stored in UTC and grouped with `timezone: "Asia/Kolkata"`.
- Using Atlas: if the cluster has been idle it pauses, so resume it from the Atlas page. If your IP changes (new Wi-Fi, hotspot), add it under Network Access.
- Renaming a category uses a multi-document transaction, which needs a replica set. Atlas and `npm run db:local` are both replica sets; a plain standalone `mongod` is not.

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

## Commands

| Where | Command | What it does |
|---|---|---|
| backend | `npm run db:local` | One-node MongoDB replica set on port 27017, data kept in `backend/.localdb` |
| backend | `npm run seed -- --demo 60` | Upserts categories and the login user, adds 60 fake transactions |
| backend | `npm run dev` | API with reload |
| backend | `npm test` | 36 unit and integration tests (in-memory MongoDB, Hugging Face faked) |
| backend | `npm run explain -- 5000` | Index scan against collection scan on 5,000 documents |
| backend | `npm run build` | Type-checks and compiles to `dist/` |
| frontend | `npm run build` | Type-checks and builds to `dist/` |

`api.http` has ready-made requests for the VS Code REST Client extension. Run the sign-in request first.

## Notes

- No sign-up. The seed script creates or updates the logins from `.env`: the admin account, plus an optional demo account (`DEMO_EMAIL` / `DEMO_PASSWORD`, set to `demo@gmail.com` / `demo123` locally for the viva). The demo password is weak on purpose, so remove those two lines before any real use.
- Every day is an IST day. Dates are stored in UTC and grouped with `timezone: "Asia/Kolkata"`.
- Using Atlas: if the cluster has been idle it pauses, so resume it from the Atlas page. If your IP changes (new Wi-Fi, hotspot), add it under Network Access.
- Renaming a category uses a multi-document transaction, which needs a replica set. Atlas and `npm run db:local` are both replica sets; a plain standalone `mongod` is not.

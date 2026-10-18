# FinMan — NoSQL Course Evaluation Report

Shareable project brief for the team. Everything below is written from the running FinMan codebase (MongoDB, Express 5, React 19, TypeScript). Use it for the written submission, the live demo, and the viva. Each person should be able to explain the section they present without reading from this file.

**Project:** FinMan — personal finance tracker  
**Database:** MongoDB (document store), accessed with Mongoose  
**Application:** React web app + Express API  
**Date of this write-up:** 17 October 2026

---

## How to use this file

1. Read sections 1–8 in order. They follow the eight evaluation criteria exactly.
2. The demo script and viva answers at the end are the spoken version of the same material.
3. Do not invent numbers. Test counts and explain plans below come from `docs/test-results.txt` and `docs/explain-results.txt`.
4. The plagiarism report is a separate file the college tool produces. This document does not replace it. Attach the original PDF or printout with the submission.
5. Passwords, connection strings, and Hugging Face tokens stay in `backend/.env`. Never paste them into a report, slide, or chat.

---

## Project snapshot

A user pastes an Indian bank SMS or uploads a bill photo. A language model extracts the amount, merchant, date, category, and payment method. The user checks the fields, then saves the transaction. The dashboard charts spending by day and by category. History supports filter, search, edit, and delete. Categories can be renamed safely across every stored transaction.

| Layer | Choice |
|---|---|
| Database | MongoDB 8 (Atlas, or a local one-node replica set) |
| ODM | Mongoose 9 |
| API | Express 5, TypeScript, Zod validation |
| Frontend | React 19, Vite, React Router, Recharts |
| Auth | JWT in an httpOnly cookie, passwords hashed with scrypt |
| AI parse | Hugging Face chat model, with a regex fallback if the model is down |

Collections: `transactions`, `categories`, `users`, `parselogs`.

---

## 1. Problem identification and real-world relevance

### Problem

People in India receive a stream of bank SMS, UPI alerts, and paper or photo bills. The messages are unstructured text. Amounts use `Rs.`, `INR`, and commas. Dates appear as `23-08-26`, `05Oct26`, or `2026-09-14 18:22:10`. The same person pays by UPI, card, cash, net banking, and wallet, and each method carries different extra fields (UPI reference, card last four digits, bill line items). Spreadsheets and memory do not answer simple questions: what did I spend today, which category is largest this month, did I already save this SMS?

### Why it is a real problem

- Bank SMS are the default receipt for UPI and card spends in India.
- A relational expense app forces one wide table of mostly empty columns, or several extra tables, for fields that only some payments have.
- Duplicate pastes are common: the same SMS saved twice inflates the month total.
- “Today” must mean an India Standard Time day. A spend at 00:30 IST is still that calendar date, not the previous UTC date.

### Objectives

1. Turn an SMS or bill into a checked, stored transaction.
2. Persist every create, read, update, and delete in MongoDB.
3. Show spending over time and by category for a chosen range.
4. Stop the same message from being saved twice.
5. Keep working when the language model is unavailable.

### Scope

In scope: one household-style login created by the seed script, transaction CRUD, category CRUD with rename, dashboard analytics, CSV and JSON export, SMS parse, bill-photo parse, duplicate detection, session login.

Out of scope, and we should say this in the viva: public sign-up, per-user data isolation (the API is locked behind login, but documents are not tagged with a `userId`), bank API integration, multi-currency, and production hosting. Adding users later means a `userId` on every transaction, that field as the first key of every index, and a filter on every query.

### Objectives mapped to features

| Objective | Where it shows up |
|---|---|
| Capture unstructured spends | Add Entry: paste SMS, upload bill, or type manually |
| Correct, persistent records | `transactions` collection, CRUD API |
| See patterns | Dashboard: today, month donut, 7/30/90-day bars, month summary |
| No double counting | Partial unique index on `dedupeHash`, HTTP 409 |
| Usable when AI is down | Regex fallback fills amount and direction; user still confirms every field |

---

## 2. NoSQL database selection and justification

### Choice

MongoDB, a document database. The app talks to it through Mongoose. Development can use MongoDB Atlas (free M0, AWS Mumbai `ap-south-1`) or `npm run db:local`, which starts a one-node replica set on port 27017. A replica set is required because category rename uses a multi-document transaction. A plain standalone `mongod` cannot do that.

### Why NoSQL instead of a relational database

The core record is one spend, but the extra facts change with the payment method. A UPI row needs `upiRef`, `vpa`, `bank`, `accountLast4`. A card row needs `cardLast4` and `cardType`. A bill needs `invoiceNumber`, `subtotal`, `tax`, and an `items` array. Those shapes live in one `details` field of type Mixed, inside the same `transactions` collection. A SQL design would need many nullable columns, or a separate table per method plus joins on every history read.

Other reasons this workload fits a document store:

- The history screen reads one transaction document and already has the category name. It does not join.
- Analytics are aggregation pipelines (`$match`, `$group`, `$lookup`, `$facet`), which MongoDB runs inside the database.
- A partial unique index enforces “this SMS was already saved” without a second table.
- A TTL index deletes AI parse logs after 30 days with no cleanup job.
- Access patterns are known up front (newest first, filter by category, filter debits in a date range), so compound indexes match those patterns.

### Why not the other NoSQL options

| Option | Why we did not pick it as the primary store |
|---|---|
| Redis | Excellent for cache and short-lived keys. Weak as the system of record for queryable spend history. |
| Firestore | Real-time listeners fit chat apps. Aggregations and multi-document transactions are a poorer fit for the charts and the category rename. |
| Cassandra | Built for huge write throughput and partition keys. Our queries are flexible filters and aggregations, not one partition-key lookup. |
| Neo4j | Graph traversal is the wrong tool. Spends are not a relationship network. |
| DynamoDB | Strong at key-value access on AWS. Ad-hoc date ranges, regex search, and `$lookup` are harder. |
| CouchDB | Document store, but the team needed aggregation pipelines, explain plans, and multi-document transactions, which MongoDB gives directly. |

### What we understand about MongoDB

- Documents are BSON. Dates are stored in UTC. Grouping passes `timezone: "Asia/Kolkata"`.
- Schema is enforced by the application (Mongoose + Zod), not by the server. `details` stays flexible on purpose.
- Indexes decide whether a query is an index scan (`IXSCAN`) or a collection scan (`COLLSCAN`).
- A multi-document transaction needs a replica set. Both Atlas and the local database are replica sets.
- Duplicate-key errors surface as MongoDB code `11000`. The API turns the dedupe case into HTTP 409.

---

## 3. Database design and data modeling

### Collections

```
finman
├── transactions    one document per spend or credit
├── categories      name + chart color, unique name
├── users           email + scrypt password hash
└── parselogs       one row per AI parse, deleted after 30 days by TTL
```

### Transaction document

Common fields (every payment has these):

| Field | Type | Role |
|---|---|---|
| `amount` | Number | Rupees, minimum 0.01, rounded to 2 decimals on input |
| `direction` | `"debit"` or `"credit"` | Charts sum debits only |
| `merchant` | String | Payee or shop |
| `occurredAt` | Date | Single timestamp. Replaces separate date and time strings so range queries work |
| `description` | String | Short note |
| `category` | String | Denormalized category name |
| `paymentMethod` | Enum | UPI, Card, Cash, NetBanking, Wallet, Other |
| `source` | Enum | sms, text, bill, manual |
| `aiParsed` | Boolean | True when the model filled fields |
| `details` | Mixed object | Method-specific extras. Empty object kept (`minimize: false`) |
| `rawInput` | String | Original SMS, when there is one |
| `dedupeHash` | String | SHA-256 of the normalized SMS. Absent for manual entries |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

`details` shapes (keys are optional):

| When | Keys |
|---|---|
| UPI | `upiRef`, `vpa`, `bank`, `accountLast4` |
| Card | `cardLast4`, `bank`, `cardType` |
| Bill | `invoiceNumber`, `subtotal`, `tax`, `items: [{ name, qty, price }]`, `fileName` |
| Anything else | `{}` |

Example (UPI debit). `2026-08-23T14:12:00.000Z` is 19:42 IST. MongoDB stores UTC.

```json
{
  "amount": 850,
  "direction": "debit",
  "merchant": "Swiggy",
  "occurredAt": "2026-08-23T14:12:00.000Z",
  "description": "Food order",
  "category": "Food",
  "paymentMethod": "UPI",
  "source": "sms",
  "aiParsed": true,
  "details": { "upiRef": "523614789012", "vpa": "swiggy@icici", "accountLast4": "4521" },
  "rawInput": "Rs.850.00 debited from A/c XX4521 ...",
  "dedupeHash": "<sha256 hex>"
}
```

A card spend in the same collection has `details.cardLast4` instead of `details.upiRef`. A bill has `details.items` as an array. No migration, no extra tables.

### Category document

`name` (unique, trimmed) and `color` (hex, used by every chart). Default seed: Food, Groceries, Transport, Shopping, Bills & Utilities, Entertainment, Health, Education, Rent, Travel, Transfers, Other.

### Denormalization and the cost

Each transaction stores the category **name**, not an ObjectId. The history list never joins. The analytics pipeline uses `$lookup` only to attach the color.

The cost: renaming “Food” to “Dining” must update the category document and every transaction that copied the old name. That is done in one multi-document transaction. If the new name already exists, the whole transaction rolls back and nothing changes. A category that still has transactions cannot be deleted (HTTP 409).

### User document

`email` (unique, lowercased), `passwordHash` (`salt:hash` from scrypt), `lastLoginAt`. There is no public registration. `npm run seed` upserts the accounts from `.env`.

### Parse log document

`model`, `kind` (`text` or `image`), `ok`, `ms`, `createdAt`. A TTL index on `createdAt` expires documents after 30 days (`expireAfterSeconds`). The parser-stats query only ever sees the last 30 days, by design.

### Indexes (access patterns)

| Index | Serves |
|---|---|
| `{ occurredAt: -1 }` | History, newest first |
| `{ direction: 1, occurredAt: -1 }` | Analytics: equality on direction, then a date range |
| `{ category: 1, occurredAt: -1 }` | History filtered by category, newest first |
| `{ dedupeHash: 1 }` unique, partial | Duplicate SMS. The filter is `{ dedupeHash: { $type: "string" } }`, so manual entries with no hash are not indexed |
| `{ createdAt: 1 }` TTL on `parselogs` | Automatic deletion after 30 days |
| Unique `name` on categories, unique `email` on users | One row per name, one row per login |

Index order follows the equality-then-range rule. `{ direction: 1, occurredAt: -1 }` puts the equality field (`direction: "debit"`) before the range field (`occurredAt`). The reverse order would not serve the analytics query as well.

### Scalability notes we can defend

- List queries are paginated (`page`, `limit` max 100) with a stable sort (`occurredAt`, then `_id`).
- Analytics reject ranges longer than 366 days so the zero-fill loop stays small.
- The flexible `details` object means new payment methods do not require a migration.
- Known limit: documents are not sharded and are not scoped by user. That is acceptable for a single-user course project and is the first change for a real multi-user deployment.

---

## 4. NoSQL implementation and CRUD operations

All writes go through Mongoose models and stay in MongoDB after the process restarts. The API returns the saved document (or 204 on delete). A malformed id is HTTP 400 (`CastError`). A missing id is HTTP 404.

### Transactions

| Action | Method and path | Database call | Success |
|---|---|---|---|
| Create | `POST /api/entries` | `Transaction.create` | 201 and the document |
| Read list | `GET /api/entries` | `find` + `countDocuments` | 200 `{ items, total, page, pages }` |
| Read one | `GET /api/entries/:id` | `findById` | 200 document |
| Update | `PUT /api/entries/:id` | `findByIdAndUpdate` with `runValidators: true` | 200 updated document |
| Delete | `DELETE /api/entries/:id` | `findByIdAndDelete` | 204 |

List filters: IST date range (`from`, `to`), exact category, case-insensitive search on merchant or description. Search text is escaped before it becomes a regular expression, so a character like `(` cannot crash the query.

Create checks that the category exists, hashes `rawInput` when present, and stores `dedupeHash`. A second save of the same SMS (even with different spacing or case) hits the unique index and returns 409 “This transaction was already saved”. Manual entries omit the hash, so they are never treated as duplicates of each other.

Update replaces the validated body. It does not recompute `dedupeHash`, so editing a field does not accidentally collide with another SMS.

### Categories

| Action | Method and path | Notes |
|---|---|---|
| Create | `POST /api/categories` | Name and hex color. Duplicate name is 409 |
| Read | `GET /api/categories` | Each category includes `transactionCount` from a `$group` |
| Update | `PATCH /api/categories/:name` | Color only, or rename inside a transaction |
| Delete | `DELETE /api/categories/:name` | Blocked with 409 while any transaction still uses the name |

### Users (limited CRUD)

Seed upserts the login user. `POST /api/auth/login` reads the user, checks the password, and sets `lastLoginAt`. There is no public create-user endpoint.

### Parse logs (create + read)

Every parse inserts one `parselogs` document. `GET /api/analytics/parser` aggregates those rows by model. Delete is the TTL monitor, not an API call.

### Seed

`npm run seed` upserts categories and the login user. `npm run seed -- --demo 60` also inserts demo transactions. Re-running the seed does not duplicate categories, because it uses `bulkWrite` upserts on the unique name.

---

## 5. Advanced features and query optimization

### Aggregation pipelines

**Daily spending** (`GET /api/analytics/daily`):

1. `$match` debits whose `occurredAt` falls in the IST range.
2. `$group` by calendar day using `$dateToString` with `timezone: "Asia/Kolkata"`.
3. `$project` rounds the total to 2 decimals.
4. The application then fills missing days with `{ total: 0 }` so the chart shows gaps.

One IST day is half-open in UTC. For 5 October 2026 the range is `2026-10-04T18:30:00.000Z` inclusive to `2026-10-05T18:30:00.000Z` exclusive. Credits are excluded from the spending charts.

**Category breakdown** (`GET /api/analytics/categories`):

1. `$match` the same debit range.
2. `$group` by category name.
3. `$lookup` into `categories` on the name to fetch the color.
4. `$project` uses `$ifNull` so a missing color becomes grey `#9ca3af`.
5. `$sort` by total descending.

The sum of category totals equals the sum of daily totals for the same range. A mismatch would mean a timezone bug. A test locks this.

**Month summary** (`GET /api/analytics/summary`) uses `$facet` so one round trip returns:

- debit and credit totals
- spend by payment method
- top 5 merchants
- the single largest debit
- the share of rows that were AI-parsed
- average debit per day

**Parser stats** group the TTL log by model and return run count, success rate, and average milliseconds.

### Index proof (5,000 documents)

Command: `npm run explain -- 5000` in `backend/`. It loads 5,000 transactions into a separate database, runs each query with the index, then forces a collection scan and compares. Captured results:

History, one category, newest first, page 1:

| Plan | Stages | Returned | Keys examined | Docs examined | ms |
|---|---|---|---|---|---|
| With index | LIMIT > FETCH > IXSCAN | 20 | 20 | 20 | 0 |
| Without index | SORT > COLLSCAN | 20 | 0 | 5,000 | 21 |

Analytics match, debits in the last 30 days:

| Plan | Stages | Returned | Keys examined | Docs examined | ms |
|---|---|---|---|---|---|
| With index | FETCH > IXSCAN | 369 | 369 | 369 | 2 |
| Without index | COLLSCAN | 369 | 0 | 5,000 | 3 |

The history index examines 20 documents to return 20. The scan examines all 5,000. The analytics test also asserts the query planner picks the compound index rather than a collection scan.

### Transactions

`PATCH /api/categories/:name` starts a MongoDB session and calls `session.withTransaction`. Inside it:

1. Load the category.
2. If the new name is taken, throw 409.
3. `updateMany` every transaction that stored the old name.
4. Save the category.

Tests cover both outcomes: a successful rename updates both collections, and a colliding name rolls back so neither collection changes.

### TTL

`parselogs.createdAt` has `expireAfterSeconds` set to 30 days. MongoDB’s TTL monitor deletes old rows. No cron job.

### Partial unique index

```text
{ dedupeHash: 1 }, unique, partialFilterExpression: { dedupeHash: { $type: "string" } }
```

Documents without a string `dedupeHash` are ignored. A sparse index would be wrong if any code stored `null`. Normalization before hashing: trim, collapse whitespace, lowercase. “Rs. 850” and “rs.  850” are the same message.

### Other database-specific behavior

- `strictQuery` is on.
- Schema validators run on update only because the controller passes `runValidators: true`.
- Duplicate key `11000` is mapped to 409.
- Bill images are not stored. The file name may be copied into `details.fileName`. Two photos can share a name, so bills skip duplicate detection.

---

## 6. Application integration and functionality

### Architecture

```
Browser (React, port 5173)
    │  fetch /api  (Vite proxies to port 4000 in development)
    ▼
Express API
    ├── helmet, CORS with credentials, JSON body limit 1 MB
    ├── rate limits on login and on parse
    ├── JWT cookie check on every route except health and login
    ├── Zod validation, then Mongoose
    └── MongoDB
```

The browser never holds the database URI or the Hugging Face token. Vite would ship any `VITE_` variable to the client, so secrets stay on the server.

### Screens

| Route | What the user does |
|---|---|
| Login | Email and password. Wrong password returns one message and does not reveal which part failed |
| `/` Dashboard | Today’s spend, category donut for a month, spending bars for 7/30/90 days, month insights |
| `/add` | Paste SMS, upload a bill image or text file, or enter manually. Review fields, then save |
| `/history` | Filter by date and category, search, page, edit, delete. Filters live in the URL |
| `/history/:id/edit` | Load one document, save changes, return to the same filtered history |
| `/categories` | Add, recolor, rename, delete |

### End-to-end flows to show

1. **SMS to chart.** Paste a debit SMS, parse, correct any empty field, save. The new row appears in History and in the dashboard totals.
2. **Duplicate.** Paste the same SMS again. The UI shows that it was already saved (409).
3. **Not a transaction.** Paste an OTP. The parser sets `isTransaction: false` and does not offer a silent save.
4. **Manual entry.** Save with no AI fields. `aiParsed` is false and there is no dedupe hash.
5. **Edit and delete.** Change an amount. Dashboard totals follow. Delete asks for confirmation, then the row is gone.
6. **Rename category.** Rename a category that has transactions. History and charts show the new name. The count of updated transactions comes back from the API.
7. **Export.** Download CSV and JSON for the current data. CSV is prefixed with a byte-order mark so Excel reads UTF-8, and cells that start with `=` are neutralized so they are not formulas.
8. **AI down.** A bad token still returns HTTP 200 with a warning and a regex amount. The user fills the rest.

### Error handling

Every error is `{ error: { message, details? } }`. The UI surfaces that message. Network failure shows that the server could not be reached. Buttons that send a request are disabled while the request is in flight, which blocks double saves. Loading, empty, and error states exist on the main screens. Unknown API paths return JSON 404, not an HTML page.

### Parser integration

`POST /api/parse` accepts text up to 5,000 characters. `POST /api/parse/file` accepts jpeg, png, webp, or plain text, up to 5 MB, via multer memory storage. The image goes to the vision model as a data URL and is not written to disk or to MongoDB. If the vision model is not configured, the API tells the user to paste the bill text instead. The model reply is parsed leniently: one bad field becomes null instead of discarding the whole result. A non-JSON reply is retried once, then the regex fallback runs.

---

## 7. Testing, security, and data validation

### Automated tests

`cd backend && npm test` runs Node’s test runner against an in-memory MongoDB. Hugging Face is faked. Latest recorded run (`docs/test-results.txt`): **36 passed, 0 failed**, 8 suites.

| Suite | What it proves |
|---|---|
| authentication | No cookie means 401. Wrong password is rejected without saying whether the email exists. Login sets an httpOnly cookie that unlocks the API. A tampered token is rejected |
| entries CRUD | Create rounds the amount and returns 201. List filters, search, and pagination work. Update validates. Delete then read is 404. Bad id is 400, unknown id is 404 |
| input validation | Negative amount, zero, future date, unknown category, and bad payment method are rejected |
| duplicate detection | Same message with different spacing or case is rejected. Manual entries without raw text are not duplicates |
| analytics aggregations | Daily totals use IST days, fill empty days, and ignore credits. Category totals match daily totals. `$facet` summary returns totals, merchants, and methods. Ranges over a year are refused. The analytics query uses the compound index |
| category rename | Rename updates the category and every copied name. A colliding rename rolls back both collections. A category in use cannot be deleted. An unused one can |
| AI parser | A good reply fills fields and writes a TTL log row. An invented category is dropped. Garbage gets one retry, then the regex amount. A rejected token is a warning, not a 500. OTP messages are not transactions. Parser stats group by model |
| export | CSV has a byte-order mark, the header row, and formula escaping |
| unit checks | JSON extraction from fenced model output, lenient AI schema, CSV escaping, IST day bounds, regex fallback |

### Validation (before the database)

Zod checks request bodies and query strings:

- Amount must be positive and at most 1,00,00,000, then rounded to 2 decimals (`12.345` becomes `12.35`).
- `occurredAt` cannot be more than one day in the future (one day of slack for clock skew).
- Merchant ≤ 120 characters, description ≤ 500, raw text ≤ 5,000, search ≤ 100.
- Direction, payment method, and source must be one of the enums.
- Category must already exist in `categories`.
- Date query parameters must be `YYYY-MM-DD`, and `from` must not be after `to`.
- Category color must be a `#rrggbb` hex value.
- Uploaded files must be an allowed type and at most 5 MB.

Mongoose repeats the important constraints (`required`, `min`, enums) so a buggy caller cannot bypass them. Updates pass `runValidators: true`.

### Security

| Control | Implementation |
|---|---|
| Authentication | JWT signed with `JWT_SECRET` (at least 32 characters), 12-hour expiry, sent as cookie `finman_token` |
| Cookie flags | `httpOnly` (page scripts cannot read it), `sameSite: lax`, `secure` in production |
| Password storage | scrypt with a random 16-byte salt, stored as `salt:hash`. Comparison uses `timingSafeEqual` |
| Login privacy | One error message for unknown email and wrong password |
| Session check | Every `/api` route except health and login requires a valid cookie |
| Brute force | Login limited to 10 attempts per 15 minutes. Parse limited to 20 per minute |
| Headers | `helmet` |
| CORS | Configured origin, credentials allowed so the cookie is sent |
| Body size | JSON limited to 1 MB |
| NoSQL / regex injection | Search text is escaped. Bodies are parsed by Zod, not concatenated into queries |
| CSV injection | Cells starting with `=`, `+`, `-`, `@`, or whitespace are prefixed so Excel does not run them |
| Secrets | `.env` is gitignored. The token and the MongoDB URI never go to the browser |
| Duplicate responses | 409 does not leak other users’ document contents |

Honest limits for the viva: this is application-level security for a course project, not a bank. There is no public registration, no per-document `userId` filter, no field-level encryption, and no audit log beyond `createdAt` / `updatedAt` / `lastLoginAt`. The demo password in `.env` is weak on purpose and must be removed before any real use.

### Manual checks before the demo

| Area | Check |
|---|---|
| Parse | Sample SMS in `samples/sms.txt`, including the OTP |
| Parse offline | Wrong token: warning shown, amount still filled |
| Duplicate | Same SMS twice returns 409 |
| Manual | Saves with `aiParsed: false` |
| Edit / delete | Dashboard updates; confirm dialog; empty last page steps back |
| Filters | Date, category, search, paging; refresh keeps the URL |
| Charts | Empty month, single entry, 90-day range |
| Export | JSON parses; CSV opens with the rupee symbol |
| Upload | Bill photo; oversized file; wrong type |
| Narrow screen | About 375 px wide: layout holds, table can scroll sideways |

---

## 8. Live demonstration, viva, and documentation

### Five-minute demo script

Have the API and the web app already running, and be signed in. If Atlas is used, resume the cluster and confirm the current IP is allowed before walking into the room. Keep a phone hotspot IP on the Atlas access list as a backup. A screen recording from the night before covers a network failure.

1. **Dashboard.** Point at today’s total, the month donut, and the 30-day bars. Mention that debits are summed and days are IST.
2. **Add from SMS.** Paste a UPI debit. Show the AI badges and any field the model left empty. Fill it and save.
3. **Duplicate.** Paste that same SMS again. Show the “already saved” message.
4. **OTP.** Paste an OTP. Show that it is rejected as not a transaction.
5. **Bill (if the vision model is configured).** Upload a photo, open extra details, show line items in `details`.
6. **History.** Filter one category, edit an amount, delete one row, return to the dashboard and show the total changed.
7. **Categories.** Rename one category and state that a transaction updated both collections or rolled both back.
8. **Export.** Download the CSV.
9. **Database proof.** In Compass or the explain output: three `details` shapes side by side, then the IXSCAN numbers (20 docs examined vs 5,000).

### What each person should be able to answer

Split the viva by criterion, not by file. Anyone can be asked any question.

| If they ask | Say this |
|---|---|
| Why MongoDB, not SQL? | Payment extras differ by method. One collection with a Mixed `details` object avoids nullable columns and extra tables. History reads a single document. Aggregations, a partial unique index, TTL, and multi-document transactions are all used for real features. |
| Why copy the category name? | The list screen is the hot path and should not join. Color is the only reason to `$lookup`. Rename pays the cost inside a transaction. |
| Why is the compound index `{ direction, occurredAt }` in that order? | Equality field first, range field second. The analytics `$match` is `direction: "debit"` plus a date range. |
| What do the explain numbers mean? | With the index, history touches 20 keys and 20 docs to return 20 rows. Without it, MongoDB sorts a full scan of 5,000 docs. |
| What if the model returns garbage? | Extract the JSON object, validate leniently, retry once, then regex the amount and direction. The user still confirms every field before save. The API returns 200 with warnings, not a crash. |
| How do timezones work? | Stored in UTC. “One IST day” is `[previous day 18:30Z, that day 18:30Z)`. Grouping passes `Asia/Kolkata`. |
| How does duplicate detection work? | SHA-256 of the normalized SMS, partial unique index, duplicate key mapped to 409. Manual rows have no hash. |
| What is the transaction around rename? | Two collections must change together. `withTransaction` commits both or rolls both back. Tested with a name collision. |
| How is the password stored? | scrypt hash and salt, not the password. The session is a JWT in an httpOnly cookie. |
| How would you add multiple users? | `userId` on every transaction, first key of every index, filter on every query, and real registration. We did not do that; login currently protects the whole API. |
| What does TTL buy? | Parse logs older than 30 days disappear without a scheduled job. Stats stay cheap. |

### Documentation set to submit

| Item | Where |
|---|---|
| This evaluation report | `docs/FinMan-Evaluation-Report.md` |
| Setup and commands | `README.md` |
| Build plan (historical) | `ROADMAP.md` |
| Test evidence | `docs/test-results.txt` (36 passed) |
| Index evidence | `docs/explain-results.txt` |
| Sample messages | `samples/sms.txt` |
| Plagiarism report | Generated by the college tool on the final PDF/DOCX. Attach the original. Do not type a fake similarity percentage into this file. |

Suggested written-report outline if the college also wants a DOCX:

1. Title, team, course, date
2. Problem, objectives, scope (section 1)
3. Why MongoDB (section 2)
4. Schema diagrams and example documents (section 3)
5. CRUD screenshots and API table (section 4)
6. Pipelines, index definitions, explain screenshots (section 5)
7. Architecture and screen flow (section 6)
8. Test table and security controls (section 7)
9. Demo steps (section 8)
10. Limits and future work (`userId`, hosting)
11. References (MongoDB manual pages for indexes, aggregation, transactions, TTL)
12. Plagiarism report attached as the last pages

### Run the demo from a clean machine

Requirements: Node 24, npm, a MongoDB replica set.

```bash
cd backend
npm install
npm run db:local
```

Second terminal:

```bash
cd backend
npm run seed -- --demo
npm run dev
```

Third terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (default `http://localhost:5173`) and sign in with the admin email and password from `backend/.env`. Health check: `GET http://localhost:4000/api/health` returns `{ "ok": true, "db": true }`.

Useful commands:

| Command | Result |
|---|---|
| `npm test` (in `backend/`) | 36 unit and integration tests |
| `npm run explain -- 5000` | Index scan vs collection scan |
| `npm run build` in both apps | Type-check and compile |

---

## API reference (quick)

| Method | Path | Auth | Success |
|---|---|---|---|
| GET | `/api/health` | No | `{ ok, db }` |
| POST | `/api/auth/login` | No | Sets cookie, returns `{ email }` |
| POST | `/api/auth/logout` | No | 204, clears cookie |
| GET | `/api/auth/me` | Yes | `{ email }` |
| GET | `/api/categories` | Yes | Categories plus `transactionCount` |
| POST | `/api/categories` | Yes | 201 |
| PATCH | `/api/categories/:name` | Yes | Updated category and `transactionsUpdated` |
| DELETE | `/api/categories/:name` | Yes | 204, or 409 if in use |
| POST | `/api/parse` | Yes | Parse result (200 even when AI fell back) |
| POST | `/api/parse/file` | Yes | Parse result |
| POST | `/api/entries` | Yes | 201 document |
| GET | `/api/entries` | Yes | Paginated list |
| GET | `/api/entries/:id` | Yes | Document |
| PUT | `/api/entries/:id` | Yes | Updated document |
| DELETE | `/api/entries/:id` | Yes | 204 |
| GET | `/api/analytics/daily` | Yes | `[{ day, total, count }]` |
| GET | `/api/analytics/categories` | Yes | `[{ category, total, count, color }]` |
| GET | `/api/analytics/summary` | Yes | `$facet` month summary |
| GET | `/api/analytics/parser` | Yes | Per-model parse stats |
| GET | `/api/export/json` | Yes | File download |
| GET | `/api/export/csv` | Yes | File download |

---

## Criterion checklist

Use this in the viva so every heading on the rubric is covered out loud.

| # | Criterion | Evidence in FinMan |
|---|---|---|
| 1 | Problem identification | Unstructured Indian bank SMS and bills; objectives and an honest scope |
| 2 | NoSQL selection | MongoDB document model justified against SQL and against other NoSQL stores |
| 3 | Data modeling | Four collections, Mixed `details`, denormalized category, indexes matched to access paths |
| 4 | CRUD | Full create/read/update/delete on transactions, persisted; category CRUD; tested |
| 5 | Advanced features | Aggregations, `$lookup`, `$facet`, compound indexes with explain proof, multi-document transactions, TTL, partial unique index |
| 6 | Application integration | React UI through an authenticated API, parse → review → save, charts, export, error states |
| 7 | Testing and security | 36 passing tests, Zod + Mongoose validation, JWT cookie, scrypt, rate limits, helmet |
| 8 | Demo, viva, documentation | Script above, answer table, this file, test and explain printouts, college plagiarism report attached separately |

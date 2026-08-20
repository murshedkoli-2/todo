# TaskFlow

A premium productivity and personal finance app built with **Next.js 14**, **MongoDB**, and **NextAuth**.

## Features

- ✅ **Tasks** — Status (To Do / In Progress / Completed / Overdue) and priority (Urgent → Low), in a
  dense list, a card grid, or a drag-and-drop status board
- 💵 **Task payments** — Total cost, paid so far, and payment method (Cash, bKash, Nagad, Rocket,
  Bank, Other). What is still due and whether the task is unpaid/partial/paid are **derived** from
  the two amounts, so a badge can never disagree with the figures beside it
- ⚡ **Quick add** — Capture a task in one line. `Send invoice friday !high` creates a task titled
  "Send invoice", due the coming Friday, at high priority
- ↩️ **Undo** — Status changes and completions are reversible from the toast that reports them
- ⌨️ **Keyboard-first** — `⌘K` palette that searches your actual tasks, `N` to capture, `/` to search,
  `G T` / `G L` / `G W` to move between sections, `?` for the full list
- 📒 **Ledger** — Track receivables and payables per person with running balance history
- 💰 **Wallet** — Monitor your cash, mobile banking (bKash, Nagad…), and bank account balances
- 🌗 **Light / Dark mode** — Defaults to light; persists user preference
- 🔐 **Auth** — Email/password with OTP email verification and JWT sessions
- 📷 **Image uploads** — Via ImgBB CDN for task attachments

---

## Quick-add syntax

The quick-add bar parses a single line into a task. Anything it does not recognise stays in the
title, and the preview under the field shows what will be created before you submit.

| You type | It means |
|----------|----------|
| `today`, `tonight`, `tomorrow`, `day after tomorrow` | Relative due date |
| `friday`, `mon`, `next friday` | The soonest matching weekday |
| `in 3 days`, `in 2 weeks` | Relative offset |
| `25 dec`, `dec 25`, `2027-03-09` | Calendar date, rolling to next year once past |
| `!urgent` `!high` `!medium` `!low` | Priority |
| `!1` `!2` `!3` `!4` | Priority, Todoist-style (`!1` is urgent) |

Only the first date and the first priority are consumed, so a task called
`Move tomorrow meeting to friday` keeps "meeting to friday" in its title.

---

## Task payments

A task records what the job is worth and what has come in against it. Everything else follows:

| Field | Meaning |
|-------|---------|
| **Total cost** | The full price of the job. This is what the old "Amount" field always held. |
| **Paid so far** | Received against that total. |
| **Payment method** | Cash, bKash, Nagad, Rocket, Bank transfer, Other. |
| Due | `total − paid`, never negative. Derived. |
| Status | `unpaid` / `partial` / `paid`. Derived. |

There is no payment-status selector: it was a third control the user had to keep in step by hand,
which is how a task came to read "৳13,500 · UNPAID" long after the money arrived. The service
derives the status on every write, so the stored value cannot drift from the amounts.

Tasks written before "paid so far" existed have their figure inferred from the total and the status
that was set by hand — a settled task had received its full total, an unpaid one nothing. A legacy
`partial` row is the one case that cannot be recovered, so it reports "Not recorded" and asks rather
than inventing a number. See `src/lib/payment.ts`.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Database | MongoDB Atlas + Mongoose |
| Auth | NextAuth v5 (beta) |
| Styling | Tailwind CSS + CSS variables |
| Email | Nodemailer (Gmail SMTP) |
| Images | ImgBB API |
| Deployment | Vercel (recommended) |

---

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd taskflow
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Fill in the values in `.env.local` — see the file for documentation on each variable.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Verify

```bash
npm run verify      # type-check + lint + unit tests with coverage + build
```

Or individually:

```bash
npm run type-check
npm run lint
npm run test:coverage
npm run test:e2e:public   # unauthenticated pages; no fixtures needed
```

The signed-in Playwright journey needs a verified account and is skipped unless `E2E_EMAIL` and
`E2E_PASSWORD` are set.

### 5. Build for Production

```bash
npm run build
npm run start
```

> **Every route renders per request.** `middleware.ts` issues a per-request CSP nonce, and a
> statically prerendered page has no nonce on its script tags — the browser blocks them all and the
> page never hydrates. `export const dynamic = "force-dynamic"` in `src/app/layout.tsx` prevents
> that; do not remove it without also removing the nonce.

---

## Deployment (Vercel)

1. Push your repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set all environment variables from `.env.local.example` in Vercel → Settings → Environment Variables
4. Set `NEXTAUTH_URL` to your production domain (e.g. `https://taskflow.vercel.app`)
5. Deploy ✓

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `NEXTAUTH_SECRET` | Random secret (`openssl rand -hex 32`) |
| `NEXTAUTH_URL` | Full public URL of your deployment |
| `GMAIL_USER` | Gmail address for OTP emails |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not your login password) |
| `IMGBB_API_KEY` | ImgBB API key for image uploads |
| `AUTH_PIN` | 4-digit admin PIN (optional) |

---

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes (auth, todos, ledger, wallet)
│   ├── ledger/        # Ledger page
│   ├── wallet/        # Wallet page
│   ├── tasks/         # Task detail pages
│   ├── login/         # Auth pages
│   ├── register/
│   └── layout.tsx
├── components/        # Shared UI components
│   ├── shell/         # App chrome: sidebar, palette, shortcuts
│   └── ui/            # Design-system primitives
├── hooks/             # useHotkeys, useFocusTrap, useMenu
├── lib/               # DB connection, types, money, dates, quick-add parser
│   ├── api/           # Route wrapper and error types
│   ├── dto/           # Document → JSON mappers
│   └── schemas/       # Zod schemas (single source of truth for domain types)
├── models/            # Mongoose models
└── server/services/   # Business logic, free of HTTP concerns
```

---

## License

MIT

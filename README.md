# TaskFlow

A premium productivity and personal finance app built with **Next.js 14**, **MongoDB**, and **NextAuth**.

## Features

- ✅ **Tasks** — Create, track, and manage todos with status (To Do / In Progress / Completed / Overdue)
- 📒 **Ledger** — Track receivables and payables per person with running balance history
- 💰 **Wallet** — Monitor your cash, mobile banking (bKash, Nagad…), and bank account balances
- 🌗 **Light / Dark mode** — Defaults to light; persists user preference
- 🔐 **Auth** — Email/password with OTP email verification and JWT sessions
- 📷 **Image uploads** — Via ImgBB CDN for task attachments

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

### 4. Type-check & Lint

```bash
npm run type-check
npm run lint
```

### 5. Build for Production

```bash
npm run build
npm run start
```

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
├── lib/               # DB connection, types, utilities
└── models/            # Mongoose models
```

---

## License

MIT

# 📝 TaskFlow — Modern Productivity & Task Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![NextAuth](https://img.shields.io/badge/Auth-NextAuth.js-purple?style=for-the-badge)](https://next-auth.js.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

A full-stack, enterprise-ready productivity and task lifecycle management web application built with **Next.js**, **TypeScript**, **MongoDB / Mongoose**, and **NextAuth.js**.

---

## 🌟 Features

- **📋 Task & Project Workspaces**: Organize tasks into projects, priority tiers (Low, Medium, High, Urgent), and status boards.
- **🔐 Multi-Provider Authentication**: Secure login via NextAuth.js supporting credentials, OAuth providers, and session persistence.
- **📬 Automated Email Alerts**: Transactional reminders and status updates delivered via Nodemailer.
- **🎯 Filter & Search**: Instant full-text filtering across active tasks, completed archives, and deadlines.
- **📱 Responsive & Accessible**: Optimized for mobile and desktop screens with seamless dark mode.

---

## 🛠️ Tech Stack

- **Frontend & Backend**: Next.js 15, React 19, TypeScript
- **Database**: MongoDB via Mongoose ODM
- **Authentication**: NextAuth.js with JWT session strategy
- **Notification**: Nodemailer SMTP integration

---

## 🚀 Getting Started

```bash
git clone https://github.com/murshedkoli-2/todo.git
cd todo
npm install

# Configure environment
cp .env.example .env
# Set MONGODB_URI, NEXTAUTH_SECRET, NEXTAUTH_URL

npm run dev
```

---

## 📄 License

Licensed under the [MIT License](LICENSE).

import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/themeScript";
import Providers from "@/components/Providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Display face, used only for page and section titles. One weight, latin
 * subset — roughly 15 KB, and the contrast it buys against Inter is what gives
 * the interface hierarchy without relying on size alone.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

/**
 * Every route renders per request.
 *
 * `middleware.ts` applies a nonce-based CSP with `strict-dynamic` and no
 * `unsafe-inline`. A nonce only exists once there is a request, so a
 * statically prerendered page ships HTML with no nonce on any of its script
 * tags — including the inline `self.__next_f` chunks React needs to hydrate —
 * and the browser blocks every one of them. The page then renders its server
 * markup and never becomes interactive.
 *
 * `/login`, `/register` and `/forgot-password` were prerendered and hit
 * exactly that: in a production build the login form never appeared, because
 * it sits behind a Suspense boundary that only resolves on the client. The
 * failure is invisible in `next dev`, which does not prerender and allows
 * `unsafe-inline`.
 *
 * Declaring it here rather than per page means a new route cannot reintroduce
 * the bug by being static without anyone noticing. Nothing is lost: middleware
 * already runs on every one of these routes, so none of them was cacheable.
 */
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e8ebfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c18" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "TaskFlow — Personal Finance & Task Dashboard",
  description:
    "Manage tasks, track receivables and payables, and monitor cash, mobile banking and bank balances in one place.",
  keywords: [
    "todo", "task manager", "productivity", "receivable", "payable",
    "ledger", "wallet", "personal finance", "dark mode", "light mode",
  ],
  authors: [{ name: "TaskFlow" }],
  robots: { index: true, follow: true },
  manifest: "/manifest.json",

  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [{ rel: "apple-touch-icon", url: "/apple-touch-icon.png" }],
  },

  appleWebApp: { capable: true, statusBarStyle: "default", title: "TaskFlow" },

  openGraph: {
    title: "TaskFlow — Personal Finance & Task Dashboard",
    description: "Manage tasks, ledger, and wallet in one place.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "TaskFlow — Personal Finance & Task Dashboard",
    description: "Manage tasks, ledger, and wallet in one place.",
  },

  formatDetection: { telephone: false },
  applicationName: "TaskFlow",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${instrumentSerif.variable} light`}>
      <body
        className="antialiased min-h-screen"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        {/*
          Must be the first node in <body>: React refuses to hydrate a <script>
          placed directly under <html>, and this has to run before first paint.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />

        <a href="#main-content" className="sr-only-focusable btn-primary absolute left-4 top-4 z-[90]">
          Skip to content
        </a>

        <Providers>{children}</Providers>

        <ServiceWorkerRegister />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}

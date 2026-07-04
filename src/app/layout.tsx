import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/* ── Viewport (theme-color lives here in Next 14) ─────────────────────────── */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4493f8" },
    { media: "(prefers-color-scheme: dark)",  color: "#1c2333" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

/* ── SEO + PWA metadata ────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: "TaskFlow — Personal Finance & Task Dashboard",
  description:
    "A premium productivity app to manage tasks, track receivables/payables, and monitor your personal finances. Supports dark & light mode.",
  keywords: [
    "todo", "task manager", "productivity", "receivable", "payable",
    "ledger", "wallet", "personal finance", "dark mode", "light mode",
  ],
  authors:    [{ name: "TaskFlow" }],
  robots:     { index: true, follow: true },
  manifest:   "/manifest.json",

  /* Icons */
  icons: {
    icon:     [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut:     "/favicon.ico",
    apple:        "/apple-touch-icon.png",
    other: [
      { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
    ],
  },

  /* Apple PWA meta */
  appleWebApp: {
    capable:           true,
    statusBarStyle:    "default",
    title:             "TaskFlow",
  },

  /* Open Graph */
  openGraph: {
    title:       "TaskFlow — Personal Finance & Task Dashboard",
    description: "Manage tasks, ledger, and wallet in one premium productivity app.",
    type:        "website",
    locale:      "en_US",
  },

  /* Twitter / X */
  twitter: {
    card:        "summary",
    title:       "TaskFlow — Personal Finance & Task Dashboard",
    description: "Manage tasks, ledger, and wallet in one premium productivity app.",
  },

  /* PWA: prevent "format detection" (turns phone numbers into links on iOS) */
  formatDetection: { telephone: false },

  /* Application name for mobile browsers */
  applicationName: "TaskFlow",
};

/**
 * Inline script runs before first paint to apply saved theme class.
 * Default is LIGHT — only adds `dark` class if previously stored as dark.
 * Prevents flash-of-wrong-theme (FOWT).
 */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark') {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  } catch(e) {
    document.documentElement.classList.add('light');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} light`}>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <body
        className="antialiased min-h-screen"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
      >
        <Providers>{children}</Providers>

        {/* PWA: service worker registration (invisible) */}
        <ServiceWorkerRegister />

        {/* PWA: "Add to Home Screen" install banner */}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}

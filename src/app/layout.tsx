import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaskFlow — Personal Finance & Task Dashboard",
  description:
    "A premium productivity app to manage tasks, track receivables/payables, and monitor your personal finances. Supports dark & light mode.",
  keywords: [
    "todo", "task manager", "productivity", "receivable", "payable",
    "ledger", "wallet", "personal finance", "dark mode", "light mode",
  ],
  authors: [{ name: "TaskFlow" }],
  robots: { index: true, follow: true },
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
  openGraph: {
    title: "TaskFlow — Personal Finance & Task Dashboard",
    description: "Manage tasks, ledger, and wallet in one premium productivity app.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "TaskFlow — Personal Finance & Task Dashboard",
    description: "Manage tasks, ledger, and wallet in one premium productivity app.",
  },
};

/**
 * Inline script runs before first paint to apply saved theme class.
 * Default is LIGHT — only adds `dark` class if previously stored as dark.
 * This prevents the flash-of-wrong-theme (FOWT) problem.
 */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark') {
      document.documentElement.classList.remove('light');
    } else {
      // Default: light mode
      document.documentElement.classList.add('light');
    }
  } catch(e) {
    // If localStorage is unavailable (e.g. private mode), default to light
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
      </body>
    </html>
  );
}

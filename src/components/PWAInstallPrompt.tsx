"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Shows a native-style "Add to Home Screen" banner on Android Chrome
 * and a manual instruction banner on iOS Safari (which doesn't support
 * the beforeinstallprompt event).
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed in this session
    const wasDismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) return;

    // Don't show if already installed (running as standalone PWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    // Detect iOS Safari
    const isIOS =
      /ipad|iphone|ipod/i.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
      // Delay slightly so it doesn't flash immediately
      const timer = setTimeout(() => setShowIOSBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop Chrome: listen for the native prompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowAndroidBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowAndroidBanner(false);
    setShowIOSBanner(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (dismissed) return null;

  // ── Android / Desktop Chrome banner ──────────────────────────────────────
  if (showAndroidBanner) {
    return (
      <div
        className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 animate-fade-in-up"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-modal)",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(68,147,248,0.15)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="TaskFlow" className="w-9 h-9 rounded-lg" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
            Install TaskFlow
          </p>
          <p className="text-xs leading-tight mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Add to home screen for quick access
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs font-medium px-2 py-1.5 rounded-lg"
            style={{ color: "var(--text-muted)" }}
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="btn-primary text-xs py-1.5 px-3"
          >
            Install
          </button>
        </div>
      </div>
    );
  }

  // ── iOS Safari instruction banner ─────────────────────────────────────────
  if (showIOSBanner) {
    return (
      <div
        className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl px-4 py-4 animate-fade-in-up"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-modal)",
          maxWidth: "400px",
          margin: "0 auto",
        }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="TaskFlow" className="w-8 h-8 rounded-lg flex-shrink-0" />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Install TaskFlow
            </p>
          </div>
          <button onClick={handleDismiss} style={{ color: "var(--text-muted)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(68,147,248,0.12)" }}>
              <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>1</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Tap the <strong>Share</strong> button{" "}
              <svg className="inline w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ verticalAlign: "middle" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>{" "}
              in Safari
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(68,147,248,0.12)" }}>
              <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>2</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Scroll down and tap <strong>Add to Home Screen</strong>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(63,185,80,0.12)" }}>
              <span className="text-xs font-bold" style={{ color: "#3fb950" }}>✓</span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Tap <strong>Add</strong> — done!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

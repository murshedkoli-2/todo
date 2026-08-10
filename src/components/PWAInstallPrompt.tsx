"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/ui/icons";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const IOS_BANNER_DELAY_MS = 3000;

/**
 * "Add to home screen" banner: the native prompt on Chromium, manual
 * instructions on iOS Safari (which has no `beforeinstallprompt` event).
 * Sits above the mobile tab bar so it never covers navigation.
 */
export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [variant, setVariant] = useState<"none" | "native" | "ios">("none");

  useEffect(() => {
    if (sessionStorage.getItem("pwa-banner-dismissed")) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    const isIOS =
      /ipad|iphone|ipod/i.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
      const timer = setTimeout(() => setVariant("ios"), IOS_BANNER_DELAY_MS);
      return () => clearTimeout(timer);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVariant("native");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVariant("none");
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setVariant("none");
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  if (variant === "none") return null;

  return (
    <div
      className="fixed bottom-20 lg:bottom-5 left-4 right-4 z-40 mx-auto rounded-card px-4 py-3.5 animate-fade-in-up"
      style={{
        maxWidth: "460px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-modal)",
      }}
      role="dialog"
      aria-label="Install TaskFlow"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-well flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Install TaskFlow
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {variant === "native"
              ? "Add it to your home screen for one-tap access."
              : "Tap Share in Safari, then “Add to Home Screen”."}
          </p>

          {variant === "native" && (
            <div className="flex items-center gap-2 mt-3">
              <button onClick={handleInstall} className="btn-primary !h-9 px-4 text-xs">
                Install
              </button>
              <button onClick={handleDismiss} className="btn-ghost !h-9 text-xs">
                Not now
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="btn-ghost w-8 h-8 px-0 flex-shrink-0"
          aria-label="Dismiss"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

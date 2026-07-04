/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Image optimization ────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "ibb.co" },
      { protocol: "https", hostname: "**.ibb.co" },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
  },

  // ── Compiler ──────────────────────────────────────────────────────
  compiler: {
    // Remove console.log in production (keep warn/error)
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["warn", "error"] }
      : false,
  },

  // ── HTTP headers ──────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options",         value: "DENY" },
          { key: "X-XSS-Protection",        value: "1; mode=block" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Cache images
        source: "/:path*.{png,jpg,jpeg,gif,svg,ico,webp,avif}",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },

  // ── Redirects ─────────────────────────────────────────────────────
  async redirects() {
    return [
      // Redirect /dashboard → / (in case old links exist)
      {
        source: "/dashboard",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // ── Bundle analyzer (set ANALYZE=true to enable) ─────────────────
  // Uncomment and run: ANALYZE=true npm run build
  // ...(process.env.ANALYZE === "true"
  //   ? { ...(await import("@next/bundle-analyzer")({ enabled: true })({})) }
  //   : {}),

  // ── Logging ───────────────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // ── TypeScript / ESLint (strict in CI, lenient in local) ─────────
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;

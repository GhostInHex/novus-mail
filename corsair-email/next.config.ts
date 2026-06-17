import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Pragmatic CSP. `'unsafe-inline'` is required for the next-themes pre-paint
// script and Next's inline bootstrap; dev additionally needs `'unsafe-eval'`
// for Turbopack/React Refresh. Tightening toward nonce + `strict-dynamic` is a
// reasonable follow-up (see docs/deployment-checklist.md).
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Same-origin SSE (/api/stream) + dev websocket for HMR.
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "form-action 'self'",
]
  .join("; ")
  .concat(";");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "corsair",
    "@corsair-dev/gmail",
    "@corsair-dev/googlecalendar",
    "postgres",
  ],
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

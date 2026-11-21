import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/http/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        // A CSP (com nonce por requisição) é definida no Proxy: src/lib/supabase/proxy.ts.
        headers: securityHeaders(),
      },
    ];
  },
};

export default nextConfig;

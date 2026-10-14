import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The PDF route reads the Thai font files from disk at runtime
  outputFileTracingIncludes: {
    "/api/bookings/*/pdf": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;

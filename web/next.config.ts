import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Production builds use a separate directory so standalone output
  // never corrupts the dev server's .next/ cache
  ...(isDev ? {} : { output: "standalone", distDir: ".next-prod" }),
};

export default nextConfig;

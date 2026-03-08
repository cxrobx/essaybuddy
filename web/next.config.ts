import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // standalone causes .next cache corruption and HMR chunk errors during local dev
  ...(isDev ? {} : { output: "standalone" }),
};

export default nextConfig;

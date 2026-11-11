import type { NextConfig } from "next";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "/vorthos").replace(
  /\/$/,
  "",
);
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  experimental: { cpus: 2 },
};
export default config;

import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root. Without this, Turbopack walks up looking for a
    // lockfile, finds a stray one in the home directory, and warns on every
    // start about a root it inferred incorrectly.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

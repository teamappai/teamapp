import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-to-png-converter pulls in pdfjs-dist + the native @napi-rs/canvas
  // binding (used server-side to rasterize contract PDFs for AI extraction).
  // Mark them external so Next/Turbopack don't try to bundle the .node binary
  // or the pdfjs worker — they're required from node_modules at runtime.
  serverExternalPackages: [
    "pdf-to-png-converter",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
};

export default nextConfig;

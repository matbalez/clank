/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/**/*": [
      "./node_modules/@moneydevkit/lightning-js/**/*",
      "./node_modules/@moneydevkit/lightning-js-linux-x64-gnu/**/*",
      "./node_modules/@moneydevkit/lightning-js-linux-x64-musl/**/*",
      "./node_modules/@moneydevkit/core/**/*",
      "./node_modules/@moneydevkit/api-contract/**/*"
    ]
  }
};

export default nextConfig;

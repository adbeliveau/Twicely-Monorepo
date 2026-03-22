import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@twicely/db',
    '@twicely/auth',
    '@twicely/casl',
    '@twicely/logger',
    '@twicely/utils',
    '@twicely/ui',
  ],
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  images: {
    localPatterns:[
      {
        pathname: '/**',
      },
    ]
  },
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;

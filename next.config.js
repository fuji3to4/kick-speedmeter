/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const repoName = 'kick-speedmeter';

const nextConfig = {
  reactStrictMode: true,
  // GitHub Pages のプロジェクトページ配下で配信するための設定
  basePath: isProd ? `/${repoName}` : '',
  assetPrefix: isProd ? `/${repoName}/` : undefined,
  // 静的エクスポート
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;

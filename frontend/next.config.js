/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  // 静态导出仅用于 GitHub Pages 生产部署；本地开发需要动态路由支持
  ...(isProd ? { output: 'export' } : {}),
  
  // 图片优化必须禁用，因为静态导出不支持 Next.js 的图片优化服务
  images: {
    unoptimized: true,
  },
  
  // GitHub Pages 部署在子路径 /lifecho 下
  // 本地开发 (npm run dev) 时不使用 basePath
  basePath: isProd ? '/lifecho' : '',
  assetPrefix: isProd ? '/lifecho/' : '',

  // 优化配置：跳过字体优化以避免网络问题
  optimizeFonts: false,
}

module.exports = nextConfig



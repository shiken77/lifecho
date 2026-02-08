/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开发服务器配置
  // 注意：Next.js 14 默认只监听 localhost
  // 如果需要从其他设备访问，需要设置 hostname
  
  // 优化配置：跳过字体优化以避免网络问题
  optimizeFonts: false,
}

module.exports = nextConfig



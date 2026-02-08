/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        echo: {
          rose: "#E76F51",     // 主色：温暖珊瑚
          peach: "#F4A261",    // 辅助：柔暖橙
          cream: "#FEFCF6",    // 底色：奶油白
          yellow: "#F2CC8F",   // 点缀：暖鹅黄
          ink: "#3D3630",      // 正文：深咖墨水
          stone: "#A69F92",    // 辅助灰
          sage: "#8CB369",     // 绿色点缀
          sky: "#7EC8E3",      // 蓝色点缀
          sand: "#FAEBD7",     // 淡沙色
        },
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
        sans: ["system-ui", "-apple-system", "sans-serif"],
        inter: ["system-ui", "-apple-system", "sans-serif"],
        playfair: ["Georgia", "serif"],
      },
      boxShadow: {
        'float': '0 12px 32px rgba(0, 0, 0, 0.08)',
        'float-lg': '0 20px 50px rgba(0, 0, 0, 0.10)',
        'card': '0 4px 16px rgba(0, 0, 0, 0.05)',
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
}

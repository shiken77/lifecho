// app/layout.tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#FEFCF6] font-sans text-[#3D3630] m-0 p-0 overflow-hidden" style={{ fontFamily: 'var(--font-inter)' }}>{children}</body>
    </html>
  );
}

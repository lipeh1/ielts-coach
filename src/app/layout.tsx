import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "steady · IELTS study",
  description: "适合在职备考的雅思学习工作台，规划练习、复盘错题并获取写作反馈。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

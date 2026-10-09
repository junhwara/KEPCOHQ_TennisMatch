import type { Metadata } from "next";
import "./tennis.css";

export const metadata: Metadata = {
  title: "코트사이드 | 한전 본사 테니스",
  description: "송변전 × 배전 복식 대항전. 일정부터 오더, 경기 기록까지.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}

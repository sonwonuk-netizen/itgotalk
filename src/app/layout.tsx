import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "잇고톡 연산",
  description: "연습하고, 테스트하고, 한 단계씩 올라가는 연산 훈련",
  applicationName: "잇고톡",
  appleWebApp: { capable: true, title: "잇고톡", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

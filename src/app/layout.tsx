import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anyware Anytime — ห้องสมุดและระบบเรียนรู้ออนไลน์",
  description: "ห้องสมุดดิจิทัลและระบบเรียนรู้ออนไลน์ เข้าถึงได้ทุกที่ ทุกเวลา",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}

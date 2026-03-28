import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const fontUi = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const fontMono = DM_Mono({
  variable: "--font-mono-alt",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const fontDisplay = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Culinaria | 海外美食文化学习平台",
  description: "Discover and master world cuisines with premium video courses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${fontUi.variable} ${fontMono.variable} ${fontDisplay.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

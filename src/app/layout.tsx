import type { Metadata } from "next";
import { DM_Mono, Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Oswal Service", template: "%s · Oswal Service" },
  description: "Service desk for Oswal Pumps and Oswal Solar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${fraunces.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}

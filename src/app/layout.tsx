import type { Metadata } from "next";
import { DM_Mono, Inter, Sora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "Oswal Service", template: "%s · Oswal Service" },
  description: "Service desk for Oswal Pumps and Oswal Solar",
  icons: { icon: "/brand/pumps-favicon.png", apple: "/brand/pumps-logo.png" },
};

const themeScript = `try{var t=localStorage.getItem("oswal-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"brand";}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="brand" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${mono.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}

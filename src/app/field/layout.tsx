import type { Metadata } from "next";

export const metadata: Metadata = { title: "Technician", appleWebApp: { capable: true, title: "Oswal Field" } };

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  return children;
}

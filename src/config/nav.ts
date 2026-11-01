export type NavItem = {
  href: string;
  label: string;
  phase: 1 | 2 | 3;
  icon: "dashboard" | "masters" | "complaint" | "attendance" | "expenses" | "reports" | "security" | "import" | "settings";
};

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", phase: 1, icon: "dashboard" },
  { href: "/masters", label: "Masters", phase: 1, icon: "masters" },
  { href: "/complaints", label: "Complaint", phase: 1, icon: "complaint" },
  { href: "/attendance", label: "Attendance", phase: 2, icon: "attendance" },
  { href: "/expenses", label: "Expenses", phase: 2, icon: "expenses" },
  { href: "/reports", label: "Reports", phase: 1, icon: "reports" },
  { href: "/security", label: "Security", phase: 1, icon: "security" },
  { href: "/import", label: "Import", phase: 1, icon: "import" },
  { href: "/settings", label: "Settings", phase: 1, icon: "settings" },
];

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0B1F3A", 700: "#16365C", 800: "#102844" },
        accent: { DEFAULT: "#E36A1E", dark: "#C45512" },
        canvas: "#F2F5F8",
        ink: "#142033",
        muted: "#5E6D82",
        line: "#E3E8F0",
        teal: "#0F7A68",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 32, 52, 0.04), 0 8px 24px rgba(16, 32, 52, 0.05)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

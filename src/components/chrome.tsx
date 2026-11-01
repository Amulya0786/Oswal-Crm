"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

export function BrandLogo({ company = "PUMPS", collapsed = false }: { company?: "PUMPS" | "SOLAR" | string; collapsed?: boolean }) {
  const solar = company === "SOLAR";
  if (collapsed) {
    return (
      <img
        className={`logo-mark ${solar ? "solar" : ""}`}
        src={solar ? "/brand/solar-logo.png" : "/brand/pumps-favicon.png"}
        alt=""
      />
    );
  }
  return (
    <img
      className="logo-full"
      src={solar ? "/brand/solar-logo.png" : "/brand/pumps-logo.png"}
      alt={solar ? "Oswal Solar" : "Oswal Pumps"}
    />
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"brand" | "dark">("brand");
  useEffect(() => {
    const saved = window.localStorage.getItem("oswal-theme");
    const next = saved === "dark" ? "dark" : "brand";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);
  function toggle() {
    const next = theme === "dark" ? "brand" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("oswal-theme", next);
  }
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === "dark" ? "Use the brand theme" : "Use the dark theme"}>
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, value]);
  return <>{new Intl.NumberFormat("en-IN").format(shown)}</>;
}

export function TileGrid({ tiles }: { tiles: { key: string; href: string; tone: string; label: string; value: number; hint?: string | null }[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="tile-grid">
      {tiles.map((tile, index) => (
        <motion.div
          key={tile.key}
          className="tile-motion"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: reduce ? 0 : index * 0.035 }}
        >
          <Link href={tile.href} className={`tile tone-${tile.tone}`}>
            <span>{tile.label}</span>
            <b><CountUp value={tile.value} /></b>
            {tile.hint && <small>{tile.hint}</small>}
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

export function PageTransition({ path, children }: { path: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div key={path} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
      {children}
    </motion.div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="empty-state panel">
      <svg viewBox="0 0 180 110" aria-hidden>
        <path d="M8 78h70" stroke="#02502f" strokeWidth="3" strokeLinecap="round" />
        <rect x="18" y="48" width="46" height="30" rx="8" fill="#eaf3ee" stroke="#02502f" strokeWidth="2" />
        <circle cx="32" cy="63" r="6" fill="#ffce30" stroke="#02502f" />
        <path d="M44 63h14" stroke="#02502f" strokeWidth="2" />
        <path d="M104 80c16-36 46-36 58 2" fill="none" stroke="#02502f" strokeWidth="2" />
        <path d="M112 80h42" stroke="#0B5D2E" strokeWidth="6" strokeLinecap="round" />
        <circle cx="146" cy="28" r="12" fill="#ffce30" />
        <path d="M146 8v6M146 42v6M126 28h6M160 28h6" stroke="#FFC61A" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Leaf } from "lucide-react";
import type { ReactNode } from "react";

export interface AIScannerProps {
  active?: boolean;
  /** Optional image element, e.g. an uploaded image preview. */
  children?: ReactNode;
  label?: string;
  inactiveLabel?: string;
  className?: string;
}

export default function AIScanner({
  active = true,
  children,
  label = "Sedang menganalisis foto tanaman…",
  inactiveLabel = "Foto siap diperiksa",
  className = "",
}: AIScannerProps) {
  const reducedMotion = useReducedMotion();

  return (
    <section className={`overflow-hidden rounded-3xl border border-emerald-800 bg-emerald-950 text-white ${className}`}>
      <div aria-busy={active} className="relative aspect-square overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center [&>img]:h-full [&>img]:w-full [&>img]:object-cover">
          {children ?? <Leaf aria-hidden="true" size={112} strokeWidth={1} className="text-emerald-300" />}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-lime-200/70" />
        {active && (
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{ top: reducedMotion ? "50%" : ["8%", "92%", "8%"] }}
            transition={reducedMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-x-5 h-1 rounded-full bg-lime-200 shadow-[0_0_18px_5px_rgba(163,230,53,0.65)]"
          />
        )}
      </div>
      <p role="status" className="border-t border-emerald-800 px-5 py-5 text-center font-semibold">
        {active ? label : inactiveLabel}
      </p>
    </section>
  );
}

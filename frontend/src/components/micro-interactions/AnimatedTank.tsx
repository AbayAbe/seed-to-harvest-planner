"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Droplets } from "lucide-react";

export interface AnimatedTankProps {
  fillPercentage: number;
  label?: string;
  className?: string;
}

export default function AnimatedTank({
  fillPercentage,
  label = "Isi tangki",
  className = "",
}: AnimatedTankProps) {
  const reducedMotion = useReducedMotion();
  const fill = Number.isFinite(fillPercentage)
    ? Math.min(100, Math.max(0, fillPercentage))
    : 0;

  return (
    <figure className={`rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 ${className}`}>
      <figcaption className="mb-5 flex items-center gap-2 text-lg font-bold">
        <Droplets aria-hidden="true" className="text-teal-700" />{label}
      </figcaption>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill}
        aria-valuetext={`${Math.round(fill)} persen`}
        className="relative mx-auto h-64 w-40 overflow-hidden rounded-[2rem] border-4 border-slate-700 bg-sky-50 shadow-inner"
      >
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{ scaleY: fill / 100 }}
          transition={{ duration: reducedMotion ? 0 : 0.75, ease: "easeInOut" }}
          className="absolute inset-0 origin-bottom bg-gradient-to-t from-emerald-600 via-teal-400 to-sky-300"
        />
        <div aria-hidden="true" className="absolute inset-4 flex flex-col justify-between">
          {[100, 75, 50, 25, 0].map(mark => (
            <span key={mark} className="w-6 border-t-2 border-slate-700/60" />
          ))}
        </div>
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-2xl bg-white/95 px-4 py-3 text-3xl font-bold tabular-nums shadow-sm">
            {Math.round(fill)}%
          </span>
        </div>
      </div>
    </figure>
  );
}

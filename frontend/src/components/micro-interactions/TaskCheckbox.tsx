"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

export interface TaskCheckboxProps {
  label: string;
  /** Controlled value: update it in onCheckedChange after persisting the task. */
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export default function TaskCheckbox({
  label, checked, onCheckedChange, disabled = false, className = "",
}: TaskCheckboxProps) {
  const reducedMotion = useReducedMotion();
  const [celebrating, setCelebrating] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const requested = useRef(false);

  // Celebrate only a user-requested completion accepted by the parent.
  // Initial checked values (e.g. restored tasks) do not trigger confetti.
  useEffect(() => {
    if (!checked || reducedMotion || !requested.current) {
      setCelebrating(false);
      return;
    }
    setCelebrating(true);
    const timer = window.setTimeout(() => {
      setCelebrating(false);
      requested.current = false;
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [checked, reducedMotion]);

  useEffect(() => {
    if (!celebrating) return;
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [celebrating]);

  return (
    <>
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          requested.current = !checked;
          onCheckedChange(!checked);
        }}
        whileTap={reducedMotion || disabled ? {} : { scale: 0.97 }}
        className={`flex min-h-[72px] w-full items-center gap-4 rounded-2xl border-2 p-4 text-left text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "border-emerald-700 bg-emerald-50" : "border-slate-300 bg-white"} ${className}`}
      >
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ scale: checked ? 1.1 : 1, rotate: checked ? -5 : 0 }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 12 }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 ${checked ? "border-emerald-800 bg-emerald-800 text-white" : "border-slate-500"}`}
        >
          {checked && <Check size={26} strokeWidth={3} />}
        </motion.span>
        <span className="min-w-0 break-words font-semibold">{label}</span>
        <span className="sr-only">{checked ? "Selesai" : "Belum selesai"}</span>
      </motion.button>
      {celebrating && !reducedMotion && viewport.width > 0 && createPortal(
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          <Confetti
            width={viewport.width}
            height={viewport.height}
            numberOfPieces={120}
            recycle={false}
            frameRate={30}
            gravity={0.18}
            colors={["#166534", "#10b981", "#bef264", "#38bdf8", "#fbbf24"]}
            style={{ pointerEvents: "none" }}
          />
        </div>, document.body,
      )}
    </>
  );
}

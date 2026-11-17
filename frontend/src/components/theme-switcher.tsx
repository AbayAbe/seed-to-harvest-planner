"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";
const key = "cyphera:theme:v1";
const choices = [{ value: "light", label: "Terang", Icon: Sun }, { value: "dark", label: "Gelap", Icon: Moon }, { value: "system", label: "Otomatis", Icon: Monitor }] as const;

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>("system");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let preference: Theme = "system";
    const apply = () => { document.documentElement.dataset.theme = preference === "system" ? (media.matches ? "dark" : "light") : preference; };
    const read = () => {
      try { const saved = localStorage.getItem(key); preference = saved === "dark" || saved === "light" ? saved : "system"; } catch { preference = "system"; }
      setTheme(preference); apply();
    };
    const change = (event: Event) => {
      preference = (event as CustomEvent<Theme>).detail; apply();
    };
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    read(); media.addEventListener("change", apply);
    window.addEventListener("storage", storage); window.addEventListener("cyphera:theme", change);
    return () => { media.removeEventListener("change", apply); window.removeEventListener("storage", storage); window.removeEventListener("cyphera:theme", change); };
  }, []);

  function select(value: Theme) {
    setTheme(value);
    window.dispatchEvent(new CustomEvent("cyphera:theme", { detail: value }));
    try { localStorage.setItem(key, value); setMessage(""); }
    catch { setMessage("Tema diterapkan untuk saat ini; pilihan belum bisa disimpan."); }
  }
  return <div className="theme-control">
    <div role="group" aria-label="Tema tampilan" className="theme-switcher">
      {choices.map(({value, label, Icon}) => <button key={value} type="button" aria-label={`Tema ${label.toLowerCase()}`} aria-pressed={theme === value} onClick={() => select(value)}><Icon size={18} aria-hidden="true"/><span>{label}</span></button>)}
    </div>
    {message && <p role="status" className="theme-message">{message}</p>}
  </div>;
}

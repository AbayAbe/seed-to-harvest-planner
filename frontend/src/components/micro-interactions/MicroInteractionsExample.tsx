"use client";

import { useState } from "react";
import AnimatedTank from "./AnimatedTank";
import AIScanner from "./AIScanner";
import TaskCheckbox from "./TaskCheckbox";

/** Mount this example from a page; no API or application data is modified. */
export default function MicroInteractionsExample() {
  const [fill, setFill] = useState(60);
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5 text-slate-900">
      <h1 className="text-3xl font-bold">Interaksi Cyphera</h1>
      <div className="grid items-start gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <AnimatedTank fillPercentage={fill} />
          <label className="block font-semibold">
            Isi tangki (%)
            <input type="number" min={0} max={100} value={fill}
              onChange={e => setFill(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="mt-2 min-h-[64px] w-full rounded-xl border border-slate-500 bg-white px-4" />
          </label>
        </div>
        <div className="space-y-4">
          <AIScanner active={scanning} label="Pratinjau animasi pemindai" />
          <button type="button" onClick={() => setScanning(value => !value)}
            className="min-h-[64px] w-full rounded-xl bg-emerald-900 px-5 font-bold text-white">
            {scanning ? "Hentikan pratinjau" : "Lihat animasi pemindai"}
          </button>
          <p className="text-sm">Pratinjau tampilan saja; tidak mengirim foto atau menjalankan analisis AI.</p>
        </div>
      </div>
      <TaskCheckbox label="Pemeriksaan lahan selesai" checked={done} onCheckedChange={setDone} />
    </div>
  );
}

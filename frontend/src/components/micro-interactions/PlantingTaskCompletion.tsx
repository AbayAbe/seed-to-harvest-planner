"use client";

import { useEffect, useState } from "react";
import { readWorkspace, writeWorkspace } from "../../lib/workspace-store";
import TaskCheckbox from "./TaskCheckbox";

export default function PlantingTaskCompletion({ farmId, phaseId, startDate, title, date }: {
  farmId: string; phaseId: string; startDate: string; title: string; date: string;
}) {
  const key = `plan:${farmId}:${startDate}:${phaseId}`;
  const [checked, setChecked] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => {
      try {
        setChecked(readWorkspace().kegiatan.some(item => item.id === key && item.selesai));
        setReady(true);
      } catch { setReady(false); setError("Status kegiatan belum bisa dibaca. Data lama tidak diubah."); }
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [key]);

  function save(next: boolean) {
    try {
      const data = readWorkspace();
      if (!data.farms.some(farm => farm.id === farmId)) throw new Error("Lahan sudah tidak tersedia. Muat ulang daftar lahan.");
      const existing = data.kegiatan.find(item => item.id === key);
      const activity = existing ? { ...existing, selesai: next } : {
        id: key, lahanId: farmId, judul: title, tanggal: date, biaya: 0,
        catatan: "Dicatat dari jadwal tanam. Tanggal adalah tanggal rencana, bukan waktu pelaksanaan.", selesai: next,
      };
      writeWorkspace({ ...data, kegiatan: existing
        ? data.kegiatan.map(item => item.id === key ? activity : item)
        : [...data.kegiatan, activity] });
      setChecked(next);
      setError("");
      window.dispatchEvent(new Event("storage"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status belum berhasil disimpan.");
    }
  }

  return <div className="mt-4">
    <TaskCheckbox label={`${checked ? "Selesai" : "Tandai selesai"}: ${title}`} checked={checked} onCheckedChange={save} disabled={!ready}/>
    {error && <p role="alert" className="mt-2 text-sm text-red-900">{error}</p>}
  </div>;
}

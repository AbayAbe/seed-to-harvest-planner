"use client";

import { ArrowUpRight, CloudRain, CloudSun, MapPin, RefreshCw, Sprout, Sun, TriangleAlert } from "lucide-react";
import type { CuacaLahan, Lahan } from "@agri/contracts";
import { useApiQuery } from "../../lib/use-api-query";
import { formatQuantity } from "../../lib/tank-mix/form";

export default function KartuLahan({ lahan, tanaman, penyegaran, onBuka }: {
  lahan: Lahan; tanaman: string; penyegaran: number; onBuka: (lahan: Lahan) => void;
}) {
  // API menerima ID lahan; backend memeriksa pemilik lalu mengambil koordinat tersimpan.
  const query = useApiQuery<CuacaLahan>(`lahan/${lahan.id}/cuaca?v=${penyegaran}`);
  const cuaca = query.data;
  const hujan = cuaca?.status === "Hujan";
  const Icon = cuaca?.ikon === "cloud-rain" ? CloudRain : cuaca?.ikon === "sun" ? Sun : CloudSun;
  return <article className="farm-card surface" aria-label={lahan.nama}>
    <header className="farm-card-heading"><span className="farm-crop-icon"><Sprout size={27}/></span><span className="farm-crop-label">{tanaman}</span></header>
    <h2>{lahan.nama}</h2><p className="farm-location"><MapPin size={17}/>{lahan.lokasi}</p>
    <div className="farm-area"><strong>{formatQuantity(lahan.luasHektare)}</strong><span>hektare<br/>luas lahan</span></div>
    <section className={`farm-weather ${hujan ? "farm-weather-rain" : ""}`} aria-label={`Cuaca ${lahan.nama}`} aria-busy={query.loading}>
      {query.loading ? <p role="status" className="py-5">Sedang memeriksa cuaca lahan…</p> : query.error ? <div><p className="font-bold">Cuaca belum tersedia</p><p className="mt-2 text-sm">{query.error}</p><button type="button" className="reset-button mt-3 w-full" onClick={query.retry}><RefreshCw size={18}/>Muat ulang cuaca</button></div> : cuaca && <>
        <div className="farm-weather-heading"><span className="flex items-center gap-3"><Icon size={33}/><span><strong>{cuaca.status}</strong><small>Cuaca simulasi di lahan</small></span></span><b>{formatQuantity(cuaca.suhuCelsius)}°</b></div>
        <div className="farm-rain-probability"><span>Potensi hujan · 3 jam ke depan</span><strong>{cuaca.potensiHujanPersen}%</strong></div>
        <p className="farm-weather-time">Diperbarui {new Date(cuaca.diperbaruiPada).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
      </>}
    </section>
    {hujan ? <p className="rain-warning" role="status"><TriangleAlert size={21}/><strong>Tunda Penyemprotan Obat!</strong></p> : <p className="farm-weather-note">{query.error ? "Periksa cuaca sebelum menentukan penyemprotan." : "Periksa kondisi lapangan dan label sebelum menyemprot."}</p>}
    <details className="farm-coordinate"><summary>Koordinat lahan</summary><p>Lintang: {lahan.latitude}<br/>Bujur: {lahan.longitude}</p></details>
    <button type="button" className="primary-button farm-open" onClick={() => onBuka(lahan)}><span>Lihat Jadwal Tanam &amp; Obat</span><ArrowUpRight size={22}/></button>
  </article>;
}

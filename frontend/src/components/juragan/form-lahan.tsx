"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, MapPin } from "lucide-react";
import { format } from "date-fns";
import type { CatalogResponse, Lahan, MasukanLahan } from "@agri/contracts";
import { requestApi } from "../../lib/api";
import { parseDecimal } from "../../lib/tank-mix/form";

const TITIK_CONTOH = [
  { id: "garut", nama: "Garut", latitude: -7.215, longitude: 107.901 },
  { id: "subang", nama: "Subang", latitude: -6.571, longitude: 107.758 },
  { id: "lembang", nama: "Lembang", latitude: -6.817, longitude: 107.616 },
];
const bacaKoordinat = (value: string) => /^-?\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : NaN;
export default function FormLahan({ catalog, onSelesai, onBatal }: { catalog: CatalogResponse; onSelesai: () => void; onBatal: () => void }) {
  const [nama, setNama] = useState("");
  const [luas, setLuas] = useState("");
  const [seedId, setSeedId] = useState(catalog.seeds[0]?.id ?? "");
  const [tanggal, setTanggal] = useState(format(new Date(), "yyyy-MM-dd"));
  const [titik, setTitik] = useState("");
  const [lokasi, setLokasi] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const namaRef = useRef<HTMLInputElement>(null);
  useEffect(() => { namaRef.current?.focus(); }, []);
  async function simpan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const contoh = TITIK_CONTOH.find((item) => item.id === titik);
    const data: MasukanLahan = { nama, lokasi: contoh?.nama ?? lokasi, luasHektare: parseDecimal(luas), seedId, tanggalTanam: tanggal,
      latitude: contoh?.latitude ?? bacaKoordinat(latitude), longitude: contoh?.longitude ?? bacaKoordinat(longitude) };
    if (!nama.trim() || !data.lokasi.trim() || !titik || !Number.isFinite(data.luasHektare) || !Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
      setGalat("Lengkapi nama, luas, tanaman, dan lokasi lahan."); return;
    }
    setSibuk(true); setGalat("");
    try { await requestApi<Lahan>("lahan", JSON.stringify(data)); onSelesai(); }
    catch (error) { setGalat(error instanceof Error ? error.message : "Lahan belum tersimpan."); }
    finally { setSibuk(false); }
  }
  return <form onSubmit={simpan} className="surface farm-form" aria-label="Tambah lahan" noValidate>
    <div className="section-kicker"><MapPin size={20}/> LAHAN BARU</div><h2 className="mt-3 text-2xl font-bold">Simpan lahan Anda.</h2>
    <fieldset disabled={sibuk} className="mt-6 grid gap-5 sm:grid-cols-2">
      <div><label htmlFor="nama-lahan" className="field-label">Nama lahan</label><input ref={namaRef} id="nama-lahan" className="field-input" value={nama} onChange={(event) => setNama(event.target.value)} placeholder="Contoh: Sawah sebelah utara" maxLength={100}/></div>
      <div><label htmlFor="luas-lahan" className="field-label">Luas lahan (hektare)</label><input id="luas-lahan" className="field-input" inputMode="decimal" value={luas} onChange={(event) => setLuas(event.target.value)} placeholder="Contoh: 2,5"/></div>
      <div><label htmlFor="tanaman-lahan" className="field-label">Tanaman di lahan ini</label><select id="tanaman-lahan" className="field-input" value={seedId} onChange={(event) => setSeedId(event.target.value)}>{catalog.seeds.map((seed) => <option key={seed.id} value={seed.id}>{seed.crop}</option>)}</select></div>
      <div><label htmlFor="tanggal-lahan" className="field-label">Tanggal mulai tanam</label><input id="tanggal-lahan" type="date" className="field-input" value={tanggal} onChange={(event) => setTanggal(event.target.value)}/></div>
      <div className="sm:col-span-2"><label htmlFor="lokasi-lahan" className="field-label">Lokasi lahan</label><select id="lokasi-lahan" className="field-input" value={titik} onChange={(event) => setTitik(event.target.value)}><option value="">Pilih lokasi</option>{TITIK_CONTOH.map((item) => <option key={item.id} value={item.id}>{item.nama} · titik contoh</option>)}<option value="manual">Isi koordinat lahan sendiri</option></select><p className="field-help">Titik contoh hanya untuk mencoba. Gunakan koordinat lahan Anda untuk lokasi yang tepat.</p></div>
      {titik === "manual" && <><div className="sm:col-span-2"><label htmlFor="wilayah-lahan" className="field-label">Desa atau wilayah</label><input id="wilayah-lahan" className="field-input" value={lokasi} onChange={(event) => setLokasi(event.target.value)} maxLength={100}/></div><div><label htmlFor="latitude-lahan" className="field-label">Lintang (latitude)</label><input id="latitude-lahan" className="field-input" inputMode="text" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Contoh: -7,215"/></div><div><label htmlFor="longitude-lahan" className="field-label">Bujur (longitude)</label><input id="longitude-lahan" className="field-input" inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Contoh: 107,901"/></div></>}
    </fieldset>
    {galat && <p role="alert" className="error-message mt-5">{galat}</p>}
    <div className="form-actions"><button type="submit" className="primary-button" disabled={sibuk}><Check size={21}/>{sibuk ? "Menyimpan…" : "Simpan lahan"}</button><button type="button" className="reset-button" onClick={onBatal} disabled={sibuk}>Batal</button></div>
  </form>;
}

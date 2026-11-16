"use client";

import { useState } from "react";
import { Sprout, ArrowRight } from "lucide-react";
import { requestApi } from "../../lib/api";

export default function LoginDemo({ onMasuk }: { onMasuk: () => void }) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  async function buka() {
    setSibuk(true); setGalat("");
    try { await requestApi("auth/demo", "{}"); onMasuk(); }
    catch (error) { setGalat(error instanceof Error ? error.message : "Demo belum bisa dibuka."); }
    finally { setSibuk(false); }
  }
  return <main className="min-h-screen grid place-items-center p-6 bg-[#f5f6f0] text-slate-900">
    <section className="surface w-full max-w-lg p-8 sm:p-12">
      <Sprout size={48} className="mb-6 text-green-800"/>
      <p className="eyebrow">PERENCANA TANI · DEMO</p>
      <h1 className="text-4xl font-bold mt-3 mb-5">Rencanakan lahan Anda.</h1>
      <p className="text-lg mb-6">Coba daftar lahan, jadwal tanam, cuaca simulasi, dan kalkulator dosis. Langsung buka tanpa nomor HP atau kata sandi.</p>
      <p className="rounded-xl bg-green-100 p-5 mb-6"><strong>Data tersimpan di browser ini.</strong> Data tidak tersinkron ke HP lain dan hilang jika data situs dihapus. Ini demo tanpa akun sungguhan.</p>
      {galat && <p role="alert" className="error-message mb-4">{galat}</p>}
      <button type="button" disabled={sibuk} onClick={buka} className="primary-button w-full min-h-[64px]">{sibuk ? "Sedang membuka…" : "Buka demo"}<ArrowRight size={24}/></button>
    </section>
  </main>;
}

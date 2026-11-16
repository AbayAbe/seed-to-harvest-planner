"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CloudSun, Leaf, MapPinned, MessageCircle, ShieldCheck, Smartphone, Sprout } from "lucide-react";
import type { KanalOtp, SesiJuragan, TantanganOtp } from "@agri/contracts";
import { requestApi } from "../../lib/api";

export default function LoginNomorHp({ onMasuk }: { onMasuk: () => void }) {
  const [nomorHp, setNomorHp] = useState("");
  const [kanal, setKanal] = useState<KanalOtp>("whatsapp");
  const [tantangan, setTantangan] = useState<TantanganOtp | null>(null);
  const [kode, setKode] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [sekarang, setSekarang] = useState(Date.now());
  const kodeRef = useRef<HTMLInputElement>(null);
  const nomorRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!tantangan) return;
    kodeRef.current?.focus();
    const timer = setInterval(() => setSekarang(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [tantangan]);
  const sisaKirim = tantangan ? Math.max(0, Math.ceil((Date.parse(tantangan.kirimUlangPada) - sekarang) / 1000)) : 0;
  const sisaKode = tantangan ? Math.max(0, Math.ceil((Date.parse(tantangan.berlakuSampai) - sekarang) / 1000)) : 0;

  async function mintaKode() {
    setSibuk(true); setGalat("");
    try {
      const hasil = await requestApi<TantanganOtp>("auth/request-otp", JSON.stringify({ nomorHp, kanal }));
      setTantangan(hasil); setKode(""); setSekarang(Date.now());
    } catch (error) { setGalat(error instanceof Error ? error.message : "Kode belum bisa dibuat. Coba lagi."); }
    finally { setSibuk(false); }
  }
  async function masuk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tantangan) { await mintaKode(); return; }
    if (!/^\d{6}$/.test(kode)) { setGalat("Isi 6 angka kode masuk."); kodeRef.current?.focus(); return; }
    setSibuk(true); setGalat("");
    try {
      await requestApi<SesiJuragan>("auth/verify-otp", JSON.stringify({ id: tantangan.id, kode }));
      onMasuk();
    } catch (error) { setGalat(error instanceof Error ? error.message : "Belum berhasil masuk."); kodeRef.current?.focus(); }
    finally { setSibuk(false); }
  }

  return <main className="login-layout">
    <section className="login-story">
      <div className="brand"><span className="brand-mark"><Sprout size={28}/></span><div><strong>Bayer<span className="brand-dot">.</span></strong><span>Ruang kendali lahan</span></div></div>
      <div className="login-story-copy"><p className="light-eyebrow"><Leaf size={18}/> DARI BENIH HINGGA PANEN</p><h2>Banyak lahan.{" "}<br/>Tetap dalam{" "}<br/><span>genggaman.</span></h2><p>Pantau cuaca dan rencana tanam di setiap lahan, dari satu tempat.</p>
        <div className="login-benefits"><span><MapPinned/>Lokasi lahan tersimpan</span><span><CloudSun/>Cuaca untuk tiap lahan</span><span><Check/>Jadwal lebih teratur</span></div>
      </div>
      <p className="login-story-foot">Kenali lahannya. Rencanakan langkahnya.</p>
    </section>
    <section className="login-form-area">
      <div className="login-card">
        <span className="login-icon"><Smartphone size={28}/></span>
        <p className="eyebrow">SELAMAT DATANG, PEMILIK LAHAN</p>
        <h1>{tantangan ? "Masukkan kode masuk." : "Masuk pakai nomor HP."}</h1>
        <p className="login-intro">{tantangan ? `Untuk nomor ${tantangan.nomorTersamar}. Cukup isi 6 angka di bawah.` : "Tidak perlu membuat atau mengingat kata sandi."}</p>
        <div className="demo-notice"><ShieldCheck size={21}/><p><strong>Mode uji coba.</strong> OTP masih simulasi. Tidak ada pesan WhatsApp atau SMS yang dikirim. Gunakan nomor contoh, bukan data pribadi.</p></div>
        <form onSubmit={masuk} noValidate><fieldset disabled={sibuk} className="space-y-5 min-w-0">
          {!tantangan ? <>
            <div><label htmlFor="nomor-hp" className="field-label">Nomor HP Anda</label><input ref={nomorRef} id="nomor-hp" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="Contoh: 081234567890" className="field-input" value={nomorHp} onChange={(event) => { setNomorHp(event.target.value); setGalat(""); }} aria-describedby="contoh-nomor"/><button type="button" id="contoh-nomor" className="large-text-button" onClick={() => { setNomorHp("081234567890"); nomorRef.current?.focus(); }}>Gunakan nomor contoh</button></div>
            <fieldset><legend className="field-label">Terima kode lewat</legend><div className="grid grid-cols-2 gap-3">{(["whatsapp", "sms"] as const).map((item) => <button key={item} type="button" className="channel-button" aria-pressed={kanal === item} onClick={() => setKanal(item)}>{item === "whatsapp" ? <MessageCircle size={22}/> : <Smartphone size={22}/>}<span>{item === "whatsapp" ? "WhatsApp" : "SMS"}</span></button>)}</div></fieldset>
          </> : <>
            <div className="demo-code"><span>Kode simulasi Anda</span><output data-testid="kode-simulasi">{tantangan.kodeSimulasi}</output><button type="button" className="large-text-button" onClick={() => { setKode(tantangan.kodeSimulasi); kodeRef.current?.focus(); }}>Gunakan kode contoh</button></div>
            <div><label htmlFor="kode-otp" className="field-label">Kode masuk (6 angka)</label><input ref={kodeRef} id="kode-otp" className="field-input otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={kode} onChange={(event) => setKode(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-describedby="waktu-otp"/><p id="waktu-otp" className="field-help">{sisaKode ? `Kode berlaku ${Math.floor(sisaKode / 60)} menit ${sisaKode % 60} detik lagi.` : "Kode sudah kedaluwarsa. Minta kode baru."}</p></div>
          </>}
          {galat && <p role="alert" className="error-message">{galat}</p>}
          <button className="primary-button w-full" type="submit" disabled={sibuk}>{sibuk ? "Tunggu sebentar…" : tantangan ? "Masuk ke lahan saya" : "Lanjutkan"}<ArrowRight size={21}/></button>
          {tantangan && <div className="grid gap-2 sm:grid-cols-2"><button type="button" className="reset-button" onClick={() => { setTantangan(null); setKode(""); setGalat(""); }} disabled={sibuk}>Ganti nomor HP</button><button type="button" className="reset-button" disabled={sibuk || sisaKirim > 0} onClick={mintaKode}>{sisaKirim ? `Kirim ulang (${sisaKirim} dtk)` : "Minta kode baru"}</button></div>}
        </fieldset></form>
        <p className="login-footnote">Satu nomor untuk mengelola semua lahan Anda.</p>
      </div>
    </section>
  </main>;
}

"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, Gift, ScanLine, ShieldCheck, LockKeyhole, ArrowRight, ImagePlus, Ticket, CircleHelp } from "lucide-react";
import CodeScanner from "./code-scanner";

function maskCode(value: string) {
  // Do not render scanned URLs as links or expose a complete redemption token.
  return value.length > 6 ? `•••• ${value.slice(-6)}` : "••••";
}

export default function FarmerRewards({ active }: { active: boolean }) {
  const [camera, setCamera] = useState(false);
  const [manual, setManual] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [help, setHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const inputId = "reward-manual-code";

  useEffect(() => {
    if (!active) { setCamera(false); setReading(false); generation.current += 1; }
    return () => { generation.current += 1; };
  }, [active]);

  function receive(raw: string) {
    setCamera(false); setError("");
    const value = raw.trim();
    if (!value || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value)) {
      setCode(""); setError("Kode belum dapat dibaca. Gunakan kode yang jelas, maksimal 2.048 karakter, tanpa baris baru."); return;
    }
    setCode(value); setManual("");
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
    if (!file) return;
    setCamera(false); setCode(""); setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
      setError("Pilih gambar JPG, PNG, atau WebP maksimal 5 MB."); return;
    }
    const current = ++generation.current;
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (current !== generation.current) return;
      const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
      if (current === generation.current) receive(result.getText());
    } catch {
      if (current === generation.current) setError("Kode belum ditemukan pada gambar. Potong gambar di sekitar kode, gunakan foto yang lebih tajam, atau ketik kodenya.");
    } finally {
      URL.revokeObjectURL(url);
      if (current === generation.current) setReading(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); receive(manual); }
  return <div className="reward-page">
    <header className="reward-hero"><div><p className="light-eyebrow"><Gift size={18}/>CYPHERA / UNDIAN PETANI</p><h1>Satu kode.<br/><span>Kesempatan baru.</span></h1><p>Pindai kode kemasan, periksa hak undian, lalu putar saat program resmi sudah terhubung.</p><span className="reward-program-badge"><LockKeyhole size={16}/>Validasi program belum terhubung</span></div><div className="reward-hero-icon" aria-hidden="true"><Gift size={72} strokeWidth={1.2}/><span>PINDAI · VALIDASI · PUTAR</span></div></header>

    <ol className="reward-steps" aria-label="Alur undian">{[{n:"01",title:"Pindai kode",detail:code?"Kode sudah terbaca":"Kamera, gambar, atau ketik"},{n:"02",title:"Validasi program",detail:"Menunggu koneksi resmi"},{n:"03",title:"Putar satu kali",detail:"Setelah hak putar disetujui"}].map(step=><li key={step.n}><span>{step.n}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div></li>)}</ol>

    <div className="reward-grid"><section className="surface reward-panel" aria-labelledby="reward-scan-title"><p className="eyebrow">MULAI DARI KEMASAN ANDA</p><h2 id="reward-scan-title">Pindai kode produk</h2><p className="reward-description">Gunakan kode khusus program undian. Barcode jenis produk saja belum membuktikan hak putar untuk satu kemasan.</p>
      {camera && active ? <CodeScanner onRead={receive} onClose={()=>setCamera(false)}/> : <div className="reward-scan-placeholder"><ScanLine size={64} strokeWidth={1.2}/><strong>Temukan kode pada kemasan</strong><p>Pastikan seluruh kode terlihat dan tidak tertutup pantulan cahaya.</p></div>}
      <div className="reward-actions"><button type="button" className="primary-button" disabled={reading || camera} onClick={()=>{setError("");setCode("");setCamera(true);}}><Camera size={20}/>Buka kamera</button><button type="button" className="reset-button" disabled={reading || camera} onClick={()=>fileInput.current?.click()}><ImagePlus size={20}/>Unggah gambar</button></div>
      <input ref={fileInput} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" aria-label="Gambar QR atau barcode" onChange={upload}/>
      <p className="reward-privacy">Foto dan isi kode diproses di perangkat ini. Tidak dikirim ke Bayer, tidak disimpan permanen, dan tautan dalam QR tidak dibuka otomatis.</p>
      <form onSubmit={submit} className="reward-manual"><label className="field-label" htmlFor={inputId}>Atau ketik kode kemasan</label><input id={inputId} className="field-input" value={manual} onChange={e=>setManual(e.target.value)} maxLength={2048} placeholder="Masukkan kode yang tercetak" autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={reading || camera}/><button type="submit" className="reward-small-button" disabled={reading || camera || !manual.trim()}>Gunakan kode <ArrowRight size={18}/></button></form>
      {reading && <p role="status" className="reward-notice">Membaca kode pada gambar…</p>}
      {error && <p role="alert" className="error-message mt-4">{error}</p>}
      {code && <div role="status" className="reward-notice"><strong>Kode terbaca · {maskCode(code)}</strong><p>Belum divalidasi oleh program Bayer. Belum ada hak putar yang diberikan atau kode yang ditandai terpakai.</p><button type="button" className="reward-small-button" onClick={()=>{setCode("");setError("");}}>Hapus kode</button></div>}
    </section>

    <section className="surface reward-panel reward-wheel-panel" aria-labelledby="reward-wheel-title"><p className="eyebrow">RUANG KEJUTAN ANDA</p><h2 id="reward-wheel-title">Roda undian petani</h2><p className="reward-description">Hadiah akan mengikuti katalog dan ketentuan program resmi.</p><div className="reward-wheel-wrap" aria-hidden="true"><span className="reward-wheel-pointer"/><div className="reward-wheel">{[0,1,2,3,4,5].map(n=><span key={n} className="reward-wheel-gift" style={{transform:`rotate(${n*60+30}deg) translateY(-104px) rotate(-${n*60+30}deg)`}}><Gift size={26}/></span>)}<div className="reward-wheel-center"><LockKeyhole size={28}/><strong>Segera hadir</strong></div></div></div><p id="reward-lock-reason" className="reward-wheel-note">Putaran belum tersedia. Kode perlu diverifikasi dan daftar hadiah perlu ditetapkan oleh pengelola program.</p><button type="button" disabled aria-describedby="reward-lock-reason" className="primary-button w-full"><LockKeyhole size={20}/>Putar undian</button><div className="reward-ticket"><Ticket size={23}/><div><strong>Hak putar: belum tersedia</strong><p>Satu kode unik yang memenuhi syarat dapat memberikan satu hak putar, sesuai aturan program yang dihubungkan.</p></div></div></section></div>

    <section className="surface reward-panel"><div className="flex items-center gap-3"><ShieldCheck size={26}/><h2>Riwayat undian</h2></div><div className="reward-history-empty"><Ticket size={32}/><div><strong>Belum ada putaran yang tercatat</strong><p>Hasil dan status penukaran akan muncul setelah program aktif. Tidak ada hadiah yang diberikan dari tampilan pratinjau ini.</p></div></div></section>
    <section className="surface reward-panel"><button type="button" className="reward-help-button" aria-expanded={help} aria-controls="reward-help" onClick={()=>setHelp(!help)}><CircleHelp size={22}/>Bagaimana aturan satu kode, satu putaran?</button>{help&&<div id="reward-help" className="reward-help"><p>Server program perlu memeriksa kode unik, masa berlaku, dan apakah kode sudah dipakai. Membaca barcode bukan bukti keaslian atau kelayakan undian.</p><p>Hak putar dan hasil harus dicatat bersama di server. Menutup halaman, mengganti HP, atau memindai ulang tidak boleh menghasilkan hak putar tambahan.</p><p>Nama program, periode, syarat peserta, daftar hadiah, peluang, dan prosedur klaim belum tersedia. Cyphera merupakan aplikasi independen; halaman ini belum terhubung ke layanan undian resmi Bayer.</p></div>}</section>
  </div>;
}

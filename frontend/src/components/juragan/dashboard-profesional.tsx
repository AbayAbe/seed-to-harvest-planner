"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowUpRight, CalendarCheck, Check, Circle, Download, Leaf, MapPin, Pencil, Plus, Search, ShieldCheck, Sprout, Upload, Wallet, Wheat } from "lucide-react";
import type { CatalogResponse, Lahan } from "@agri/contracts";
import { readWorkspace, writeWorkspace, parseBackup, type Workspace, type Kegiatan } from "../../lib/workspace-store";
import { requestApi } from "../../lib/api";
import FormLahan from "./form-lahan";
import KartuLahan from "./kartu-lahan";

const angka = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const rupiah = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
const tanggal = (s: string) => format(parseISO(s), "d MMM yyyy", { locale: id });
const pesan = (e: unknown) => e instanceof Error ? e.message : "Perubahan belum tersimpan. Coba lagi.";

export default function DashboardProfesional({ catalog, onBukaLahan }: { catalog: CatalogResponse; onBukaLahan: (lahan: Lahan) => void }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [galat, setGalat] = useState("");
  const [info, setInfo] = useState("");
  const [search, setSearch] = useState("");
  const [crop, setCrop] = useState("");
  const [sort, setSort] = useState("nama");
  const [form, setForm] = useState<Lahan | "baru" | null>(null);
  const [agendaForm, setAgendaForm] = useState(false);
  const [filter, setFilter] = useState<"aktif" | "selesai" | "semua">("aktif");
  const [restore, setRestore] = useState<Workspace | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const today = format(new Date(), "yyyy-MM-dd");
  function load() { try { setData(readWorkspace()); setGalat(""); } catch (e) { setGalat(pesan(e)); } }
  useEffect(() => { load(); const listener = () => load(); window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); }, []);
  useEffect(() => { if (form) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [form]);
  function edit(lahan: Lahan | "baru") { setForm(lahan); setGalat(""); }
  function closeForm() { setForm(null); addRef.current?.focus(); }
  function mutate(change: (current: Workspace) => Workspace) {
    try { writeWorkspace(change(readWorkspace())); load(); setInfo("Perubahan tersimpan di perangkat ini."); return true; }
    catch (e) { setGalat(pesan(e)); return false; }
  }
  async function contoh() {
    setBusy(true);
    try { await requestApi("lahan/contoh", "{}"); load(); } catch (e) { setGalat(pesan(e)); }
    finally { setBusy(false); }
  }
  function exportData() {
    try {
      const blob = new Blob([JSON.stringify(readWorkspace(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `lahan-saya-${today}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setInfo("File cadangan disiapkan. Simpan di tempat aman untuk dipulihkan nanti.");
    } catch (e) { setGalat(pesan(e)); }
  }
  async function importData(file?: File) {
    if (!file) return;
    setGalat(""); setRestore(null);
    try { if (file.size > 2_000_000) throw new Error("Ukuran cadangan maksimal 2 MB."); setRestore(parseBackup(await file.text())); }
    catch (e) { setGalat(pesan(e)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }
  const farms = data?.farms ?? [];
  const activities = data?.kegiatan ?? [];
  const pending = activities.filter(item => !item.selesai);
  const overdue = pending.filter(item => item.tanggal < today);
  const harvests = farms.map(farm => ({ farm, date: addDays(parseISO(farm.tanggalTanam), farm.hariPanen) }))
    .filter(item => differenceInCalendarDays(item.date, parseISO(today)) >= 0).sort((a, b) => +a.date - +b.date);
  const upcoming = harvests.filter(item => differenceInCalendarDays(item.date, parseISO(today)) <= 30);
  const visible = farms.filter(farm => (!crop || farm.seedId === crop) && `${farm.nama} ${farm.lokasi}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "luas" ? b.luasHektare - a.luasHektare : sort === "panen" ? +addDays(parseISO(a.tanggalTanam), a.hariPanen) - +addDays(parseISO(b.tanggalTanam), b.hariPanen) : a.nama.localeCompare(b.nama, "id"));
  const agenda = activities.filter(item => filter === "semua" || item.selesai === (filter === "selesai")).sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  return <div className="pro-dashboard">
    <section className="pro-hero">
      <div className="pro-hero-copy"><p className="light-eyebrow"><Leaf size={17}/> CATAT HARI INI. TUMBUH ESOK HARI.</p><h1>Lahan Anda,<br/><span>lebih terencana.</span></h1><p>Semua lahan, pekerjaan, dan catatan biaya.<br/>Satu ruang kerja untuk musim yang lebih tertata.</p><div className="pro-date"><CalendarCheck size={18}/>{format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}</div></div>
      <div className="pro-harvest"><span className="pro-label"><Wheat size={19}/> PANEN TERDEKAT</span>{harvests[0] ? <><strong>{format(harvests[0].date, "d MMM", { locale: id })}</strong><p>{harvests[0].farm.nama}</p><span>{differenceInCalendarDays(harvests[0].date, parseISO(today))} hari menuju perkiraan panen</span><button type="button" onClick={() => onBukaLahan(harvests[0]!.farm)}>Lihat rencana <ArrowUpRight size={20}/></button></> : <><strong>Musim baru.</strong><p>Mulai dengan menyimpan lahan dan tanggal tanam.</p><button type="button" onClick={() => edit("baru")}>Tambah lahan <Plus size={20}/></button></>}<small>Perkiraan kalender, bukan kepastian panen.</small></div>
      <svg className="pro-field-lines" viewBox="0 0 600 260" aria-hidden="true"><g fill="none" stroke="currentColor">{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i * 48 - 100} 300 Q${i * 28 + 100} 20 700 ${i * 22 - 60}`} />)}</g></svg>
    </section>
    <div className="pro-metrics">
      <div><span><Sprout/> Luas kelolaan</span><strong>{angka(farms.reduce((n, f) => n + f.luasHektare, 0))}<small> ha</small></strong><p>{farms.length} lahan tersimpan</p></div>
      <div><span><CalendarCheck/> Pekerjaan terbuka</span><strong>{pending.length}</strong><p>{overdue.length ? `${overdue.length} melewati tanggal rencana` : "Tidak ada pekerjaan terlambat"}</p></div>
      <div><span><Wheat/> Panen 30 hari</span><strong>{upcoming.length}<small> lahan</small></strong><p>Menurut kalender tanam</p></div>
      <div><span><Wallet/> Biaya tercatat</span><strong className="pro-money">{rupiah(activities.filter(a => a.selesai).reduce((n, a) => n + a.biaya, 0))}</strong><p>Untuk kegiatan selesai</p></div>
    </div>
    {galat && <p role="alert" className="error-message mb-5">{galat}</p>}
    {info && <p role="status" className="pro-feedback"><Check size={18}/>{info}<button type="button" aria-label="Tutup pemberitahuan" onClick={() => setInfo("")}>Tutup</button></p>}
    <section className="pro-agenda surface" aria-label="Agenda kerja">
      <div className="pro-section-heading"><div><p className="eyebrow">LANGKAH KECIL, HASIL BESAR</p><h2>Agenda kerja Anda</h2><p>Catat pekerjaan nyata. Jadwal ini Anda tentukan sendiri.</p></div><button type="button" className="primary-button" disabled={!farms.length} onClick={() => setAgendaForm(!agendaForm)}><Plus size={19}/>{agendaForm ? "Tutup formulir" : "Tambah kegiatan"}</button></div>
      {agendaForm && <FormKegiatan farms={farms} today={today} onSave={item => { const ok = mutate(current => ({ ...current, kegiatan: [...current.kegiatan, item] })); if (ok) setAgendaForm(false); }}/>}
      <div className="pro-tabs" aria-label="Filter agenda">{([['aktif','Belum selesai'],['selesai','Selesai'],['semua','Semua']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {!agenda.length ? <div className="pro-empty"><CalendarCheck size={30}/><div><strong>{farms.length ? "Ruang untuk rencana berikutnya." : "Tambahkan lahan pertama Anda."}</strong><p>{farms.length ? "Tambahkan kegiatan seperti pengamatan tanaman, perawatan irigasi, atau pencatatan panen." : "Setelah lahan tersimpan, Anda dapat membuat agenda kerja."}</p></div></div> : <ul className="pro-activity-list">{agenda.map(item => <li key={item.id} className={item.selesai ? "is-complete" : ""}><button type="button" className="pro-check" aria-label={`${item.selesai ? "Batalkan selesai" : "Tandai selesai"}: ${item.judul}`} aria-pressed={item.selesai} onClick={() => mutate(current => ({ ...current, kegiatan: current.kegiatan.map(a => a.id === item.id ? { ...a, selesai: !a.selesai } : a) }))}>{item.selesai ? <Check/> : <Circle/>}</button><div><strong>{item.judul}</strong><p>{farms.find(f => f.id === item.lahanId)?.nama} · {tanggal(item.tanggal)}</p>{item.catatan && <p className="pro-notes">{item.catatan}</p>}</div><div className="pro-activity-meta"><span className={item.selesai ? "pro-tag green" : item.tanggal < today ? "pro-tag amber" : "pro-tag"}>{item.selesai ? "Selesai" : item.tanggal < today ? "Lewat rencana" : item.tanggal === today ? "Hari ini" : "Terjadwal"}</span><small>{rupiah(item.biaya)}</small></div></li>)}</ul>}
      <p className="pro-agenda-foot">Anggaran kegiatan terbuka: <strong>{rupiah(pending.reduce((n, a) => n + a.biaya, 0))}</strong> · Biaya sesuai catatan Anda, bukan estimasi harga pasar.</p>
    </section>
    <div className="pro-section-heading pro-farm-heading"><div><p className="eyebrow">KENALI SETIAP PETAK</p><h2>Semua lahan saya <span className="pro-count">{farms.length}</span></h2><p>Temukan lahan, lihat perkembangannya, dan lanjutkan pekerjaan.</p></div><button ref={addRef} type="button" className="primary-button" onClick={() => edit("baru")}><Plus size={20}/>Tambah lahan</button></div>
    {form && <div ref={formRef}><FormLahan key={form === "baru" ? "baru" : form.id} catalog={catalog} {...(form === "baru" ? {} : { initial: form })} onBatal={closeForm} onSelesai={() => { closeForm(); load(); setRefresh(n => n + 1); }}/></div>}
    {!!farms.length && <div className="pro-search"><label><span className="field-label"><Search size={17}/> Cari lahan</span><input className="field-input" placeholder="Nama lahan atau wilayah…" value={search} onChange={e => setSearch(e.target.value)}/></label><label><span className="field-label">Tanaman</span><select className="field-input" value={crop} onChange={e => setCrop(e.target.value)}><option value="">Semua tanaman</option>{catalog.seeds.map(seed => <option key={seed.id} value={seed.id}>{seed.crop}</option>)}</select></label><label><span className="field-label">Urutkan</span><select className="field-input" value={sort} onChange={e => setSort(e.target.value)}><option value="nama">Nama lahan</option><option value="panen">Rencana panen</option><option value="luas">Luas terbesar</option></select></label></div>}
    <p className="pro-weather-note">Cuaca kartu masih simulasi berdasarkan koordinat lahan. Periksa kondisi lapangan sebelum mengambil keputusan.</p>
    {!data ? <p className="surface p-6">{galat ? "Pulihkan cadangan di bagian bawah jika data tidak dapat dibaca." : "Sedang membuka lahan Anda…"}</p> : !farms.length ? <section className="surface pro-empty"><Sprout size={42}/><div><h3>Mulai dari satu lahan.</h3><p>Simpan lokasi dan tanaman Anda, atau jelajahi tiga lahan contoh.</p><button type="button" className="reset-button mt-4" disabled={busy} onClick={contoh}>{busy ? "Menyiapkan…" : "Coba dengan 3 lahan contoh"}</button></div></section> : !visible.length ? <p className="surface p-6">Tidak ada lahan yang cocok. Coba nama atau tanaman lain.</p> : <div className="pro-farms-grid">{visible.map(farm => {
      const age = differenceInCalendarDays(parseISO(today), parseISO(farm.tanggalTanam));
      const progress = Math.min(100, Math.max(0, age / farm.hariPanen * 100));
      return <div key={farm.id} className="pro-farm-wrap"><KartuLahan lahan={farm} tanaman={catalog.seeds.find(s => s.id === farm.seedId)?.crop ?? "Tanaman"} penyegaran={refresh} onBuka={onBukaLahan}/><div className="pro-farm-extra"><div className="pro-growth-label"><strong>{age < 0 ? `Tanam ${Math.abs(age)} hari lagi` : `Usia kalender ${age} hari`}</strong><span>{Math.round(progress)}%</span></div><progress aria-label={`Perjalanan musim ${farm.nama}`} value={progress} max={100}/><p>Perkiraan panen {format(addDays(parseISO(farm.tanggalTanam), farm.hariPanen), "d MMM yyyy", { locale: id })}. Kemajuan berdasarkan waktu, bukan kondisi tanaman.</p><div className="pro-farm-actions"><button type="button" className="reset-button" onClick={() => edit(farm)} aria-label={`Ubah ${farm.nama}`}><Pencil size={18}/>Ubah lahan</button><a className="reset-button" href={`https://www.google.com/maps?q=${farm.latitude},${farm.longitude}`} target="_blank" rel="noreferrer" aria-label={`Buka peta ${farm.nama}`}><MapPin size={18}/>Peta lahan</a></div></div></div>;
    })}</div>}
    <section className="pro-backup surface" aria-label="Cadangan data"><div><ShieldCheck size={28}/><h2>Data Anda, tetap di tangan Anda.</h2><p>Lahan dan agenda tersimpan di browser ini. Unduh cadangan untuk disimpan atau dipindahkan ke HP lain. Menghapus data situs menghapus penyimpanan lokal.</p></div><div className="pro-backup-actions"><button type="button" className="primary-button" onClick={exportData}><Download size={20}/>Unduh cadangan</button><button type="button" className="reset-button" onClick={() => fileRef.current?.click()}><Upload size={20}/>Pulihkan cadangan</button><input ref={fileRef} type="file" accept=".json,application/json" className="hidden" aria-label="File cadangan" onChange={e => void importData(e.target.files?.[0])}/></div>
      {restore && <div className="pro-restore"><h3>Periksa sebelum memulihkan</h3><p>File berisi <strong>{restore.farms.length} lahan dan {restore.kegiatan.length} kegiatan</strong>. Memulihkan akan mengganti seluruh data di browser ini ({farms.length} lahan, {activities.length} kegiatan). Unduh cadangan data saat ini terlebih dahulu.</p><div className="flex flex-wrap gap-3 mt-4"><button className="primary-button" type="button" onClick={() => { try { writeWorkspace(restore); setRestore(null); setForm(null); setAgendaForm(false); load(); setInfo("Cadangan berhasil dipulihkan."); } catch (e) { setGalat(pesan(e)); } }}>Ganti data dengan cadangan ini</button><button className="reset-button" type="button" onClick={() => setRestore(null)}>Batal pemulihan</button></div></div>}
    </section>
  </div>;
}

function FormKegiatan({ farms, today, onSave }: { farms: Lahan[]; today: string; onSave: (item: Kegiatan) => void }) {
  const [farm, setFarm] = useState(farms[0]?.id ?? "");
  const [judul, setJudul] = useState(""); const [date, setDate] = useState(today);
  const [cost, setCost] = useState("0"); const [note, setNote] = useState(""); const [error, setError] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  function save(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!judul.trim() || !farm || !date || !/^\d+(?:[.,]\d{1,2})?$/.test(cost) || Number(cost.replace(",", ".")) > 1e12) { setError("Isi kegiatan, lahan, tanggal, dan biaya dengan angka tanpa pemisah ribuan."); return; }
    onSave({ id: crypto.randomUUID(), lahanId: farm, judul: judul.trim(), tanggal: date, biaya: Number(cost.replace(",", ".")), catatan: note, selesai: false });
  }
  return <form aria-label="Tambah kegiatan" className="pro-activity-form" onSubmit={save}>
    <label><span className="field-label">Nama kegiatan</span><input ref={ref} className="field-input" value={judul} maxLength={120} placeholder="Contoh: Periksa saluran air" onChange={e => setJudul(e.target.value)}/></label>
    <label><span className="field-label">Lahan kegiatan</span><select className="field-input" value={farm} onChange={e => setFarm(e.target.value)}>{farms.map(f => <option key={f.id} value={f.id}>{f.nama}</option>)}</select></label>
    <label><span className="field-label">Tanggal kegiatan</span><input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)}/></label>
    <label><span className="field-label">Biaya kegiatan (Rp)</span><input className="field-input" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)}/></label>
    <label className="pro-wide"><span className="field-label">Catatan lapangan</span><textarea className="field-input" value={note} maxLength={1000} placeholder="Apa yang perlu diperhatikan?" onChange={e => setNote(e.target.value)}/></label>
    {error && <p role="alert" className="error-message pro-wide">{error}</p>}
    <button type="submit" className="primary-button"><Check size={19}/>Simpan kegiatan</button>
  </form>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CalendarDays, FlaskConical, Leaf, LogOut, MapPinned, Sprout, Wallet, History, Stethoscope } from "lucide-react";
import KalkulatorDosis from "./tank-mix-calculator";
import PlannerTimeline from "./planner-timeline";
import type { CatalogResponse, Lahan, Pengguna, SesiJuragan } from "@agri/contracts";
import { useApiQuery } from "../lib/use-api-query";
import { requestApi } from "../lib/api";
import LoginNomorHp from "./juragan/login-nomor-hp";
import DashboardJuragan from "./juragan/dashboard-juragan";
import DashboardProfesional from "./juragan/dashboard-profesional";

import KlinikDashboard from "./klinik-dashboard";
import FinanceDashboard from "./records/finance-dashboard";
import DiseaseDashboard from "./records/disease-dashboard";
import { DashboardNavigation, type DashboardView } from "./dashboard-navigation";

export default function Dashboard({ initialView = "lahan" }: { initialView?: DashboardView } = {}) {
  const sesi = useApiQuery<SesiJuragan>("auth/session");
  useEffect(() => {
    const expired = () => sesi.retry();
    window.addEventListener("agri:sesi-berakhir", expired);
    return () => window.removeEventListener("agri:sesi-berakhir", expired);
  }, [sesi.retry]);
  if (sesi.loading) return <main className="p-8" role="status">Sedang membuka ruang lahan Anda…</main>;
  if (sesi.error) return <main className="mx-auto max-w-lg p-8"><p role="alert" className="error-message mb-5">{sesi.error}</p><button type="button" className="primary-button w-full" onClick={sesi.retry}>Coba lagi</button></main>;
  if (!sesi.data?.pengguna) return <LoginNomorHp onMasuk={sesi.retry}/>;
  return <RuangJuragan initialView={initialView} key={sesi.data.pengguna.id} pengguna={sesi.data.pengguna} onKeluar={sesi.retry}/>;
}

function RuangJuragan({ pengguna, onKeluar, initialView }: { pengguna: Pengguna; onKeluar: () => void; initialView: DashboardView }) {
  const [view, setView] = useState<DashboardView>(initialView);
  const [visited, setVisited] = useState<DashboardView[]>([initialView]);
  const navigate = useCallback((next: DashboardView) => {
    setVisited(current => current.includes(next) ? current : [...current, next]);
    setView(next); window.history.replaceState(null, "", `#${next}`); window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const next = window.location.hash.slice(1);
    if (["lahan", "timeline", "tank-mix", "klinik", "keuangan", "riwayat"].includes(next)) navigate(next as DashboardView);
  }, [navigate]);
  const [lahanAktif, setLahanAktif] = useState<Lahan | null>(null);
  const [keluarSibuk, setKeluarSibuk] = useState(false);
  const [galatKeluar, setGalatKeluar] = useState("");
  const catalog = useApiQuery<CatalogResponse>("catalog");
  const navigation = [
    { id: "lahan" as const, label: "Lahan saya", detail: "Pantau semua lokasi", Icon: MapPinned },
    { id: "timeline" as const, label: "Jadwal tanam", detail: "Atur langkah budidaya", Icon: CalendarDays },
    { id: "tank-mix" as const, label: "Kalkulator dosis", detail: "Hitung kebutuhan tangki", Icon: FlaskConical },
    { id: "klinik" as const, label: "Klinik tanaman", detail: "Kenali gejala dari foto", Icon: Stethoscope },
    { id: "keuangan" as const, label: "Buku kas tani", detail: "Biaya, pendapatan, ROI", Icon: Wallet },
    { id: "riwayat" as const, label: "Riwayat penyakit", detail: "Pantau pola per lahan", Icon: History },
  ];
  const judul = navigation.find(item => item.id === view)!.label;
  const plannerView = view === "timeline" || view === "tank-mix";
  async function keluar() {
    setKeluarSibuk(true); setGalatKeluar("");
    try { await requestApi("auth/logout", "{}"); onKeluar(); }
    catch (error) { setGalatKeluar(error instanceof Error ? error.message : "Belum bisa keluar. Coba lagi."); }
    finally { setKeluarSibuk(false); }
  }
  function bukaLahan(lahan: Lahan) { setLahanAktif(lahan); navigate("timeline"); window.scrollTo({ top: 0 }); }

  return (
    <DashboardNavigation.Provider value={{view,navigate}}><div className="app-shell">
      <a className="skip-link" href="#main-content">Langsung ke isi</a>
      <aside className="sidebar" aria-label="Navigasi Cyphera">
        <div className="brand"><span className="brand-mark"><Sprout size={25} /></span><div><strong>Cyphera<span className="brand-dot">.</span></strong><span>Perencana tani</span></div></div>
        <div className="sidebar-scroll" role="region" aria-label="Daftar menu Cyphera" tabIndex={0}>
        <p className="sidebar-caption">RUANG KERJA</p>
        <nav aria-label="Menu utama" className="side-nav">
          {navigation.map(({ id, label, detail, Icon }) => <button type="button" key={id} onClick={() => navigate(id)} aria-label={label} aria-pressed={view === id} aria-controls={`${id}-panel`} className={`nav-item ${view === id ? "is-active" : ""}`}><Icon size={22} /><span><strong>{label}</strong><small>{detail}</small></span><span className="nav-indicator" /></button>)}
        </nav>
        </div>
        <div className="sidebar-bottom"><a className="sidebar-reference" href="https://www.bayer.com/id/id/produk/indonesia-crop-protection" target="_blank" rel="noreferrer"><span className="sidebar-reference-icon"><Leaf size={20}/></span><span><strong>Panduan produk</strong><small>Referensi resmi Bayer</small></span><ArrowUpRight size={18}/><span className="sr-only"> (buka tab baru)</span></a><p className="sidebar-foot">Cyphera / Ruang kerja pertanian</p></div>
      </aside>

      <div className="app-content">
        <header className="topbar juragan-topbar"><p><span className="hidden sm:inline">Perencanaan <span className="mx-3 text-[#708078]">/</span></span><strong>{judul}</strong></p><div className="flex items-center gap-3"><span className="status-pill"><span /> {view === "tank-mix" ? "Dosis dari label" : view === "klinik" ? "Pengamatan tanaman" : view === "keuangan" ? "Buku kas" : view === "riwayat" ? "Riwayat pengamatan" : "Cuaca simulasi"}</span>{process.env.NEXT_PUBLIC_DEMO_STATIC !== "true" && <button type="button" className="logout-button" onClick={keluar} disabled={keluarSibuk}><LogOut size={20}/>{keluarSibuk ? "Tunggu…" : "Keluar"}</button>}</div></header>
        <main id="main-content" tabIndex={-1} className="workspace">
          {process.env.NEXT_PUBLIC_DEMO_STATIC === "true" && plannerView && <p className="rounded-xl bg-green-100 p-5 mb-5 text-slate-900"><strong>Penyimpanan di perangkat ini.</strong> Data lahan hanya tersimpan di perangkat ini. Cuaca adalah simulasi. Data hilang jika penyimpanan situs dihapus.</p>}
          {galatKeluar && <p role="alert" className="error-message mb-5">{galatKeluar}</p>}
          {plannerView && <div className="page-heading"><div><p className="eyebrow">{view === "timeline" ? "DARI BENIH, SELANGKAH DEMI SELANGKAH" : "PERENCANAAN CAMPURAN"}</p><h1>{view === "timeline" ? "Musim tanam Anda." : "Takaran lebih terencana."}</h1><p>{view === "timeline" ? "Satu tempat untuk mengatur tanggal dan melihat setiap kegiatan." : "Hitung kebutuhan obat dan air sesuai luas lahan serta tangki Anda."}</p></div><div className="heading-mark" aria-hidden="true">{view === "timeline" ? <Sprout size={35} strokeWidth={1.5} /> : <FlaskConical size={35} strokeWidth={1.5} />}</div></div>}
          {plannerView && lahanAktif && <div className="active-farm-context"><button type="button" className="reset-button" onClick={() => navigate("lahan")}><ArrowLeft size={19}/>Semua lahan</button><div><strong>{lahanAktif.nama} · {lahanAktif.lokasi}</strong><p>Rencana dibuka dari data lahan ini. Perubahan pada simulasi di bawah belum disimpan ke lahan.</p></div></div>}
          {catalog.loading && <div className="surface p-6" role="status">Sedang memuat pilihan tanaman dan produk…</div>}
          {catalog.error && <div className="surface p-6"><p role="alert" className="error-message mb-4">{catalog.error}</p><button type="button" className="primary-button" onClick={catalog.retry}>Coba muat lagi</button></div>}
          {catalog.data && <>
            <div id="lahan-panel" hidden={view !== "lahan"}>{process.env.NEXT_PUBLIC_DEMO_STATIC === "true" ? <DashboardProfesional catalog={catalog.data} onBukaLahan={bukaLahan}/> : <DashboardJuragan pengguna={pengguna} catalog={catalog.data} aktif={view === "lahan"} onBukaLahan={bukaLahan}/>}</div>
            <div id="timeline-panel" hidden={view !== "timeline"}><PlannerTimeline key={lahanAktif?.id ?? "umum"} lahan={lahanAktif} catalog={catalog.data} onOpenCalculator={() => navigate("tank-mix")} /></div>
            <div id="tank-mix-panel" hidden={view !== "tank-mix"}><KalkulatorDosis key={lahanAktif?.id ?? "umum"} products={catalog.data.products} luasAwal={lahanAktif?.luasHektare ?? null} /></div>
          </>}
          <div id="klinik-panel" hidden={view !== "klinik"}>{visited.includes("klinik") && <KlinikDashboard/>}</div>
          <div id="keuangan-panel" hidden={view !== "keuangan"}>{visited.includes("keuangan") && <FinanceDashboard active={view === "keuangan"}/>}</div>
          <div id="riwayat-panel" hidden={view !== "riwayat"}>{visited.includes("riwayat") && <DiseaseDashboard active={view === "riwayat"}/>}</div>
          <footer className="workspace-footer"><span>Cyphera · Perencana tani</span><span>Rencanakan dengan jelas, gunakan sesuai label.</span></footer>
        </main>
      </div>
    </div></DashboardNavigation.Provider>
  );
}

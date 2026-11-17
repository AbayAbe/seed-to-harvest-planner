"use client";

import PlantingTaskCompletion from "./micro-interactions/PlantingTaskCompletion";
import { CropReference } from "./bayer-reference";
import { useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { ArrowDown, ArrowRight, CalendarDays, Check, ChevronDown, CloudRain, Droplets, FlaskConical, Sprout, Sun, CloudSun, Eye, Wheat, CircleAlert } from "lucide-react";
import type { CatalogResponse, Lahan, TimelineReport, TimelineRequest, WeatherCondition, WeatherScenarioId } from "@agri/contracts";
import { useApiQuery } from "../lib/use-api-query";

const weatherLabels: Record<WeatherCondition, string> = { Clear: "Cerah", Cloudy: "Berawan", Rain: "Hujan" };
const dateLabel = (date: string, pattern = "d MMMM yyyy") => format(parseISO(date), pattern, { locale: id });

export default function PlannerTimeline({ catalog, lahan = null, onOpenCalculator }: { catalog: CatalogResponse; lahan?: Lahan | null; onOpenCalculator: () => void }) {
  const { seeds: SEED_VARIETIES, scenarios: WEATHER_SCENARIOS } = catalog;
  const [seedId, setSeedId] = useState(lahan?.seedId ?? SEED_VARIETIES[0]?.id ?? "");
  const [startDate, setStartDate] = useState(lahan?.tanggalTanam ?? "2026-11-01");
  const [scenario, setScenario] = useState<WeatherScenarioId>("mixed");
  const [harvestDay, setHarvestDay] = useState(String(lahan?.hariPanen ?? SEED_VARIETIES[0]?.phases.find((phase) => phase.type === "harvest")?.dayOffset ?? 100));
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const harvestValue = Number(harvestDay);
  const harvestError = !/^\d+$/.test(harvestDay) || !Number.isSafeInteger(harvestValue) || harvestValue < 1;
  const currentScenario = WEATHER_SCENARIOS.find((item) => item.id === scenario)!;
  const validationError = !startDate ? "Pilih tanggal tanam untuk membuat jadwal."
    : harvestError ? "Isi hari panen dengan bilangan bulat lebih dari nol." : "";
  const request: TimelineRequest = { seedId, startDate, scenario, harvestDayOffset: harvestValue };
  const query = useApiQuery<TimelineReport>("timeline", JSON.stringify(request), validationError);
  const calculation = { tasks: query.data?.tasks ?? [], needsReview: query.data?.needsReview ?? [], error: query.error };
  const delayedCount = calculation.tasks.filter((task) => task.delayDays > 0).length;
  const visibleTasks = calculation.tasks.filter((task) => !delayedOnly || task.delayDays > 0);
  const lastTask = calculation.tasks.at(-1);
  const spanDays = lastTask ? differenceInCalendarDays(parseISO(lastTask.scheduledDate), parseISO(startDate)) : 0;
  const seed = SEED_VARIETIES.find((item) => item.id === seedId);

  return <>
    <section className="season-banner" aria-label="Ringkasan rencana">
      <div className="season-copy"><span className="light-eyebrow"><Sprout size={16} /> RENCANA BUDIDAYA · SIMULASI</span><h2>{seed?.crop ?? "Pilih tanaman"}</h2><p>{lastTask ? `${dateLabel(startDate, "d MMM yyyy")} — ${dateLabel(lastTask.scheduledDate, "d MMM yyyy")}` : "Tentukan awal musim tanam Anda"}</p></div>
      <div className="season-stats"><div><strong>{(calculation.tasks.length + calculation.needsReview.length).toString().padStart(2, "0")}</strong><span>Kegiatan contoh</span></div><div><strong>{delayedCount.toString().padStart(2, "0")}</strong><span>Jadwal bergeser</span></div><div><strong>{spanDays}</strong><span>Hari rencana</span></div>{calculation.needsReview.length > 0 && <div><strong>{calculation.needsReview.length}</strong><span>Perlu ditinjau</span></div>}</div>
      <svg className="field-art" viewBox="0 0 260 220" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1">{[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <path key={n} d={`M ${-60 + n * 26} 220 Q ${80 + n * 14} 90 ${180 + n * 24} -30`} />)}</g></svg>
    </section>

    <div className="planner-grid">
      <aside className="space-y-5">
        <section className="surface settings-card"><div className="section-kicker"><span className="step-number">01</span> PENGATURAN</div><h2>Mulai dari lahan Anda</h2><p className="body-muted mt-2">{SEED_VARIETIES.length} tanaman · {WEATHER_SCENARIOS.length} skenario cuaca</p>
          <div className="mt-6 space-y-5">
            <div><label htmlFor="seed" className="field-label">Jenis tanaman</label><select id="seed" className="field-input" value={seedId} onChange={(event) => { const selected = SEED_VARIETIES.find((item) => item.id === event.target.value); if (!selected) return; setSeedId(selected.id); setHarvestDay(String(selected.phases.find((phase) => phase.type === "harvest")!.dayOffset)); setExpanded(null); setDelayedOnly(false); }}>{SEED_VARIETIES.map((item) => <option key={item.id} value={item.id}>{item.crop}</option>)}</select><p className="field-help">{seed?.startNote}</p></div>
            <div><label htmlFor="start" className="field-label">Tanggal mulai tanam</label><input className="field-input" id="start" type="date" value={startDate} aria-invalid={!startDate} aria-describedby={!startDate ? "schedule-error" : undefined} onChange={(event) => { setStartDate(event.target.value); setExpanded(null); }} /></div>
            <div><label htmlFor="harvest-day" className="field-label">Rencana panen (hari setelah tanam)</label><input id="harvest-day" type="text" inputMode="numeric" className="field-input" value={harvestDay} onChange={(event) => { setHarvestDay(event.target.value); setExpanded(null); }} aria-invalid={harvestError} aria-describedby={harvestError ? "schedule-error" : "harvest-help"}/><p id="harvest-help" className="field-help">Angka awal hanya contoh. Ubah untuk mencoba panen lebih cepat atau lebih lambat.</p></div>
            <div><label htmlFor="weather-scenario" className="field-label">Skenario cuaca</label><select id="weather-scenario" className="field-input" value={scenario} onChange={(event) => { const selected = WEATHER_SCENARIOS.find((item) => item.id === event.target.value); if (selected) setScenario(selected.id); setExpanded(null); }}>{WEATHER_SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="field-help">{currentScenario.description}</p></div>
          </div><div className="auto-note"><Check size={16} /> Jadwal diperbarui otomatis</div>
        </section>
        <section className="weather-note"><CloudRain size={25} /><h3>Aturan cuaca dalam simulasi</h3><p>Hanya aplikasi produk yang digeser saat hujan. Tanam, pengamatan, dan panen tetap mengikuti rencana; kondisi lapangan tetap perlu diperiksa.</p><span>Belum mencakup angin, kelembapan, atau suhu.</span></section>
        <button type="button" className="calculator-shortcut" onClick={onOpenCalculator}><FlaskConical size={22}/><span><strong>Hitung campuran</strong><small>Buka kalkulator dosis</small></span><ArrowRight size={19}/></button>
      </aside>

      <section className="surface schedule-card" aria-labelledby="schedule-title" aria-busy={query.loading}>
        <div className="schedule-heading"><div><div className="section-kicker"><span className="step-number">02</span> LINIMASA</div><h2 id="schedule-title">Langkah budidaya Anda</h2><p className="body-muted mt-2">{currentScenario.name} · Pilih kegiatan untuk melihat rinciannya.</p></div><CalendarDays size={24} className="text-[#46674e]" /></div>
        <div className="simulation-context"><InfoNote /> <p>Semua hari kegiatan dan panen adalah contoh simulasi. Aplikasi obat hanya bila diperlukan dan sesuai label; kegiatan sebelum panen tetap perlu pemeriksaan interval pra-panen.</p></div>
        {calculation.needsReview.length > 0 && <section className="review-panel" aria-label="Kegiatan perlu ditinjau"><h3><CircleAlert size={20}/>{calculation.needsReview.length} kegiatan perlu ditinjau</h3><p>Kegiatan berikut belum memiliki tanggal pelaksanaan. Kegiatan lainnya tetap ditampilkan.</p><ul>{calculation.needsReview.map((task) => <li key={task.id}><strong>{task.phase.name}</strong><span>Rencana awal: {dateLabel(task.originalDate)}.</span><p>{task.reason === "persistent-rain" ? `Hujan masih muncul setelah 7 kali penundaan, sampai ${dateLabel(task.lastCheckedDate)}. Tinjau kembali kondisi dan label produk.` : "Tanggal kegiatan menyentuh atau melewati rencana panen. Tinjau jadwal dan interval pra-panen; aplikasi tidak dijadwalkan otomatis."}</p></li>)}</ul></section>}
        <div className="schedule-filters" aria-label="Filter kegiatan"><button type="button" aria-pressed={!delayedOnly} onClick={() => setDelayedOnly(false)}>Semua kegiatan <span>{calculation.tasks.length}</span></button><button type="button" aria-pressed={delayedOnly} onClick={() => setDelayedOnly(true)}>Jadwal bergeser <span>{delayedCount}</span></button></div>
        {query.loading ? <p role="status" className="p-6">Sedang memperbarui jadwal…</p> : calculation.error ? <div className="p-6"><p role="alert" id="schedule-error" className="error-message mb-4">{calculation.error}</p>{!validationError && <button type="button" className="primary-button" onClick={query.retry}>Coba buat jadwal lagi</button>}</div> : !visibleTasks.length ? <div className="empty-schedule"><Check size={28}/><h3>Tidak ada jadwal bergeser</h3><p>{calculation.needsReview.length ? "Lihat kegiatan yang perlu ditinjau di atas." : "Semua kegiatan tetap mengikuti rencana awal."}</p></div> : <ol className="timeline-list">{visibleTasks.map((task) => {
          const isOpen = expanded === task.id;
          const Icon = task.phase.type === "planting" ? Sprout : task.phase.type === "monitoring" ? Eye : task.phase.type === "harvest" ? Wheat : Droplets;
          const WeatherIcon = task.forecast.condition === "Rain" ? CloudRain : task.forecast.condition === "Cloudy" ? CloudSun : Sun;
          const actualDay = differenceInCalendarDays(parseISO(task.scheduledDate), parseISO(startDate));
          return <li key={task.id} className={`timeline-item ${task.delayDays ? "is-delayed" : ""}`}>
            <span className="timeline-dot"><Icon size={21}/></span><div className="timeline-content"><button type="button" className="task-button" aria-expanded={isOpen} aria-controls={`detail-${task.phase.id}`} onClick={() => setExpanded(isOpen ? null : task.id)}><span><span className="task-date">{dateLabel(task.scheduledDate, "dd MMM yyyy")} <span>· Hari ke-{actualDay}</span></span><strong>{task.phase.name}</strong><span className="task-product">{task.phase.productName ?? (task.phase.type === "planting" ? seed?.name : task.phase.type === "harvest" ? "Titik panen simulasi" : task.phase.type === "monitoring" ? "Periksa kondisi di lahan" : "Produk belum ditentukan")}</span></span><ChevronDown size={20} className={isOpen ? "rotate-180" : ""}/></button>
              {lahan && seedId === lahan.seedId && startDate === lahan.tanggalTanam && <PlantingTaskCompletion farmId={lahan.id} phaseId={task.phase.id} startDate={startDate} title={task.phase.name} date={task.scheduledDate}/>}
              <div className="task-badges"><span className={task.delayDays ? "badge badge-amber" : "badge badge-green"}>{task.delayDays ? <><ArrowRight size={13}/> Bergeser {task.delayDays} hari</> : <><Check size={13}/> Sesuai rencana</>}</span><span className="weather-label"><WeatherIcon size={15}/>{weatherLabels[task.forecast.condition]}</span></div>
              {isOpen && <div id={`detail-${task.phase.id}`} className="task-details"><p><strong>Rencana awal:</strong> {dateLabel(task.originalDate)} (hari ke-{task.phase.dayOffset}).</p>{task.delayDays > 0 ? <p><strong>Alasan perubahan:</strong> prakiraan hujan pada jadwal sebelumnya. Jadwal baru sudah diperiksa kembali.</p> : <p>Jadwal tetap mengikuti tanggal tanam yang Anda pilih.</p>}<p>Prakiraan pada tanggal kegiatan: {weatherLabels[task.forecast.condition].toLowerCase()} (simulasi).</p><p>{task.phase.note ?? "Kegiatan ini merupakan contoh perencanaan. Sesuaikan dengan kebutuhan tanaman, kondisi lahan, serta label produk."}</p>{task.forecast.condition === "Rain" && <p>Aturan tunda otomatis hanya berlaku pada aplikasi produk. Kegiatan ini tetap perlu ditinjau sesuai kondisi hujan di lapangan.</p>}</div>}
            </div>
          </li>;
        })}</ol>}
        <div className="schedule-footer"><ArrowDown size={17}/><p>Jadwal dan pasangan produk–tanaman masih contoh. Cocokkan dengan label dan arahan petugas pertanian.</p></div>
      </section>
    </div>
    {seed && <CropReference key={seed.crop} crop={seed.crop}/>}
  </>;
}

function InfoNote() { return <CircleAlert size={17} aria-hidden="true" />; }

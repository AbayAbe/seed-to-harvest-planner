import KlinikTanaman from "../../components/klinik-dashboard";
export const metadata = { title: "Klinik Tanaman | Cyphera" };
export default function ClinicPage() {
  return <main className="min-h-screen bg-[#f3f6ef] px-4 pb-12 sm:px-8"><div className="mx-auto max-w-6xl"><a href="../" className="inline-flex min-h-[64px] items-center font-semibold text-emerald-950">← Kembali ke lahan saya</a></div><KlinikTanaman/></main>;
}

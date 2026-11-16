/** Nomor HP disimpan dalam format internasional, misalnya +62812… */
export interface Pengguna {
  readonly id: string;
  readonly nomorHp: string;
  readonly nama: string;
  readonly dibuatPada: string;
}

/** Relasi satu-ke-banyak: satu Pengguna memiliki banyak Lahan. */
export interface Lahan {
  readonly id: string;
  readonly penggunaId: Pengguna["id"];
  readonly nama: string;
  readonly lokasi: string;
  readonly luasHektare: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly seedId: string;
  readonly tanggalTanam: string;
  readonly hariPanen: number;
  /** Alamat topik yang disiapkan untuk sensor; belum ada koneksi broker MQTT. */
  readonly topikMqtt: string | null;
  readonly dibuatPada: string;
}
export interface PenggunaDenganLahan extends Pengguna {
  readonly lahan: readonly Lahan[];
}
export type MasukanLahan = Pick<Lahan, "nama" | "lokasi" | "luasHektare" | "latitude" | "longitude" | "seedId" | "tanggalTanam">;
export interface CuacaLahan {
  readonly latitude: number;
  readonly longitude: number;
  readonly status: "Cerah" | "Berawan" | "Hujan";
  readonly ikon: "sun" | "cloud-sun" | "cloud-rain";
  readonly suhuCelsius: number;
  /** Persentase 0–100 untuk prakiraan tiga jam berikutnya, bukan volume hujan. */
  readonly potensiHujanPersen: number;
  readonly waktuPrakiraan: string;
  readonly diperbaruiPada: string;
  readonly sumber: "simulasi";
}
export type KanalOtp = "whatsapp" | "sms";
export interface TantanganOtp {
  readonly id: string;
  readonly nomorTersamar: string;
  readonly kanal: KanalOtp;
  readonly berlakuSampai: string;
  readonly kirimUlangPada: string;
  readonly mode: "simulasi";
  /** Hanya untuk demonstrasi lokal. Penyedia sungguhan tidak boleh mengirim ini. */
  readonly kodeSimulasi: string;
}
export interface SesiJuragan {
  readonly pengguna: Pengguna | null;
  readonly mode: "simulasi";
}

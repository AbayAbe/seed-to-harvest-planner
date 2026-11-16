import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { KanalOtp, Pengguna, TantanganOtp } from "@agri/contracts";
import type { IncomingMessage } from "node:http";
import { HttpError } from "../http-error.js";
import { DatabaseJuragan } from "./database.js";

const MENIT = 60_000;
export const DURASI_SESI_DETIK = 8 * 60 * 60;
export const NAMA_COOKIE = "agri_sesi";
export function normalisasiNomorHp(value: unknown): string {
  if (typeof value !== "string" || value.length > 30) throw new HttpError(400, "NOMOR_INVALID", "Isi nomor HP Indonesia yang benar.");
  let nomor = value.replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (nomor.startsWith("0")) nomor = `62${nomor.slice(1)}`;
  if (!/^628\d{7,11}$/.test(nomor)) throw new HttpError(400, "NOMOR_INVALID", "Isi nomor HP seperti 081234567890.");
  return `+${nomor}`;
}
/** Adapter simulasi tidak mengirim pesan WhatsApp/SMS dan tidak memverifikasi kepemilikan nomor. */
export interface PengirimOtp {
  kirim(nomorHp: string, kanal: KanalOtp, kode: string): Promise<{ mode: "simulasi"; kodeSimulasi: string }>;
}
export const pengirimOtpSimulasi: PengirimOtp = {
  async kirim(_nomorHp, _kanal, kode) { return { mode: "simulasi", kodeSimulasi: kode }; },
};
interface KodeTersimpan {
  nomorHp: string; hash: Buffer; expires: number; attempts: number;
}
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export class LayananOtp {
  private readonly challenges = new Map<string, KodeTersimpan>();
  private readonly limits = new Map<string, { until: number; count: number }>();
  private readonly cooldowns = new Map<string, number>();
  private readonly secret = randomBytes(32);
  constructor(private readonly db: DatabaseJuragan, private readonly now = Date.now, private readonly pengirim = pengirimOtpSimulasi) {}
  private digest(id: string, kode: string) { return createHmac("sha256", this.secret).update(`${id}:${kode}`).digest(); }
  private batasi(key: string, max: number) {
    const now = this.now();
    const record = this.limits.get(key);
    if (record && record.until > now) {
      if (record.count >= max) throw new HttpError(429, "TERLALU_SERING", "Terlalu banyak percobaan. Tunggu 15 menit, lalu coba lagi.");
      record.count++;
    } else this.limits.set(key, { count: 1, until: now + 15 * MENIT });
  }
  async minta(nomor: unknown, kanal: unknown, alamat: string): Promise<TantanganOtp> {
    const now = this.now();
    for (const [key, value] of this.challenges) if (value.expires <= now) this.challenges.delete(key);
    for (const [key, value] of this.limits) if (value.until <= now) this.limits.delete(key);
    for (const [key, value] of this.cooldowns) if (value <= now) this.cooldowns.delete(key);
    const nomorHp = normalisasiNomorHp(nomor);
    if (kanal !== "whatsapp" && kanal !== "sms") throw new HttpError(400, "KANAL_INVALID", "Pilih WhatsApp atau SMS.");
    this.batasi(`alamat:${alamat}`, 60);
    if ((this.cooldowns.get(nomorHp) ?? 0) > now) throw new HttpError(429, "TUNGGU_KODE", "Tunggu 60 detik sebelum meminta kode lagi.");
    this.batasi(`nomor:${nomorHp}`, 5);
    const id = randomUUID();
    const kode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    // Kode lama dinonaktifkan segera ketika kode baru dibuat.
    for (const [key, value] of this.challenges) if (value.nomorHp === nomorHp) this.challenges.delete(key);
    this.challenges.set(id, { nomorHp, hash: this.digest(id, kode), expires: now + 5 * MENIT, attempts: 0 });
    this.cooldowns.set(nomorHp, now + MENIT);
    try {
      const hasil = await this.pengirim.kirim(nomorHp, kanal, kode);
      return { id, nomorTersamar: `${nomorHp.slice(0, 5)}••••${nomorHp.slice(-4)}`, kanal,
        berlakuSampai: new Date(now + 5 * MENIT).toISOString(), kirimUlangPada: new Date(now + MENIT).toISOString(), ...hasil };
    } catch (error) { this.challenges.delete(id); throw error; }
  }
  verifikasi(id: unknown, kode: unknown): { pengguna: Pengguna; token: string } {
    const challenge = typeof id === "string" ? this.challenges.get(id) : undefined;
    if (!challenge || challenge.expires <= this.now() || challenge.attempts >= 5) {
      if (typeof id === "string") this.challenges.delete(id);
      throw new HttpError(400, "OTP_KEDALUWARSA", "Kode sudah tidak berlaku. Minta kode baru.");
    }
    challenge.attempts++;
    if (typeof kode !== "string" || !/^\d{6}$/.test(kode) || !timingSafeEqual(challenge.hash, this.digest(id as string, kode))) {
      if (challenge.attempts >= 5) this.challenges.delete(id as string);
      throw new HttpError(400, "OTP_SALAH", challenge.attempts >= 5 ? "Lima kali salah. Minta kode baru." : "Kode belum cocok. Periksa 6 angka yang Anda masukkan.");
    }
    this.challenges.delete(id as string);
    const pengguna = this.db.penggunaUntukNomor(challenge.nomorHp, this.now());
    const token = randomBytes(32).toString("hex");
    this.db.buatSesi(hashToken(token), pengguna.id, this.now() + DURASI_SESI_DETIK * 1000, this.now());
    return { pengguna, token };
  }
  private token(req: IncomingMessage) {
    return req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${NAMA_COOKIE}=`))?.slice(NAMA_COOKIE.length + 1) ?? "";
  }
  pengguna(req: IncomingMessage): Pengguna | null {
    const token = this.token(req);
    return /^[a-f0-9]{64}$/.test(token) ? this.db.penggunaDariSesi(hashToken(token), this.now()) : null;
  }
  wajibMasuk(req: IncomingMessage): Pengguna {
    const pengguna = this.pengguna(req);
    if (!pengguna) throw new HttpError(401, "SESI_BERAKHIR", "Silakan masuk lagi untuk membuka lahan Anda.");
    return pengguna;
  }
  keluar(req: IncomingMessage) { this.db.hapusSesi(hashToken(this.token(req))); }
}
export function cookieSesi(token: string, secure: boolean, hapus = false): string {
  return `${NAMA_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${hapus ? 0 : DURASI_SESI_DETIK}${secure ? "; Secure" : ""}`;
}

/** Skema SQLite lokal. Kunci asing dan indeks membatasi lahan pada pemiliknya. */
export const SKEMA_JURAGAN = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS pengguna (
  id TEXT PRIMARY KEY,
  nomorHp TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  dibuatPada TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS lahan (
  id TEXT PRIMARY KEY,
  penggunaId TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  nama TEXT NOT NULL,
  lokasi TEXT NOT NULL,
  luasHektare REAL NOT NULL CHECK (luasHektare > 0 AND luasHektare <= 1000000),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  seedId TEXT NOT NULL,
  tanggalTanam TEXT NOT NULL,
  hariPanen INTEGER NOT NULL CHECK (hariPanen > 0),
  topikMqtt TEXT UNIQUE,
  dibuatPada TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS lahan_pemilik ON lahan(penggunaId);
CREATE TABLE IF NOT EXISTS sesi (
  hashToken TEXT PRIMARY KEY,
  penggunaId TEXT NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  berlakuSampai INTEGER NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS sesi_kedaluwarsa ON sesi(berlakuSampai);
`;

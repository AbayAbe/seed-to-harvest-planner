/** Normalized SQLite schema. Amounts are whole rupiah; product quantities retain units. */
export const RECORDS_SCHEMA = `
CREATE UNIQUE INDEX IF NOT EXISTS lahan_scope ON lahan(id, penggunaId);
CREATE TABLE IF NOT EXISTS katalog_harga (
 id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES pengguna(id), name TEXT NOT NULL,
 unit TEXT NOT NULL CHECK(unit IN ('ml','g')), packQuantity REAL NOT NULL CHECK(packQuantity>0),
 packPriceRp INTEGER NOT NULL CHECK(packPriceRp>0)
) STRICT;
CREATE TABLE IF NOT EXISTS transaksi_kas (
 id TEXT PRIMARY KEY, userId TEXT NOT NULL, farmId TEXT NOT NULL, date TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('expense','income')), description TEXT NOT NULL,
 amountRp INTEGER NOT NULL CHECK(amountRp>=0), usageJson TEXT,
 FOREIGN KEY(farmId,userId) REFERENCES lahan(id,penggunaId)
) STRICT;
CREATE INDEX IF NOT EXISTS kas_periode ON transaksi_kas(userId,farmId,date);
CREATE TABLE IF NOT EXISTS log_penyakit (
 id TEXT PRIMARY KEY, userId TEXT NOT NULL, farmId TEXT NOT NULL, date TEXT NOT NULL,
 disease TEXT NOT NULL, note TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('manual','ai')),
 analysisId TEXT, UNIQUE(userId,analysisId),
 CHECK((source='manual' AND analysisId IS NULL) OR (source='ai' AND analysisId IS NOT NULL)),
 FOREIGN KEY(farmId,userId) REFERENCES lahan(id,penggunaId)
) STRICT;
CREATE INDEX IF NOT EXISTS penyakit_periode ON log_penyakit(userId,farmId,date);
`;

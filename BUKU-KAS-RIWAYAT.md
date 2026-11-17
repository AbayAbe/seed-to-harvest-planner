# Buku Kas Tani dan Riwayat Penyakit — Cyphera

## Tersedia di GitHub Pages

- `/keuangan/`: katalog harga pribadi, pemakaian produk, biaya lain, pendapatan
  panen, laba dan ROI per lahan; filter lahan dan periode.
- `/riwayat/`: catatan manual gejala/penyakit yang terhubung ke ID lahan,
  daftar riwayat, dan grafik frekuensi per lahan–penyakit.
- Kalkulator tangki menyediakan **Catat biaya di Buku Kas**. Tombol membawa
  kebutuhan produk total (dibulatkan maksimal 3 desimal), bukan dosis per tangki.
  Pengguna memilih lahan dan harga produk lalu mengonfirmasi pemakaian nyata.
  Hasil kalkulator tidak otomatis membebankan biaya.

Mode Pages tidak memanggil API dan tidak membutuhkan API key. Data menggunakan
`agri:workspace:v2.records` di localStorage, bersama data lahan. Cadangan ekspor
dan impor di Lahan saya mencakup ketiganya. Data lama tanpa `records` dibaca
sebagai katalog/kas/riwayat kosong. Pemulihan cadangan lama mengganti seluruh
workspace, termasuk mengosongkan buku kas dan riwayat; UI menjelaskan hal ini
sebelum konfirmasi. Batas cadangan 2 MB dan 2.000 entri untuk setiap jenis.

Catatan Klinik lama yang tidak mempunyai ID lahan tetap terpisah. Tidak ada
tebakan untuk memasangkan nama lahan lama ke ID lahan. AI tetap belum aktif di
Pages; entri dari form baru selalu bersumber `manual`. Status AI dalam cadangan
lokal bukan bukti autentik karena file cadangan dapat diedit pemiliknya.

## Struktur data dan file

- `shared/src/records.ts`: `ProductPrice`, `CashEntry`, `DiseaseLog`, ringkasan.
- `backend/src/records/schema.ts`: SQL SQLite yang dijalankan saat database dibuat.
- `backend/src/records/domain.ts`: validasi, perhitungan, agregasi; dipakai backend
  dan frontend agar rumus sama.
- `backend/src/records/repository.ts`: persistensi dengan prepared statements.
- `backend/src/records/router.ts`: endpoint Express dan pemeriksaan sesi.
- `frontend/src/components/records/`: dashboard, filter, dan komponen umum.
- `frontend/src/lib/use-farm-records.ts`: adapter localStorage atau API.

| Tabel | Atribut utama | Relasi |
|---|---|---|
| `katalog_harga` | id, userId, name, unit, packQuantity, packPriceRp | pemilik |
| `transaksi_kas` | id, userId, farmId, date, kind, description, amountRp, usageJson | lahan + pemilik |
| `log_penyakit` | id, userId, farmId, date, disease, note, source, analysisId | lahan + pemilik |

Transaksi panen menggunakan `kind='income'` pada `transaksi_kas`. Biaya memakai
`kind='expense'`. `usageJson` menyimpan salinan harga, satuan, ukuran kemasan,
serta jumlah produk yang dipakai saat transaksi. Pembaruan katalog tidak
mengubah transaksi yang sudah tercatat. Foreign key gabungan `(farmId,userId)`
mencegah data dikaitkan ke lahan milik pengguna lain.

## Matematika dan asumsi

Harga per ml/gram = harga kemasan / isi kemasan.
Biaya = jumlah yang dipakai × harga kemasan / isi kemasan.
Pembulatan dilakukan satu kali per transaksi ke rupiah terdekat menggunakan
aritmetika integer BigInt; satuan ml dan gram tidak dikonversi.

Contoh **angka uji**, bukan harga pasar: Rp150.000 per 1.000 ml, digunakan 320 ml
→ biaya Rp48.000. Pendapatan Rp96.000 → laba Rp48.000 → ROI 100%.

Laba = pendapatan − seluruh biaya yang dicatat dalam filter.
ROI = laba / biaya × 100; biaya nol menghasilkan `null` (bukan 0% atau Infinity).
ROI gabungan dihitung dari total pendapatan dan total biaya, bukan rata-rata
persentase tiap lahan. Ini ROI biaya tercatat; bila ongkos tenaga kerja, pupuk,
sewa dan biaya lain belum dimasukkan, hasil belum mewakili keseluruhan usaha.
Biaya agenda tidak otomatis dimasukkan agar pencatatan tidak ganda.

Kas mencatat nilai rupiah bulat, positif, maksimal Rp1 triliun per entri.
Pemakaian sangat kecil dapat dibulatkan ke Rp0. Jumlah produk/kemasan maksimal
1 juta unit dan 3 desimal. Tanggal `YYYY-MM-DD` difilter inklusif. Semua tanggal
tanpa filter mencakup seluruh musim; gunakan filter periode untuk satu musim.
Transaksi pada versi ini bersifat tambah catatan; belum ada UI koreksi/pembatalan.

Frekuensi penyakit menghitung jumlah log, bukan prevalensi, luas terinfeksi,
atau tingkat keparahan. Pengelompokan mengabaikan huruf besar/kecil untuk nama
yang sama; sinonim penyakit belum disatukan. AI dan manual dilaporkan terpisah.

## Backend Express pada port 4000

Sudah dipasang pada server Node.js utama tanpa mengubah API lama. Menjalankan
`npm run dev` menyediakan frontend 3000 dan backend 4000. Endpoint memakai sesi
aplikasi; request tanpa sesi mendapat 401. Login lokal proyek masih OTP simulasi,
sehingga autentikasi nyata tetap diperlukan sebelum backend multiuser produksi.
Mode Pages tidak bergantung pada sesi ini.

| Metode dan endpoint | Hasil |
|---|---|
| `GET /api/records/finance` | `{ blocks: [{ farmId, expensesRp, revenueRp, profitRp, roiPercent }] }` |
| `GET /api/records/diseases` | `{ statistics: [{ farmId, disease, count, manual, ai, lastDate }] }` |
| `GET /api/records` | harga, transaksi, dan log milik pengguna |
| `POST /api/records/prices` | tambah/perbarui harga milik pengguna |
| `POST /api/records/cash` | catat pemakaian, biaya lain, atau panen |
| `POST /api/records/diseases` | catatan manual; klien tidak boleh mengklaim sumber AI |

GET menerima `farmId`, `from`, `to`; statistik penyakit juga menerima `disease`.
Nilai tanggal salah/rentang terbalik menghasilkan 400; lahan asing 404. Galat
berbentuk `{ error: { code, message } }`. Detail database tidak dikirim ke klien.

Contoh payload pemakaian (server mencari harga, tidak mempercayai total klien):

```json
{
  "id": "uuid-transaksi-dari-klien",
  "farmId": "id-lahan",
  "date": "2026-11-17",
  "kind": "expense",
  "description": "Pemakaian produk di blok A",
  "productId": "id-katalog-harga",
  "quantity": 320
}
```

Pendapatan panen mengirim `kind: "income"`, `amountRp`, tanpa `productId`.
Pengiriman ulang ID transaksi yang sama dan data sama tidak menambah biaya lagi.
Perubahan data untuk ID tersebut ditolak. Tidak ada sinkronisasi otomatis antara
localStorage Pages dan SQLite backend pada versi ini.

## Penyimpanan otomatis hasil Vision (disiapkan, belum aktif di Pages)

Endpoint terpadu `/api/clinic/identify` kini membutuhkan sesi, `farmId`, dan
`analysisId` UUID selain `image`, `crop`, dan `tankLiters`. Kepemilikan lahan
diperiksa sebelum Vision dipanggil. Hasil `suspected`, kode bukan `none`, serta
tanaman hasil pengamatan yang sesuai pilihan pengguna disimpan ke log sebagai
**dugaan AI**, bukan diagnosis pasti. Foto tidak disimpan. Tanggal log memakai
waktu server zona Asia/Jakarta.

Unique constraint `(userId, analysisId)` membuat retry tidak menggandakan log.
AI sehat, tidak jelas, bukan tanaman, atau tidak cocok tanaman tidak dicatat
sebagai penyakit. Kegagalan menyimpan tidak dilaporkan sebagai sukses.
Server Klinik mandiri tanpa database tidak otomatis menyimpan riwayat; gunakan
server utama untuk fitur ini. Komponen Vision tersimpan menerima prop `farmId`,
tetapi halaman `/klinik/` tetap memakai dashboard non-AI sesuai tahap sekarang.
Aktivasi berikutnya memakai sesi same-origin/proxy Next.js; integrasi auth
cross-origin tidak diaktifkan oleh fitur Pages.

## Verifikasi

`npm run typecheck`, `npm run build:pages` dengan base path repo, dan
`npm run test:pages` menguji halaman statis. `node --import tsx --test
tests/records.test.ts tests/clinic.test.ts tests/api.test.ts` menguji rumus,
filter, kepemilikan, snapshot harga, migrasi cadangan, dan penyimpanan log AI
idempoten dengan analyzer pengganti (tanpa biaya API).

Referensi persistensi: [Node.js SQLite](https://nodejs.org/api/sqlite.html),
[transaksi SQLite](https://www.sqlite.org/lang_transaction.html).

# Klinik Tanaman — Cyphera

Versi aktif adalah dashboard tanpa API (`klinik-dashboard.tsx`). Foto hanya
untuk pratinjau lokal; catatan teks tersimpan di browser. Analisis penyakit
dan dosis belum aktif. Kode integrasi di bawah disiapkan untuk tahap berikutnya
dan tidak dipanggil oleh dashboard.


Implementasi menggunakan OpenAI Responses API dengan input gambar dan structured
outputs. Model default `gpt-4o` dapat diganti melalui `OPENAI_VISION_MODEL` dengan
model yang mendukung gambar dan structured outputs. API key hanya di backend.

## File utama

- `frontend/src/components/klinik-tanaman.tsx`: kamera/galeri, pratinjau,
  input tanaman dan tangki, loading, batal, error, kartu hasil.
- `frontend/src/app/klinik/page.tsx`: halaman `/klinik/`, tanpa login.
- `backend/src/clinic/router.ts`: Express, multipart, validasi gambar, CORS,
  pembatasan permintaan, dan respons galat JSON.
- `backend/src/clinic/service.ts`: prompt Vision, schema Zod, katalog fiktif,
  pencocokan tanaman + kode penyakit, kalkulasi dosis.
- `shared/src/clinic.ts`: kontrak TypeScript frontend/backend.

Server lama proyek menggunakan HTTP native Node.js, bukan Express. Endpoint
Express dipasang pada server tersebut di `/api/clinic/identify`, sehingga
API lama tidak perlu dimigrasikan. Tersedia server Express mandiri untuk hosting
Klinik saja; server ini tidak membawa autentikasi OTP simulasi aplikasi lama.

## Instalasi dan menjalankan lokal

Library sudah ditambahkan pada package.json dan package-lock.json. Dari root:

```powershell
npm ci
Copy-Item backend/.env.example backend/.env
```

Jika `.env` sudah ada, edit file itu; jangan menimpanya. Isi di `backend/.env`:

```dotenv
OPENAI_API_KEY=isi_key_anda_di_sini
OPENAI_VISION_MODEL=gpt-4o
FRONTEND_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Lalu `npm run dev`, buka `http://localhost:3000/klinik/`. Next.js meneruskan
`/api/clinic/identify` ke backend port 4000. Jangan memasukkan API key ke kode,
GitHub, atau variabel `NEXT_PUBLIC_*`. Jangan mengirim key melalui chat.
Panggilan Vision memakai kuota akun OpenAI; tes otomatis tidak memanggil AI nyata.

Perintah pemasangan library bila memindahkan kode ke proyek lain:

```powershell
npm install --workspace @agri/backend express multer openai zod sharp express-rate-limit
npm install --save-dev --workspace @agri/backend @types/express @types/multer
```

Frontend menggunakan React, Tailwind dan `lucide-react` yang sudah terpasang.
Tidak perlu Axios: unggahan memakai `fetch` dan `FormData`. Jangan set manual
header `Content-Type` multipart; browser yang menambahkan boundary.

## Hosting terpisah dan GitHub Pages

GitHub Pages hanya menyajikan frontend statis. Host backend Express pada layanan
Node.js terpisah dengan perintah build `npm ci && npm run build --workspace @agri/backend`
dan start `npm run start:clinic --workspace @agri/backend`.
Atur `HOST=0.0.0.0`, `PORT` sesuai hosting, `OPENAI_API_KEY`, serta
`FRONTEND_ORIGINS=https://abayabe.github.io` (origin tanpa path repo).
Server mandiri memakai port 4001 jika `PORT` tidak ditentukan.

Pada environment build frontend, atur:

```dotenv
NEXT_PUBLIC_CLINIC_API_URL=https://alamat-backend-anda.example
```

Ini URL publik backend, bukan API key dan bukan URL OpenAI. Gunakan HTTPS,
tanpa akhiran `/api`. Build ulang frontend setelah mengubahnya. Untuk workflow
Pages, variabel repository `NEXT_PUBLIC_CLINIC_API_URL` dibaca saat build.
Jika URL belum diisi, halaman menjelaskan bahwa koneksi belum aktif dan tombol
analisis dinonaktifkan; tidak ada hasil AI palsu atau fallback hasil statis.

Endpoint ini terbuka agar mengikuti akses tanpa login aplikasi: 10 permintaan
per 15 menit per IP, maksimal 3 proses bersamaan per instans. Batas ini berada
di memori. Untuk trafik publik besar, gunakan pembatas terpusat/gateway dan
pengendalian biaya di akun provider. CORS bukan autentikasi. Di balik proxy,
konfigurasikan `trust proxy` hanya untuk proxy yang diketahui; default saat ini
tidak mempercayai header IP sehingga pengguna lewat proxy berbagi kuota IP.

## Kontrak API dan penanganan gagal

`POST /api/clinic/identify`, `multipart/form-data`:

- `image`: satu JPEG/PNG/WebP, maksimal 5 MB, foto diam maksimal 24 megapiksel.
- `crop`: `tomat`, `padi`, `cabai`, `jagung`, atau `lainnya`.
- `tankLiters`: teks angka 1–100; koma desimal didukung.

Sukses: `{ analysis, product, notice }`. `product` dapat `null`. Status
pengamatan: `suspected`, `uncertain`, `healthy`, `not_plant`. Tidak terlihat
gejala bukan jaminan tanaman sehat. Tingkat keyakinan AI bukan probabilitas
diagnosis yang sudah dikalibrasi. Galat konsisten:
`{ "error": { "code": "AI_TIMEOUT", "message": "Analisis terlalu lama..." } }`.
HTTP 400/413/415 untuk isian/file, 403 origin, 429 pembatasan, 422 hasil tak
terbaca/refusal, 502 galat provider/schema, 503 konfigurasi/kuota, 504 timeout.

Gambar didekode ulang menggunakan Sharp, dibatasi ukurannya menjadi 1600 px,
metadata EXIF/GPS dibuang, lalu dikirim sebagai JPEG ke OpenAI. Buffer berada
di memori; tidak ditulis ke database/disk atau log. `store: false` digunakan
untuk respons API, tetapi bukan janji zero-retention dari provider. Informasi
pengiriman foto ditampilkan sebelum pengguna menekan Analisis.

## Katalog dummy dan rumus

Katalog berisi **produk fiktif**, bukan label Bayer atau produk terdaftar.
Contoh: Produk Contoh A, 2 ml/liter × 16 liter = 32 ml. Ini menguji alur data
dan matematika, **bukan instruksi penggunaan pestisida**. UI menyatakan hal ini.
AI tidak menentukan dosis atau produk. Pencocokan membutuhkan status dugaan,
keyakinan tinggi, tanaman hasil pengamatan sama dengan pilihan pengguna,
serta pasangan tanaman–kode penyakit yang ada. Selain itu `product: null`.

Sebelum dipakai untuk rekomendasi nyata, ganti katalog dengan data label yang
ditinjau ahli: tanaman, target penyakit, wilayah/registrasi, formulasi, unit,
dosis dan basisnya, interval, batas aplikasi, PHI/REI serta sumber label.
Jangan mengubah g/ha menjadi g/liter tanpa volume air/ha yang sesuai label:
`dosis/tangki = dosis/ha × volume tangki ÷ volume air/ha`. Dosis berbasis liter
tidak boleh dipakai untuk semua jenis label. Jangan mengubah label dummy menjadi
"terverifikasi" hanya karena AI yakin. Diagnosis perlu konfirmasi lapangan.

## Verifikasi

```powershell
npm run typecheck
npm run build --workspace @agri/backend
node --import tsx --test tests/clinic.test.ts tests/api.test.ts
npm run test:ui -- clinic.spec.ts
```

Tes memakai analyzer/provider pengganti dan intersepsi respons browser. Ini
menguji alur serta penanganan gagal, bukan akurasi diagnosis model. Uji provider
nyata masih memerlukan API key dan foto tanaman yang diizinkan untuk dikirim.

Referensi implementasi:
- [OpenAI Vision](https://developers.openai.com/api/docs/guides/images-vision)
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Multer](https://expressjs.com/en/resources/middleware/multer/)

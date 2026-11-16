# Membagikan aplikasi melalui GitHub dan hosting

GitHub menyimpan kode proyek. Orang lain membuka website melalui alamat hosting.
GitHub Pages melayani situs statis, sedangkan aplikasi ini memerlukan proses
backend dan database. Rujukan: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Panduan berikut menyiapkan **demo**, karena OTP dan cuaca belum menggunakan layanan
sungguhan. Jangan memakai nomor pribadi atau data lahan rahasia pada demo publik.
Tidak ada layanan hosting, akun, atau pembayaran yang dibuat otomatis oleh proyek ini.

## 1. Unggah proyek dari VS Code

1. Buka folder **seed-to-harvest-planner** di VS Code, bukan folder induknya.
2. Buka **Source Control** (Ctrl+Shift+G). Jika belum ada repositori, pilih
   **Initialize Repository**.
3. Periksa daftar file, isi pesan commit seperti `Tambah dashboard multi-lahan`,
   lalu pilih **Commit**.
4. Pilih **Publish to GitHub**, lalu masuk ke akun GitHub melalui browser.
5. Beri nama repositori, misalnya `agri-tech-dashboard`.
6. Pilih **Private** bila kode hanya untuk Anda/kolaborator, atau **Public** bila
   semua orang boleh membaca kode. Menentukan siapa yang melihat kode berbeda
   dengan menentukan siapa yang dapat membuka website.

Langkah penerbitan dari VS Code mengikuti
[panduan GitHub di VS Code](https://code.visualstudio.com/docs/sourcecontrol/github).
Jika ingin bantuan unggah melalui ChatGPT/Codex, pasang integrasi GitHub dan
hubungkan akun yang memiliki repositori tersebut.

`.gitignore` sudah mengecualikan `node_modules`, hasil build, file `.env`,
hasil tes, serta database SQLite. Tetap periksa daftar file sebelum commit.
Pastikan `package-lock.json`, ketiga folder `frontend`, `backend`, `shared`,
dan `package.json` utama ikut diunggah. Jangan memasukkan API key atau data akun
ke kode; atur sebagai environment variable pada hosting.

## 2. Pasang backend di Render

Buat **Web Service** dan hubungkan repositori GitHub. Render mendukung
perintah build/start proyek Node sendiri.
[Panduan Render](https://render.com/docs/deploy-node-express-app).

| Pengaturan | Nilai untuk proyek ini |
| --- | --- |
| Runtime | Node |
| Root Directory | Kosong (akar repositori) |
| Build Command | `npm ci --include=dev && npm run build --workspace @agri/backend` |
| Start Command | `npm run start:backend` |
| Health Check Path | `/api/health` |
| Node | 24.x; `.nvmrc` menyimpan versi pengembangan |

Isi environment variable berikut:

```text
HOST=0.0.0.0
NODE_ENV=production
COOKIE_SECURE=true
ALLOW_DEMO_AUTH=true
FRONTEND_ORIGINS=https://ALAMAT-FRONTEND-ANDA.vercel.app
DATABASE_PATH=/var/data/juragan.sqlite
```

Ganti alamat frontend setelah Vercel memberikan domain. Izinkan hanya domain
yang Anda gunakan, dipisahkan koma jika lebih dari satu. `ALLOW_DEMO_AUTH`
hanya membuka demonstrasi OTP; pengaturan ini tidak mengubahnya menjadi login nyata.
Gunakan `PORT` yang disediakan hosting.

Database membutuhkan persistent disk dengan mount path **/var/data**. Render
menyediakan persistent disk pada layanan berbayar; tanpa disk tersebut, perubahan
file akan hilang ketika layanan restart/deploy.
[Dokumentasi persistent disk](https://render.com/docs/disks).
Untuk demo sementara tanpa disk, gunakan `DATABASE_PATH=:memory:` dan pahami
bahwa seluruh pengguna, sesi, serta lahan akan hilang ketika backend restart.

Setelah backend aktif, buka `https://ALAMAT-BACKEND.onrender.com/api/health`.
Respons yang diharapkan adalah `status: ok` dan `service: agri-backend`.

## 3. Pasang frontend di Vercel

Buat proyek dari repositori GitHub yang sama. Vercel mendukung pemilihan folder
aplikasi dalam monorepo.
[Panduan monorepo Vercel](https://vercel.com/docs/monorepos).

| Pengaturan | Nilai |
| --- | --- |
| Framework | Next.js |
| Root Directory | `frontend` |
| Node.js | 24.x |
| Install Command | `cd .. && npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | Bawaan Next.js |
| Environment variable | `BACKEND_URL=https://ALAMAT-BACKEND.onrender.com` |

Aktifkan **Include source files outside of the Root Directory in the Build Step**
bila opsi ini tersedia, karena tipe bersama berada di `shared/`.
Rujukan: [konfigurasi build](https://vercel.com/docs/builds/configure-a-build)
dan [versi Node.js yang didukung](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

Jangan memakai `localhost` untuk `BACKEND_URL` pada hosting. Jangan memakai
`npm run dev` sebagai perintah produksi. Jika alamat backend berubah, ubah
environment variable dan deploy ulang frontend agar tujuan proxy diperbarui.

## 4. Periksa dan bagikan tautan

1. Salin domain frontend dari Vercel ke `FRONTEND_ORIGINS` pada Render.
2. Buka domain frontend di jendela penyamaran.
3. Coba masuk dengan OTP simulasi, tambahkan lahan contoh, buka jadwal dan kalkulator.
4. Coba keluar, lalu pastikan daftar lahan meminta login kembali.
5. Periksa pengaturan akses/deployment protection hosting agar penerima tautan
   yang dituju memang boleh membuka demo.
6. Bagikan **URL frontend Vercel**, bukan alamat `localhost` atau URL API backend.

Domain/domain khusus, billing, pengaturan akses, serta kredensial provider tetap
dikelola di akun Anda. Konfigurasi di atas belum berarti aplikasi sudah diterbitkan.

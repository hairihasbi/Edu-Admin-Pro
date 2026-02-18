
# 🚀 Panduan Deploy EduAdmin Pro v2.1

Dokumen ini berisi langkah-langkah lengkap untuk men-deploy aplikasi EduAdmin Pro ke layanan cloud (Vercel) dan menghubungkannya dengan database serta layanan pihak ketiga.

Versi ini mencakup perbaikan dependensi, **Hybrid Database** (Offline-First), **AI Load Balancing**, **Pengaturan Situs Global**, dan **WhatsApp Broadcast**.

## 📋 Prasyarat

Pastikan Anda memiliki akun di layanan berikut (semuanya memiliki paket Gratis/Free Tier):

1.  **GitHub** (Untuk menyimpan kode sumber).
2.  **Vercel** (Untuk hosting aplikasi dan API serverless).
3.  **Turso** (Untuk Database SQL cloud).
4.  **Upstash** (Untuk Redis - Caching & Rate Limiting).
5.  **Google AI Studio** (Untuk API Key Gemini).

---

## Tahap 1: Persiapan Database & Infrastruktur

### 1. Setup Database (Turso)
Aplikasi ini menggunakan Turso (LibSQL) sebagai database utama.

1.  Daftar di [turso.tech](https://turso.tech).
2.  Buat Database baru (beri nama misal: `eduadmin-db`).
3.  Masuk ke detail database, klik **"Connect"**.
4.  Simpan data berikut:
    *   **Database URL**: (Format: `libsql://db-name-user.turso.io`)
    *   **Auth Token**: (Klik "Generate Token").

### 2. Setup Redis (Upstash)
Redis wajib digunakan untuk **Rate Limiting** (mencegah penyalahgunaan API AI) dan caching konfigurasi.

1.  Daftar di [upstash.com](https://upstash.com).
2.  Buat Database Redis baru.
3.  Pada dashboard, cari bagian **REST API**.
4.  Simpan data berikut:
    *   **UPSTASH_REDIS_REST_URL**
    *   **UPSTASH_REDIS_REST_TOKEN**

### 3. Setup Google Gemini AI
1.  Buka [Google AI Studio](https://aistudio.google.com/).
2.  Klik **"Get API key"**.
3.  Buat API Key baru.
4.  Simpan Key tersebut. Anda bisa membuat banyak key (misal 3-5 key) untuk menghindari limit penggunaan.

---

## Tahap 2: Upload Kode ke GitHub

1.  Buka terminal di folder proyek ini.
2.  Jalankan perintah berikut:
    ```bash
    git init
    git add .
    git commit -m "EduAdmin Pro v2.1 Update"
    ```
3.  Buka GitHub, buat repository baru.
4.  Ikuti instruksi GitHub untuk *push* kode (remote add origin & push).

---

## Tahap 3: Deploy ke Vercel

1.  Buka dashboard [Vercel](https://vercel.com).
2.  Klik **"Add New..."** -> **"Project"**.
3.  Pilih repository GitHub yang baru diupload.
4.  **PENTING:** Di bagian **Environment Variables**, masukkan data berikut:

| Key | Value (Contoh) | Fungsi |
| :--- | :--- | :--- |
| `TURSO_DB_URL` | `libsql://...` | Koneksi Database Utama |
| `TURSO_AUTH_TOKEN` | `eyJ...` | Token Autentikasi Database |
| `UPSTASH_REDIS_REST_URL` | `https://...upstash.io` | Koneksi Redis |
| `UPSTASH_REDIS_REST_TOKEN` | `A...=` | Token Redis |
| `GEMINI_KEY_1` | `AIzaSy...` | Key AI Utama |
| `GEMINI_KEY_2` | `AIzaSy...` | (Opsional) Key Cadangan 1 |

*Catatan: Aplikasi mendukung rotasi key otomatis. Key tambahan bisa diinput melalui UI Admin tanpa redeploy.*

5.  Klik **"Deploy"**.

---

## Tahap 4: Inisialisasi & Login Admin

1.  Buka URL aplikasi yang sudah dideploy.
2.  Tunggu status database di pojok kanan atas berubah menjadi **"Turso Cloud"** (atau hijau). Ini menandakan tabel database otomatis dibuat.
3.  Login default:
    *   **Username:** `admin`
    *   **Password:** `admin`
4.  **WAJIB:** Segera ganti password di menu **Profil & Akun**.

---

## Tahap 5: Pengaturan Situs & Identitas (Baru)

Anda tidak perlu mengubah kode untuk mengganti nama sekolah atau logo.

1.  Login sebagai **Admin**.
2.  Masuk ke menu **Pengaturan Situs** (ikon Globe).
3.  Anda bisa mengubah:
    *   **Nama Aplikasi & Sekolah** (Muncul di dashboard dan laporan).
    *   **Logo & Favicon** (Masukkan URL gambar langsung).
    *   **SEO Meta** (Deskripsi untuk Google Search).
4.  Klik Simpan. Perubahan akan langsung diterapkan.

---

## Tahap 6: Manajemen API Key AI (Load Balancing)

Untuk mencegah error "Quota Exceeded" saat banyak guru membuat RPP bersamaan, aplikasi menggunakan sistem **Hybrid Key Management**.

1.  Masuk ke menu **Konfigurasi Sistem** -> Tab **Gemini AI Keys**.
2.  **Environment Keys:** Status key yang dimasukkan di Vercel.
3.  **Database Keys (Active Pool):**
    *   Tambahkan API Key tambahan *langsung* di menu ini.
    *   Key ini disimpan di Database dan digunakan secara acak bersamaan dengan Key dari Environment.
    *   Gunakan fitur **Bulk Upload** jika memiliki banyak key cadangan.

---

## Tahap 7: Fitur WhatsApp Broadcast

1.  Daftar di penyedia gateway (contoh: [FlowKirim](https://flowkirim.com) atau [Fonnte](https://fonnte.com)).
2.  Scan QR Code WA di dashboard penyedia.
3.  Di aplikasi EduAdmin, masuk ke **Konfigurasi Sistem** -> **WhatsApp Gateway**.
4.  Isi data:
    *   **Provider:** Pilih sesuai layanan.
    *   **Base URL:** `https://scan.flowkirim.com/api/whatsapp/messages/text` (Contoh FlowKirim).
    *   **API Key:** Dari dashboard provider.
    *   **Device ID:** Dari dashboard provider.
5.  Ubah status ke **Aktif**.

---

## 🛠 Troubleshooting & Maintenance

**1. Gagal Build / Deploy (npm error)**
*   **Error:** `npm error notarget No matching version found for @google/genai...`
*   **Penyebab:** Versi library Google GenAI di `package.json` kadaluarsa atau tidak valid.
*   **Solusi:** Kami telah memperbarui `package.json` ke versi `^0.2.0`. Silakan commit dan push ulang kode Anda ke GitHub, Vercel akan otomatis melakukan redeploy.

**2. Status Database "Mode Lokal" / "Sync Error"**
*   **Mode Lokal:** Artinya internet putus atau API Vercel tidak bisa dihubungi. Aplikasi tetap bisa dipakai (Offline), data disimpan di browser.
*   **Sync Error:** Cek `TURSO_DB_URL` di Vercel. Pastikan formatnya benar (`libsql://`).

**3. Fitur RPP Error / Loading Terus**
*   Cek menu **Konfigurasi Sistem** -> **Gemini AI Keys**.
*   Lihat apakah ada key yang statusnya **DEAD** atau **RATE_LIMITED**.
*   Jika semua key mati, tambahkan key baru di bagian "Database Keys".
*   **Darurat:** Admin bisa mematikan fitur RPP sementara di tab **Fitur & Sistem** agar guru melihat pesan "Maintenance".

**4. Reset Sistem (Tahun Ajaran Baru)**
*   Gunakan menu **Backup & Restore** -> Tab **Hapus Data**.
*   Pilih **Hapus Data Semester** untuk membersihkan nilai & jurnal saja.
*   Pilih **Factory Reset** untuk menghapus total data siswa & kelas (Hati-hati!).

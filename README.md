# StoryPad

**Script Continuity, Script Converter & NLE Timeline Bridge**

[English](#english) | [Bahasa Indonesia](#bahasa-indonesia)

---

## English

### Overview

StoryPad is a web application built for film and video production crews to manage script continuity on set and prepare assets for post-production. It converts screenplay documents into interactive scene-by-scene cue sheets, tracks audio and camera takes per dialogue line, and generates standardized file names for Non-Linear Editing (NLE) workflows.

### What You Can Do

- **Track Production Progress**: View your active project, dialogue coverage percentage, confirmed Circle Good Takes, and recent take media from the Production Dashboard.
- **Import & Convert Scripts**: Upload `.docx`, `.fountain`, `.md`, or `.txt` files, or paste script text directly. StoryPad detects scenes, characters, dialogue lines, acting notes, and action/shot descriptions with a live preview before saving.
- **Work Scene by Scene**: Filter the interactive script reader by scene, focus on dialogue lines, highlight take statuses (`Good Take`, `Review`, `Pending`), or add new lines manually during production.
- **Log Takes & Review Media**: Record multiple takes for each dialogue line, mark Circle Good Takes, write field continuity notes, and upload or link audio and camera footage for in-browser playback.
- **Standardize NLE File Names**: Automatically generate consistent clip names (`SC{scene}_SH{shot}_T{take}_{Keyword}_CAM-A.mp4` and `_AUD.wav`) and copy them with one click for DaVinci Resolve or Adobe Premiere Pro.
- **Switch Workspace Themes**: Use **Editorial Paper** (light mode) for outdoor/bright-set readability or **Dark Slate** (dark mode) for low-light monitoring rooms.
- **Collaborate with Role-Based Access**: Work across dedicated production views (Script Supervisor, Video Editor, Sound Recordist, Director/Producer) and manage team invitations and project access through the Admin Console.

### Supported Formats

| Category | Supported Formats |
| :--- | :--- |
| **Scripts** | `.docx`, `.fountain`, `.md`, `.txt` |
| **Audio** | `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.webm` |
| **Video** | `.mp4`, `.mov`, `.webm`, `.mkv` |

### Requirements & Quick Start

1. **Prerequisites**: A modern web browser, a configured Supabase project, and either **Node.js** or **PHP** for local hosting.
2. **Environment Setup**: Copy `.env.example` to `.env` and fill in your studio name and Supabase project credentials.
3. **Run Locally**:
   - Using Node.js:
     ```bash
     node server.js
     ```
   - Using PHP:
     ```bash
     php -S 127.0.0.1:8000
     ```

---

## Bahasa Indonesia

### Gambaran Umum

StoryPad adalah aplikasi web untuk kru produksi film dan video yang digunakan untuk mencatat kontinuitas naskah di lokasi syuting serta menyiapkan aset menuju pascaproduksi. Aplikasi ini mengonversi dokumen naskah menjadi lembar kerja interaktif per adegan, mencatat take audio dan footage kamera pada setiap dialog, serta menghasilkan penamaan file standar untuk alur kerja Non-Linear Editing (NLE).

### Fitur Utama untuk Pengguna

- **Pantau Progres Produksi**: Lihat ringkasan proyek aktif, persentase cakupan dialog, jumlah Circle Good Take yang terkonfirmasi, serta daftar media take terbaru melalui Dashboard Produksi.
- **Impor & Konversi Naskah**: Unggah berkas `.docx`, `.fountain`, `.md`, atau `.txt`, atau tempel teks naskah secara langsung. StoryPad mendeteksi batas scene, nama pemeran, dialog, arahan akting, dan deskripsi aksi/shot beserta pratinjau sebelum disimpan.
- **Navigasi Naskah per Adegan**: Saring tampilan naskah berdasarkan scene, aktifkan mode fokus dialog, sorot status take (`Good Take`, `Review`, `Pending`), atau tambahkan baris dialog/aksi baru secara manual di lapangan.
- **Catat Take & Tinjau Media**: Catat beberapa take untuk tiap dialog, tandai Circle Good Take, simpan catatan kontinuitas lapangan, serta unggah atau tautkan rekaman audio dan footage kamera untuk diputar langsung di browser.
- **Standarisasi Nama File NLE**: Hasilkan kode nama file secara otomatis (`SC{scene}_SH{shot}_T{take}_{KataKunci}_CAM-A.mp4` dan `_AUD.wav`) dan salin dengan satu klik untuk DaVinci Resolve maupun Adobe Premiere Pro.
- **Pilih Tema Tampilan**: Gunakan mode **Kertas Editorial** (terang) untuk keterbacaan di luar ruangan atau **Slate Gelap** (gelap) untuk ruang pemantauan minim cahaya.
- **Kolaborasi Berbasis Peran**: Bekerja sesuai tampilan peran produksi (Script Supervisor, Video Editor, Sound Recordist, Director/Producer) serta kelola undangan dan akses tim melalui Admin Console.

### Format yang Didukung

| Kategori | Format yang Didukung |
| :--- | :--- |
| **Naskah** | `.docx`, `.fountain`, `.md`, `.txt` |
| **Audio** | `.wav`, `.mp3`, `.m4a`, `.aac`, `.ogg`, `.webm` |
| **Video** | `.mp4`, `.mov`, `.webm`, `.mkv` |

### Kebutuhan & Cara Menjalankan

1. **Prasyarat**: Browser web modern, proyek Supabase yang sudah dikonfigurasi, serta **Node.js** atau **PHP** untuk menjalankan server lokal.
2. **Konfigurasi Environment**: Salin `.env.example` menjadi `.env`, lalu isi nama studio dan konfigurasi proyek Supabase Anda.
3. **Jalankan Secara Lokal**:
   - Menggunakan Node.js:
     ```bash
     node server.js
     ```
   - Menggunakan PHP:
     ```bash
     php -S 127.0.0.1:8000
     ```

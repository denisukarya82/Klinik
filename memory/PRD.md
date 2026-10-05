# PRD — SIM Klinik Bidan

## Problem Statement (original, verbatim)
"buatkan saya web app untuk data pasien klinik bidan. datanya seperti sistem rumahsakit, mendata pasien, sakit apa. obat apa harga berapa initinya sesuaikan sama data real rumah sakit"

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), semua rute prefix `/api`, MongoDB via motor.
- Frontend: React (CRA + craco), react-router v7, shadcn/ui, Tailwind, recharts, framer-motion, sonner.
- Auth: JWT custom (httpOnly cookies), bcrypt, admin seeding, full password-reset flow (Emergent email).
- Bahasa: seluruh UI Bahasa Indonesia. Mata uang Rupiah.

## User Personas
- Bidan / staff klinik: mengelola pasien, kunjungan, resep, tagihan, dan data kehamilan.

## Core Requirements (static)
- Data pasien (No. RM otomatis), rekam medis (keluhan/diagnosa/tindakan), resep obat + harga Rupiah.
- Kunjungan membuat tagihan otomatis & mengurangi stok obat.
- Tagihan/pembayaran (Tunai/Transfer/QRIS/BPJS).
- Kebidanan: kehamilan (HPHT→HPL & usia kehamilan otomatis / Naegele), ANC, persalinan + data bayi.
- Dashboard statistik.
- Login JWT untuk staff.

## Implemented (2026-06)
- [x] Auth JWT lengkap + reset password + admin seed (denisukarya003@gmail.com)
- [x] Data Pasien CRUD + pencarian + halaman detail
- [x] Data Obat CRUD (24 obat tersisi otomatis dengan harga realistis, editable)
- [x] Kunjungan & Resep (builder resep, total otomatis, buat invoice, kurangi stok)
- [x] Tagihan (filter, detail item, tandai lunas)
- [x] Kebidanan (kehamilan, ANC, persalinan + bayi)
- [x] Dashboard (statistik + chart kunjungan + kunjungan terbaru)
- Diuji: backend 17/17 pytest lulus, frontend smoke flows 100%.

## Backlog / Remaining
- P1: Impor daftar obat dari file user (user menyebut akan memberi daftar nanti).
- P2: Cetak/ekspor nota tagihan & resep (PDF).
- P2: Jadwal/pengingat kontrol ANC otomatis.
- P2: Role/permission (admin vs staff), manajemen pengguna.
- P2: DialogDescription untuk hilangkan warning a11y (non-blocking).

## Next Tasks
- Tunggu daftar obat dari user untuk impor massal.

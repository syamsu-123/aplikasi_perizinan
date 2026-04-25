# Aplikasi Perizinan Santri dengan QR Code

Sistem manajemen keluar masuk perizinan santri berbasis web dengan menggunakan QR Code untuk identifikasi.

## 🚀 Pilihan Implementasi

Aplikasi ini tersedia dalam 2 versi:

### 1. 📱 Versi Flutter (Mobile App - Recommended)
- **Native mobile app** untuk Android
- **QR Scanner** dengan akses kamera penuh
- **Offline-first** architecture
- **Material 3** design
- Lihat: [`flutter_app/`](flutter_app/)

### 2. 🌐 Versi React (Web App)
- **Web-based** accessible dari browser
- **PWA support** untuk install di HP
- **Responsive** design
- Lihat: [`frontend/`](frontend/)

## 🎯 Fitur Utama

- **Dashboard** - Statistik real-time santri di dalam/luar pondok
- **Manajemen Santri** - CRUD data santri dengan generate QR Code otomatis
- **Pengajuan Izin** - Sistem pengajuan dan persetujuan izin keluar
- **QR Scanner** - Scan QR Code untuk check in/out santri
- **Laporan** - Export laporan keluar masuk dalam format CSV
- **Mobile Ready** - Dapat diakses dari HP Android/iOS

## 📱 Quick Start - Versi Flutter (Recommended)

```bash
# 1. Jalankan backend
npm run dev

# 2. Buka terminal baru, jalankan Flutter
cd flutter_app
flutter pub get
flutter run
```

📖 **Panduan lengkap Flutter:** [FLUTTER_GUIDE.md](FLUTTER_GUIDE.md)

📱 **Panduan akses Android:** [ANDROID_ACCESS.md](ANDROID_ACCESS.md)

## 📋 Teknologi

Aplikasi ini dibangun menggunakan arsitektur modern Serverless dan teknologi mobile cross-platform:

### Frontend (UI & Logic)
- **React.js (Vite)** - Framework antarmuka pengguna yang sangat cepat.
- **React Bootstrap** & **Bootstrap Icons** - Komponen styling responsif.
- **qrcode.react** - Pembuatan QR Code otomatis.
- **SheetJS (xlsx)** - Fitur import data santri dari file Excel.
- **Moment.js** - Format dan manipulasi tanggal/waktu.

### Backend & Database (BaaS)
- **Firebase Firestore** - Database NoSQL realtime berbasis cloud untuk manajemen data.
- **Firebase Authentication** - Sistem autentikasi aman dengan dukungan **Google Sign-In**.

### Mobile App (Native Wrapper - Android)
- **Ionic Capacitor** - Mengubah aplikasi web React menjadi aplikasi native Android/iOS.
- **Capacitor Barcode Scanner** - Plugin pemindaian QR Code memanfaatkan hardware kamera HP.
- **Capacitor Filesystem & Share** - Mengelola penyimpanan dan membagikan gambar QR Code.
## 🛠️ Instalasi

### Prerequisites
- Node.js >= 16.x
- npm atau yarn

### Langkah Instalasi

1. Clone atau download repository ini

2. Install dependencies backend:
```bash
npm install
```

3. Install dependencies frontend:
```bash
cd frontend
npm install
```

4. **Setup Firebase:**
   Ikuti panduan di `FIREBASE_SETUP.md` untuk mengkonfigurasi Firebase Firestore dan Authentication.

## ▶️ Menjalankan Aplikasi (Development)

1. Jalankan aplikasi frontend:
```bash
cd frontend
npm run dev
```
   Aplikasi akan berjalan di `http://localhost:5173` (atau port lain jika sudah terpakai).

### 📱 Akses dari Android/HP

1. Pastikan HP dan komputer terhubung ke **WiFi yang sama**
2. Buka browser di HP (Chrome/Firefox)
3. Ketik alamat sesuai IP komputer Anda: `http://192.168.1.8:5173`
4. Install sebagai PWA: Menu browser → "Install app" atau "Add to Home Screen"

## 📱 Cara Penggunaan

### 1. Menambah Santri Baru
- Buka menu **Data Santri**
- Klik **Tambah Santri Baru**
- Isi form data santri
- QR Code akan otomatis generate dan bisa di-download

### 2. Mengajukan Izin
- Buka menu **Pengajuan Izin**
- Klik **Ajukan Izin Baru**
- Pilih santri, jenis izin, dan isi alasan
- Admin akan menyetujui/menolak pengajuan

### 3. Check In/Out dengan QR Scanner
- Buka menu **QR Scanner**
- Klik **Mulai Scan**
- Arahkan kamera ke QR Code santri
- Sistem akan otomatis mencatat keluar/masuk

### 4. Melihat Laporan
- Buka menu **Laporan**
- Filter berdasarkan tanggal, santri, atau jenis akses
- Export ke CSV untuk laporan lebih lanjut

## 🗄️ Database

Database SQLite otomatis dibuat saat pertama kali menjalankan aplikasi dengan tabel:
- `santri` - Data santri
- `jenis_izin` - Jenis-jenis izin
- `izin` - Pengajuan izin
- `akses_log` - Log keluar masuk
- `users` - User admin

### Default Admin
- Username: `admin`
- Password: `admin123`

## 📁 Struktur Folder

```
aplikasi_perizinan/
├── database/
│   ├── init.js          # Inisialisasi database
│   └── database.db      # SQLite database (auto-created)
├── routes/
│   ├── santri.js        # API routes santri
│   ├── izin.js          # API routes izin
│   └── akses.js         # API routes akses log & denda
├── frontend/            # React web app (Capacitor)
│   ├── src/
│   │   ├── pages/       # Halaman-halaman React
│   │   ├── api.js       # API client
│   │   ├── App.jsx      # Main component
│   │   └── main.jsx     # Entry point
│   ├── .env             # Frontend environment
│   └── capacitor.config.json
├── flutter_app/         # Flutter mobile app
│   └── lib/
│       ├── main.dart
│       ├── services/    # API service
│       ├── models/      # Data models
│       ├── providers/   # State management
│       └── screens/     # UI screens
├── server.js            # Express server
├── .env                 # Backend environment
├── .gitignore           # Git ignore rules
├── build-android.bat    # Android build script
└── package.json
```

## 🔌 API Endpoints

### Santri
- `GET /api/santri` - Get all santri
- `GET /api/santri/:id` - Get santri by ID
- `GET /api/santri/nis/:nis` - Get santri by NIS
- `POST /api/santri` - Create new santri
- `PUT /api/santri/:id` - Update santri
- `DELETE /api/santri/:id` - Delete santri
- `GET /api/santri/:id/qr-code` - Get QR Code

### Izin
- `GET /api/izin` - Get all izin
- `GET /api/izin/jenis` - Get jenis izin
- `POST /api/izin` - Create izin request
- `PUT /api/izin/:id/approve` - Approve izin
- `PUT /api/izin/:id/reject` - Reject izin

### Akses Log
- `GET /api/akses` - Get all logs
- `GET /api/akses/today` - Get today's logs
- `POST /api/akses` - Record new akses
- `GET /api/akses/stats` - Get statistics

## 📝 License

MIT License

## 👨‍💻 Developer

Dibuat untuk manajemen perizinan santri pondok pesantren.

---
**© 2026 Aplikasi Perizinan Santri**

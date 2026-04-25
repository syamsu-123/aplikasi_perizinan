# Setup Firebase

## 1. Buat Project Firebase
1. Buka https://console.firebase.google.com/
2. Klik "Add Project"
3. Ikuti langkah pembuatan project

## 2. Setup Firestore Database
1. Di Firebase Console, buka menu "Firestore Database"
2. Klik "Create Database"
3. Pilih "Start in **test mode**" (untuk development)
4. Pilih lokasi server (disarankan `asia-southeast2` Jakarta)

## 3. Dapatkan Konfigurasi Firebase
1. Di Firebase Console, klik ikon ⚙️ (Settings) → "Project settings"
2. Scroll ke bawah ke bagian "Your apps"
3. Klik ikon web `</>` untuk menambahkan web app
4. Daftarkan app dengan nickname "Perizinan Santri"
5. Copy konfigurasi Firebase yang muncul

## 4. Update Konfigurasi
Buka file `frontend/src/firebase.js` dan ganti konfigurasi dengan yang dari Firebase Console:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "project-id.firebaseapp.com",
  projectId: "project-id",
  storageBucket: "project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## 5. Setup Security Rules (Opsional)
Di Firestore Console → Rules, bisa diatur:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Test mode - ubah untuk production
    }
  }
}
```

## 6. Build Ulang
```bash
cd frontend
npm run build
npx cap sync android
```

## Struktur Collection di Firestore

| Collection | Deskripsi |
|---|---|
| `santri` | Data santri |
| `izin` | Data pengajuan izin |
| `akses` | Log keluar masuk |
| `denda` | Data denda keterlambatan |
| `config` | Konfigurasi aplikasi (denda) |
| `jenis_izin` | Jenis-jenis izin |

## Field di Collection `santri`
| Field | Tipe | Keterangan |
|---|---|---|
| `nama` | string | Nama lengkap |
| `nis` | string | Nomor Induk Santri |
| `kelas` | string | Kelas santri |
| `tanggal_lahir` | string | YYYY-MM-DD |
| `alamat` | string | Alamat lengkap |
| `no_hp_ortu` | string | No HP orang tua |
| `qrCode` | string | QR Code data |
| `statusAktif` | boolean | Status aktif |
| `createdAt` | timestamp | Waktu dibuat |
| `updatedAt` | timestamp | Waktu update |

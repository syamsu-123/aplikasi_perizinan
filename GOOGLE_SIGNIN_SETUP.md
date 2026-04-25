# Panduan Enable Google Sign-In di Firebase

## Langkah-langkah di Firebase Console:

### 1. Buka Firebase Console
- Kunjungi: https://console.firebase.google.com/
- Pilih project: **perizinan-51407**

### 2. Enable Google Sign-In
1. Klik **Authentication** di menu kiri
2. Klik tab **Sign-in method**
3. Klik **Google** di daftar provider
4. Toggle **Enable** menjadi ON
5. Isi **Project support email** (pilih email admin Anda)
6. Klik **Save**

### 3. Setup SHA-1 untuk Android (PENTING!)
Google Sign-In di Android memerlukan SHA-1 fingerprint:

#### Cara mendapatkan SHA-1:
```bash
# Masuk ke folder android
cd frontend/android

# Untuk debug key (development)
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android

# Copy SHA1 value yang muncul (format: AA:BB:CC:...)
```

#### Tambahkan SHA-1 ke Firebase:
1. Di Firebase Console, klik icon **⚙️ Settings** (gear) di samping **Project Overview**
2. Pilih **Project settings**
3. Scroll ke bagian **Your apps**
4. Klik app Android Anda (`com.perizinan.app` atau sejenis)
5. Klik **Add fingerprint**
6. Paste SHA-1 yang sudah di-copy
7. Klik **Save**

### 4. Download google-services.json
1. Masih di halaman yang sama (Project settings > Your apps)
2. Klik **google-services.json** untuk download
3. Simpan file di: `frontend/android/app/google-services.json`

### 5. Rebuild APK
Setelah setup selesai, rebuild APK:
```bash
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
```

## Testing Google Sign-In:
- Buka aplikasi di Android
- Klik tombol **Masuk dengan Google**
- Pilih akun Google Anda
- Login seharusnya berhasil tanpa verifikasi email tambahan

## Troubleshooting:

### Error: "Developer Error" atau "Sign-In Failed"
- Pastikan SHA-1 sudah ditambahkan ke Firebase
- Pastikan file `google-services.json` sudah ada di `frontend/android/app/`

### Error: "Popup blocked"
- Google Sign-In menggunakan popup di web
- Untuk Android/Capacitor, pastikan plugin Google Sign-In sudah terinstall

### Error: "auth/unauthorized-domain"
- Pastikan domain `localhost` dan domain Anda sudah didaftarkan di **Authorized domains**
- Di Firebase Console > Authentication > Settings > Authorized domains
- Tambahkan domain yang digunakan (localhost, 192.168.x.x, dll)

## Notes:
- Admin (adminizin@gmail.com) bisa login dengan email/password tanpa verifikasi
- User baru yang daftar dengan email/password harus verifikasi email dulu
- User yang login dengan Google **tidak perlu verifikasi email** (Google sudah verifikasi)
- Setelah user terverifikasi, bisa langsung login tanpa verifikasi ulang

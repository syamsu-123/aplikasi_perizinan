# 📱 Android Access Guide - Aplikasi Perizinan Santri

## Quick Access Methods

### Method 1: Browser Access (No Installation)

1. **Ensure Android device and computer are on the same WiFi network**

2. **Find your computer's IP address:**
   - Windows: `ipconfig` (look for "IPv4 Address" in WiFi adapter)
   - The server also displays network IPs when started

3. **Open browser on Android** (Chrome, Firefox, etc.)

4. **Enter the URL:**
   ```
   http://YOUR_IP:5173
   ```
   Replace `YOUR_IP` with your computer's IP (e.g., `192.168.1.8`)

---

### Method 2: Install as PWA (Progressive Web App)

1. Open the app in Chrome on Android
2. Tap menu **⋮** (top-right) → **"Install app"** or **"Add to Home Screen"**
3. Name it (e.g., "Perizinan Santri")
4. Tap **"Install"**
5. App will appear on your home screen

---

## Configuration

### Update Frontend API URL

If the app can't connect to the backend, update `frontend/.env`:

```env
VITE_API_URL=http://YOUR_IP:5000/api
```

Then restart the frontend:
```bash
cd frontend
npm run dev
```

**For Flutter app:** Update `flutter_app/lib/services/api_service.dart` with your computer's IP or use `10.0.2.2` for Android emulator.

---

## Running the Server

### 1. Start Backend
```bash
npm run dev
```
Server displays network IPs on startup.

### 2. Start Frontend
```bash
npm run client
```
Access via `http://YOUR_IP:5173` from Android.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't connect to server | Verify both devices are on same WiFi, check firewall allows ports 5000 & 5173 |
| Connection refused | Run `ipconfig` to get correct IP, update `VITE_API_URL` in `frontend/.env` |
| Network timeout | Disable proxy/VPN, check WiFi connection |
| Camera not working (QR Scanner) | Grant camera permissions, use Chrome/Firefox, or use manual NIS input |

---

## Mobile Features

✅ Bottom navigation for easy access  
✅ Touch-friendly buttons  
✅ Responsive design  
✅ QR scanner for check-in/out  
✅ PWA support (install like native app)  

---

## Security Notes

⚠️ **Important:**
- App is designed for local network (same WiFi) access only
- Do not expose server to internet without proper protection
- Use HTTPS for public network access

---

**© 2026 Aplikasi Perizinan Santri**

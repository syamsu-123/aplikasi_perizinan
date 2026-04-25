# TODO: Perbaiki QR Scanner Agar Lancar

**Status: 5/7 completed**

## Steps from Approved Plan

- [x] 1. Read current QRScanner.jsx to confirm content for exact edits
- [x] 2. Fix state bugs (_scanResult → scanResult, add permission states)
- [x] 3. Add scanner lifecycle management (stop/hide, guards)
- [x] 4. Improve permissions pre-check + request
- [x] 5. Optimize API chain (parallel calls, timeouts, better loading)
- [x] 6. Apply all UI improvements (disable buttons, spinners, torch sync)
- [ ] 7. Test changes: npm run build && npx cap sync android && npx cap run android

**QR Scanner fixed! Test: cd frontend && npm run build && npx cap sync android && npx cap open android**

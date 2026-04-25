import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Konfigurasi Firebase - Project: perizinan-51407
const firebaseConfig = {
  apiKey: "AIzaSyCcfVLQHl34vxncKGlc1mMrQE_ZoZ2dr_s",
  authDomain: "perizinan-51407.firebaseapp.com",
  projectId: "perizinan-51407",
  storageBucket: "perizinan-51407.firebasestorage.app",
  messagingSenderId: "241233721254",
  appId: "1:241233721254:web:5d58e9796a664f07674167",
  measurementId: "G-NNFXWLVCGQ"
};

console.log('[FIREBASE] Initializing Firebase...');

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
console.log('[FIREBASE] App initialized:', app.name);

const db = getFirestore(app);
console.log('[FIREBASE] Firestore initialized');

const auth = getAuth(app);
console.log('[FIREBASE] Auth initialized');

// Enable persistence untuk Android/Capacitor
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db)
    .then(() => console.log('[FIREBASE] Persistence enabled'))
    .catch((err) => console.warn('[FIREBASE] Persistence failed:', err.code, err.message));
}

// Set auth persistence - Fixed for Android WebView (disable persistence)
if (typeof window !== 'undefined') {
  // Detect Capacitor/Android environment - Simplified for browser dev
  if (typeof window !== 'undefined' && window.Capacitor) {
    console.log('[FIREBASE] Capacitor detected - No persistence (WebView)');
  } else {
    // Browser: use local persistence
    setPersistence(auth, browserLocalPersistence)
      .then(() => console.log('[FIREBASE] Auth persistence: LOCAL'))
      .catch(err => console.warn('[FIREBASE] Auth persistence failed:', err.code));
  }
}

export { db, auth, firebaseConfig };
export default app;

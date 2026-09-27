import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

// Validate if legitimate Firebase credentials are provided
export const isFirebaseConfigured = Boolean(
  apiKey &&
  typeof apiKey === 'string' &&
  apiKey.trim() !== '' &&
  !apiKey.toLowerCase().includes('your_') &&
  !apiKey.toLowerCase().includes('placeholder') &&
  projectId &&
  !projectId.toLowerCase().includes('your_')
);

const firebaseConfig = {
  apiKey: apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn('[Actify] Firebase initialization failed. Falling back to safe offline mode:', err.message);
    app = null;
    auth = null;
    db = null;
  }
} else {
  console.info('[Actify] Firebase credentials not configured or placeholder detected. Operating in seamless local/offline mode.');
}

export { auth, db };
export default app;

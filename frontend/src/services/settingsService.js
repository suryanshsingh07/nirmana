import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../config/firebase';

const MAX_STUDY_HOURS = 15;
const MIN_STUDY_HOURS = 0.5;

const DEFAULTS = {
  dailyStudyHours: 4,
};

const LOCAL_SETTINGS_PREFIX = 'actify_settings_';

/**
 * Get user settings document. Returns defaults if not found.
 * Enforces study hours cap.
 * @param {string} uid - User ID
 * @returns {Promise<object>}
 */
export async function getUserSettings(uid) {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = { ...DEFAULTS, ...snap.data() };
        data.dailyStudyHours = Math.min(data.dailyStudyHours, MAX_STUDY_HOURS);
        data.dailyStudyHours = Math.max(data.dailyStudyHours, MIN_STUDY_HOURS);
        return data;
      }
    } catch (err) {
      console.warn('Firestore getUserSettings failed, using local settings:', err.message);
    }
  }

  try {
    const raw = localStorage.getItem(`${LOCAL_SETTINGS_PREFIX}${uid}`);
    if (raw) {
      const data = { ...DEFAULTS, ...JSON.parse(raw) };
      data.dailyStudyHours = Math.min(data.dailyStudyHours, MAX_STUDY_HOURS);
      data.dailyStudyHours = Math.max(data.dailyStudyHours, MIN_STUDY_HOURS);
      return data;
    }
  } catch {
    // fallback to defaults
  }
  return { ...DEFAULTS };
}

/**
 * Update user settings (merge).
 * Enforces max 15 hours study cap before saving.
 * @param {string} uid - User ID
 * @param {object} settings - Partial settings to update
 */
export async function updateUserSettings(uid, settings) {
  const sanitized = { ...settings };
  if (sanitized.dailyStudyHours !== undefined) {
    sanitized.dailyStudyHours = Math.min(sanitized.dailyStudyHours, MAX_STUDY_HOURS);
    sanitized.dailyStudyHours = Math.max(sanitized.dailyStudyHours, MIN_STUDY_HOURS);
  }

  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, {
        ...sanitized,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore updateUserSettings failed, using local settings:', err.message);
    }
  }

  try {
    const current = await getUserSettings(uid);
    const merged = { ...current, ...sanitized };
    localStorage.setItem(`${LOCAL_SETTINGS_PREFIX}${uid}`, JSON.stringify(merged));
  } catch (err) {
    console.warn('Failed to save settings locally:', err);
  }

  return sanitized;
}

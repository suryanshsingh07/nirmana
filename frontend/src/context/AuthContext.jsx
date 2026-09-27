import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';

const AuthContext = createContext(null);

const LOCAL_USER_KEY = 'actify_local_user';

/**
 * Custom hook to access auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * AuthProvider — wraps app with Firebase auth state management
 * and seamless local offline fallback when Firebase is not configured.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase is legitimately configured and auth service initialized
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      });
      return unsubscribe;
    }

    // Offline / Local Mode Fallback
    try {
      const savedUser = localStorage.getItem(LOCAL_USER_KEY);
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      } else {
        // Automatically provide demo student session so the user can explore instantly
        const defaultStudent = {
          uid: 'demo-student-01',
          email: 'student@actify.app',
          displayName: 'Alex Johnson',
          isDemo: true,
        };
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(defaultStudent));
        setUser(defaultStudent);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auth methods — return promises so callers can handle responses
  const signup = async (email, password) => {
    if (isFirebaseConfigured && auth) {
      return createUserWithEmailAndPassword(auth, email, password);
    }
    // Local offline signup
    const newUser = {
      uid: 'local_' + Date.now(),
      email,
      displayName: email.split('@')[0],
      isDemo: true,
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    return { user: newUser };
  };

  const login = async (email, password) => {
    if (isFirebaseConfigured && auth) {
      return signInWithEmailAndPassword(auth, email, password);
    }
    // Local offline login
    const localUser = {
      uid: 'local_' + (email ? email.replace(/[^a-zA-Z0-9]/g, '_') : 'user'),
      email: email || 'student@actify.app',
      displayName: email ? email.split('@')[0] : 'Alex Johnson',
      isDemo: true,
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(localUser));
    setUser(localUser);
    return { user: localUser };
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      return signOut(auth);
    }
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
    return Promise.resolve();
  };

  const quickDemoLogin = () => {
    const demoUser = {
      uid: 'demo-student-01',
      email: 'alex.johnson@university.edu',
      displayName: 'Alex Johnson',
      isDemo: true,
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    quickDemoLogin,
    isOfflineMode: !isFirebaseConfigured || !auth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

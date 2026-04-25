import { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateProfile,
  reload
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          emailVerified: firebaseUser.emailVerified,
          provider: firebaseUser.providerData[0]?.providerId || 'email'
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Fungsi cek apakah email adalah admin
  const isAdminEmail = (email) => {
    return email === 'adminizin@gmail.com';
  };

  // Login function dengan email/password
  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // Reload user untuk dapat data terbaru (termasuk verifikasi email)
    await reload(result.user);

    const isVerified = result.user.emailVerified;
    const isAdmin = isAdminEmail(email);

    // Admin selalu bisa login tanpa verifikasi
    // User biasa: jika sudah terverifikasi, bisa langsung login
    // User biasa: jika belum terverifikasi, harus verifikasi dulu
    if (!isVerified && !isAdmin) {
      await signOut(auth);
      throw new Error('Email not verified');
    }

    return {
      success: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        emailVerified: result.user.emailVerified,
        provider: 'email'
      }
    };
  };

  // Login dengan Google - Fixed for Capacitor Android WebView
  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    
    try {
      // Use signInWithRedirect instead of signInWithPopup for WebView compatibility
      await signInWithRedirect(auth, provider);
      return { success: true, redirect: true };
    } catch (error) {
      console.error('Google redirect error:', error);
      throw error;
    }
  };

  // Handle redirect result (called after redirect back)
  const handleGoogleRedirect = async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        return {
          success: true,
          user: {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            emailVerified: result.user.emailVerified,
            provider: 'google'
          }
        };
      }
      return { success: false };
    } catch (error) {
      console.error('Google redirect result error:', error);
      throw error;
    }
  };

  // Register function
  const register = async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Update profile dengan nama tampil
    await updateProfile(result.user, {
      displayName: displayName
    });

    // Kirim email verifikasi untuk user baru
    await sendEmailVerification(result.user, {
      url: window.location.origin,
      handleCodeInApp: false
    });

    return {
      success: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: displayName || result.user.email,
        emailVerified: result.user.emailVerified,
        provider: 'email'
      }
    };
  };

  // Kirim ulang email verifikasi
  const resendVerification = async () => {
    if (user) {
      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.emailVerified) {
        await sendEmailVerification(currentUser, {
          url: window.location.origin,
          handleCodeInApp: false
        });
        return { success: true };
      }
    }
    return { success: false, error: 'No user or already verified' };
  };

  // Cek apakah email sudah terverifikasi (refresh dari Firebase)
  const checkEmailVerified = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await reload(currentUser);
      return currentUser.emailVerified;
    }
    return false;
  };

  // Logout function
  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    login,
    // loginWithGoogle, // Removed per request
    // handleGoogleRedirect, // Removed per request
    register,
    logout,
    resendVerification,
    checkEmailVerified,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;

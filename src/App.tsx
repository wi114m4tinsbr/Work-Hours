import { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, Timestamp, updateDoc, onSnapshot } from './firebase';
import { User } from 'firebase/auth';
import { Dashboard } from './components/Dashboard';
import { JobView } from './components/JobView';
import { AdminSettings } from './components/AdminSettings';
import { ThemeModal } from './components/ThemeModal';
import { Intro } from './components/Intro';
import { LogIn, Clock, LogOut, User as UserIcon, Languages, ShieldCheck, Palette } from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from './lib/i18n';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('pt');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  const [settings, setSettings] = useState({
    appName: 'WorkHours',
    primaryColor: '#000000',
    creatorPhoto: ''
  });
  
  const isTogglingRef = useRef(false);

  // Apply dark mode class to html element and save to localStorage
  useEffect(() => {
    console.log('[Theme] Applying theme classes. Dark mode:', isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Fetch global settings
    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setSettings({
          appName: data.appName || 'WorkHours',
          primaryColor: data.primaryColor || '#000000',
          creatorPhoto: data.creatorPhoto || ''
        });
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            language: 'pt',
            createdAt: Timestamp.now()
          });
          
          // Increment total users stat
          const statsRef = doc(db, 'stats', 'global');
          const statsSnap = await getDoc(statsRef);
          if (statsSnap.exists()) {
            await updateDoc(statsRef, { totalUsers: (statsSnap.data().totalUsers || 0) + 1 });
          } else {
            await setDoc(statsRef, { totalUsers: 1, totalLogins: 1 });
          }
        }

        // Increment total logins stat
        const statsRef = doc(db, 'stats', 'global');
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
          await updateDoc(statsRef, { totalLogins: (statsSnap.data().totalLogins || 0) + 1 });
        }

        setUser(user);
      } else {
        setUser(null);
        // Reset to global theme when logged out
        const themeColor = settings.primaryColor || '#000000';
        document.documentElement.style.setProperty('--primary-color', themeColor);
        document.documentElement.style.setProperty('--primary-color-hover', themeColor + 'ee');
        document.documentElement.style.setProperty('--primary-color-light', themeColor + '15');
      }
      setLoading(false);
    });

    return () => {
      unsubscribeSettings();
      unsubscribeAuth();
    };
  }, [settings.primaryColor]);

  // Separate effect for user data/theme to avoid blocking auth
  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, 'users', user.uid);
    console.log('[Theme] Attaching user data listener for:', user.uid);
    
    const unsubscribeUser = onSnapshot(userRef, { includeMetadataChanges: true }, (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        if (userData.language) setLang(userData.language);
        
        // Only update if the value is explicitly set in DB and no pending writes
        // to avoid reverting local optimistic updates
        if (userData.isDarkMode !== undefined && !snap.metadata.hasPendingWrites && !isTogglingRef.current) {
          setIsDarkMode(prev => {
            if (prev !== userData.isDarkMode) {
              console.log('[Theme] Syncing from Firestore snapshot:', userData.isDarkMode);
              return userData.isDarkMode;
            }
            return prev;
          });
        }
        
        // Apply user theme or fallback to global
        const themeColor = userData.primaryColor || settings.primaryColor || '#000000';
        document.documentElement.style.setProperty('--primary-color', themeColor);
        document.documentElement.style.setProperty('--primary-color-hover', themeColor + 'ee');
        document.documentElement.style.setProperty('--primary-color-light', themeColor + '15');
      }
    });

    return () => {
      console.log('[Theme] Detaching user data listener');
      unsubscribeUser();
    };
  }, [user?.uid, settings.primaryColor]);

  const handleLanguageChange = async (newLang: Language) => {
    if (!user) return;
    setLang(newLang);
    try {
      await updateDoc(doc(db, 'users', user.uid), { language: newLang });
    } catch (error) {
      console.error("Error updating language:", error);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleToggleDarkMode = async () => {
    isTogglingRef.current = true;
    setIsDarkMode(prev => {
      const next = !prev;
      console.log('[Theme] Toggling dark mode to:', next);
      
      // Immediate local persistence
      localStorage.setItem('theme', next ? 'dark' : 'light');
      
      if (user) {
        console.log('[Theme] Syncing with Firestore...');
        updateDoc(doc(db, 'users', user.uid), { 
          isDarkMode: next 
        }).catch(error => {
          console.error("[Theme] Firestore update failed:", error);
        });
      }
      
      return next;
    });

    // Release the lock after a delay to allow Firestore to sync
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 2000);
  };

  const t = translations[lang];
  const isOwner = user?.email === "martinswilliam2004@gmail.com";

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Clock className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <Intro 
        onLogin={handleLogin} 
        appName={settings.appName} 
        creatorPhoto={settings.creatorPhoto}
        t={t} 
        lang={lang}
        onLanguageChange={setLang}
        isDarkMode={isDarkMode}
        onThemeToggle={handleToggleDarkMode}
      />
    );
  }

  return (
    <div 
      className={cn(
        "min-h-screen bg-stone-50 dark:bg-stone-950 font-sans text-stone-900 dark:text-stone-100 transition-colors",
        isDarkMode ? "dark" : ""
      )}
      data-theme={isDarkMode ? 'dark' : 'light'}
    >
      {/* Header */}
      <header className="bg-white dark:bg-stone-900 border-b border-black/5 dark:border-white/5 sticky top-0 z-10 transition-colors">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setCurrentJobId(null)}
          >
            <Clock className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">{settings.appName}</span>
          </div>
          
            <div className="flex items-center gap-3">
              {/* Language Switcher Pill */}
              <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-full border border-black/5 dark:border-white/5 shadow-sm">
                {(['pt', 'en', 'es'] as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLanguageChange(l)}
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold uppercase transition-all",
                      lang === l 
                        ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm" 
                        : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div className="h-6 w-px bg-stone-200 dark:bg-stone-800 mx-1" />

              <button 
                onClick={() => setIsThemeModalOpen(true)}
                className="p-2 text-stone-400 hover:text-primary transition-colors"
                title={t.theme}
              >
                <Palette className="w-5 h-5" />
              </button>

              {isOwner && (
                <button 
                  onClick={() => setIsAdminModalOpen(true)}
                  className="p-2 text-stone-400 hover:text-primary transition-colors"
                  title="Admin Settings"
                >
                  <ShieldCheck className="w-5 h-5" />
                </button>
              )}

              <div className="flex items-center gap-2 ml-2">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || ''} 
                    className="w-8 h-8 rounded-full border border-black/10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center border border-black/10">
                    <UserIcon className="w-4 h-4 text-stone-500" />
                  </div>
                )}
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                title={t.logout}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          {!currentJobId ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <Dashboard onSelectJob={setCurrentJobId} userId={user.uid} t={t} />
            </motion.div>
          ) : (
            <motion.div
              key="jobview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <JobView 
                jobId={currentJobId} 
                userId={user.uid} 
                onBack={() => setCurrentJobId(null)} 
                t={t}
                lang={lang}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AdminSettings 
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        currentSettings={settings}
        t={t}
      />

      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        userId={user.uid}
        t={t}
      />
    </div>
  );
}

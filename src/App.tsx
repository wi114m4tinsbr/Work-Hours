import { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, Timestamp, updateDoc, onSnapshot } from './firebase';
import { User } from 'firebase/auth';
import { Dashboard } from './components/Dashboard';
import { JobView } from './components/JobView';
import { AdminSettings } from './components/AdminSettings';
import { ThemeModal } from './components/ThemeModal';
import { Intro } from './components/Intro';
import { LogIn, Clock, LogOut, User as UserIcon, Languages, ShieldCheck, Palette, Sun, Moon } from 'lucide-react';
import { cn, hexToRgb } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from './lib/i18n';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('pt');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [settings, setSettings] = useState({
    appName: 'WorkHours',
    primaryColor: '#000000',
    footerText: 'WorkHours • Professional Edition • 2026'
  });

  // Apply dark mode class to html element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { isDarkMode: newMode });
      } catch (error) {
        console.error("Error updating dark mode:", error);
      }
    }
  };

  const applyTheme = (themeColor: string) => {
    document.documentElement.style.setProperty('--primary-color', themeColor);
    document.documentElement.style.setProperty('--primary-color-hover', themeColor + 'ee');
    document.documentElement.style.setProperty('--primary-color-light', themeColor + '15');
    
    // Add dynamic background variables
    const rgb = hexToRgb(themeColor);
    if (rgb) {
      // Very dark version of the primary color for background
      const bgDark = `rgba(${Math.round(rgb.r * 0.06)}, ${Math.round(rgb.g * 0.06)}, ${Math.round(rgb.b * 0.06)}, 1)`;
      const bgCardDark = `rgba(${Math.round(rgb.r * 0.1)}, ${Math.round(rgb.g * 0.1)}, ${Math.round(rgb.b * 0.1)}, 1)`;
      document.documentElement.style.setProperty('--bg-dark', bgDark);
      document.documentElement.style.setProperty('--bg-card-dark', bgCardDark);
    } else {
      document.documentElement.style.setProperty('--bg-dark', '#0c0a09');
      document.documentElement.style.setProperty('--bg-card-dark', '#1c1917');
    }
  };

  useEffect(() => {
    // Fetch global settings
    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setSettings({
          appName: data.appName || 'WorkHours',
          primaryColor: data.primaryColor || '#000000',
          footerText: data.footerText || 'WorkHours • Professional Edition • 2026'
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
        applyTheme(themeColor);
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
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        setLang(userData.language || 'pt');
        setIsDarkMode(!!userData.isDarkMode);
        
        // Apply user theme or fallback to global
        const themeColor = userData.primaryColor || settings.primaryColor || '#000000';
        applyTheme(themeColor);
      }
    });

    return () => unsubscribeUser();
  }, [user, settings.primaryColor]);

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
        footerText={settings.footerText}
        t={t} 
        lang={lang}
        onLanguageChange={setLang}
        isDarkMode={isDarkMode}
        onThemeToggle={toggleDarkMode}
      />
    );
  }

  return (
    <div className={cn(
      "min-h-screen font-sans flex flex-col transition-colors duration-300 custom-scrollbar",
      isDarkMode ? "bg-bg-dark text-stone-100" : "bg-stone-50 text-stone-900"
    )}>
      {/* Header */}
      <header className={cn(
        "border-bottom sticky top-0 z-50 transition-colors duration-300",
        isDarkMode ? "bg-bg-card-dark border-white/5" : "bg-white border-black/5"
      )}>
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div 
            className="flex items-center gap-2 cursor-pointer shrink-0"
            onClick={() => setCurrentJobId(null)}
          >
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <span className="font-bold text-base sm:text-lg tracking-tight truncate max-w-[120px] sm:max-w-none">{settings.appName}</span>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-3">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-stone-400 hover:text-primary transition-colors"
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <button 
              onClick={() => setIsThemeModalOpen(true)}
              className="p-2 text-stone-400 hover:text-primary transition-colors hidden sm:block"
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
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            <div className="relative group">
              <button className="p-2 text-stone-400 hover:text-primary transition-colors flex items-center gap-1">
                <Languages className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[10px] sm:text-xs font-bold uppercase">{lang}</span>
              </button>
              <div className={cn(
                "absolute right-0 top-full mt-1 rounded-xl shadow-xl border transition-all p-2 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible",
                isDarkMode ? "bg-stone-900 border-white/5" : "bg-white border-black/5"
              )}>
                {(['pt', 'en', 'es'] as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLanguageChange(l)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      lang === l 
                        ? "bg-primary-light text-primary font-bold" 
                        : isDarkMode ? "hover:bg-stone-800 text-stone-400" : "hover:bg-stone-50 text-stone-600"
                    )}
                  >
                    {l === 'pt' ? 'Português' : l === 'en' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || ''} 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/10"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-100 flex items-center justify-center border border-black/10">
                  <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 text-stone-500" />
                </div>
              )}
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
              title={t.logout}
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 pb-24 flex-1 w-full overflow-y-auto custom-scrollbar">
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

      <footer className={cn(
        "py-8 text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-30",
        isDarkMode ? "text-white" : "text-stone-900"
      )}>
        {settings.footerText === 'WorkHours • Professional Edition • 2026' 
          ? `${settings.appName} • ${t.professionalEdition} • 2026` 
          : settings.footerText}
      </footer>
    </div>
  );
}

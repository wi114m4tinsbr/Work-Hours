import { useState, useEffect } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, Timestamp, updateDoc, onSnapshot } from './firebase';
import { User } from 'firebase/auth';
import { Dashboard } from './components/Dashboard';
import { JobView } from './components/JobView';
import { AdminSettings } from './components/AdminSettings';
import { ThemeModal } from './components/ThemeModal';
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
  const [settings, setSettings] = useState({
    appName: 'WorkHours',
    primaryColor: '#000000'
  });

  useEffect(() => {
    // Fetch global settings
    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribeSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setSettings({
          appName: data.appName || 'WorkHours',
          primaryColor: data.primaryColor || '#000000'
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
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribeUser = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const userData = snap.data();
        setLang(userData.language || 'pt');
        
        // Apply user theme or fallback to global
        const themeColor = userData.primaryColor || settings.primaryColor || '#000000';
        document.documentElement.style.setProperty('--primary-color', themeColor);
        document.documentElement.style.setProperty('--primary-color-hover', themeColor + 'ee');
        document.documentElement.style.setProperty('--primary-color-light', themeColor + '15');
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
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-black/5"
        >
          <div className="w-20 h-20 bg-primary-light rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-sans font-bold text-stone-900 mb-2 tracking-tight">
            {settings.appName}
          </h1>
          <p className="text-stone-500 mb-8 font-sans">
            Gerencie seus trabalhos e calcule seus ganhos de forma simples e rápida.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-primary hover:bg-primary-hover text-white font-sans font-medium py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-primary-light"
          >
            <LogIn className="w-5 h-5" />
            {t.loginGoogle}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      {/* Header */}
      <header className="bg-white border-bottom border-black/5 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setCurrentJobId(null)}
          >
            <Clock className="w-6 h-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">{settings.appName}</span>
          </div>
          
          <div className="flex items-center gap-4">
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

            <div className="relative group">
              <button className="p-2 text-stone-400 hover:text-primary transition-colors flex items-center gap-1">
                <Languages className="w-5 h-5" />
                <span className="text-xs font-bold uppercase">{lang}</span>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-black/5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all p-2 min-w-[120px]">
                {(['pt', 'en', 'es'] as Language[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => handleLanguageChange(l)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      lang === l ? "bg-primary-light text-primary font-bold" : "hover:bg-stone-50"
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

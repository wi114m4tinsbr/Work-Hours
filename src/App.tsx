import { useState, useEffect, useRef } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, Timestamp, updateDoc, onSnapshot } from './firebase';
import { User } from 'firebase/auth';
import { Dashboard } from './components/Dashboard';
import { JobView } from './components/JobView';
import { AdminSettings } from './components/AdminSettings';
import { ThemeModal } from './components/ThemeModal';
import { Intro } from './components/Intro';
import { InvoiceCreator } from './components/InvoiceCreator';
import { PublicInvoiceView } from './components/PublicInvoiceView';
import { LogIn, Clock, LogOut, User as UserIcon, Languages, ShieldCheck, Palette, Sun, Moon, FileText, Crown, X, Check, ChevronDown, BriefcaseBusiness, Grid2X2, ScanText, FilePenLine, UserRound } from 'lucide-react';
import { cn, hexToRgb } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from './lib/i18n';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view) {
      setViewId(view);
    }
  }, []);

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hours' | 'invoices'>('hours');
  const [lang, setLang] = useState<Language>('pt');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [subscriptionType, setSubscriptionType] = useState<'free' | 'monthly'>('free');
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [settings, setSettings] = useState({
    appName: 'Shift Hours',
    primaryColor: '#000000',
    footerText: 'SHIFTHOURS • Professional Edition • 2026'
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
          appName: data.appName || 'Shift Hours',
          primaryColor: data.primaryColor || '#000000',
          footerText: data.footerText || 'SHIFTHOURS • Professional Edition • 2026'
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
            createdAt: Timestamp.now(),
            subscription: { type: 'free', expiryDate: null },
            usage: { lastInvoiceDate: '', dailyInvoiceCount: 0 }
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
        setSubscriptionType(userData.subscription?.type === 'monthly' ? 'monthly' : 'free');
        const storedName = (userData.displayName || user.displayName || '').trim().split(/\s+/);
        setProfileFirstName(userData.firstName || storedName[0] || '');
        setProfileLastName(userData.lastName || (storedName.length > 1 ? storedName[storedName.length - 1] : ''));
        
        // Apply user theme or fallback to global
        const themeColor = userData.primaryColor || settings.primaryColor || '#000000';
        applyTheme(themeColor);
      }
    });

    return () => unsubscribeUser();
  }, [user, settings.primaryColor]);

  useEffect(() => {
    if (!isToolsMenuOpen) return;
    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) setIsToolsMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsToolsMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isToolsMenuOpen]);

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
    console.log("handleLogin called");
    setLoginLoading(true);
    setLoginError(null);
    try {
      // Try popup first
      await signInWithPopup(auth, googleProvider);
      console.log("Login successful with popup");
    } catch (error: any) {
      console.error("Login popup error:", error);
      // If popup is blocked or fails, try redirect as fallback
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        try {
          console.log("Attempting redirect login...");
          // Note: signInWithRedirect might not work perfectly in all iframe environments,
          // but it's a good fallback to try.
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError: any) {
          console.error("Login redirect error:", redirectError);
          setLoginError("O login foi bloqueado pelo navegador. Por favor, permita popups ou tente novamente.");
        }
      } else {
        setLoginError(error.message || "Erro ao entrar com Google");
      }
    } finally {
      // Don't set loading to false if we're redirecting, as the page will reload
      // But for popup it's fine.
      setLoginLoading(false);
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
  const isOwner = user?.email?.toLowerCase().trim() === "martinswilliam2004@gmail.com";

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

  if (viewId) {
    return <PublicInvoiceView invoiceId={viewId} />;
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
        loginLoading={loginLoading}
        loginError={loginError}
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
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            type="button"
            className="group flex items-center gap-2.5 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
            onClick={() => setCurrentJobId(null)}
            aria-label={`${settings.appName} - Home`}
          >
            <span className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm transition-transform duration-200 group-hover:scale-[1.04]">
              <Clock className="w-5 h-5 text-white" />
            </span>
            <span className="font-black text-base sm:text-xl tracking-[-0.035em] text-stone-900 dark:text-white transition-colors duration-200 group-hover:text-primary truncate max-w-[135px] sm:max-w-none">{settings.appName}</span>
          </button>

          {/* Product switcher: app-specific tools live here so the global header stays clean. */}
          <div ref={toolsMenuRef} className="hidden sm:flex items-center relative mr-auto">
            <button
              type="button"
              onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
              className={cn("group h-10 px-3 rounded-xl flex items-center gap-2 text-sm font-bold border transition-colors", isToolsMenuOpen ? "bg-primary-light border-primary/20 text-primary dark:bg-white/10 dark:text-white dark:border-white/10" : "border-transparent text-stone-600 dark:text-stone-200 hover:bg-primary-light dark:hover:bg-white/10 hover:text-primary dark:hover:text-white")}
              aria-expanded={isToolsMenuOpen}
              title={lang === 'en' ? 'Apps and tools' : lang === 'es' ? 'Aplicaciones y herramientas' : 'Aplicativos e ferramentas'}
            >
              <Grid2X2 size={18} className="transition-transform duration-200 group-hover:scale-110" />
              <span>{lang === 'en' ? 'Tools' : lang === 'es' ? 'Herramientas' : 'Ferramentas'}</span>
              <ChevronDown size={13} className={cn("transition-transform duration-200", isToolsMenuOpen && "rotate-180")} />
            </button>
            <AnimatePresence>
              {isToolsMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  className="absolute top-full left-0 mt-2 w-[320px] p-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-stone-900 shadow-xl z-[70] origin-top-left"
                >
                  <div className="px-2 pt-1 pb-2">
                    <p className="text-xs font-black uppercase tracking-wider text-stone-400">{lang === 'en' ? 'Shift Hours tools' : lang === 'es' ? 'Herramientas de Shift Hours' : 'Ferramentas do Shift Hours'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => { setActiveTab('invoices'); setIsToolsMenuOpen(false); }} className="group flex flex-col items-center text-center gap-2 p-3 rounded-xl hover:bg-primary-light dark:hover:bg-white/10">
                      <span className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center"><FileText size={18}/></span>
                      <span className="text-xs font-bold leading-tight text-stone-800 dark:text-stone-100">{t.invoiceCreator}</span>
                    </button>
                    <div className="flex flex-col items-center text-center gap-2 p-3 rounded-xl opacity-55">
                      <span className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-stone-300 flex items-center justify-center"><ScanText size={18}/></span>
                      <span className="text-xs font-bold leading-tight text-stone-600 dark:text-stone-300">{lang === 'en' ? 'PDF Reader' : lang === 'es' ? 'Lector PDF' : 'Leitor PDF'}</span>
                      <span className="text-[9px] font-black uppercase tracking-wide text-stone-400">{lang === 'en' ? 'Soon' : lang === 'es' ? 'Pronto' : 'Em breve'}</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-2 p-3 rounded-xl opacity-55">
                      <span className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-white/10 text-stone-500 dark:text-stone-300 flex items-center justify-center"><FilePenLine size={18}/></span>
                      <span className="text-xs font-bold leading-tight text-stone-600 dark:text-stone-300">{lang === 'en' ? 'PDF Editor' : lang === 'es' ? 'Editor PDF' : 'Editor PDF'}</span>
                      <span className="text-[9px] font-black uppercase tracking-wide text-stone-400">{lang === 'en' ? 'Soon' : lang === 'es' ? 'Pronto' : 'Em breve'}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 lg:gap-3 shrink-0 lg:ml-auto">
            <button
              onClick={() => setActiveTab('invoices')}
              className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-primary hover:bg-primary-light dark:hover:bg-white/10 transition-all duration-200 sm:hidden"
              title={t.invoiceCreator}
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={toggleDarkMode}
              className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full text-stone-400 hover:text-primary hover:bg-primary-light dark:hover:bg-white/10 transition-all duration-200"
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <button 
              onClick={() => setIsThemeModalOpen(true)}
              className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full text-stone-400 hover:text-primary hover:bg-primary-light dark:hover:bg-white/10 transition-all duration-200 hidden sm:inline-flex"
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
              <button className="w-10 h-10 shrink-0 inline-flex items-center justify-center gap-0.5 rounded-full text-stone-400 hover:text-primary hover:bg-primary-light dark:hover:bg-white/10 transition-all duration-200">
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

            {!isOwner && (
              <div className="hidden sm:flex items-center gap-1.5 ml-3 lg:ml-5 pl-3 lg:pl-5 border-l border-stone-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-black shadow-sm",
                    subscriptionType === 'monthly'
                      ? "bg-primary-light text-primary border-primary/25"
                      : "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700"
                  )}
                  title={lang === 'en' ? 'Current plan' : lang === 'es' ? 'Plan actual' : 'Plano atual'}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
                  {subscriptionType === 'monthly' ? 'Premium' : t.free}
                  <span className="hidden lg:inline text-[9px] uppercase tracking-wider opacity-60">{lang === 'en' ? 'Current' : lang === 'es' ? 'Actual' : 'Atual'}</span>
                </button>
                {subscriptionType === 'free' && (
                  <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="group/upgrade relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-amber-400/80 dark:border-amber-600 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 dark:from-amber-500 dark:via-yellow-400 dark:to-amber-600 text-amber-950 text-xs font-black shadow-[0_3px_12px_rgba(245,158,11,0.22)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.48)] hover:-translate-y-0.5 hover:scale-[1.04] overflow-hidden"
                    title={lang === 'en' ? 'Explore Premium' : lang === 'es' ? 'Conocer Premium' : 'Conhecer o Premium'}
                  >
                    <span className="absolute inset-y-0 -left-10 w-6 rotate-12 bg-white/75 blur-[1px] transition-all duration-700 group-hover/upgrade:left-[115%]" />
                    <Crown size={14} className="relative transition-transform duration-200 group-hover/upgrade:-rotate-6 group-hover/upgrade:scale-125" />
                    <span className="relative">Upgrade</span>
                    <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/35 pointer-events-none" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="profile-trigger group/profile flex items-center gap-2 min-w-0 ml-3 lg:ml-5 pl-3 lg:pl-5 py-1 border-l border-stone-200 dark:border-white/10 transition-all duration-200 bg-transparent hover:bg-transparent shadow-none hover:shadow-none"
              title={lang === 'en' ? 'Edit profile' : lang === 'es' ? 'Editar perfil' : 'Editar perfil'}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt={profileFirstName || user.displayName || ''} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/10 dark:border-white/15 shrink-0 transition-all duration-200 group-hover/profile:scale-[1.06] group-hover/profile:ring-2 group-hover/profile:ring-primary/20" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-100 dark:bg-white/10 flex items-center justify-center border border-black/10 dark:border-white/15 shrink-0"><UserIcon className="w-3 h-3 sm:w-4 sm:h-4 text-stone-500 dark:text-stone-300" /></div>
              )}
              <span className="hidden md:flex flex-col items-start leading-tight whitespace-nowrap">
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-200 group-hover/profile:text-primary transition-colors duration-200">
                  {[profileFirstName, profileLastName].filter(Boolean).join(' ') || user.displayName || user.email?.split('@')[0]}
                </span>
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  <UserRound size={9} />
                  {lang === 'en' ? 'Profile' : lang === 'es' ? 'Perfil' : 'Perfil'}
                </span>
              </span>
            </button>
            <button 
              onClick={handleLogout}
              className="h-10 flex items-center gap-1.5 ml-1 px-2 text-stone-400 hover:text-red-500 transition-colors whitespace-nowrap shrink-0 bg-transparent hover:bg-transparent shadow-none hover:shadow-none"
              title={t.logout}
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden xl:inline text-xs font-bold">{t.logout}</span>
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'invoices' ? (
        <main className="flex-1 w-full overflow-y-auto custom-scrollbar">
          <InvoiceCreator language={lang} onBack={() => setActiveTab('hours')} isAdmin={isOwner} embedded />
        </main>
      ) : (
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
      )}

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

      <AnimatePresence>
        {isUpgradeModalOpen && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsUpgradeModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-stone-900 shadow-2xl overflow-hidden"
            >
              <div className="p-5 sm:p-6 border-b border-black/5 dark:border-white/10 flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider mb-2"><Crown size={15} /> Shift Hours Premium</div>
                  <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">Faça mais com o Shift Hours</h2>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-300">Compare seu plano gratuito com os recursos Premium.</p>
                </div>
                <button type="button" onClick={() => setIsUpgradeModalOpen(false)} className="p-2 rounded-xl text-stone-500 dark:text-stone-300 hover:bg-primary hover:text-white"><X size={19} /></button>
              </div>
              <div className="p-5 sm:p-6 grid sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-stone-200 dark:border-white/10 p-4">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-300">{t.free}</span>
                  <div className="mt-2 text-2xl font-black text-stone-900 dark:text-white">€0</div>
                  <div className="mt-4 space-y-3 text-sm text-stone-600 dark:text-stone-300">
                    <div className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />1 trabalho/empresa</div>
                    <div className="flex gap-2"><Check size={16} className="text-emerald-500 shrink-0 mt-0.5" />1 fatura por dia</div>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-primary p-4 shadow-lg shadow-primary/10 relative">
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Premium</span>
                  <div className="mt-2 text-2xl font-black text-stone-900 dark:text-white">Em breve</div>
                  <div className="mt-4 space-y-3 text-sm text-stone-600 dark:text-stone-300">
                    <div className="flex gap-2"><Check size={16} className="text-primary shrink-0 mt-0.5" />Múltiplos trabalhos/empresas</div>
                    <div className="flex gap-2"><Check size={16} className="text-primary shrink-0 mt-0.5" />Mais faturas e recursos Premium</div>
                  </div>
                </div>
              </div>
              <div className="px-5 sm:px-6 pb-6">
                <button type="button" disabled className="w-full rounded-xl bg-primary text-white px-4 py-3 font-black disabled:opacity-60 disabled:cursor-not-allowed">Upgrade Premium · Em breve</button>
                <p className="text-center mt-3 text-xs text-stone-400 dark:text-stone-500">Nenhuma cobrança será feita nesta etapa.</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileModalOpen && (
          <motion.div className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setIsProfileModalOpen(false)}>
            <motion.div initial={{opacity:0,y:16,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:10,scale:.98}} onClick={(e)=>e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-black/10 dark:border-white/10 shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5"><div><h2 className="text-xl font-black text-stone-900 dark:text-white">{lang === 'en' ? 'Your profile' : lang === 'es' ? 'Tu perfil' : 'Seu perfil'}</h2><p className="text-sm text-stone-500 dark:text-stone-400">{lang === 'en' ? 'How your name appears in Shift Hours.' : lang === 'es' ? 'Cómo aparece tu nombre en Shift Hours.' : 'Como seu nome aparece no Shift Hours.'}</p></div><button type="button" onClick={()=>setIsProfileModalOpen(false)} className="p-2 rounded-xl text-stone-500 dark:text-stone-300 hover:bg-primary hover:text-white"><X size={18}/></button></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold text-stone-500 dark:text-stone-300 mb-1.5">{lang === 'en' ? 'First name' : lang === 'es' ? 'Nombre' : 'Primeiro nome'}</label><input maxLength={24} value={profileFirstName} onChange={(e)=>setProfileFirstName(e.target.value.slice(0,24))} className="w-full h-11 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-3 text-stone-900 dark:text-white" /></div>
                <div><label className="block text-xs font-bold text-stone-500 dark:text-stone-300 mb-1.5">{lang === 'en' ? 'Last name' : lang === 'es' ? 'Apellido' : 'Último nome'}</label><input maxLength={24} value={profileLastName} onChange={(e)=>setProfileLastName(e.target.value.slice(0,24))} className="w-full h-11 rounded-xl border border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-stone-800 px-3 text-stone-900 dark:text-white" /></div>
              </div>
              <p className="mt-2 text-[11px] text-stone-400">{lang === 'en' ? 'Maximum 24 characters per field.' : lang === 'es' ? 'Máximo de 24 caracteres por campo.' : 'Máximo de 24 caracteres por campo.'}</p>
              <button type="button" onClick={async()=>{const firstName=profileFirstName.trim();const lastName=profileLastName.trim();if(!firstName)return;await updateDoc(doc(db,'users',user.uid),{firstName,lastName,displayName:[firstName,lastName].filter(Boolean).join(' ')});setIsProfileModalOpen(false);}} className="mt-5 w-full rounded-xl bg-primary hover:bg-primary-hover text-white py-3 font-black">{lang === 'en' ? 'Save name' : lang === 'es' ? 'Guardar nombre' : 'Salvar nome'}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className={cn(
        "pt-48 pb-12 text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-30",
        isDarkMode ? "text-white" : "text-stone-900"
      )}>
        {settings.footerText.replace(/WORKHOURS/gi, 'SHIFTHOURS')}
      </footer>
    </div>
  );
}

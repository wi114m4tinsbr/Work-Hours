import React from 'react';
import { LogIn, Clock, CheckCircle2, BarChart3, Shield, Zap, Moon, Sun, Languages } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../lib/i18n';
import { cn } from '../lib/utils';

interface IntroProps {
  onLogin: () => void;
  appName: string;
  creatorPhoto?: string;
  t: any;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

export function Intro({ onLogin, appName, creatorPhoto, t, lang, onLanguageChange, isDarkMode, onThemeToggle }: IntroProps) {
  const features = [
    {
      icon: <Clock className="w-6 h-6 text-emerald-500" />,
      title: t.feature1Title,
      desc: t.feature1Desc,
      color: "bg-emerald-500/10"
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
      title: t.feature2Title,
      desc: t.feature2Desc,
      color: "bg-blue-500/10"
    },
    {
      icon: <Shield className="w-6 h-6 text-purple-500" />,
      title: t.feature3Title,
      desc: t.feature3Desc,
      color: "bg-purple-500/10"
    },
    {
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      title: t.feature4Title,
      desc: t.feature4Desc,
      color: "bg-amber-500/10"
    }
  ];

  return (
    <div className={cn(
      "min-h-screen font-sans flex flex-col transition-colors duration-500",
      isDarkMode ? "bg-stone-950 text-white dark" : "bg-white text-stone-900"
    )}>
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className={cn(
          "absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] opacity-40 transition-colors duration-700",
          isDarkMode ? "bg-emerald-900/30" : "bg-emerald-200/60"
        )} />
        <div className={cn(
          "absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[120px] opacity-40 transition-colors duration-700",
          isDarkMode ? "bg-blue-900/30" : "bg-blue-200/60"
        )} />
        <div className={cn(
          "absolute top-[20%] left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 transition-colors duration-700",
          isDarkMode ? "bg-purple-900/30" : "bg-purple-200/60"
        )} />
      </div>

      {/* Top Controls */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/20 shadow-xl">
          {(['pt', 'en', 'es'] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => onLanguageChange(l)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full text-[10px] font-bold uppercase transition-all",
                lang === l 
                  ? "bg-white text-stone-900 shadow-sm" 
                  : "text-stone-400 hover:text-white"
              )}
            >
              {l}
            </button>
          ))}
        </div>
        
        <button
          type="button"
          onClick={onThemeToggle}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
        </button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-24 grid lg:grid-cols-2 gap-16 items-center flex-grow">
        {/* Left Side: Hero Content */}
        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-8 shadow-sm border",
              isDarkMode ? "bg-stone-900 border-stone-800 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-600"
            )}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {t.newReport}
            </div>
            
            <h1 className={cn(
              "text-7xl lg:text-9xl font-black tracking-tight leading-[1.1] mb-8",
              isDarkMode ? "text-white" : "text-stone-900"
            )}>
              {t.heroTitle1}{' '}
              <span className="bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">{t.heroTitle2}</span>
            </h1>
            
            <p className={cn(
              "text-xl max-w-lg leading-relaxed font-medium",
              isDarkMode ? "text-stone-400" : "text-stone-500"
            )}>
              {t.heroSubtitle}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-6"
          >
            <button
              onClick={onLogin}
              className="group relative inline-flex items-center justify-center gap-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white px-10 py-6 rounded-[2rem] font-black text-xl transition-all hover:scale-[1.05] active:scale-[0.98] shadow-[0_20px_50px_rgba(16,185,129,0.3)]"
            >
              <LogIn className="w-7 h-7 transition-transform group-hover:translate-x-1" />
              {t.loginGoogle}
            </button>
            
            <div className="flex items-center gap-4 px-2">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <img
                    key={i}
                    src={`https://picsum.photos/seed/user${i+10}/100/100`}
                    className="w-10 h-10 rounded-full border-4 border-white dark:border-stone-900 shadow-lg"
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
              <div className="flex flex-col">
                <span className={cn("text-sm font-black", isDarkMode ? "text-white" : "text-stone-900")}>{t.activeUsers}</span>
                <span className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">{t.realUsers}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className={cn(
              "grid grid-cols-2 gap-12 pt-10 border-t",
              isDarkMode ? "border-stone-800" : "border-stone-100"
            )}
          >
            <div>
              <div className="text-4xl font-black text-emerald-500">100%</div>
              <div className="text-xs text-stone-400 uppercase tracking-[0.2em] font-bold mt-1">{t.freeJoke}</div>
            </div>
            <div>
              <div className="text-4xl font-black text-blue-500">Cloud</div>
              <div className="text-xs text-stone-400 uppercase tracking-[0.2em] font-bold mt-1">{t.synced}</div>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Visual/Features */}
        <div className="relative lg:pl-10">
          <div className={cn(
            "absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 blur-[100px] rounded-full",
            isDarkMode ? "opacity-30" : "opacity-50"
          )} />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10"
          >
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + (idx * 0.1), ease: "easeOut" }}
                whileHover={{ 
                  y: -12,
                  transition: { duration: 0.3 }
                }}
                className={cn(
                  "group p-8 rounded-[3rem] border transition-all duration-300 space-y-5",
                  isDarkMode 
                    ? "bg-stone-900/80 border-stone-800 hover:border-emerald-500/50 shadow-2xl shadow-black/50" 
                    : "bg-white/90 border-stone-100 hover:border-emerald-500/30 shadow-2xl shadow-stone-200/50"
                )}
              >
                <div className={cn(
                  "w-16 h-16 rounded-3xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500",
                  feature.color
                )}>
                  {feature.icon}
                </div>
                <h3 className="font-black text-2xl tracking-tight">{feature.title}</h3>
                <p className={cn(
                  "text-sm leading-relaxed font-medium",
                  isDarkMode ? "text-stone-400" : "text-stone-500"
                )}>{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Floating Badge */}
          <motion.div
            animate={{ 
              y: [0, -15, 0],
              rotate: [0, 3, 0]
            }}
            transition={{ 
              duration: 5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className={cn(
              "absolute -top-24 -right-12 p-6 rounded-[2.5rem] shadow-2xl border hidden lg:block z-20",
              isDarkMode ? "bg-stone-900 border-stone-800" : "bg-white border-stone-100"
            )}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <div className="text-lg font-black tracking-tight">{t.productivity}</div>
                <div className="text-xs text-emerald-500 font-bold uppercase tracking-widest">{t.thisMonth}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className={cn(
        "relative z-10 py-16 border-t mt-auto",
        isDarkMode ? "border-stone-800 bg-stone-950/50" : "border-stone-100 bg-stone-50/50"
      )}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-emerald-500" />
              <span className="font-black text-2xl tracking-tighter">{appName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-3 py-1.5 rounded-full border border-current">
                {t.professionalEdition} - 2026
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 group bg-white/5 dark:bg-black/5 p-4 rounded-[2.5rem] border border-black/5 dark:border-white/5 backdrop-blur-sm transition-all hover:scale-105">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-blue-500 rounded-full blur-md opacity-40 group-hover:opacity-100 transition-opacity" />
              <img 
                src={creatorPhoto || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?fit=facearea&facepad=2&w=256&h=256&q=100"} 
                alt="William Martins"
                className="w-16 h-16 rounded-full border-2 border-white dark:border-stone-800 relative z-10 object-cover shadow-2xl transition-transform group-hover:rotate-6"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-left">
              <div className="text-[10px] text-stone-400 uppercase font-bold tracking-widest mb-1">{t.developedBy}</div>
              <div className="text-xl font-black tracking-tight">William Martins</div>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-30">
              &copy; 2026 &bull; {appName}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

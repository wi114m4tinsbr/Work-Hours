import React from 'react';
import { LogIn, Clock, CheckCircle2, BarChart3, Shield, Zap, Moon, Sun, Languages } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../lib/i18n';
import { cn } from '../lib/utils';

interface IntroProps {
  onLogin: () => void;
  appName: string;
  footerText: string;
  t: any;
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

export function Intro({ onLogin, appName, footerText, t, lang, onLanguageChange, isDarkMode, onThemeToggle }: IntroProps) {
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
      "min-h-screen font-sans relative flex flex-col transition-colors duration-500 custom-scrollbar",
      isDarkMode ? "bg-bg-dark text-white" : "bg-white text-stone-900"
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
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1 sm:gap-2 bg-white/10 backdrop-blur-md p-1 rounded-full border border-white/20 shadow-xl">
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
          onClick={onThemeToggle}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-xl hover:scale-110 transition-all"
        >
          {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-blue-400" />}
        </button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center flex-1">
        {/* Left Side: Hero Content */}
        <div className="space-y-6 lg:space-y-8 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className={cn(
              "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6 lg:mb-8 shadow-sm border mx-auto lg:mx-0",
              isDarkMode ? "bg-bg-card-dark border-white/10 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-600"
            )}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {t.newReport}
            </div>
            
            <h1 className={cn(
              "text-5xl sm:text-7xl lg:text-9xl font-black tracking-tighter leading-[0.9] lg:leading-[0.85] mb-6 lg:mb-8",
              isDarkMode ? "text-white" : "text-stone-900"
            )}>
              {t.heroTitle1} <br />
              <span className="bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">{t.heroTitle2}</span>
            </h1>
            
            <p className={cn(
              "text-lg sm:text-xl max-w-lg leading-relaxed font-medium mx-auto lg:mx-0",
              isDarkMode ? "text-stone-400" : "text-stone-500"
            )}>
              {t.heroSubtitle}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-6"
          >
            <button
              onClick={onLogin}
              className="w-full sm:w-auto group relative inline-flex items-center justify-center gap-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white px-8 lg:px-10 py-5 lg:py-6 rounded-[1.5rem] lg:rounded-[2rem] font-black text-lg lg:text-xl transition-all hover:scale-[1.05] active:scale-[0.98] shadow-[0_20px_50px_rgba(16,185,129,0.3)]"
            >
              <LogIn className="w-6 h-6 lg:w-7 lg:h-7 transition-transform group-hover:translate-x-1" />
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
              "grid grid-cols-2 gap-8 lg:gap-12 pt-10 border-t",
              isDarkMode ? "border-stone-800" : "border-stone-100"
            )}
          >
            <div>
              <div className="text-3xl lg:text-4xl font-black text-emerald-500">100%</div>
              <div className="text-[10px] lg:text-xs text-stone-400 uppercase tracking-[0.2em] font-bold mt-1">{t.free}</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-black text-blue-500">Cloud</div>
              <div className="text-[10px] lg:text-xs text-stone-400 uppercase tracking-[0.2em] font-bold mt-1">{t.synced}</div>
            </div>
          </motion.div>
        </div>

        {/* Right Side: Visual/Features */}
        <div className="relative lg:pl-10 pb-20 lg:pb-0">
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
                    ? "bg-bg-card-dark border-white/10 hover:border-emerald-500/50 shadow-2xl shadow-black/50" 
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
              "absolute -top-24 -right-12 p-8 rounded-[2.5rem] shadow-2xl border hidden lg:block z-20",
              isDarkMode ? "bg-bg-card-dark border-white/10" : "bg-white border-stone-100"
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
        "relative py-12 lg:absolute lg:bottom-8 left-0 w-full text-center text-[10px] font-black uppercase tracking-[0.4em] opacity-30 z-20",
        isDarkMode ? "text-white" : "text-stone-900"
      )}>
        {footerText === 'Work Hours • Professional Edition • 2026' 
          ? `${appName} • ${t.professionalEdition} • 2026` 
          : footerText}
      </footer>
    </div>
  );
}

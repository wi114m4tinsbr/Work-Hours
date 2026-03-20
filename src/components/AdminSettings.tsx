import React, { useState, useEffect } from 'react';
import { X, Settings, Palette, Type, BarChart3, Users, MousePointer2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, setDoc, getDoc, onSnapshot } from '../firebase';
import { themes } from '../lib/themes';
import { cn } from '../lib/utils';

interface AdminSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: { appName: string; primaryColor: string; footerText: string };
  t: any;
}

export function AdminSettings({ isOpen, onClose, currentSettings, t }: AdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'stats'>('settings');
  const [appName, setAppName] = useState(currentSettings.appName);
  const [primaryColor, setPrimaryColor] = useState(currentSettings.primaryColor);
  const [footerText, setFooterText] = useState(currentSettings.footerText);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLogins: 0,
    totalJobs: 0,
    totalEntries: 0
  });

  useEffect(() => {
    if (!isOpen) return;

    const statsRef = doc(db, 'stats', 'global');
    const unsubscribe = onSnapshot(statsRef, (snap) => {
      if (snap.exists()) {
        setStats(prev => ({ ...prev, ...snap.data() }));
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        appName,
        primaryColor,
        footerText
      }, { merge: true });
      onClose();
    } catch (error) {
      console.error("Error updating settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-bg-card-dark rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row h-[85vh] sm:h-[500px]">
              {/* Sidebar / Tabs */}
              <div className="w-full sm:w-48 bg-stone-50 dark:bg-bg-dark border-b sm:border-b-0 sm:border-r border-stone-100 dark:border-white/5 p-4 sm:p-6 flex flex-row sm:flex-col gap-2 shrink-0 overflow-x-auto sm:overflow-x-visible custom-scrollbar">
                <button
                  onClick={() => setActiveTab('settings')}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
                    activeTab === 'settings' ? "bg-primary text-white shadow-lg shadow-primary-light" : "text-stone-400 dark:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/5"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  Geral
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={cn(
                    "flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap",
                    activeTab === 'stats' ? "bg-primary text-white shadow-lg shadow-primary-light" : "text-stone-400 dark:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/5"
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  Estatísticas
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-5 sm:p-8 sm:pr-12">
                  <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight dark:text-white">
                      {activeTab === 'settings' ? 'Configurações do App' : 'Painel de Controle'}
                    </h3>
                    <button onClick={onClose} className="p-2 text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                      <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                  </div>

                  {activeTab === 'settings' ? (
                    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div>
                      <label className="flex items-center gap-2 text-[10px] sm:text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                        <Type className="w-3 h-3" />
                        Nome do Aplicativo
                      </label>
                      <input
                        type="text"
                        required
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-stone-50 dark:bg-white/5 border-none focus:ring-2 focus:ring-primary transition-all font-bold dark:text-white text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[10px] sm:text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                        <Type className="w-3 h-3" />
                        {t.footerTextLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={footerText}
                        onChange={(e) => setFooterText(e.target.value)}
                        className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-stone-50 dark:bg-white/5 border-none focus:ring-2 focus:ring-primary transition-all font-bold dark:text-white text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-[10px] sm:text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                        <Palette className="w-3 h-3" />
                        Cor Primária
                      </label>
                      <div className="flex gap-3 sm:gap-4 items-center mb-4">
                        <input
                          type="color"
                          required
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl cursor-pointer border-none bg-transparent"
                        />
                        <input
                          type="text"
                          required
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="flex-1 px-4 sm:px-5 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-stone-50 dark:bg-white/5 border-none focus:ring-2 focus:ring-primary transition-all font-mono font-bold dark:text-white text-sm sm:text-base"
                        />
                      </div>
                      <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                        {themes.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setPrimaryColor(theme.primary)}
                            className={cn(
                              "aspect-square rounded-lg sm:rounded-xl border-2 sm:border-4 transition-all",
                              primaryColor === theme.primary ? "border-primary scale-110" : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: theme.primary }}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 sm:py-5 rounded-xl sm:rounded-2xl transition-all shadow-xl shadow-primary-light disabled:opacity-50 mt-2 sm:mt-4 text-sm sm:text-base"
                    >
                      {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] space-y-2">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100">{stats.totalUsers}</div>
                        <div className="text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Usuários Registrados</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] space-y-2">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-500/10 flex items-center justify-center">
                          <MousePointer2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-100">{stats.totalLogins}</div>
                        <div className="text-[9px] sm:text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Acessos Totais</div>
                      </div>
                    </div>

                    <div className="bg-stone-50 dark:bg-bg-dark p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] space-y-4">
                      <h4 className="font-black text-stone-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
                        <Share2 className="w-4 h-4 text-primary" />
                        Atividade da Plataforma
                      </h4>
                      <div className="space-y-3 sm:space-y-4">
                        <div className="flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-bg-card-dark rounded-xl sm:rounded-2xl border border-stone-100 dark:border-white/5">
                          <span className="text-xs sm:text-sm font-bold text-stone-500 dark:text-stone-400">Trabalhos Criados</span>
                          <span className="font-black text-stone-900 dark:text-white text-sm sm:text-base">{stats.totalJobs || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 sm:p-4 bg-white dark:bg-bg-card-dark rounded-xl sm:rounded-2xl border border-stone-100 dark:border-white/5">
                          <span className="text-xs sm:text-sm font-bold text-stone-500 dark:text-stone-400">Registros de Horas</span>
                          <span className="font-black text-stone-900 dark:text-white text-sm sm:text-base">{stats.totalEntries || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

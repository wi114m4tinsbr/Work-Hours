import React, { useState, useEffect } from 'react';
import { X, Settings, Palette, Type, BarChart3, Users, MousePointer2, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, setDoc, getDoc, onSnapshot } from '../firebase';
import { themes } from '../lib/themes';
import { cn } from '../lib/utils';

interface AdminSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: { appName: string; primaryColor: string };
  t: any;
}

export function AdminSettings({ isOpen, onClose, currentSettings, t }: AdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'stats'>('settings');
  const [appName, setAppName] = useState(currentSettings.appName);
  const [primaryColor, setPrimaryColor] = useState(currentSettings.primaryColor);
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
        primaryColor
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
            className="relative w-full max-w-2xl bg-white dark:bg-bg-card-dark rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="flex h-[500px]">
              {/* Sidebar */}
              <div className="w-48 bg-stone-50 dark:bg-bg-dark border-r border-stone-100 dark:border-white/5 p-6 flex flex-col gap-2">
                <button
                  onClick={() => setActiveTab('settings')}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                    activeTab === 'settings' ? "bg-primary text-white shadow-lg shadow-primary-light" : "text-stone-400 dark:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/5"
                  )}
                >
                  <Settings className="w-4 h-4" />
                  Geral
                </button>
                <button
                  onClick={() => setActiveTab('stats')}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all",
                    activeTab === 'stats' ? "bg-primary text-white shadow-lg shadow-primary-light" : "text-stone-400 dark:text-stone-600 hover:bg-stone-100 dark:hover:bg-white/5"
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  Estatísticas
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black tracking-tight dark:text-white">
                    {activeTab === 'settings' ? 'Configurações do App' : 'Painel de Controle'}
                  </h3>
                  <button onClick={onClose} className="p-2 text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {activeTab === 'settings' ? (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                        <Type className="w-3 h-3" />
                        Nome do Aplicativo
                      </label>
                      <input
                        type="text"
                        required
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-stone-50 dark:bg-white/5 border-none focus:ring-2 focus:ring-primary transition-all font-bold dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
                        <Palette className="w-3 h-3" />
                        Cor Primária
                      </label>
                      <div className="flex gap-4 items-center mb-4">
                        <input
                          type="color"
                          required
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-14 h-14 rounded-2xl cursor-pointer border-none bg-transparent"
                        />
                        <input
                          type="text"
                          required
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="flex-1 px-5 py-4 rounded-2xl bg-stone-50 dark:bg-white/5 border-none focus:ring-2 focus:ring-primary transition-all font-mono font-bold dark:text-white"
                        />
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {themes.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setPrimaryColor(theme.primary)}
                            className={cn(
                              "aspect-square rounded-xl border-4 transition-all",
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
                      className="w-full bg-primary hover:bg-primary-hover text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-primary-light disabled:opacity-50 mt-4"
                    >
                      {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-[2rem] space-y-2">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100">{stats.totalUsers}</div>
                        <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Usuários Registrados</div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] space-y-2">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                          <MousePointer2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-3xl font-black text-blue-900 dark:text-blue-100">{stats.totalLogins}</div>
                        <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Acessos Totais</div>
                      </div>
                    </div>

                    <div className="bg-stone-50 dark:bg-bg-dark p-8 rounded-[2.5rem] space-y-4">
                      <h4 className="font-black text-stone-900 dark:text-white flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-primary" />
                        Atividade da Plataforma
                      </h4>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-bg-card-dark rounded-2xl border border-stone-100 dark:border-white/5">
                          <span className="text-sm font-bold text-stone-500 dark:text-stone-400">Trabalhos Criados</span>
                          <span className="font-black text-stone-900 dark:text-white">{stats.totalJobs || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-white dark:bg-bg-card-dark rounded-2xl border border-stone-100 dark:border-white/5">
                          <span className="text-sm font-bold text-stone-500 dark:text-stone-400">Registros de Horas</span>
                          <span className="font-black text-stone-900 dark:text-white">{stats.totalEntries || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

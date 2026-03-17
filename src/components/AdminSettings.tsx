import React, { useState } from 'react';
import { X, Settings, Palette, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, setDoc } from '../firebase';
import { themes } from '../lib/themes';
import { cn } from '../lib/utils';

interface AdminSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: { appName: string; primaryColor: string };
  t: any;
}

export function AdminSettings({ isOpen, onClose, currentSettings, t }: AdminSettingsProps) {
  const [appName, setAppName] = useState(currentSettings.appName);
  const [primaryColor, setPrimaryColor] = useState(currentSettings.primaryColor);
  const [loading, setLoading] = useState(false);

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
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-bold">{t.adminSettings}</h3>
              </div>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700 mb-1">
                  <Type className="w-4 h-4" />
                  {t.appNameLabel}
                </label>
                <input
                  type="text"
                  required
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-stone-700 mb-1">
                  <Palette className="w-4 h-4" />
                  {t.primaryColorLabel}
                </label>
                <div className="flex gap-4 items-center mb-4">
                  <input
                    type="color"
                    required
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer border-none"
                  />
                  <input
                    type="text"
                    required
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all font-mono"
                  />
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setPrimaryColor(theme.primary)}
                      className={cn(
                        "aspect-square rounded-lg border-2 transition-all",
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
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary-light disabled:opacity-50 mt-4"
              >
                {loading ? t.creating : t.saveSettings}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

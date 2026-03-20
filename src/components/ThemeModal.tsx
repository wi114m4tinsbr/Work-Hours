import React, { useState, useEffect } from 'react';
import { X, Palette, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, updateDoc, onSnapshot } from '../firebase';
import { themes } from '../lib/themes';
import { cn } from '../lib/utils';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  t: any;
}

export function ThemeModal({ isOpen, onClose, userId, t }: ThemeModalProps) {
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.primaryColor) {
          setSelectedColor(data.primaryColor);
        }
      }
    });
    return () => unsubscribe();
  }, [userId]);

  const handleSave = async (color: string) => {
    setSelectedColor(color);
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        primaryColor: color
      });
    } catch (error) {
      console.error("Error updating theme:", error);
    } finally {
      setLoading(false);
    }
  };

  const monoTheme = themes.find(t => t.id === 'mono');
  const vividThemes = themes.filter(t => t.isVivid);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
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
            className="relative w-full max-w-md bg-white dark:bg-bg-card-dark rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8"
          >
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-primary-light dark:bg-primary/10 rounded-xl">
                  <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold dark:text-white">{t.theme}</h3>
              </div>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="space-y-6 sm:space-y-8 max-h-[70vh] overflow-y-auto pr-1 sm:pr-0 custom-scrollbar">
              {/* Monochromatic */}
              <div>
                <h4 className="text-[10px] sm:text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3 sm:mb-4">{t.monochromatic}</h4>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {monoTheme && (
                    <button
                      onClick={() => handleSave(monoTheme.primary)}
                      className={cn(
                        "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl border-2 transition-all flex items-center justify-center relative overflow-hidden",
                        selectedColor === monoTheme.primary ? "border-primary scale-110 shadow-lg" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: monoTheme.primary }}
                    >
                      {selectedColor === monoTheme.primary && <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Vivid Themes */}
              <div>
                <h4 className="text-[10px] sm:text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3 sm:mb-4">{t.vividThemes}</h4>
                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                  {vividThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => handleSave(theme.primary)}
                      className={cn(
                        "aspect-square rounded-xl sm:rounded-2xl border-2 transition-all flex items-center justify-center relative overflow-hidden",
                        selectedColor === theme.primary ? "border-primary scale-110 shadow-lg" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: theme.primary }}
                    >
                      {selectedColor === theme.primary && <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Color */}
              <div>
                <h4 className="text-[10px] sm:text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-3 sm:mb-4">{t.customColor}</h4>
                <div className="flex gap-3 sm:gap-4 items-center">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => handleSave(e.target.value)}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl cursor-pointer border-none p-0 bg-transparent"
                  />
                  <div className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-white/5 bg-stone-50 dark:bg-white/5 font-mono text-xs sm:text-sm dark:text-stone-300">
                    {selectedColor.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-stone-900 dark:bg-white dark:text-stone-900 font-bold py-4 rounded-xl sm:rounded-2xl mt-6 sm:mt-8 hover:bg-stone-800 dark:hover:bg-stone-100 transition-all text-sm sm:text-base"
            >
              {t.back}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

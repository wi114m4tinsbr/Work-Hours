import React, { useState } from 'react';
import { Palette, Type } from 'lucide-react';
import { db, doc, setDoc } from '../firebase';
import { themes } from '../lib/themes';
import { cn } from '../lib/utils';

interface AppSettingsFormProps {
  currentSettings: { appName: string; primaryColor: string; footerText: string };
  t: any;
  onSaved?: () => void;
}

/** App name, footer and brand colour; lives in the admin panel's Settings tab. */
export function AppSettingsForm({ currentSettings, t, onSaved }: AppSettingsFormProps) {
  const [appName, setAppName] = useState(currentSettings.appName);
  const [primaryColor, setPrimaryColor] = useState(currentSettings.primaryColor);
  const [footerText, setFooterText] = useState(currentSettings.footerText.replace(/WORKHOURS/gi, 'SHIFTHOURS'));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        appName,
        primaryColor,
        footerText
      }, { merge: true });
      onSaved?.();
    } catch (error) {
      console.error("Error updating settings:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
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
            onChange={(e) => setFooterText(e.target.value.replace(/WORKHOURS/gi, 'SHIFTHOURS'))}
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
  );
}

import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, Timestamp, handleFirestoreError, OperationType, updateDoc, doc, getDoc, setDoc } from '../firebase';
import { X, Briefcase, Coffee, Car, Home, ShoppingBag, Utensils, Code, Camera, Music, Heart, Image as ImageIcon, Type as TypeIcon, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CURRENCIES, cn } from '../lib/utils';
import { Job } from '../types';

export const JOB_ICONS = {
  Briefcase,
  Coffee,
  Car,
  Home,
  ShoppingBag,
  Utensils,
  Code,
  Camera,
  Music,
  Heart
};

export type JobIconName = keyof typeof JOB_ICONS;

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  t: any;
  jobToEdit?: Job | null;
}

export function JobModal({ isOpen, onClose, userId, t, jobToEdit }: JobModalProps) {
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [iconType, setIconType] = useState<'icon' | 'letter' | 'image'>('icon');
  const [iconValue, setIconValue] = useState<string>('Briefcase');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (jobToEdit) {
      setName(jobToEdit.name);
      setHourlyRate(jobToEdit.hourlyRate.toString());
      setCurrency(jobToEdit.currency || 'BRL');
      setIconType(jobToEdit.iconType || 'icon');
      setIconValue(jobToEdit.iconValue || 'Briefcase');
    } else {
      setName('');
      setHourlyRate('');
      setCurrency('BRL');
      setIconType('icon');
      setIconValue('Briefcase');
    }
  }, [jobToEdit, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconValue(reader.result as string);
        setIconType('image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hourlyRate) return;

    setLoading(true);
    try {
      const jobData = {
        userId,
        name,
        hourlyRate: parseFloat(hourlyRate),
        currency,
        iconType,
        iconValue,
      };

      if (jobToEdit) {
        await updateDoc(doc(db, 'jobs', jobToEdit.id), jobData);
      } else {
        await addDoc(collection(db, 'jobs'), {
          ...jobData,
          createdAt: Timestamp.now()
        });

        // Increment total jobs stat
        const statsRef = doc(db, 'stats', 'global');
        const statsSnap = await getDoc(doc(db, 'stats', 'global'));
        if (statsSnap.exists()) {
          await updateDoc(statsRef, { totalJobs: (statsSnap.data().totalJobs || 0) + 1 });
        } else {
          await setDoc(statsRef, { totalJobs: 1 }, { merge: true });
        }
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, jobToEdit ? OperationType.UPDATE : OperationType.CREATE, 'jobs');
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
              <h3 className="text-xl font-bold">{jobToEdit ? t.edit : t.newJob}</h3>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">
                  {t.selectIcon}
                </label>
                
                <div className="flex gap-2 mb-4">
                  {(['icon', 'letter', 'image'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setIconType(type);
                        if (type === 'letter' && iconType !== 'letter') setIconValue(name.charAt(0).toUpperCase() || 'A');
                        if (type === 'icon' && iconType !== 'icon') setIconValue('Briefcase');
                      }}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
                        iconType === type 
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary-light" 
                          : "bg-stone-50 text-stone-400 border-stone-200 hover:bg-stone-100"
                      )}
                    >
                      {type === 'icon' ? t.icon : type === 'letter' ? t.letter : t.image}
                    </button>
                  ))}
                </div>

                {iconType === 'icon' && (
                  <div className="grid grid-cols-5 gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-100">
                    {Object.entries(JOB_ICONS).map(([iconName, Icon]) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setIconValue(iconName)}
                        className={cn(
                          "aspect-square rounded-xl flex items-center justify-center transition-all",
                          iconValue === iconName 
                            ? "bg-primary text-white shadow-md scale-110" 
                            : "text-stone-400 hover:bg-stone-200 hover:text-stone-600"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                )}

                {iconType === 'letter' && (
                  <div className="flex gap-3 items-center">
                    <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg shadow-primary-light">
                      {iconValue.charAt(0).toUpperCase()}
                    </div>
                    <input
                      type="text"
                      maxLength={1}
                      value={iconValue}
                      onChange={(e) => setIconValue(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all text-center text-xl font-bold"
                    />
                  </div>
                )}

                {iconType === 'image' && (
                  <div className="flex gap-3 items-center">
                    <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center overflow-hidden border border-stone-200 relative group">
                      {iconValue && iconValue.startsWith('data:') ? (
                        <img src={iconValue} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-stone-300" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-stone-200 hover:border-primary hover:bg-primary-light transition-all text-stone-500 hover:text-primary">
                        <Upload className="w-5 h-5" />
                        <span className="text-sm font-bold">{t.uploadImage}</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-500 uppercase tracking-wider mb-2">
                  {t.jobName}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Hotel 5 Estrelas"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {t.hourlyRate}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {t.currency}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all bg-white"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-primary-light disabled:opacity-50 mt-4"
              >
                {loading ? t.creating : t.save}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

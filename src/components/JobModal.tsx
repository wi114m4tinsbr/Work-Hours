import React, { useState, useEffect } from 'react';
import { db, auth, collection, addDoc, Timestamp, handleFirestoreError, OperationType, updateDoc, doc, getDoc, getDocs, query, where, setDoc } from '../firebase';
import { X, Briefcase, Coffee, Car, Home, ShoppingBag, Utensils, Code, Camera, Music, Heart, Image as ImageIcon, Upload } from 'lucide-react';
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
  const [imagePosition, setImagePosition] = useState({ x: 50, y: 50 });
  const [isPositioningImage, setIsPositioningImage] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [draftImagePosition, setDraftImagePosition] = useState({ x: 50, y: 50 });
  const [imageZoom, setImageZoom] = useState(1);
  const [draftImageZoom, setDraftImageZoom] = useState(1);
  const imageDragRef = React.useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    if (jobToEdit) {
      setName(jobToEdit.name);
      setHourlyRate(jobToEdit.hourlyRate.toString());
      setCurrency(jobToEdit.currency || 'BRL');
      setIconType(jobToEdit.iconType || 'icon');
      setIconValue(jobToEdit.iconValue || 'Briefcase');
      setImagePosition(jobToEdit.imagePosition || { x: 50, y: 50 });
      setImageZoom(jobToEdit.imageZoom || 1);
    } else {
      setName('');
      setHourlyRate('');
      setCurrency('BRL');
      setIconType('icon');
      setIconValue('Briefcase');
      setImagePosition({ x: 50, y: 50 });
      setImageZoom(1);
    }
  }, [jobToEdit, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const MAX_SIDE = 512;
        const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, width, height);

        let optimized = canvas.toDataURL('image/webp', 0.82);
        if (optimized.length > 700000) optimized = canvas.toDataURL('image/jpeg', 0.78);

        setIconValue(optimized);
        setIconType('image');
        setImagePosition({ x: 50, y: 50 });
        setImageZoom(1);
        setDraftImagePosition({ x: 50, y: 50 });
        setDraftImageZoom(1);
        setShowImageEditor(true);
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const beginImageDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsPositioningImage(true);
    imageDragRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: draftImagePosition.x,
      startY: draftImagePosition.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveImageDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPositioningImage || !imageDragRef.current) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sensitivity = 100 / Math.max(rect.width, rect.height);
    const dx = (e.clientX - imageDragRef.current.pointerX) * sensitivity;
    const dy = (e.clientY - imageDragRef.current.pointerY) * sensitivity;
    setDraftImagePosition({
      x: Math.max(0, Math.min(100, imageDragRef.current.startX - dx)),
      y: Math.max(0, Math.min(100, imageDragRef.current.startY - dy)),
    });
  };

  const endImageDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsPositioningImage(false);
    imageDragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const openImageEditor = () => {
    if (!iconValue?.startsWith('data:')) return;
    setDraftImagePosition(imagePosition);
    setDraftImageZoom(imageZoom);
    setShowImageEditor(true);
  };

  const saveImagePosition = () => {
    setImagePosition(draftImagePosition);
    setImageZoom(draftImageZoom);
    setShowImageEditor(false);
    setIsPositioningImage(false);
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
        ...(iconType === 'image' ? { imagePosition, imageZoom } : {}),
      };

      if (jobToEdit) {
        await updateDoc(doc(db, 'jobs', jobToEdit.id), jobData);
      } else {
        const userSnap = await getDoc(doc(db, 'users', userId));
        const subscriptionType = userSnap.exists() ? userSnap.data().subscription?.type || 'free' : 'free';
        const isAdmin = auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com';

        if (!isAdmin && subscriptionType !== 'monthly') {
          const jobsQuery = query(collection(db, 'jobs'), where('userId', '==', userId));
          const jobsSnap = await getDocs(jobsQuery);

          if (jobsSnap.size >= 1) {
            window.alert('O plano gratuito permite apenas 1 empresa/trabalho. Para adicionar outra empresa, será necessário fazer upgrade do plano.');
            return;
          }
        }

        await addDoc(collection(db, 'jobs'), {
          ...jobData,
          createdAt: Timestamp.now()
        });

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

  const darkFieldClasses = "dark:bg-stone-800 dark:border-stone-700 dark:text-stone-100 dark:placeholder:text-stone-500";

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
            className="relative w-full max-w-md bg-white dark:bg-stone-900 dark:text-stone-100 rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-white">{jobToEdit ? t.edit : t.newJob}</h3>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:text-stone-400 dark:hover:text-white">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] sm:max-h-[70vh] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
              <div>
                <label className="block text-sm font-bold text-stone-500 dark:text-stone-300 uppercase tracking-wider mb-2">
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
                          : "bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700 dark:hover:bg-stone-700 dark:hover:text-white"
                      )}
                    >
                      {type === 'icon' ? t.icon : type === 'letter' ? t.letter : t.image}
                    </button>
                  ))}
                </div>

                {iconType === 'icon' && (
                  <div className="grid grid-cols-5 gap-2 p-3 bg-stone-50 dark:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-700">
                    {Object.entries(JOB_ICONS).map(([iconName, Icon]) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setIconValue(iconName)}
                        className={cn(
                          "aspect-square rounded-xl flex items-center justify-center transition-all",
                          iconValue === iconName
                            ? "bg-primary text-white shadow-md scale-110"
                            : "text-stone-400 hover:bg-stone-200 hover:text-stone-600 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:text-white"
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
                      className={cn("flex-1 px-4 py-3 rounded-2xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-primary transition-all text-center text-xl font-bold", darkFieldClasses)}
                    />
                  </div>
                )}

                {iconType === 'image' && (
                  <div className="flex gap-3 items-center">
                    <button type="button" onClick={openImageEditor} className="relative w-20 h-20 shrink-0 rounded-full overflow-hidden border-2 border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 group" title="Ajustar imagem">
                      {iconValue && iconValue.startsWith('data:') ? (
                        <>
                          <img src={iconValue} alt="Preview" draggable={false} className="w-full h-full object-cover" style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%`, transform: `scale(${imageZoom})` }} />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 text-white opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold">Ajustar</span>
                        </>
                      ) : (
                        <ImageIcon className="w-7 h-7 text-stone-300 dark:text-stone-400 mx-auto" />
                      )}
                    </button>
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-700 hover:border-primary hover:bg-primary-light dark:hover:bg-primary/10 transition-all text-stone-500 dark:text-stone-300 hover:text-primary">
                        <Upload className="w-5 h-5" />
                        <span className="text-sm font-bold">{iconValue?.startsWith('data:') ? 'Alterar imagem' : t.uploadImage}</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-500 dark:text-stone-300 uppercase tracking-wider mb-2">
                  {t.jobName}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Hotel 5 Estrelas"
                  className={cn("w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-primary transition-all", darkFieldClasses)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t.hourlyRate}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="0,00"
                    className={cn("w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-primary transition-all", darkFieldClasses)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t.currency}</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className={cn("w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-primary transition-all", darkFieldClasses)}
                  >
                    {CURRENCIES.map(c => (
                      <option key={c.code} value={c.code} className="bg-white text-stone-900 dark:bg-stone-800 dark:text-stone-100">
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
      {showImageEditor && iconValue?.startsWith('data:') && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setShowImageEditor(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-white">Ajustar imagem</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Arraste a foto e use o zoom para escolher o enquadramento.</p>
              </div>
              <button type="button" onClick={() => setShowImageEditor(false)} className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"><X size={20} /></button>
            </div>
            <div className="flex justify-center py-3">
              <div
                className="relative w-72 h-72 max-w-full rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800 border-4 border-white dark:border-stone-700 shadow-xl cursor-grab active:cursor-grabbing touch-none select-none"
                onPointerDown={beginImageDrag}
                onPointerMove={moveImageDrag}
                onPointerUp={endImageDrag}
                onPointerCancel={endImageDrag}
              >
                <img src={iconValue} alt="Ajustar" draggable={false} className="w-full h-full object-cover select-none pointer-events-none will-change-transform" style={{ objectPosition: `${draftImagePosition.x}% ${draftImagePosition.y}%`, transform: `scale(${draftImageZoom})` }} />
                <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/80 pointer-events-none" />
              </div>
            </div>
            <div className="mt-4 px-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Zoom</span>
                <button type="button" onClick={() => { setDraftImagePosition({ x: 50, y: 50 }); setDraftImageZoom(1); }} className="text-xs font-bold text-primary hover:underline">Centralizar</button>
              </div>
              <input type="range" min="1" max="2.5" step="0.01" value={draftImageZoom} onChange={(e) => setDraftImageZoom(Number(e.target.value))} className="w-full accent-primary" />
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setShowImageEditor(false)} className="flex-1 h-11 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-bold">Cancelar</button>
              <button type="button" onClick={saveImagePosition} className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold">Usar esta posição</button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

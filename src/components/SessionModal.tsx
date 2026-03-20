import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, Timestamp, handleFirestoreError, OperationType, updateDoc, doc, getDoc, setDoc } from '../firebase';
import { X, Clock, Calendar, Coffee } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkSession } from '../types';

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  jobId: string;
  sessionToEdit?: WorkSession | null;
  t: any;
}

export function SessionModal({ isOpen, onClose, userId, jobId, sessionToEdit, t }: SessionModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('60');
  const [isBreakPaid, setIsBreakPaid] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionToEdit) {
      setDate(sessionToEdit.date);
      setStartTime(sessionToEdit.startTime);
      setEndTime(sessionToEdit.endTime);
      setBreakMinutes(sessionToEdit.breakMinutes.toString());
      setIsBreakPaid(sessionToEdit.isBreakPaid);
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setStartTime('08:00');
      setEndTime('17:00');
      setBreakMinutes('60');
      setIsBreakPaid(false);
    }
  }, [sessionToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const sessionData = {
        userId,
        jobId,
        date,
        startTime,
        endTime,
        breakMinutes: parseInt(breakMinutes) || 0,
        isBreakPaid,
      };

      if (sessionToEdit) {
        await updateDoc(doc(db, 'sessions', sessionToEdit.id), sessionData);
      } else {
        await addDoc(collection(db, 'sessions'), {
          ...sessionData,
          createdAt: Timestamp.now()
        });

        // Increment total entries stat
        const statsRef = doc(db, 'stats', 'global');
        const statsSnap = await getDoc(doc(db, 'stats', 'global'));
        if (statsSnap.exists()) {
          await updateDoc(statsRef, { totalEntries: (statsSnap.data().totalEntries || 0) + 1 });
        } else {
          await setDoc(statsRef, { totalEntries: 1 }, { merge: true });
        }
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, sessionToEdit ? OperationType.UPDATE : OperationType.CREATE, 'sessions');
    } finally {
      setLoading(false);
    }
  };

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
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="relative w-full max-w-md bg-white dark:bg-bg-card-dark rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl p-5 sm:p-8 overflow-y-auto custom-scrollbar max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold dark:text-white">{sessionToEdit ? t.editSession : t.addDay}</h3>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label className="flex items-center gap-2 text-[10px] sm:text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5 sm:mb-2">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.date}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary transition-all bg-stone-50 dark:bg-white/5 dark:text-white text-sm sm:text-base"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="flex items-center gap-2 text-[10px] sm:text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5 sm:mb-2">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {t.entry}
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary transition-all bg-stone-50 dark:bg-white/5 dark:text-white text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] sm:text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5 sm:mb-2">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {t.exit}
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary transition-all bg-stone-50 dark:bg-white/5 dark:text-white text-sm sm:text-base"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] sm:text-sm font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1.5 sm:mb-2">
                  <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {t.break}
                </label>
                <div className="flex gap-3 sm:gap-4">
                  <input
                    type="number"
                    required
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(e.target.value)}
                    className="flex-1 px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-primary transition-all bg-stone-50 dark:bg-white/5 dark:text-white text-sm sm:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setIsBreakPaid(!isBreakPaid)}
                    className={`px-3 sm:px-4 rounded-xl sm:rounded-2xl border transition-all font-bold text-[10px] sm:text-xs uppercase tracking-widest ${
                      isBreakPaid 
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20' 
                        : 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200 dark:shadow-red-900/20'
                    }`}
                  >
                    {isBreakPaid ? t.paidBreak : t.unpaidBreak}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 sm:py-5 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-primary-light disabled:opacity-50 mt-2 sm:mt-4 text-base sm:text-lg"
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

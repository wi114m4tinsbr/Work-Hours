import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string, workerName: string) => void;
  defaultTitle: string;
  defaultWorkerName: string;
  t: any;
}

export function PDFModal({ isOpen, onClose, onConfirm, defaultTitle, defaultWorkerName, t }: PDFModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [workerName, setWorkerName] = useState(defaultWorkerName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(title, workerName);
    onClose();
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
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-t-[2rem] sm:rounded-3xl shadow-2xl p-5 sm:p-6 transition-colors overflow-y-auto custom-scrollbar max-h-[90vh]"
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                <h3 className="text-lg sm:text-xl font-bold dark:text-white">{t.downloadPDF}</h3>
              </div>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t.reportTitle}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  {t.worker}
                </label>
                <input
                  type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl sm:rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm sm:text-base"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 mt-2 sm:mt-4 text-sm sm:text-base"
              >
                {t.downloadPDF}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

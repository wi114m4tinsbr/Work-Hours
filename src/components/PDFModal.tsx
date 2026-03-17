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
                <FileText className="w-6 h-6 text-emerald-600" />
                <h3 className="text-xl font-bold">{t.downloadPDF}</h3>
              </div>
              <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  {t.reportTitle}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  {t.worker}
                </label>
                <input
                  type="text"
                  required
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-200 mt-4"
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

import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, doc, getDoc, deleteDoc, handleFirestoreError, OperationType } from '../firebase';
import { Job, WorkSession } from '../types';
import { ArrowLeft, Plus, Calendar, Clock, Trash2, Calculator, TrendingUp, Coffee, Share2, Edit2, FileDown, Eye, Briefcase } from 'lucide-react';
import { formatCurrency, calculateDuration, generateWhatsAppReport, formatDuration } from '../lib/utils';
import { SessionModal } from './SessionModal';
import { JobModal, JOB_ICONS, JobIconName } from './JobModal';
import { PDFModal } from './PDFModal';
import { motion } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface JobViewProps {
  jobId: string;
  userId: string;
  onBack: () => void;
  t: any;
  lang: string;
}

const JobIcon = ({ job }: { job: Job }) => {
  if (job.iconType === 'image' && job.iconValue) {
    return <img src={job.iconValue} alt={job.name} className="w-full h-full object-cover rounded-xl" />;
  }
  if (job.iconType === 'letter' && job.iconValue) {
    return <span className="text-lg font-bold uppercase">{job.iconValue.charAt(0)}</span>;
  }
  
  const IconComponent = JOB_ICONS[job.iconValue as JobIconName] || Briefcase;
  return <IconComponent className="w-5 h-5" />;
};

export function JobView({ jobId, userId, onBack, t, lang }: JobViewProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<WorkSession | null>(null);
  const [visibleBreaks, setVisibleBreaks] = useState<Record<string, boolean>>({});

  const toggleBreakVisibility = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setVisibleBreaks(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  useEffect(() => {
    const unsubscribeJob = onSnapshot(doc(db, 'jobs', jobId), (snap) => {
      if (snap.exists()) {
        setJob({ id: snap.id, ...snap.data() } as Job);
      }
    });

    const q = query(
      collection(db, 'sessions'), 
      where('jobId', '==', jobId),
      where('userId', '==', userId)
    );
    const unsubscribeSessions = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkSession[];
      setSessions(sessionsData.sort((a, b) => b.date.localeCompare(a.date)));
    });

    return () => {
      unsubscribeJob();
      unsubscribeSessions();
    };
  }, [jobId, userId]);

  const handleDeleteSession = async (sessionId: string) => {
    if (confirm(t.confirmDeleteSession)) {
      try {
        await deleteDoc(doc(db, 'sessions', sessionId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `sessions/${sessionId}`);
      }
    }
  };

  const handleEditSession = (session: WorkSession) => {
    setSessionToEdit(session);
    setIsSessionModalOpen(true);
  };

  const handleAddSession = () => {
    setSessionToEdit(null);
    setIsSessionModalOpen(true);
  };

  const handleShare = () => {
    if (!job) return;
    const report = generateWhatsAppReport(job.name, sessions, totalHours, totalEarnings, job.currency, t, lang);
    window.open(`https://wa.me/?text=${report}`, '_blank');
  };

  const handleDownloadPDF = (customTitle: string, customWorkerName: string) => {
    if (!job) return;
    const doc = new jsPDF();
    const locale = getLocale();

    // Header
    doc.setFontSize(20);
    doc.text(customTitle, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`${t.date}: ${format(new Date(), 'dd/MM/yyyy')}`, 195, 20, { align: 'right' });

    // Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(t.worker, 20, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(customWorkerName, 20, 46);

    doc.setFont('helvetica', 'bold');
    doc.text(t.company, 120, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(job.name, 120, 46);

    // Table
    const tableData = sessions.map(s => {
      const duration = calculateDuration(s.startTime, s.endTime, s.breakMinutes, s.isBreakPaid);
      return [
        format(parseISO(s.date), 'dd/MM/yyyy'),
        `${s.startTime} - ${s.endTime}`,
        formatDuration(duration),
        formatCurrency(duration * job.hourlyRate, job.currency)
      ];
    });

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#10b981';
    const rgb: [number, number, number] = primaryColor.startsWith('#') 
      ? [
          parseInt(primaryColor.slice(1, 3), 16),
          parseInt(primaryColor.slice(3, 5), 16),
          parseInt(primaryColor.slice(5, 7), 16)
        ]
      : [16, 185, 129];

    autoTable(doc, {
      startY: 60,
      head: [[t.date, t.period, t.totalHours, t.subtotal]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: rgb },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont('helvetica', 'bold');
    doc.text(`${t.totalHours}: ${formatDuration(totalHours)}`, 195, finalY, { align: 'right' });
    doc.text(`${t.totalToReceive}: ${formatCurrency(totalEarnings, job.currency)}`, 195, finalY + 7, { align: 'right' });

    doc.save(`${job.name}_Report.pdf`);
  };

  const totalHours = sessions.reduce((acc, session) => {
    return acc + calculateDuration(session.startTime, session.endTime, session.breakMinutes, session.isBreakPaid);
  }, 0);

  const totalEarnings = totalHours * (job?.hourlyRate || 0);

  const getLocale = () => {
    if (t.language === 'English') return enUS;
    if (t.language === 'Español') return es;
    return ptBR;
  };

  if (!job) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-900 dark:text-stone-100"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-light dark:bg-primary/10 rounded-xl flex items-center justify-center text-primary overflow-hidden">
              <JobIcon job={job} />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight dark:text-white">{job.name}</h2>
              <p className="text-stone-500 dark:text-stone-400 text-sm">{t.period}</p>
            </div>
            <button
              onClick={() => setIsJobModalOpen(true)}
              className="p-2 text-stone-400 dark:text-stone-600 hover:text-primary transition-colors"
              title={t.edit}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPDFModalOpen(true)}
            className="p-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 rounded-2xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
            title={t.downloadPDF}
          >
            <FileDown className="w-5 h-5" />
          </button>
          <button
            onClick={handleShare}
            className="p-3 bg-primary-light dark:bg-primary/10 text-primary rounded-2xl hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
            title={t.generateReport}
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-primary to-primary-hover text-white p-6 rounded-[2rem] shadow-xl shadow-primary-light transform hover:scale-[1.02] transition-transform">
          <div className="flex items-center gap-2 mb-3 opacity-80">
            <Calculator className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">{t.totalToReceive}</span>
          </div>
          <div className="text-3xl font-bold tracking-tight">{formatCurrency(totalEarnings, job.currency)}</div>
        </div>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-3 text-stone-400 dark:text-stone-500">
            <Clock className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">{t.totalHours}</span>
          </div>
          <div className="text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">{formatDuration(totalHours)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-stone-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-3 text-stone-400 dark:text-stone-500">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">{t.hourlyRate}</span>
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">{formatCurrency(job.hourlyRate, job.currency)}</div>
        </div>
        <div className="bg-white dark:bg-stone-900 p-6 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-3 text-stone-400 dark:text-stone-500">
            <Calendar className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">{t.daysWorked}</span>
          </div>
          <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">{sessions.length}</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <h3 className="text-lg font-bold">{t.workSessions}</h3>
        <button
          onClick={handleAddSession}
          className="bg-stone-900 hover:bg-stone-800 text-white p-2 rounded-xl flex items-center gap-2 px-4 text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          {t.addDay}
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-stone-300">
          <Calendar className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500">{t.noSessions}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const duration = calculateDuration(session.startTime, session.endTime, session.breakMinutes, session.isBreakPaid);
            return (
              <motion.div
                layout
                key={session.id}
                className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm hover:shadow-lg transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-2xl flex flex-col items-center justify-center text-stone-500 dark:text-stone-400 group-hover:bg-primary-light dark:group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <span className="text-[10px] font-bold uppercase leading-none">
                      {format(parseISO(session.date), 'MMM', { locale: getLocale() })}
                    </span>
                    <span className="text-lg font-bold leading-none dark:text-white">
                      {format(parseISO(session.date), 'dd')}
                    </span>
                  </div>
                  <div>
                    <div className="font-bold text-stone-900 dark:text-stone-100">
                      {session.startTime} - {session.endTime}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(duration)}
                      </span>
                      {session.breakMinutes > 0 && (
                        <button 
                          onClick={(e) => toggleBreakVisibility(e, session.id)}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 ${
                            session.isBreakPaid 
                              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/20' 
                              : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20'
                          }`}
                        >
                          <Coffee className="w-3 h-3" />
                          <span>{session.breakMinutes}m</span>
                          {visibleBreaks[session.id] && (
                            <motion.span
                              initial={{ opacity: 0, w: 0 }}
                              animate={{ opacity: 1, w: 'auto' }}
                              className="border-l border-current pl-1.5 ml-0.5"
                            >
                              {session.isBreakPaid ? t.paidBreak : t.unpaidBreak}
                            </motion.span>
                          )}
                          <Eye className={`w-3 h-3 ${visibleBreaks[session.id] ? 'opacity-100' : 'opacity-40'}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-primary">
                      {formatCurrency(duration * job.hourlyRate, job.currency)}
                    </div>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditSession(session)}
                      className="p-2 text-stone-300 dark:text-stone-600 hover:text-primary transition-colors"
                      title={t.edit}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-2 text-stone-300 dark:text-stone-600 hover:text-red-500 transition-colors"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <SessionModal 
        isOpen={isSessionModalOpen} 
        onClose={() => setIsSessionModalOpen(false)} 
        userId={userId} 
        jobId={jobId} 
        sessionToEdit={sessionToEdit}
        t={t}
      />

      <JobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        userId={userId}
        t={t}
        jobToEdit={job}
      />

      <PDFModal
        isOpen={isPDFModalOpen}
        onClose={() => setIsPDFModalOpen(false)}
        onConfirm={handleDownloadPDF}
        defaultTitle={t.invoice}
        defaultWorkerName={userId}
        t={t}
      />
    </div>
  );
}

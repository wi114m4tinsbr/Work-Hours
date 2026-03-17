import React, { useState, useEffect } from 'react';
import { db, collection, query, where, onSnapshot, addDoc, Timestamp, deleteDoc, doc, handleFirestoreError, OperationType } from '../firebase';
import { Job } from '../types';
import { Plus, Briefcase, Trash2, ChevronRight, DollarSign, Edit2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { JobModal, JOB_ICONS, JobIconName } from './JobModal';
import { motion } from 'motion/react';

const JobIcon = ({ job }: { job: Job }) => {
  if (job.iconType === 'image' && job.iconValue) {
    return <img src={job.iconValue} alt={job.name} className="w-full h-full object-cover rounded-2xl" />;
  }
  if (job.iconType === 'letter' && job.iconValue) {
    return <span className="text-xl font-bold uppercase">{job.iconValue.charAt(0)}</span>;
  }
  
  const IconComponent = JOB_ICONS[job.iconValue as JobIconName] || Briefcase;
  return <IconComponent className="w-7 h-7" />;
};

interface DashboardProps {
  userId: string;
  onSelectJob: (jobId: string) => void;
  t: any;
}

export function Dashboard({ userId, onSelectJob, t }: DashboardProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'jobs'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Job[];
      setJobs(jobsData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    });

    return () => unsubscribe();
  }, [userId]);

  const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (confirm(t.confirmDeleteJob)) {
      try {
        await deleteDoc(doc(db, 'jobs', jobId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `jobs/${jobId}`);
      }
    }
  };

  const handleEditJob = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    setJobToEdit(job);
    setIsModalOpen(true);
  };

  const handleNewJob = () => {
    setJobToEdit(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{t.myJobs}</h2>
        <button
          onClick={handleNewJob}
          className="bg-primary hover:bg-primary-hover text-white p-2 rounded-xl transition-all shadow-lg shadow-primary-light flex items-center gap-2 px-4 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">{t.newJob}</span>
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-stone-300">
          <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-stone-300" />
          </div>
          <p className="text-stone-500">{t.noJobs}</p>
          <button
            onClick={handleNewJob}
            className="mt-4 text-primary font-medium hover:underline"
          >
            {t.firstJob}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <motion.div
              layout
              key={job.id}
              onClick={() => onSelectJob(job.id)}
              className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all group-hover:rotate-3 overflow-hidden">
                  <JobIcon job={job} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{job.name}</h3>
                  <div className="flex items-center gap-1 text-stone-500 text-sm">
                    <DollarSign className="w-3 h-3" />
                    <span>{formatCurrency(job.hourlyRate, job.currency)} / {t.hourlyRate.toLowerCase()}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleEditJob(e, job)}
                  className="p-2 text-stone-300 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  title={t.edit}
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => handleDeleteJob(e, job.id)}
                  className="p-2 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  title={t.delete}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <ChevronRight className="w-5 h-5 text-stone-300" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <JobModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        userId={userId} 
        t={t}
        jobToEdit={jobToEdit}
      />
    </div>
  );
}

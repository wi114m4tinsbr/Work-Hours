import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Save, 
  ChevronLeft, 
  Settings, 
  Type, 
  Palette, 
  Layout,
  AlertCircle,
  CheckCircle2,
  Lock,
  Crown,
  FileText,
  Share2,
  CreditCard,
  Smartphone,
  Phone,
  Copy
} from 'lucide-react';
import { db, auth } from '../firebase';
import { 
  collection, 
  addDoc, 
  setDoc,
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDoc,
  deleteDoc 
} from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from '../lib/utils';
import { translations, Language } from '../lib/i18n';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceStyles {
  font: string;
  primaryColor: string;
  fontSize: number;
}

interface InvoiceCreatorProps {
  language: Language;
  onBack: () => void;
  isAdmin: boolean;
}

export const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({ language, onBack, isAdmin }) => {
  const t = translations[language];
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [invoiceAlias, setInvoiceAlias] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  
  const [issuer, setIssuer] = useState({ name: '', taxId: '', address: '' });
  const [receiver, setReceiver] = useState({ name: '', taxId: '', address: '' });
  
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', quantity: 1, unitPrice: 0 }
  ]);
  
  const [styles, setStyles] = useState<InvoiceStyles>({
    font: 'helvetica',
    primaryColor: '#3b82f6',
    fontSize: 10
  });

  const [labels, setLabels] = useState({
    invoice: t.invoice,
    invoiceNumber: t.invoiceNumber,
    orderNumber: t.orderNumber,
    date: t.date,
    dueDate: t.dueDate,
    issuer: t.issuer,
    receiver: t.receiver,
    description: t.description,
    quantity: t.quantity,
    unitPrice: t.unitPrice,
    total: t.total,
    subtotal: t.subtotal,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [dailyUsage, setDailyUsage] = useState({ count: 0, lastDate: '' });
  const [subscription, setSubscription] = useState('free');
  const [savedInvoices, setSavedInvoices] = useState<any[]>([]);
  const [showList, setShowList] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean, id: string | 'selected' }>({ show: false, id: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const FONTS = [
    { name: 'Helvetica', value: 'helvetica' },
    { name: 'Times New Roman', value: 'times' },
    { name: 'Courier', value: 'courier' },
    { name: 'Arial', value: 'arial' },
    { name: 'Verdana', value: 'verdana' },
    { name: 'Georgia', value: 'georgia' },
    { name: 'Trebuchet MS', value: 'trebuchet' },
    { name: 'Impact', value: 'impact' },
  ];

  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setDailyUsage({
          count: data.usage?.dailyInvoiceCount || 0,
          lastDate: data.usage?.lastInvoiceDate || ''
        });
        setSubscription(data.subscription?.type || 'free');
      }
    });

    const q = query(
      collection(db, 'invoices'), 
      where('userId', '==', auth.currentUser.uid)
    );
    const unsubscribeInvoices = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSavedInvoices(docs.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    return () => {
      unsubscribeUser();
      unsubscribeInvoices();
    };
  }, []);

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const total = subtotal; // Simplified for now, could add taxes

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const checkLimit = () => {
    const isUserAdmin = isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com';
    if (isUserAdmin) return true;
    if (subscription === 'monthly') return true;
    
    const today = new Date().toISOString().split('T')[0];
    if (dailyUsage.lastDate === today && dailyUsage.count >= 1) {
      return false;
    }
    return true;
  };

  const generatePDF = async (action: 'download' | 'share' = 'download') => {
    const doc = new jsPDF();
    
    // Set font
    doc.setFont(styles.font);
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(styles.primaryColor);
    doc.text(labels.invoice.toUpperCase(), 105, 20, { align: 'center' });
    
    doc.setFontSize(styles.fontSize);
    doc.setTextColor(0, 0, 0);
    
    // Issuer & Receiver
    doc.text(`${labels.issuer}:`, 20, 40);
    doc.text(issuer.name, 20, 45);
    doc.text(issuer.taxId, 20, 50);
    doc.text(issuer.address, 20, 55);
    
    doc.text(`${labels.receiver}:`, 120, 40);
    doc.text(receiver.name, 120, 45);
    doc.text(receiver.taxId, 120, 50);
    doc.text(receiver.address, 120, 55);
    
    // Details
    doc.text(`${labels.invoiceNumber}: ${invoiceNumber}`, 20, 75);
    doc.text(`${labels.date}: ${date}`, 20, 80);
    if (dueDate) doc.text(`${labels.dueDate}: ${dueDate}`, 20, 85);
    if (orderNumber) doc.text(`${labels.orderNumber}: ${orderNumber}`, 20, 90);
    
    // Table
    const tableData = items.map(item => [
      item.description,
      item.quantity.toString(),
      `${item.unitPrice.toFixed(2)} €`,
      `${(item.quantity * item.unitPrice).toFixed(2)} €`
    ]);
    
    autoTable(doc, {
      startY: 100,
      head: [[labels.description, labels.quantity, labels.unitPrice, labels.total]],
      body: tableData,
      headStyles: { fillColor: styles.primaryColor },
      theme: 'grid'
    });
    
    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`${labels.total}: ${total.toFixed(2)} €`, 190, finalY, { align: 'right' });
    
    const safeInvoiceNumber = invoiceNumber.replace(/[/\\?%*:|"<>]/g, '-');
    
    if (action === 'download') {
      doc.save(`${safeInvoiceNumber}.pdf`);
    } else if (action === 'share') {
      // Try to generate a shareable link first
      setMessage({ type: 'success', text: t.sharingLink });
      
      try {
        // Save the invoice data to shared_invoices collection
        const sharedInvoiceData = {
          invoiceNumber,
          orderNumber,
          date,
          dueDate,
          issuer,
          receiver,
          items: items.map(({ description, quantity, unitPrice }) => ({
            description,
            quantity,
            unitPrice,
            total: quantity * unitPrice
          })),
          subtotal,
          total,
          currency: '€',
          styles,
          labels,
          createdAt: serverTimestamp(),
          isShared: true
        };

        const docRef = await addDoc(collection(db, 'shared_invoices'), sharedInvoiceData);
        
        // Generate link
        const shareLink = `${window.location.origin}?view=${docRef.id}`;
        
        // Copy link to clipboard
        await navigator.clipboard.writeText(shareLink);
        setMessage({ type: 'success', text: t.linkCopied });
        
        // Optional: Also try to share if supported
        if (navigator.share) {
          try {
            await navigator.share({
              title: labels.invoice,
              text: `${labels.invoice} ${invoiceNumber}`,
              url: shareLink
            });
          } catch (e) {
            // Ignore share error if link was already copied
          }
        }
        return;
      } catch (error) {
        console.error('Error generating link:', error);
        setMessage({ type: 'error', text: t.linkError });
        
        // Fallback: Direct file share
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], `${safeInvoiceNumber}.pdf`, { type: 'application/pdf' });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: labels.invoice,
            });
          } catch (shareErr) {
            if ((shareErr as Error).name !== 'AbortError') {
              doc.save(`${safeInvoiceNumber}.pdf`);
            }
          }
        } else {
          doc.save(`${safeInvoiceNumber}.pdf`);
        }
      }
    }
  };

  const handleSaveInvoice = async () => {
    if (!auth.currentUser) return;

    setIsSaving(true);
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      const invoiceData: any = {
        userId: auth.currentUser.uid,
        invoiceNumber,
        invoiceAlias,
        orderNumber,
        date,
        dueDate,
        issuer,
        receiver,
        items: items.map(({ description, quantity, unitPrice }) => ({
          description,
          quantity,
          unitPrice,
          total: quantity * unitPrice
        })),
        subtotal,
        total,
        currency: '€',
        styles,
        labels,
        savedTime: timeStr,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'invoices', editingId), invoiceData);
      } else {
        invoiceData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'invoices'), invoiceData);
        setEditingId(docRef.id);
      }
      setMessage({ type: 'success', text: t.invoiceSaved });
    } catch (error) {
      console.error('Error saving invoice:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar fatura.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleAction = async (action: 'download' | 'share') => {
    if (!auth.currentUser) return;

    if (!checkLimit()) {
      setShowPaymentModal(true);
      return;
    }

    if (action === 'share') setIsSharing(true);
    else setIsDownloading(true);

    try {
      // IMPORTANT: Call generatePDF (which calls navigator.share) 
      // BEFORE any async calls to preserve the user activation gesture.
      await generatePDF(action);

      // Update Usage in background
      const today = new Date().toISOString().split('T')[0];
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const newCount = (dailyUsage.count || 0) + 1;
      
      updateDoc(userRef, {
        usage: {
          lastInvoiceDate: today,
          dailyInvoiceCount: newCount
        }
      }).catch(err => console.error('Error updating usage:', err));
    } catch (error) {
      console.error('Error in action:', error);
      if ((error as Error).name !== 'AbortError') {
        setMessage({ type: 'error', text: 'Erro ao processar ação.' });
      }
    } finally {
      setIsSharing(false);
      setIsDownloading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invoices', id));
      if (editingId === id) {
        setEditingId(null);
      }
      setMessage({ type: 'success', text: 'Fatura excluída com sucesso!' });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir fatura.' });
    } finally {
      setDeleteModal({ show: false, id: '' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedInvoices.length === 0) return;
    
    setIsSaving(true);
    try {
      await Promise.all(selectedInvoices.map(id => deleteDoc(doc(db, 'invoices', id))));
      if (editingId && selectedInvoices.includes(editingId)) {
        setEditingId(null);
      }
      setSelectedInvoices([]);
      setMessage({ type: 'success', text: 'Faturas excluídas com sucesso!' });
    } catch (error) {
      console.error('Error deleting invoices:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir faturas.' });
    } finally {
      setIsSaving(false);
      setDeleteModal({ show: false, id: '' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === savedInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(savedInvoices.map(inv => inv.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="font-medium">{t.back}</span>
          </button>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (showList) {
                  // Reset state for new invoice when clicking "New Invoice" from list
                  setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
                  setInvoiceAlias('');
                  setOrderNumber('');
                  setDate(new Date().toISOString().split('T')[0]);
                  setDueDate('');
                  setIssuer({ name: '', taxId: '', address: '' });
                  setReceiver({ name: '', taxId: '', address: '' });
                  setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
                  setEditingId(null);
                }
                setShowList(!showList);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-xl hover:bg-gray-100 transition-all"
            >
              <Layout size={20} />
              <span>{showList ? t.newInvoice : t.invoiceList}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
              {isAdmin ? (
                <Crown size={16} className="text-yellow-500" />
              ) : subscription === 'monthly' ? (
                <Crown size={16} className="text-blue-500" />
              ) : (
                <Lock size={16} className="text-gray-400" />
              )}
              <span>{isAdmin ? 'Admin' : subscription === 'monthly' ? 'Premium' : 'Free'}</span>
            </div>
            
            <button
              onClick={() => handleSaveInvoice()}
              disabled={isSaving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={20} />
              )}
              <span>Salvar</span>
            </button>

            <button
              onClick={() => handleAction('share')}
              disabled={isSharing || isDownloading || isSaving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-green-200 disabled:opacity-50"
            >
              {isSharing ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Smartphone size={20} />
              )}
              <span>{t.share}</span>
            </button>

            <button
              onClick={() => handleAction('download')}
              disabled={isSharing || isDownloading || isSaving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              {isDownloading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download size={20} />
              )}
              <span>{t.download}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {showList ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-gray-900">{t.invoiceList}</h2>
                
                {savedInvoices.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleSelectAll}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      {selectedInvoices.length === savedInvoices.length ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                    </button>
                    {selectedInvoices.length > 0 && (
                      <button
                        onClick={() => setDeleteModal({ show: true, id: 'selected' })}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        Excluir Selecionadas ({selectedInvoices.length})
                      </button>
                    )}
                  </div>
                )}
              </div>

              {savedInvoices.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Nenhuma fatura encontrada.</p>
                  <button 
                    onClick={() => {
                      // Reset state for new invoice
                      setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
                      setInvoiceAlias('');
                      setOrderNumber('');
                      setDate(new Date().toISOString().split('T')[0]);
                      setDueDate('');
                      setIssuer({ name: '', taxId: '', address: '' });
                      setReceiver({ name: '', taxId: '', address: '' });
                      setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
                      setEditingId(null);
                      setShowList(false);
                    }}
                    className="mt-4 text-blue-600 font-bold hover:underline"
                  >
                    {t.newInvoice}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedInvoices.map((inv) => (
                    <div 
                      key={inv.id} 
                      className={`bg-white p-6 rounded-2xl shadow-sm border transition-all group relative ${
                        selectedInvoices.includes(inv.id) ? 'border-blue-500 bg-blue-50/30' : 'border-gray-100 hover:shadow-md'
                      }`}
                    >
                      <div className="absolute top-4 left-4 z-10">
                        <input 
                          type="checkbox"
                          checked={selectedInvoices.includes(inv.id)}
                          onChange={() => toggleSelectInvoice(inv.id)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex justify-between items-start mb-4 pl-8">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <FileText size={20} />
                        </div>
                        <div className="text-right">
                          <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                            {inv.date}
                          </span>
                          {inv.savedTime && (
                            <span className="block text-[10px] text-gray-400 mt-0.5">
                              {inv.savedTime}
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-900 mb-1 pl-8 truncate">
                        {inv.invoiceAlias || inv.invoiceNumber}
                      </h3>
                      {inv.invoiceAlias && (
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider pl-8 mb-1">
                          {inv.invoiceNumber}
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mb-4 truncate pl-8">{inv.receiver?.name || 'Sem nome'}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                        <span className="font-bold text-blue-600">{inv.total.toFixed(2)} €</span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              // Load invoice data
                              setInvoiceNumber(inv.invoiceNumber);
                              setInvoiceAlias(inv.invoiceAlias || '');
                              setOrderNumber(inv.orderNumber || '');
                              setDate(inv.date);
                              setDueDate(inv.dueDate || '');
                              setIssuer(inv.issuer);
                              setReceiver(inv.receiver);
                              setItems(inv.items.map((it: any, idx: number) => ({ id: idx.toString(), ...it })));
                              setStyles(inv.styles || styles);
                              setEditingId(inv.id);
                              setShowList(false);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Settings size={18} />
                          </button>
                          <button 
                            onClick={() => setDeleteModal({ show: true, id: inv.id })}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Internal Name (Alias) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-50 text-gray-400 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{t.internalName}</p>
                    <input 
                      type="text" 
                      placeholder={t.internalNamePlaceholder}
                      value={invoiceAlias}
                      onChange={(e) => setInvoiceAlias(e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-600 p-0"
                    />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                      message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <span className="font-medium">{message.text}</span>
                    {message.type === 'error' && !(isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com') && subscription === 'free' && (
                      <button className="ml-auto text-sm underline font-bold">
                        {t.upgradeToUnlimited}
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-8 space-y-8">
                      {/* Invoice Header */}
                      <div className="flex flex-col md:flex-row justify-between gap-8">
                        <div className="space-y-4 flex-1">
                          <input 
                            value={labels.invoice}
                            onChange={(e) => setLabels({ ...labels, invoice: e.target.value })}
                            className="text-3xl font-bold uppercase tracking-wider bg-transparent border-none focus:ring-0 w-full p-0"
                            style={{ color: styles.primaryColor }}
                          />
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center gap-2">
                              <input 
                                value={labels.invoiceNumber}
                                onChange={(e) => setLabels({ ...labels, invoiceNumber: e.target.value })}
                                className="text-sm font-semibold text-gray-500 w-24 bg-transparent border-none focus:ring-0 p-0"
                              />
                              <input 
                                type="text" 
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className="flex-1 bg-gray-50 border-none rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                value={labels.orderNumber}
                                onChange={(e) => setLabels({ ...labels, orderNumber: e.target.value })}
                                className="text-sm font-semibold text-gray-500 w-24 bg-transparent border-none focus:ring-0 p-0"
                              />
                              <input 
                                type="text" 
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value)}
                                className="flex-1 bg-gray-50 border-none rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4 flex-1">
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center gap-2">
                              <input 
                                value={labels.date}
                                onChange={(e) => setLabels({ ...labels, date: e.target.value })}
                                className="text-sm font-semibold text-gray-500 w-24 bg-transparent border-none focus:ring-0 p-0"
                              />
                              <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="flex-1 bg-gray-50 border-none rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                value={labels.dueDate}
                                onChange={(e) => setLabels({ ...labels, dueDate: e.target.value })}
                                className="text-sm font-semibold text-gray-500 w-24 bg-transparent border-none focus:ring-0 p-0"
                              />
                              <input 
                                type="date" 
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="flex-1 bg-gray-50 border-none rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <hr className="border-gray-100" />

                      {/* Issuer & Receiver */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-4">
                          <input 
                            value={labels.issuer}
                            onChange={(e) => setLabels({ ...labels, issuer: e.target.value })}
                            className="text-sm font-bold text-gray-400 uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0"
                          />
                          <div className="space-y-2">
                            <input 
                              placeholder="Nome / Empresa"
                              value={issuer.name}
                              onChange={(e) => setIssuer({ ...issuer, name: e.target.value })}
                              className="w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 font-semibold text-lg outline-none"
                            />
                            <input 
                              placeholder="NIF / Tax ID"
                              value={issuer.taxId}
                              onChange={(e) => setIssuer({ ...issuer, taxId: e.target.value })}
                              className="w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 text-sm outline-none"
                            />
                            <textarea 
                              placeholder="Morada"
                              value={issuer.address}
                              onChange={(e) => setIssuer({ ...issuer, address: e.target.value })}
                              className="w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 text-sm outline-none resize-none"
                              rows={2}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <input 
                            value={labels.receiver}
                            onChange={(e) => setLabels({ ...labels, receiver: e.target.value })}
                            className="text-sm font-bold text-gray-400 uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0"
                          />
                          <div className="space-y-2">
                            <input 
                              placeholder="Nome do Cliente"
                              value={receiver.name}
                              onChange={(e) => setReceiver({ ...receiver, name: e.target.value })}
                              className="w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 font-semibold text-lg outline-none"
                            />
                            <input 
                              placeholder="NIF / Tax ID"
                              value={receiver.taxId}
                              onChange={(e) => setReceiver({ ...receiver, taxId: e.target.value })}
                              className="w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 text-sm outline-none"
                            />
                            <textarea 
                              placeholder="Morada do Cliente"
                              value={receiver.address}
                              onChange={(e) => setReceiver({ ...receiver, address: e.target.value })}
                              className="w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 text-sm outline-none resize-none"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <div className="col-span-6">
                            <input 
                              value={labels.description}
                              onChange={(e) => setLabels({ ...labels, description: e.target.value })}
                              className="bg-transparent border-none focus:ring-0 p-0 w-full text-xs font-bold text-gray-500 uppercase"
                            />
                          </div>
                          <div className="col-span-2 text-center">
                            <input 
                              value={labels.quantity}
                              onChange={(e) => setLabels({ ...labels, quantity: e.target.value })}
                              className="bg-transparent border-none focus:ring-0 p-0 w-full text-xs font-bold text-gray-500 uppercase text-center"
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <input 
                              value={labels.unitPrice}
                              onChange={(e) => setLabels({ ...labels, unitPrice: e.target.value })}
                              className="bg-transparent border-none focus:ring-0 p-0 w-full text-xs font-bold text-gray-500 uppercase text-right"
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <input 
                              value={labels.total}
                              onChange={(e) => setLabels({ ...labels, total: e.target.value })}
                              className="bg-transparent border-none focus:ring-0 p-0 w-full text-xs font-bold text-gray-500 uppercase text-right"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-2 items-center group">
                              <div className="col-span-6 flex items-center gap-2">
                                <button 
                                  onClick={() => removeItem(item.id)}
                                  className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 size={16} />
                                </button>
                                <input 
                                  value={item.description}
                                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                  className="w-full bg-transparent border-b border-transparent focus:border-blue-500 py-1 outline-none"
                                  placeholder="Descrição do serviço..."
                                />
                              </div>
                              <div className="col-span-2">
                                <input 
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-transparent border-b border-transparent focus:border-blue-500 py-1 text-center outline-none"
                                />
                              </div>
                              <div className="col-span-2">
                                <input 
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-transparent border-b border-transparent focus:border-blue-500 py-1 text-right outline-none"
                                />
                              </div>
                              <div className="col-span-2 text-right font-semibold">
                                {(item.quantity * item.unitPrice).toFixed(2)} €
                              </div>
                            </div>
                          ))}
                        </div>

                        <button 
                          onClick={addItem}
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          <Plus size={18} />
                          {t.addInvoiceItem}
                        </button>
                      </div>

                      <hr className="border-gray-100" />

                      {/* Summary */}
                      <div className="flex justify-end">
                        <div className="w-full max-w-xs space-y-3">
                          <div className="flex justify-between text-gray-500">
                            <input 
                              value={labels.subtotal}
                              onChange={(e) => setLabels({ ...labels, subtotal: e.target.value })}
                              className="bg-transparent border-none focus:ring-0 p-0 text-gray-500"
                            />
                            <span>{subtotal.toFixed(2)} €</span>
                          </div>
                          <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-100">
                            <input 
                              value={labels.total}
                              onChange={(e) => setLabels({ ...labels, total: e.target.value })}
                              className="bg-transparent border-none focus:ring-0 p-0 text-gray-900 font-bold"
                            />
                            <span>{total.toFixed(2)} €</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar Controls */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-900 font-bold">
                        <Palette size={20} className="text-blue-600" />
                        <h3>{t.editStyles}</h3>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.color}</label>
                          <div className="flex flex-wrap gap-2">
                            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#000000'].map(color => (
                              <button
                                key={color}
                                onClick={() => setStyles({ ...styles, primaryColor: color })}
                                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                                  styles.primaryColor === color ? 'border-white ring-2 ring-blue-500 scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.font}</label>
                          <select 
                            value={styles.font}
                            onChange={(e) => setStyles({ ...styles, font: e.target.value })}
                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                          >
                            {FONTS.map(font => (
                              <option key={font.value} value={font.value}>{font.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.fontSize}</label>
                          <input 
                            type="range" 
                            min="8" 
                            max="14" 
                            value={styles.fontSize}
                            onChange={(e) => setStyles({ ...styles, fontSize: parseInt(e.target.value) })}
                            className="w-full accent-blue-600"
                          />
                          <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                            <span>Pequeno</span>
                            <span>Grande</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <div className="flex items-center gap-2 text-gray-900 font-bold">
                        <Settings size={20} className="text-blue-600" />
                        <h3>{t.adminSettings}</h3>
                      </div>
                      
                      <div className={cn(
                        "rounded-xl p-4 space-y-3 transition-colors",
                        (isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com') 
                          ? "bg-blue-50" 
                          : dailyUsage.count >= 1 ? "bg-red-50" : "bg-blue-50"
                      )}>
                        <div className="flex items-center justify-between text-sm">
                          <span className={cn(
                            "font-medium",
                            (isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com')
                              ? "text-blue-700"
                              : dailyUsage.count >= 1 ? "text-red-700" : "text-blue-700"
                          )}>Uso Diário</span>
                          <span className={cn(
                            "font-bold",
                            (isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com')
                              ? "text-blue-900"
                              : dailyUsage.count >= 1 ? "text-red-900" : "text-blue-900"
                          )}>
                            {(isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com') 
                              ? "∞" 
                              : dailyUsage.count >= 1 ? "0 / 0" : "0 / 1"}
                          </span>
                        </div>
                        <div className={cn(
                          "w-full rounded-full h-2",
                          (isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com')
                            ? "bg-blue-200"
                            : dailyUsage.count >= 1 ? "bg-red-200" : "bg-blue-200"
                        )}>
                          <div 
                            className={cn(
                              "h-2 rounded-full transition-all duration-500",
                              (isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com')
                                ? "bg-blue-600"
                                : dailyUsage.count >= 1 ? "bg-red-600" : "bg-blue-600"
                            )}
                            style={{ 
                              width: (isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com')
                                ? "100%"
                                : dailyUsage.count >= 1 ? "100%" : "0%"
                            }}
                          />
                        </div>
                        {!(isAdmin || auth.currentUser?.email?.toLowerCase().trim() === 'martinswilliam2004@gmail.com') && subscription === 'free' && dailyUsage.count >= 1 && (
                          <p className="text-[10px] text-red-600 font-medium leading-tight">
                            Você atingiu o limite gratuito. Faça upgrade para continuar criando faturas ilimitadas.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {showPaymentModal && (
        <PaymentModal onClose={() => setShowPaymentModal(false)} t={t} />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteModal({ show: false, id: '' })}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                {deleteModal.id === 'selected' ? 'Excluir Selecionadas' : 'Excluir Fatura'}
              </h3>
              <p className="text-gray-500 text-center mb-8">
                {deleteModal.id === 'selected' 
                  ? `Tem certeza que deseja excluir ${selectedInvoices.length} faturas? Esta ação não pode ser desfeita.`
                  : 'Tem certeza que deseja excluir esta fatura? Esta ação não pode ser desfeita.'}
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => deleteModal.id === 'selected' ? handleDeleteSelected() : handleDeleteInvoice(deleteModal.id)}
                  disabled={isSaving}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {isSaving ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
                <button
                  onClick={() => setDeleteModal({ show: false, id: '' })}
                  className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PaymentModal: React.FC<{ 
  onClose: () => void; 
  t: any;
}> = ({ onClose, t }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="bg-blue-50 p-3 rounded-2xl">
              <Lock className="text-blue-600" size={24} />
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <Plus className="rotate-45" size={24} />
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">{t.limitTitle}</h2>
            <p className="text-gray-500 leading-relaxed">{t.limitMessage}</p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.paymentOptions}</h3>
              
              <div className="grid grid-cols-1 gap-2">
                <button className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-500 transition-all group">
                  <div className="flex items-center gap-3">
                    <CreditCard className="text-blue-600" size={20} />
                    <span className="font-semibold text-gray-700">{t.creditCard}</span>
                  </div>
                  <ChevronLeft className="rotate-180 text-gray-300 group-hover:text-blue-500" size={18} />
                </button>

                <button className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:border-blue-500 transition-all group">
                  <div className="flex items-center gap-3">
                    <Smartphone className="text-black" size={20} />
                    <span className="font-semibold text-gray-700">{t.applePay}</span>
                  </div>
                  <ChevronLeft className="rotate-180 text-gray-300 group-hover:text-blue-500" size={18} />
                </button>

                <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <Phone className="text-green-600" size={20} />
                    <span className="font-semibold text-gray-700">{t.mbWay}</span>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <span className="text-green-700 font-mono font-bold text-lg">+351 926 658 230</span>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center uppercase font-bold tracking-wider">
                    {t.paymentInstructions}
                  </p>
                </div>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

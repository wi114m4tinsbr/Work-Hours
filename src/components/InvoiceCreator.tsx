import { ToolIdentity } from "./ToolIdentity";
import { isPremium } from '../lib/subscription';
import type { DailyQuota } from '../lib/quota';
import { UsageBadge, QuotaNotice } from './UsageBadge';
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
  Copy,
  Image,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ChevronUp,
  ChevronDown
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

interface TextStyle {
  color: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
}

interface InvoiceStyles {
  font: string;
  primaryColor: string;
  backgroundColor: string;
  template: string;
  logo?: string;
  logoX: number;
  logoY: number;
  logoWidth: number;
  logoHeight: number;
  logoRotation?: number;
  logoZIndex?: number;
  fieldStyles: {
    [key: string]: TextStyle;
  };
}

const DEFAULT_TEXT_STYLE: TextStyle = {
  color: '#000000',
  bold: false,
  italic: false,
  fontSize: 10
};

const createFieldStyles = (base: Partial<TextStyle> = {}, overrides: { [key: string]: Partial<TextStyle> } = {}) => {
  const fields = [
    'title', 'invoiceNumberLabel', 'invoiceNumberValue', 'orderNumberLabel', 'orderNumberValue',
    'dateLabel', 'dateValue', 'dueDateLabel', 'dueDateValue', 'issuerLabel', 'issuerName',
    'issuerTaxId', 'issuerAddress', 'receiverLabel', 'receiverName', 'receiverTaxId',
    'receiverAddress', 'tableHeader', 'tableBody', 'subtotalLabel', 'subtotalValue',
    'taxLabel', 'taxValue', 'totalLabel', 'totalValue', 'notesLabel', 'notesValue'
  ];
  
  const styles: { [key: string]: TextStyle } = {};
  fields.forEach(field => {
    styles[field] = { ...DEFAULT_TEXT_STYLE, ...base, ...(overrides[field] || {}) };
  });
  return styles;
};

const TEMPLATES = [
  {
    id: 'modern',
    name: 'Modern',
    styles: {
      font: 'helvetica',
      primaryColor: '#3b82f6',
      backgroundColor: '#ffffff',
      template: 'modern',
      logoX: 150,
      logoY: 20,
      logoWidth: 40,
      logoHeight: 40,
      logoRotation: 0,
      logoZIndex: 10,
      fieldStyles: createFieldStyles({}, {
        title: { color: '#3b82f6', fontSize: 20, bold: true },
        issuerLabel: { color: '#6b7280', fontSize: 9, bold: true },
        receiverLabel: { color: '#6b7280', fontSize: 9, bold: true },
        invoiceNumberLabel: { color: '#6b7280', fontSize: 9, bold: true },
        orderNumberLabel: { color: '#6b7280', fontSize: 9, bold: true },
        dateLabel: { color: '#6b7280', fontSize: 9, bold: true },
        dueDateLabel: { color: '#6b7280', fontSize: 9, bold: true },
        tableHeader: { color: '#ffffff', fontSize: 10, bold: true },
        totalLabel: { fontSize: 12, bold: true },
        totalValue: { color: '#3b82f6', fontSize: 12, bold: true },
        taxLabel: { color: '#6b7280', fontSize: 9 },
        taxValue: { fontSize: 10 },
        notesLabel: { color: '#6b7280', fontSize: 9, bold: true },
        notesValue: { fontSize: 9, italic: true },
      })
    }
  },
  {
    id: 'classic',
    name: 'Classic',
    styles: {
      font: 'times',
      primaryColor: '#1f2937',
      backgroundColor: '#ffffff',
      template: 'classic',
      logoX: 20,
      logoY: 20,
      logoWidth: 30,
      logoHeight: 30,
      logoRotation: 0,
      logoZIndex: 10,
      fieldStyles: createFieldStyles({}, {
        title: { fontSize: 24, bold: true },
        tableHeader: { color: '#ffffff', bold: true },
        totalValue: { fontSize: 14, bold: true }
      })
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    styles: {
      font: 'helvetica',
      primaryColor: '#000000',
      backgroundColor: '#ffffff',
      template: 'minimal',
      logoX: 170,
      logoY: 10,
      logoWidth: 25,
      logoHeight: 25,
      logoRotation: 0,
      logoZIndex: 10,
      fieldStyles: createFieldStyles({}, {
        title: { fontSize: 16, bold: false },
        tableHeader: { color: '#ffffff', fontSize: 9 }
      })
    }
  },
  {
    id: 'bold',
    name: 'Bold',
    styles: {
      font: 'impact',
      primaryColor: '#ef4444',
      backgroundColor: '#ffffff',
      template: 'bold',
      logoX: 20,
      logoY: 10,
      logoWidth: 50,
      logoHeight: 50,
      fieldStyles: createFieldStyles({}, {
        title: { color: '#ef4444', fontSize: 28, bold: true },
        tableHeader: { color: '#ffffff', bold: true },
        totalValue: { color: '#ef4444', fontSize: 18, bold: true }
      })
    }
  },
  {
    id: 'elegant',
    name: 'Elegant',
    styles: {
      font: 'georgia',
      primaryColor: '#4b2c20',
      backgroundColor: '#fffaf5',
      template: 'elegant',
      logoX: 90,
      logoY: 15,
      logoWidth: 30,
      logoHeight: 30,
      fieldStyles: createFieldStyles({}, {
        title: { color: '#4b2c20', fontSize: 22, italic: true },
        tableHeader: { color: '#ffffff', italic: true },
        totalValue: { color: '#4b2c20', fontSize: 16, bold: true }
      })
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    styles: {
      font: 'verdana',
      primaryColor: '#1e3a8a',
      backgroundColor: '#f8fafc',
      template: 'professional',
      logoX: 20,
      logoY: 15,
      logoWidth: 35,
      logoHeight: 35,
      fieldStyles: createFieldStyles({}, {
        title: { color: '#1e3a8a', fontSize: 20, bold: true },
        tableHeader: { color: '#ffffff', bold: true },
        totalValue: { color: '#1e3a8a', fontSize: 14, bold: true }
      })
    }
  }
];

interface InvoiceCreatorProps {
  language: Language;
  onBack: () => void;
  isAdmin: boolean;
  embedded?: boolean;
  /** Daily allowance from the app; missing means unlimited (e.g. isolated tests). */
  quota?: DailyQuota;
}

export const InvoiceCreator: React.FC<InvoiceCreatorProps> = ({ language, onBack, isAdmin, embedded = false, quota }) => {
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
  
  const [styles, setStyles] = useState<InvoiceStyles>(TEMPLATES[0].styles);

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
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedField, setSelectedField] = useState<keyof InvoiceStyles['fieldStyles']>('title');

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
        setSubscription(isPremium(data.subscription) ? 'monthly' : 'free');
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
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

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

  // Free accounts get one downloaded or shared invoice per day; saving drafts is never counted.
  const limitReached = !!quota?.reached;
  const [limitNotice, setLimitNotice] = useState(false);
  const usageText = language === 'en' ? '1 invoice available today' : language === 'es' ? '1 factura disponible hoy' : '1 fatura disponível hoje';
  const usageBadge = (className?: string) => quota ? (
    <UsageBadge access={quota.access} language={language} available={usageText} reached={quota.reached} progress={quota.used / quota.limit} className={className} />
  ) : null;
  const checkLimit = () => !limitReached;

  const generatePDF = async (action: 'download' | 'share' = 'download') => {
    const doc = new jsPDF();
    
    const setTextStyle = (style: TextStyle) => {
      doc.setTextColor(style.color);
      doc.setFontSize(style.fontSize);
      let fontType = 'normal';
      if (style.bold && style.italic) fontType = 'bolditalic';
      else if (style.bold) fontType = 'bold';
      else if (style.italic) fontType = 'italic';
      doc.setFont(styles.font, fontType);
    };

    // Background Color
    if (styles.backgroundColor && styles.backgroundColor !== '#ffffff') {
      doc.setFillColor(styles.backgroundColor);
      doc.rect(0, 0, 210, 297, 'F');
    }

    // Logo
    if (styles.logo) {
      try {
        doc.addImage(
          styles.logo, 
          'PNG', 
          styles.logoX, 
          styles.logoY, 
          styles.logoWidth, 
          styles.logoHeight, 
          undefined, 
          'FAST', 
          styles.logoRotation ?? 0
        );
      } catch (e) {
        console.error('Error adding logo to PDF:', e);
      }
    }
    
    // Header
    setTextStyle(styles.fieldStyles.title);
    doc.text(labels.invoice.toUpperCase(), 105, 20, { align: 'center' });
    
    // Issuer & Receiver
    setTextStyle(styles.fieldStyles.issuerLabel);
    doc.text(`${labels.issuer}:`, 20, 40);
    setTextStyle(styles.fieldStyles.receiverLabel);
    doc.text(`${labels.receiver}:`, 120, 40);

    setTextStyle(styles.fieldStyles.issuerName);
    doc.text(issuer.name, 20, 45);
    setTextStyle(styles.fieldStyles.issuerTaxId);
    doc.text(issuer.taxId, 20, 50);
    setTextStyle(styles.fieldStyles.issuerAddress);
    doc.text(issuer.address, 20, 55);
    
    setTextStyle(styles.fieldStyles.receiverName);
    doc.text(receiver.name, 120, 45);
    setTextStyle(styles.fieldStyles.receiverTaxId);
    doc.text(receiver.taxId, 120, 50);
    setTextStyle(styles.fieldStyles.receiverAddress);
    doc.text(receiver.address, 120, 55);
    
    // Details
    setTextStyle(styles.fieldStyles.invoiceNumberLabel);
    doc.text(`${labels.invoiceNumber}:`, 20, 75);
    setTextStyle(styles.fieldStyles.dateLabel);
    doc.text(`${labels.date}:`, 20, 80);
    if (dueDate) {
      setTextStyle(styles.fieldStyles.dueDateLabel);
      doc.text(`${labels.dueDate}:`, 20, 85);
    }
    if (orderNumber) {
      setTextStyle(styles.fieldStyles.orderNumberLabel);
      doc.text(`${labels.orderNumber}:`, 20, 90);
    }

    setTextStyle(styles.fieldStyles.invoiceNumberValue);
    doc.text(invoiceNumber, 60, 75);
    setTextStyle(styles.fieldStyles.dateValue);
    doc.text(date, 60, 80);
    if (dueDate) {
      setTextStyle(styles.fieldStyles.dueDateValue);
      doc.text(dueDate, 60, 85);
    }
    if (orderNumber) {
      setTextStyle(styles.fieldStyles.orderNumberValue);
      doc.text(orderNumber, 60, 90);
    }
    
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
      headStyles: { 
        fillColor: styles.primaryColor,
        textColor: styles.fieldStyles.tableHeader.color,
        fontSize: styles.fieldStyles.tableHeader.fontSize,
        fontStyle: styles.fieldStyles.tableHeader.bold && styles.fieldStyles.tableHeader.italic ? 'bolditalic' : 
                   styles.fieldStyles.tableHeader.bold ? 'bold' : 
                   styles.fieldStyles.tableHeader.italic ? 'italic' : 'normal'
      },
      bodyStyles: {
        textColor: styles.fieldStyles.tableBody.color,
        fontSize: styles.fieldStyles.tableBody.fontSize,
        fontStyle: styles.fieldStyles.tableBody.bold && styles.fieldStyles.tableBody.italic ? 'bolditalic' : 
                   styles.fieldStyles.tableBody.bold ? 'bold' : 
                   styles.fieldStyles.tableBody.italic ? 'italic' : 'normal'
      },
      theme: 'grid'
    });
    
    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    setTextStyle(styles.fieldStyles.subtotalLabel);
    doc.text(`${labels.subtotal}:`, 160, finalY, { align: 'right' });
    setTextStyle(styles.fieldStyles.subtotalValue);
    doc.text(`${subtotal.toFixed(2)} €`, 190, finalY, { align: 'right' });

    setTextStyle(styles.fieldStyles.taxLabel);
    doc.text(`${labels.tax} (${taxRate}%):`, 160, finalY + 7, { align: 'right' });
    setTextStyle(styles.fieldStyles.taxValue);
    doc.text(`${taxAmount.toFixed(2)} €`, 190, finalY + 7, { align: 'right' });

    setTextStyle(styles.fieldStyles.totalLabel);
    doc.text(`${labels.total}:`, 160, finalY + 15, { align: 'right' });
    setTextStyle(styles.fieldStyles.totalValue);
    doc.text(`${total.toFixed(2)} €`, 190, finalY + 15, { align: 'right' });

    if (notes) {
      setTextStyle(styles.fieldStyles.notesLabel);
      doc.text(`${labels.notes}:`, 20, finalY + 30);
      setTextStyle(styles.fieldStyles.notesValue);
      doc.text(notes, 20, finalY + 35, { maxWidth: 170 });
    }
    
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

  const getSafeStyles = (savedStyles: any): InvoiceStyles => {
    const defaultStyles = TEMPLATES[0].styles;
    if (!savedStyles) return defaultStyles;

    // If it's the old format (flat object with color, font, fontSize)
    if (savedStyles.color && !savedStyles.fieldStyles && !savedStyles.titleStyle) {
      return {
        ...defaultStyles,
        primaryColor: savedStyles.color,
        font: savedStyles.font || defaultStyles.font,
        fieldStyles: createFieldStyles({}, {
          title: { color: savedStyles.color, fontSize: 20, bold: true },
          totalValue: { color: savedStyles.color, fontSize: 12, bold: true },
        })
      };
    }

    // If it's the intermediate format (with titleStyle, labelStyle, etc.)
    if (savedStyles.titleStyle && !savedStyles.fieldStyles) {
      return {
        ...defaultStyles,
        ...savedStyles,
        fieldStyles: createFieldStyles({}, {
          title: savedStyles.titleStyle,
          invoiceNumberLabel: savedStyles.labelStyle,
          invoiceNumberValue: savedStyles.contentStyle,
          orderNumberLabel: savedStyles.labelStyle,
          orderNumberValue: savedStyles.contentStyle,
          dateLabel: savedStyles.labelStyle,
          dateValue: savedStyles.contentStyle,
          dueDateLabel: savedStyles.labelStyle,
          dueDateValue: savedStyles.contentStyle,
          issuerLabel: savedStyles.labelStyle,
          issuerName: savedStyles.contentStyle,
          issuerTaxId: savedStyles.contentStyle,
          issuerAddress: savedStyles.contentStyle,
          receiverLabel: savedStyles.labelStyle,
          receiverName: savedStyles.contentStyle,
          receiverTaxId: savedStyles.contentStyle,
          receiverAddress: savedStyles.contentStyle,
          tableHeader: savedStyles.tableHeaderStyle,
          tableBody: savedStyles.tableBodyStyle,
          subtotalLabel: savedStyles.labelStyle,
          subtotalValue: savedStyles.contentStyle,
          totalLabel: savedStyles.totalStyle,
          totalValue: savedStyles.totalStyle,
        })
      };
    }

    // If it's the new format, ensure all properties exist
    return {
      ...defaultStyles,
      ...savedStyles,
      logoRotation: savedStyles.logoRotation ?? 0,
      logoZIndex: savedStyles.logoZIndex ?? 10,
      fieldStyles: {
        ...defaultStyles.fieldStyles,
        ...(savedStyles.fieldStyles || {})
      }
    };
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
        taxRate,
        taxAmount,
        total,
        notes,
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
      setLimitNotice(true);
      return;
    }

    if (action === 'share') setIsSharing(true);
    else setIsDownloading(true);

    try {
      // IMPORTANT: Call generatePDF (which calls navigator.share) 
      // BEFORE any async calls to preserve the user activation gesture.
      await generatePDF(action);

      // Count the download or share in the background (free accounts only).
      quota?.consume().catch(err => console.error('Error updating usage:', err));
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

  const [isStylePanelCollapsed, setIsStylePanelCollapsed] = useState(false);

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className={cn("bg-white dark:bg-bg-card-dark border-b border-gray-200 dark:border-white/10 px-4", embedded ? "relative z-20" : "sticky top-0 z-30")}>
        <div className="max-w-7xl mx-auto py-3 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
          <div className="min-w-0 lg:flex-1">
            <ToolIdentity title={t.invoiceCreator} language={language} backLabel={t.back} onBack={onBack} />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar">
            <button
              onClick={() => {
                if (showList) {
                  setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
                  setInvoiceAlias(''); setOrderNumber(''); setDate(new Date().toISOString().split('T')[0]); setDueDate('');
                  setIssuer({ name: '', taxId: '', address: '' }); setReceiver({ name: '', taxId: '', address: '' });
                  setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]); setTaxRate(0); setNotes(''); setEditingId(null);
                }
                setShowList(!showList);
              }}
              className="shrink-0 flex items-center gap-2 text-gray-700 dark:text-gray-100 font-bold px-3.5 py-2 rounded-xl border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10"
            >
              <Layout size={17} />
              <span>{showList ? t.newInvoice : t.invoiceList}</span>
            </button>

            {!showList && (
              <>
                <span className="hidden sm:block h-7 w-px bg-gray-200 dark:bg-white/10 mx-1 shrink-0" />
                <button onClick={() => handleAction('share')} disabled={isSharing || isDownloading || isSaving} className="shrink-0 flex items-center gap-2 text-gray-700 dark:text-gray-100 font-bold px-3.5 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50">
                  {isSharing ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Share2 size={17} />}
                  <span>{t.share}</span>
                </button>
                <button onClick={() => handleAction('download')} disabled={isSharing || isDownloading || isSaving} className="shrink-0 flex items-center gap-2 text-gray-700 dark:text-gray-100 font-bold px-3.5 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-50">
                  {isDownloading ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Download size={17} />}
                  <span>{t.download}</span>
                </button>
                <button onClick={() => handleSaveInvoice()} disabled={isSaving} className="shrink-0 flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl font-black shadow-sm disabled:opacity-50">
                  {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={17} />}
                  <span>{language === 'en' ? 'Save' : language === 'es' ? 'Guardar' : 'Salvar'}</span>
                </button>
              </>
            )}
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
                <div className="bg-white dark:bg-white/5 rounded-2xl p-12 text-center border border-dashed border-gray-200 dark:border-white/15">
                  <FileText className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-200 font-medium">Nenhuma fatura encontrada.</p>
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
                    className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
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
                              setTaxRate(inv.taxRate || 0);
                              setNotes(inv.notes || '');
                              setStyles(getSafeStyles(inv.styles));
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
              {/* Unified invoice editing panel */}
              <div className="sticky top-[76px] z-20 bg-white rounded-2xl shadow-lg border border-gray-200 p-4 invoice-editor-light-panel">
                <div className={cn("flex items-center gap-3", !isStylePanelCollapsed && "pb-4 mb-4 border-b border-gray-200")}>
                  <div className="flex-1 min-w-0">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{t.internalName}</label>
                    <input
                      type="text"
                      placeholder={t.internalNamePlaceholder}
                      value={invoiceAlias}
                      onChange={(e) => setInvoiceAlias(e.target.value)}
                      className="w-full h-9 bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  {usageBadge('hidden md:inline-flex self-end')}
                  <button
                    type="button"
                    onClick={() => setIsStylePanelCollapsed(!isStylePanelCollapsed)}
                    className="h-9 w-9 shrink-0 self-end flex items-center justify-center rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-primary hover:text-white hover:border-primary"
                    title={isStylePanelCollapsed ? 'Mostrar estilos' : 'Minimizar estilos'}
                    aria-label={isStylePanelCollapsed ? 'Mostrar estilos' : 'Minimizar estilos'}
                  >
                    {isStylePanelCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                  </button>
                </div>

                {!isStylePanelCollapsed && (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-12 gap-3 items-end">
                  <div className="xl:col-span-2">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">Modelo</label>
                    <select value={styles.template} onChange={(e) => {
                      const template = TEMPLATES.find(item => item.id === e.target.value);
                      if (template) setStyles({ ...template.styles, logo: styles.logo });
                    }} className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-3 text-xs">
                      {TEMPLATES.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                  </div>

                  <div className="xl:col-span-2">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">{t.font}</label>
                    <select value={styles.font} onChange={(e) => setStyles({ ...styles, font: e.target.value })} className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-3 text-xs">
                      {FONTS.map(font => <option key={font.value} value={font.value}>{font.name}</option>)}
                    </select>
                  </div>

                  <div className="xl:col-span-2">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">{t.backgroundColor}</label>
                    <div className="h-10 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2">
                      <input type="color" value={styles.backgroundColor} onChange={(e) => setStyles({ ...styles, backgroundColor: e.target.value })} className="w-7 h-7 shrink-0 rounded-md cursor-pointer border-0 p-0 bg-transparent" title={t.backgroundColor} />
                      <span className="text-[10px] font-mono text-gray-600 uppercase truncate">{styles.backgroundColor}</span>
                    </div>
                  </div>

                  <div className="col-span-2 xl:col-span-3">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">Campo da fatura</label>
                    <select value={selectedField} onChange={(e) => setSelectedField(e.target.value as keyof InvoiceStyles['fieldStyles'])} className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-3 text-xs">
                      <optgroup label="Cabeçalho"><option value="title">Título da Fatura</option><option value="invoiceNumberLabel">Etiqueta Nº Fatura</option><option value="invoiceNumberValue">Valor Nº Fatura</option><option value="orderNumberLabel">Etiqueta Nº Pedido</option><option value="orderNumberValue">Valor Nº Pedido</option></optgroup>
                      <optgroup label="Datas"><option value="dateLabel">Etiqueta Data</option><option value="dateValue">Valor Data</option><option value="dueDateLabel">Etiqueta Vencimento</option><option value="dueDateValue">Valor Vencimento</option></optgroup>
                      <optgroup label="Emissor"><option value="issuerLabel">Etiqueta Emissor</option><option value="issuerName">Nome Emissor</option><option value="issuerTaxId">NIF Emissor</option><option value="issuerAddress">Morada Emissor</option></optgroup>
                      <optgroup label="Recetor"><option value="receiverLabel">Etiqueta Recetor</option><option value="receiverName">Nome Recetor</option><option value="receiverTaxId">NIF Recetor</option><option value="receiverAddress">Morada Recetor</option></optgroup>
                      <optgroup label="Tabela"><option value="tableHeader">Cabeçalho da Tabela</option><option value="tableBody">Corpo da Tabela</option></optgroup>
                      <optgroup label="Totais"><option value="subtotalLabel">Etiqueta Subtotal</option><option value="subtotalValue">Valor Subtotal</option><option value="taxLabel">Etiqueta Imposto</option><option value="taxValue">Valor Imposto</option><option value="totalLabel">Etiqueta Total</option><option value="totalValue">Valor Total</option></optgroup>
                      <optgroup label="Notas"><option value="notesLabel">Etiqueta Notas</option><option value="notesValue">Conteúdo Notas</option></optgroup>
                    </select>
                  </div>

                  <div className="xl:col-span-1">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">Estilo</label>
                    <div className="h-10 flex gap-1">
                      <button type="button" onClick={() => setStyles({ ...styles, fieldStyles: { ...styles.fieldStyles, [selectedField]: { ...styles.fieldStyles[selectedField], bold: !styles.fieldStyles[selectedField].bold } } })} className={cn("flex-1 rounded-lg font-bold border transition-colors", styles.fieldStyles[selectedField].bold ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-700 border-gray-200")}>B</button>
                      <button type="button" onClick={() => setStyles({ ...styles, fieldStyles: { ...styles.fieldStyles, [selectedField]: { ...styles.fieldStyles[selectedField], italic: !styles.fieldStyles[selectedField].italic } } })} className={cn("flex-1 rounded-lg italic border transition-colors", styles.fieldStyles[selectedField].italic ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-700 border-gray-200")}>I</button>
                    </div>
                  </div>

                  <div className="xl:col-span-1">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">Cor texto</label>
                    <div className="h-10 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
                      <input type="color" value={styles.fieldStyles[selectedField].color} onChange={(e) => setStyles({ ...styles, fieldStyles: { ...styles.fieldStyles, [selectedField]: { ...styles.fieldStyles[selectedField], color: e.target.value } } })} className="w-7 h-7 rounded-md cursor-pointer border-0 p-0 bg-transparent" />
                    </div>
                  </div>

                  <div className="xl:col-span-1">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">Tamanho</label>
                    <input type="number" min="6" max="72" value={styles.fieldStyles[selectedField].fontSize} onChange={(e) => setStyles({ ...styles, fieldStyles: { ...styles.fieldStyles, [selectedField]: { ...styles.fieldStyles[selectedField], fontSize: parseInt(e.target.value) || 8 } } })} className="w-full h-10 bg-gray-50 border border-gray-200 rounded-lg px-2 text-xs" />
                  </div>

                  <div className="col-span-2 md:col-span-4 xl:col-span-6">
                    <label className="block text-[10px] leading-4 font-bold text-gray-500 uppercase tracking-wider mb-1">Logo</label>
                    <div className="h-10 flex gap-2">
                      <label className="h-10 flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 rounded-lg text-xs font-bold border border-gray-200">
                        <Image size={15} />{styles.logo ? 'Trocar logo' : 'Adicionar logo'}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const reader = new FileReader();
                          reader.onloadend = () => setStyles(prev => ({ ...prev, logo: reader.result as string }));
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                      {styles.logo && <button type="button" onClick={() => setStyles({ ...styles, logo: undefined })} className="h-10 flex items-center gap-2 px-3 text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg text-xs font-bold"><Trash2 size={15} />Remover logo</button>}
                    </div>
                  </div>

                  <div className="col-span-2 md:hidden">
                    {usageBadge('w-full justify-center')}
                  </div>
                </div>
                )}
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
                <div className="lg:col-span-3 space-y-6">
                  <div 
                    className="rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                    style={{ backgroundColor: styles.backgroundColor }}
                  >
                    <div className="relative min-h-[800px] bg-white" id="invoice-sheet">
                      {/* Logo */}
                      {styles.logo && (
                        <motion.div
                          drag
                          dragMomentum={false}
                          dragElastic={0}
                          dragConstraints={{ left: 0, top: 0, right: 800, bottom: 1100 }} // Approximate A4 bounds in px
                          onDragEnd={(_, info) => {
                            // Update position only at the end to avoid "double-move" jump
                            setStyles(prev => ({ 
                              ...prev, 
                              logoX: prev.logoX + info.offset.x, 
                              logoY: prev.logoY + info.offset.y 
                            }));
                          }}
                          // Reset the transform after drag ends so left/top take over
                          animate={{ x: 0, y: 0 }}
                          transition={{ duration: 0 }}
                          className="absolute group border-2 border-transparent hover:border-blue-500 rounded-lg transition-colors"
                          style={{ 
                            left: `${styles.logoX}px`, 
                            top: `${styles.logoY}px`,
                            width: `${styles.logoWidth}px`,
                            height: `${styles.logoHeight}px`,
                            rotate: `${styles.logoRotation ?? 0}deg`,
                            zIndex: styles.logoZIndex ?? 10,
                            cursor: 'move'
                          }}
                        >
                          <img 
                            src={styles.logo} 
                            alt="Logo" 
                            className="w-full h-full object-contain pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                          {/* Resize Handle */}
                          <motion.div
                            drag
                            dragMomentum={false}
                            dragElastic={0}
                            onDrag={(_, info) => {
                              // Update dimensions based on drag
                              setStyles(prev => ({ 
                                ...prev, 
                                logoWidth: Math.max(20, prev.logoWidth + info.delta.x), 
                                logoHeight: Math.max(20, prev.logoHeight + info.delta.y) 
                              }));
                            }}
                            // Reset transform for resize handle too
                            animate={{ x: 0, y: 0 }}
                            transition={{ duration: 0 }}
                            className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-nwse-resize shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"
                          />
                          {/* Rotation Handle */}
                          <motion.div
                            drag
                            dragMomentum={false}
                            dragElastic={0}
                            onDrag={(_, info) => {
                              // Simple rotation based on horizontal drag
                              setStyles(prev => ({ 
                                ...prev, 
                                logoRotation: (prev.logoRotation ?? 0) + info.delta.x 
                              }));
                            }}
                            // Reset transform for rotation handle
                            animate={{ x: 0, y: 0 }}
                            transition={{ duration: 0 }}
                            className="absolute -top-6 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full cursor-alias shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center"
                          >
                            <RotateCcw size={10} className="text-white" />
                          </motion.div>
                        </motion.div>
                      )}

                      <div className="p-8 space-y-8">
                        {/* Invoice Header */}
                        <div className="flex flex-col md:flex-row justify-between gap-8">
                        <div className="space-y-4 flex-1">
                          <input 
                            value={labels.invoice}
                            onChange={(e) => setLabels({ ...labels, invoice: e.target.value })}
                            className={cn(
                              "text-3xl uppercase tracking-wider bg-transparent border-none focus:ring-0 w-full p-0",
                              styles.fieldStyles.title.bold && "font-bold",
                              styles.fieldStyles.title.italic && "italic"
                            )}
                            style={{ 
                              color: styles.fieldStyles.title.color,
                              fontSize: `${styles.fieldStyles.title.fontSize * 2}px` // Scale for UI
                            }}
                          />
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center gap-2">
                              <input 
                                value={labels.invoiceNumber}
                                onChange={(e) => setLabels({ ...labels, invoiceNumber: e.target.value })}
                                className={cn(
                                  "w-24 bg-transparent border-none focus:ring-0 p-0",
                                  styles.fieldStyles.invoiceNumberLabel.bold && "font-bold",
                                  styles.fieldStyles.invoiceNumberLabel.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.invoiceNumberLabel.color,
                                  fontSize: `${styles.fieldStyles.invoiceNumberLabel.fontSize}px`
                                }}
                              />
                              <input 
                                type="text" 
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className={cn(
                                  "flex-1 bg-black/5 border-none rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500",
                                  styles.fieldStyles.invoiceNumberValue.bold && "font-bold",
                                  styles.fieldStyles.invoiceNumberValue.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.invoiceNumberValue.color,
                                  fontSize: `${styles.fieldStyles.invoiceNumberValue.fontSize}px`
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                value={labels.orderNumber}
                                onChange={(e) => setLabels({ ...labels, orderNumber: e.target.value })}
                                className={cn(
                                  "w-24 bg-transparent border-none focus:ring-0 p-0",
                                  styles.fieldStyles.orderNumberLabel.bold && "font-bold",
                                  styles.fieldStyles.orderNumberLabel.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.orderNumberLabel.color,
                                  fontSize: `${styles.fieldStyles.orderNumberLabel.fontSize}px`
                                }}
                              />
                              <input 
                                type="text" 
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value)}
                                className={cn(
                                  "flex-1 bg-black/5 border-none rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500",
                                  styles.fieldStyles.orderNumberValue.bold && "font-bold",
                                  styles.fieldStyles.orderNumberValue.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.orderNumberValue.color,
                                  fontSize: `${styles.fieldStyles.orderNumberValue.fontSize}px`
                                }}
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
                                className={cn(
                                  "w-24 bg-transparent border-none focus:ring-0 p-0",
                                  styles.fieldStyles.dateLabel.bold && "font-bold",
                                  styles.fieldStyles.dateLabel.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.dateLabel.color,
                                  fontSize: `${styles.fieldStyles.dateLabel.fontSize}px`
                                }}
                              />
                              <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className={cn(
                                  "flex-1 bg-black/5 border-none rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500",
                                  styles.fieldStyles.dateValue.bold && "font-bold",
                                  styles.fieldStyles.dateValue.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.dateValue.color,
                                  fontSize: `${styles.fieldStyles.dateValue.fontSize}px`
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                value={labels.dueDate}
                                onChange={(e) => setLabels({ ...labels, dueDate: e.target.value })}
                                className={cn(
                                  "w-24 bg-transparent border-none focus:ring-0 p-0",
                                  styles.fieldStyles.dueDateLabel.bold && "font-bold",
                                  styles.fieldStyles.dueDateLabel.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.dueDateLabel.color,
                                  fontSize: `${styles.fieldStyles.dueDateLabel.fontSize}px`
                                }}
                              />
                              <input 
                                type="date" 
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className={cn(
                                  "flex-1 bg-black/5 border-none rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500",
                                  styles.fieldStyles.dueDateValue.bold && "font-bold",
                                  styles.fieldStyles.dueDateValue.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.dueDateValue.color,
                                  fontSize: `${styles.fieldStyles.dueDateValue.fontSize}px`
                                }}
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
                            className={cn(
                              "uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0 w-full",
                              styles.fieldStyles.issuerLabel.bold && "font-bold",
                              styles.fieldStyles.issuerLabel.italic && "italic"
                            )}
                            style={{ 
                              color: styles.fieldStyles.issuerLabel.color,
                              fontSize: `${styles.fieldStyles.issuerLabel.fontSize}px`
                            }}
                          />
                          <div className="space-y-2">
                            <input 
                              placeholder="Nome / Empresa"
                              value={issuer.name}
                              onChange={(e) => setIssuer({ ...issuer, name: e.target.value })}
                              className={cn(
                                "w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 outline-none",
                                styles.fieldStyles.issuerName.bold && "font-bold",
                                styles.fieldStyles.issuerName.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.issuerName.color,
                                fontSize: `${styles.fieldStyles.issuerName.fontSize}px`
                              }}
                            />
                            <input 
                              placeholder="NIF / Tax ID"
                              value={issuer.taxId}
                              onChange={(e) => setIssuer({ ...issuer, taxId: e.target.value })}
                              className={cn(
                                "w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 outline-none",
                                styles.fieldStyles.issuerTaxId.bold && "font-bold",
                                styles.fieldStyles.issuerTaxId.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.issuerTaxId.color,
                                fontSize: `${styles.fieldStyles.issuerTaxId.fontSize}px`
                              }}
                            />
                            <textarea 
                              placeholder="Morada"
                              value={issuer.address}
                              onChange={(e) => setIssuer({ ...issuer, address: e.target.value })}
                              className={cn(
                                "w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 outline-none resize-none",
                                styles.fieldStyles.issuerAddress.bold && "font-bold",
                                styles.fieldStyles.issuerAddress.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.issuerAddress.color,
                                fontSize: `${styles.fieldStyles.issuerAddress.fontSize}px`
                              }}
                              rows={2}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <input 
                            value={labels.receiver}
                            onChange={(e) => setLabels({ ...labels, receiver: e.target.value })}
                            className={cn(
                              "uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0 w-full",
                              styles.fieldStyles.receiverLabel.bold && "font-bold",
                              styles.fieldStyles.receiverLabel.italic && "italic"
                            )}
                            style={{ 
                              color: styles.fieldStyles.receiverLabel.color,
                              fontSize: `${styles.fieldStyles.receiverLabel.fontSize}px`
                            }}
                          />
                          <div className="space-y-2">
                            <input 
                              placeholder="Nome do Cliente"
                              value={receiver.name}
                              onChange={(e) => setReceiver({ ...receiver, name: e.target.value })}
                              className={cn(
                                "w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 outline-none",
                                styles.fieldStyles.receiverName.bold && "font-bold",
                                styles.fieldStyles.receiverName.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.receiverName.color,
                                fontSize: `${styles.fieldStyles.receiverName.fontSize}px`
                              }}
                            />
                            <input 
                              placeholder="NIF / Tax ID"
                              value={receiver.taxId}
                              onChange={(e) => setReceiver({ ...receiver, taxId: e.target.value })}
                              className={cn(
                                "w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 outline-none",
                                styles.fieldStyles.receiverTaxId.bold && "font-bold",
                                styles.fieldStyles.receiverTaxId.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.receiverTaxId.color,
                                fontSize: `${styles.fieldStyles.receiverTaxId.fontSize}px`
                              }}
                            />
                            <textarea 
                              placeholder="Morada do Cliente"
                              value={receiver.address}
                              onChange={(e) => setReceiver({ ...receiver, address: e.target.value })}
                              className={cn(
                                "w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 outline-none resize-none",
                                styles.fieldStyles.receiverAddress.bold && "font-bold",
                                styles.fieldStyles.receiverAddress.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.receiverAddress.color,
                                fontSize: `${styles.fieldStyles.receiverAddress.fontSize}px`
                              }}
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="space-y-4">
                        <div 
                          className="grid grid-cols-12 gap-4 px-4 py-2 rounded-lg uppercase tracking-wider"
                          style={{ backgroundColor: styles.fieldStyles.tableHeader.color + '10' }} // Light version of header color
                        >
                          <div className="col-span-6">
                            <input 
                              value={labels.description}
                              onChange={(e) => setLabels({ ...labels, description: e.target.value })}
                              className={cn(
                                "bg-transparent border-none focus:ring-0 p-0 w-full uppercase",
                                styles.fieldStyles.tableHeader.bold && "font-bold",
                                styles.fieldStyles.tableHeader.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.tableHeader.color,
                                fontSize: `${styles.fieldStyles.tableHeader.fontSize}px`
                              }}
                            />
                          </div>
                          <div className="col-span-2 text-center">
                            <input 
                              value={labels.quantity}
                              onChange={(e) => setLabels({ ...labels, quantity: e.target.value })}
                              className={cn(
                                "bg-transparent border-none focus:ring-0 p-0 w-full uppercase text-center",
                                styles.fieldStyles.tableHeader.bold && "font-bold",
                                styles.fieldStyles.tableHeader.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.tableHeader.color,
                                fontSize: `${styles.fieldStyles.tableHeader.fontSize}px`
                              }}
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <input 
                              value={labels.unitPrice}
                              onChange={(e) => setLabels({ ...labels, unitPrice: e.target.value })}
                              className={cn(
                                "bg-transparent border-none focus:ring-0 p-0 w-full uppercase text-right",
                                styles.fieldStyles.tableHeader.bold && "font-bold",
                                styles.fieldStyles.tableHeader.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.tableHeader.color,
                                fontSize: `${styles.fieldStyles.tableHeader.fontSize}px`
                              }}
                            />
                          </div>
                          <div className="col-span-2 text-right">
                            <input 
                              value={labels.total}
                              onChange={(e) => setLabels({ ...labels, total: e.target.value })}
                              className={cn(
                                "bg-transparent border-none focus:ring-0 p-0 w-full uppercase text-right",
                                styles.fieldStyles.tableHeader.bold && "font-bold",
                                styles.fieldStyles.tableHeader.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.tableHeader.color,
                                fontSize: `${styles.fieldStyles.tableHeader.fontSize}px`
                              }}
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
                                  className={cn(
                                    "w-full bg-transparent border-b border-transparent focus:border-blue-500 py-1 outline-none",
                                    styles.fieldStyles.tableBody.bold && "font-bold",
                                    styles.fieldStyles.tableBody.italic && "italic"
                                  )}
                                  style={{ 
                                    color: styles.fieldStyles.tableBody.color,
                                    fontSize: `${styles.fieldStyles.tableBody.fontSize}px`
                                  }}
                                  placeholder="Descrição do serviço..."
                                />
                              </div>
                              <div className="col-span-2">
                                <input 
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                  className={cn(
                                    "w-full bg-transparent border-b border-transparent focus:border-blue-500 py-1 text-center outline-none",
                                    styles.fieldStyles.tableBody.bold && "font-bold",
                                    styles.fieldStyles.tableBody.italic && "italic"
                                  )}
                                  style={{ 
                                    color: styles.fieldStyles.tableBody.color,
                                    fontSize: `${styles.fieldStyles.tableBody.fontSize}px`
                                  }}
                                />
                              </div>
                              <div className="col-span-2">
                                <input 
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  className={cn(
                                    "w-full bg-transparent border-b border-transparent focus:border-blue-500 py-1 text-right outline-none",
                                    styles.fieldStyles.tableBody.bold && "font-bold",
                                    styles.fieldStyles.tableBody.italic && "italic"
                                  )}
                                  style={{ 
                                    color: styles.fieldStyles.tableBody.color,
                                    fontSize: `${styles.fieldStyles.tableBody.fontSize}px`
                                  }}
                                />
                              </div>
                              <div 
                                className={cn(
                                  "col-span-2 text-right",
                                  styles.fieldStyles.tableBody.bold && "font-bold",
                                  styles.fieldStyles.tableBody.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.tableBody.color,
                                  fontSize: `${styles.fieldStyles.tableBody.fontSize}px`
                                }}
                              >
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
                          <div className="flex justify-between">
                            <input 
                              value={labels.subtotal}
                              onChange={(e) => setLabels({ ...labels, subtotal: e.target.value })}
                              className={cn(
                                "bg-transparent border-none focus:ring-0 p-0",
                                styles.fieldStyles.subtotalLabel.bold && "font-bold",
                                styles.fieldStyles.subtotalLabel.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.subtotalLabel.color,
                                fontSize: `${styles.fieldStyles.subtotalLabel.fontSize}px`
                              }}
                            />
                            <span 
                              className={cn(
                                styles.fieldStyles.subtotalValue.bold && "font-bold",
                                styles.fieldStyles.subtotalValue.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.subtotalValue.color,
                                fontSize: `${styles.fieldStyles.subtotalValue.fontSize}px`
                              }}
                            >
                              {subtotal.toFixed(2)} €
                            </span>
                          </div>

                          <div className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-2 flex-1">
                              <input 
                                value={labels.tax || 'Imposto'}
                                onChange={(e) => setLabels({ ...labels, tax: e.target.value })}
                                className={cn(
                                  "bg-transparent border-none focus:ring-0 p-0 w-24",
                                  styles.fieldStyles.taxLabel.bold && "font-bold",
                                  styles.fieldStyles.taxLabel.italic && "italic"
                                )}
                                style={{ 
                                  color: styles.fieldStyles.taxLabel.color,
                                  fontSize: `${styles.fieldStyles.taxLabel.fontSize}px`
                                }}
                              />
                              <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                                <input 
                                  type="number"
                                  value={taxRate}
                                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                  className="w-10 bg-transparent border-none focus:ring-0 p-0 text-xs text-center"
                                />
                                <span className="text-[10px] text-gray-400 font-bold">%</span>
                              </div>
                            </div>
                            <span 
                              className={cn(
                                styles.fieldStyles.taxValue.bold && "font-bold",
                                styles.fieldStyles.taxValue.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.taxValue.color,
                                fontSize: `${styles.fieldStyles.taxValue.fontSize}px`
                              }}
                            >
                              {taxAmount.toFixed(2)} €
                            </span>
                          </div>

                          <div 
                            className="flex justify-between pt-3 border-t border-gray-100"
                            style={{ borderTopColor: styles.fieldStyles.totalLabel.color + '20' }}
                          >
                            <input 
                              value={labels.total}
                              onChange={(e) => setLabels({ ...labels, total: e.target.value })}
                              className={cn(
                                "bg-transparent border-none focus:ring-0 p-0",
                                styles.fieldStyles.totalLabel.bold && "font-bold",
                                styles.fieldStyles.totalLabel.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.totalLabel.color,
                                fontSize: `${styles.fieldStyles.totalLabel.fontSize}px`
                              }}
                            />
                            <span 
                              className={cn(
                                styles.fieldStyles.totalValue.bold && "font-bold",
                                styles.fieldStyles.totalValue.italic && "italic"
                              )}
                              style={{ 
                                color: styles.fieldStyles.totalValue.color,
                                fontSize: `${styles.fieldStyles.totalValue.fontSize}px`
                              }}
                            >
                              {total.toFixed(2)} €
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-12 space-y-4">
                        <input 
                          value={labels.notes}
                          onChange={(e) => setLabels({ ...labels, notes: e.target.value })}
                          className={cn(
                            "uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0 w-full",
                            styles.fieldStyles.notesLabel.bold && "font-bold",
                            styles.fieldStyles.notesLabel.italic && "italic"
                          )}
                          style={{ 
                            color: styles.fieldStyles.notesLabel.color,
                            fontSize: `${styles.fieldStyles.notesLabel.fontSize}px`
                          }}
                        />
                        <textarea 
                          placeholder="Notas adicionais..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className={cn(
                            "w-full bg-transparent border-b border-gray-100 focus:border-blue-500 py-1 outline-none resize-none",
                            styles.fieldStyles.notesValue.bold && "font-bold",
                            styles.fieldStyles.notesValue.italic && "italic"
                          )}
                          style={{ 
                            color: styles.fieldStyles.notesValue.color,
                            fontSize: `${styles.fieldStyles.notesValue.fontSize}px`
                          }}
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Legacy sidebar controls kept in code for compatibility; editing now lives in the compact toolbar above. */}
                <div className="hidden">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-8">
                    {/* Templates */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-gray-900 font-bold">
                        <Layout size={20} className="text-blue-600" />
                        <h3>{t.templates}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {TEMPLATES.map(template => (
                          <button
                            key={template.id}
                            onClick={() => setStyles(template.styles)}
                            className={cn(
                              "p-3 rounded-xl border-2 transition-all text-[10px] font-bold uppercase tracking-wider text-center",
                              styles.template === template.id 
                                ? "border-blue-500 bg-blue-50 text-blue-700" 
                                : "border-gray-100 hover:border-gray-200 text-gray-400"
                            )}
                          >
                            {template.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Styles */}
                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <div className="flex items-center gap-2 text-gray-900 font-bold">
                        <Palette size={20} className="text-blue-600" />
                        <h3>{t.customStyles}</h3>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Page Background */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.backgroundColor}</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="color" 
                              value={styles.backgroundColor}
                              onChange={(e) => setStyles({ ...styles, backgroundColor: e.target.value })}
                              className="w-12 h-10 rounded-xl cursor-pointer border-none p-0 bg-transparent"
                            />
                            <span className="text-xs font-mono text-gray-500 uppercase">{styles.backgroundColor}</span>
                          </div>
                        </div>

                        {/* Font */}
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

                        {/* Logo Controls */}
                        <div className="pt-6 border-t border-gray-100 space-y-4">
                          <div className="flex items-center gap-2 text-gray-900 font-bold">
                            <Image size={20} className="text-blue-600" />
                            <h3>Logo</h3>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <label className="flex-1 cursor-pointer bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold transition-colors text-center">
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setStyles({ ...styles, logo: reader.result as string });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                                {styles.logo ? 'Trocar Logo' : 'Adicionar Logo'}
                              </label>
                              {styles.logo && (
                                <button 
                                  onClick={() => setStyles({ ...styles, logo: undefined })}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                >
                                  <Trash2 size={20} />
                                </button>
                              )}
                            </div>

                            {styles.logo && (
                              <div className="space-y-4 p-4 bg-gray-50 rounded-2xl">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Posição X</label>
                                    <input 
                                      type="number" 
                                      value={styles.logoX}
                                      onChange={(e) => setStyles({ ...styles, logoX: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-white border border-gray-100 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Posição Y</label>
                                    <input 
                                      type="number" 
                                      value={styles.logoY}
                                      onChange={(e) => setStyles({ ...styles, logoY: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-white border border-gray-100 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Largura</label>
                                    <input 
                                      type="number" 
                                      value={styles.logoWidth}
                                      onChange={(e) => setStyles({ ...styles, logoWidth: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-white border border-gray-100 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Altura</label>
                                    <input 
                                      type="number" 
                                      value={styles.logoHeight}
                                      onChange={(e) => setStyles({ ...styles, logoHeight: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-white border border-gray-100 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Rotação (°)</label>
                                    <input 
                                      type="number" 
                                      value={styles.logoRotation ?? 0}
                                      onChange={(e) => setStyles({ ...styles, logoRotation: parseInt(e.target.value) || 0 })}
                                      className="w-full bg-white border border-gray-100 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Camada (Z)</label>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => setStyles({ ...styles, logoZIndex: Math.max(0, (styles.logoZIndex ?? 10) - 1) })}
                                        className="p-1 bg-white border border-gray-100 rounded hover:bg-gray-50 transition-colors"
                                      >
                                        <ArrowDown size={14} />
                                      </button>
                                      <span className="text-xs font-mono w-4 text-center">{styles.logoZIndex ?? 10}</span>
                                      <button 
                                        onClick={() => setStyles({ ...styles, logoZIndex: (styles.logoZIndex ?? 10) + 1 })}
                                        className="p-1 bg-white border border-gray-100 rounded hover:bg-gray-50 transition-colors"
                                      >
                                        <ArrowUp size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-[10px] text-gray-400 italic">Dica: Você também pode arrastar, redimensionar e girar a logo diretamente na folha.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Text Styles Sections */}
                        <div className="pt-6 border-t border-gray-100 space-y-4">
                          <div className="flex items-center gap-2 text-gray-900 font-bold">
                            <Type size={20} className="text-blue-600" />
                            <h3>Estilo dos Campos</h3>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Selecionar Campo</label>
                              <select 
                                value={selectedField}
                                onChange={(e) => setSelectedField(e.target.value as any)}
                                className="w-full bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                              >
                                <optgroup label="Cabeçalho">
                                  <option value="title">Título da Fatura</option>
                                  <option value="invoiceNumberLabel">Etiqueta Nº Fatura</option>
                                  <option value="invoiceNumberValue">Valor Nº Fatura</option>
                                  <option value="orderNumberLabel">Etiqueta Nº Pedido</option>
                                  <option value="orderNumberValue">Valor Nº Pedido</option>
                                </optgroup>
                                <optgroup label="Datas">
                                  <option value="dateLabel">Etiqueta Data</option>
                                  <option value="dateValue">Valor Data</option>
                                  <option value="dueDateLabel">Etiqueta Vencimento</option>
                                  <option value="dueDateValue">Valor Vencimento</option>
                                </optgroup>
                                <optgroup label="Emissor">
                                  <option value="issuerLabel">Etiqueta Emissor</option>
                                  <option value="issuerName">Nome Emissor</option>
                                  <option value="issuerTaxId">NIF Emissor</option>
                                  <option value="issuerAddress">Morada Emissor</option>
                                </optgroup>
                                <optgroup label="Recetor">
                                  <option value="receiverLabel">Etiqueta Recetor</option>
                                  <option value="receiverName">Nome Recetor</option>
                                  <option value="receiverTaxId">NIF Recetor</option>
                                  <option value="receiverAddress">Morada Recetor</option>
                                </optgroup>
                                <optgroup label="Tabela">
                                  <option value="tableHeader">Cabeçalho da Tabela</option>
                                  <option value="tableBody">Corpo da Tabela</option>
                                </optgroup>
                                <optgroup label="Totais">
                                  <option value="subtotalLabel">Etiqueta Subtotal</option>
                                  <option value="subtotalValue">Valor Subtotal</option>
                                  <option value="taxLabel">Etiqueta Imposto</option>
                                  <option value="taxValue">Valor Imposto</option>
                                  <option value="totalLabel">Etiqueta Total</option>
                                  <option value="totalValue">Valor Total</option>
                                </optgroup>
                                <optgroup label="Notas">
                                  <option value="notesLabel">Etiqueta Notas</option>
                                  <option value="notesValue">Conteúdo Notas</option>
                                </optgroup>
                              </select>
                            </div>

                            <div className="space-y-4 p-4 bg-gray-50 rounded-2xl">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Estilo de {selectedField}</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setStyles({ 
                                      ...styles, 
                                      fieldStyles: {
                                        ...styles.fieldStyles,
                                        [selectedField]: { ...styles.fieldStyles[selectedField], bold: !styles.fieldStyles[selectedField].bold }
                                      }
                                    })}
                                    className={cn(
                                      "w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-xs",
                                      styles.fieldStyles[selectedField].bold ? "bg-blue-600 text-white" : "bg-white text-gray-400 hover:text-gray-600 border border-gray-100"
                                    )}
                                  >
                                    <span className="font-bold">B</span>
                                  </button>
                                  <button
                                    onClick={() => setStyles({ 
                                      ...styles, 
                                      fieldStyles: {
                                        ...styles.fieldStyles,
                                        [selectedField]: { ...styles.fieldStyles[selectedField], italic: !styles.fieldStyles[selectedField].italic }
                                      }
                                    })}
                                    className={cn(
                                      "w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-xs",
                                      styles.fieldStyles[selectedField].italic ? "bg-blue-600 text-white" : "bg-white text-gray-400 hover:text-gray-600 border border-gray-100"
                                    )}
                                  >
                                    <span className="italic">I</span>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">Cor</label>
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="color" 
                                      value={styles.fieldStyles[selectedField].color}
                                      onChange={(e) => setStyles({ 
                                        ...styles, 
                                        fieldStyles: {
                                          ...styles.fieldStyles,
                                          [selectedField]: { ...styles.fieldStyles[selectedField], color: e.target.value }
                                        }
                                      })}
                                      className="w-8 h-8 rounded-lg cursor-pointer border-none p-0 bg-transparent shrink-0"
                                    />
                                    <span className="text-[10px] font-mono text-gray-400 uppercase">{styles.fieldStyles[selectedField].color}</span>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-gray-400 uppercase">Tamanho</label>
                                  <input 
                                    type="number"
                                    value={styles.fieldStyles[selectedField].fontSize}
                                    onChange={(e) => setStyles({ 
                                      ...styles, 
                                      fieldStyles: {
                                        ...styles.fieldStyles,
                                        [selectedField]: { ...styles.fieldStyles[selectedField], fontSize: parseInt(e.target.value) || 8 }
                                      }
                                    })}
                                    className="w-full bg-white border border-gray-100 rounded-lg px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 space-y-4">
                      <div className="flex items-center gap-2 text-gray-900 font-bold">
                        <Settings size={20} className="text-blue-600" />
                        <h3>{t.adminSettings}</h3>
                      </div>
                      
                      {usageBadge('w-full')}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <QuotaNotice
        open={limitNotice}
        language={language}
        onClose={() => setLimitNotice(false)}
        title={language === 'en' ? 'Daily limit reached' : language === 'es' ? 'Límite diario alcanzado' : 'Limite diário atingido'}
        message={language === 'en' ? 'The free plan includes 1 downloaded or shared invoice per day. You can keep editing and saving; downloads open again tomorrow, or right away with Premium.' : language === 'es' ? 'El plan gratis incluye 1 factura descargada o compartida por día. Puedes seguir editando y guardando; las descargas vuelven mañana, o al instante con Premium.' : 'O plano grátis inclui 1 fatura baixada ou compartilhada por dia. Você pode continuar editando e salvando; os downloads voltam amanhã, ou na hora com o Premium.'}
      />
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

import { useState, useEffect } from 'react';
import { db, doc, getDoc } from '../firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, Download, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface PublicInvoiceViewProps {
  invoiceId: string;
}

export function PublicInvoiceView({ invoiceId }: PublicInvoiceViewProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const docRef = doc(db, 'shared_invoices', invoiceId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setInvoice(docSnap.data());
        } else {
          setError('Fatura não encontrada ou link expirado.');
        }
      } catch (err) {
        console.error('Error fetching shared invoice:', err);
        setError('Erro ao carregar a fatura. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  const downloadPDF = () => {
    if (!invoice) return;

    const doc = new jsPDF();
    const { styles, labels, issuer, receiver, invoiceNumber, date, dueDate, orderNumber, items, total } = invoice;

    // Set font
    doc.setFont(styles.font || 'helvetica');
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(styles.primaryColor || '#000000');
    doc.text((labels.invoice || 'FATURA').toUpperCase(), 105, 20, { align: 'center' });
    
    doc.setFontSize(styles.fontSize || 10);
    doc.setTextColor(0, 0, 0);
    
    // Issuer & Receiver
    doc.text(`${labels.issuer || 'Emissor'}:`, 20, 40);
    doc.text(issuer.name, 20, 45);
    doc.text(issuer.taxId, 20, 50);
    doc.text(issuer.address, 20, 55);
    
    doc.text(`${labels.receiver || 'Recetor'}:`, 120, 40);
    doc.text(receiver.name, 120, 45);
    doc.text(receiver.taxId, 120, 50);
    doc.text(receiver.address, 120, 55);
    
    // Details
    doc.text(`${labels.invoiceNumber || 'Fatura Nº'}: ${invoiceNumber}`, 20, 75);
    doc.text(`${labels.date || 'Data'}: ${date}`, 20, 80);
    if (dueDate) doc.text(`${labels.dueDate || 'Vencimento'}: ${dueDate}`, 20, 85);
    if (orderNumber) doc.text(`${labels.orderNumber || 'Nº Encomenda'}: ${orderNumber}`, 20, 90);
    
    // Table
    const tableData = items.map((item: any) => [
      item.description,
      item.quantity.toString(),
      `${item.unitPrice.toFixed(2)} €`,
      `${(item.quantity * item.unitPrice).toFixed(2)} €`
    ]);
    
    autoTable(doc, {
      startY: 100,
      head: [[labels.description || 'Descrição', labels.quantity || 'Qtd', labels.unitPrice || 'Preço', labels.total || 'Total']],
      body: tableData,
      headStyles: { fillColor: styles.primaryColor || '#000000' },
      theme: 'grid'
    });
    
    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`${labels.total || 'Total'}: ${total.toFixed(2)} €`, 190, finalY, { align: 'right' });
    
    const safeInvoiceNumber = invoiceNumber.replace(/[/\\?%*:|"<>]/g, '-');
    doc.save(`${safeInvoiceNumber}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-stone-400 animate-spin mb-4" />
        <p className="text-stone-500 font-medium">A carregar fatura...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-xl font-bold text-stone-900 mb-2">Ops! Algo correu mal</h1>
        <p className="text-stone-500 max-w-xs mb-6">{error || 'Não foi possível encontrar esta fatura.'}</p>
        <a href="/" className="text-primary font-bold hover:underline">Voltar ao Início</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 py-8 px-4 sm:py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900 leading-tight">Visualização de Fatura</h1>
              <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Documento Partilhado</p>
            </div>
          </div>
          <button
            onClick={downloadPDF}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Descarregar PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>

        {/* Invoice Preview Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden"
        >
          <div className="p-6 sm:p-10">
            {/* Invoice Content Preview */}
            <div className="flex flex-col sm:flex-row justify-between gap-8 mb-12">
              <div>
                <h2 className="text-3xl font-black text-stone-900 uppercase tracking-tighter mb-4" style={{ color: invoice.styles.primaryColor }}>
                  {invoice.labels.invoice}
                </h2>
                <div className="space-y-1 text-sm">
                  <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">{invoice.labels.invoiceNumber}</p>
                  <p className="font-mono font-bold text-stone-900">{invoice.invoiceNumber}</p>
                </div>
              </div>
              <div className="text-right space-y-4">
                <div className="space-y-1 text-sm">
                  <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">{invoice.labels.date}</p>
                  <p className="font-bold text-stone-900">{invoice.date}</p>
                </div>
                {invoice.dueDate && (
                  <div className="space-y-1 text-sm">
                    <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">{invoice.labels.dueDate}</p>
                    <p className="font-bold text-stone-900">{invoice.dueDate}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 mb-12">
              <div className="space-y-3">
                <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest border-b border-stone-100 pb-2">{invoice.labels.issuer}</p>
                <div className="space-y-1">
                  <p className="font-bold text-stone-900">{invoice.issuer.name}</p>
                  <p className="text-sm text-stone-500">{invoice.issuer.taxId}</p>
                  <p className="text-sm text-stone-500 leading-relaxed">{invoice.issuer.address}</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest border-b border-stone-100 pb-2">{invoice.labels.receiver}</p>
                <div className="space-y-1">
                  <p className="font-bold text-stone-900">{invoice.receiver.name}</p>
                  <p className="text-sm text-stone-500">{invoice.receiver.taxId}</p>
                  <p className="text-sm text-stone-500 leading-relaxed">{invoice.receiver.address}</p>
                </div>
              </div>
            </div>

            {/* Items Table Preview */}
            <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0 mb-12">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-stone-100">
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">{invoice.labels.description}</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-center">{invoice.labels.quantity}</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">{invoice.labels.unitPrice}</th>
                    <th className="py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">{invoice.labels.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {invoice.items.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="py-4 font-bold text-stone-900">{item.description}</td>
                      <td className="py-4 text-center font-mono text-stone-600">{item.quantity}</td>
                      <td className="py-4 text-right font-mono text-stone-600">{item.unitPrice.toFixed(2)} €</td>
                      <td className="py-4 text-right font-bold text-stone-900">{(item.quantity * item.unitPrice).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-full sm:w-64 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">Subtotal</span>
                  <span className="font-mono text-stone-600">{invoice.subtotal.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-stone-100">
                  <span className="text-stone-900 font-black uppercase tracking-widest text-xs">{invoice.labels.total}</span>
                  <span className="text-2xl font-black text-stone-900" style={{ color: invoice.styles.primaryColor }}>
                    {invoice.total.toFixed(2)} €
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="bg-stone-50 border-t border-stone-100 p-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 flex items-center justify-center gap-2">
              <Clock size={12} />
              Gerado via Shift Hours Professional
            </p>
          </div>
        </motion.div>

        <p className="mt-8 text-center text-xs text-stone-400">
          Este link de visualização é seguro e privado. Apenas quem possui o link pode visualizar este documento.
        </p>
      </div>
    </div>
  );
}

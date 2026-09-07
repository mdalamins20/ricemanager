import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface DailyLog {
  date: string;
  lunch: boolean;
  dinner: boolean;
  guestLunch: number;
  guestDinner: number;
}

export interface MemberReport {
  memberId: string;
  memberName: string;
  phone: string;
  prevBalance: number;
  advanceDeposit: number;
  finalDeposit: number;
  remainingDeposit: number;
  totalMeals: number;
  totalCost: number;
  currentBalance: number;
  dailyLogs: DailyLog[];
  photoBase64?: string;
}

export const generatePDF = async (item: MemberReport, selectedMonth: string): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const monthName = format(new Date(selectedMonth), 'MMMM yyyy');

  // Load Logo
  let logoDataUrl = '';
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    img.src = '/logo.png';
    await loadPromise;
    const canvas = document.createElement('canvas');
    
    // Resize image to prevent massive base64 strings
    const MAX_SIZE = 150;
    let width = img.width;
    let height = img.height;
    if (width > MAX_SIZE || height > MAX_SIZE) {
       const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
       width = width * ratio;
       height = height * ratio;
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
      logoDataUrl = canvas.toDataURL('image/png');
    }
  } catch (e) {
    console.warn('Failed to load logo for PDF');
  }

  // Premium Header Background (Emerald)
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, 210, 45, 'F');
  
  // App Name & Logo
  if (logoDataUrl) {
      // Draw white circle background for logo
      doc.setFillColor(255, 255, 255);
      doc.circle(25, 22.5, 12, 'F');
      doc.addImage(logoDataUrl, 'PNG', 15, 12.5, 20, 20);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text('Meal Manager', 42, 26);
  } else {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('Meal Manager', 15, 26);
  }

  // Invoice Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE / STATEMENT', 195, 22, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Billing Month: ${monthName}`, 195, 28, { align: 'right' });

  // Member Information Section
  doc.setTextColor(51, 65, 85);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 15, 60);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(item.memberName, 15, 67);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${item.phone}`, 15, 73);
  
  // Invoice Meta Info
  doc.setFontSize(10);
  doc.text(`Invoice No: INV-${format(new Date(), 'yyMM')}-${item.memberId.substring(0, 4).toUpperCase()}`, 195, 60, { align: 'right' });
  doc.text(`Issue Date: ${format(new Date(), 'dd MMM, yyyy')}`, 195, 66, { align: 'right' });

  // Financial Summary Table
  autoTable(doc, {
    startY: 85,
    head: [['Description', 'Amount (BDT)']],
    body: [
      ['Previous Balance (Brought Forward)', `${item.prevBalance >= 0 ? '+' : ''}${item.prevBalance}`],
      ['Advance Deposit (Current Month)', `+${item.advanceDeposit}`],
      ['Final Settlement / Extra Payment', `+${item.finalDeposit}`],
      ['Total Available Funds', `${item.remainingDeposit}`],
      [`Total Meals Consumed (${item.totalMeals})`, `-${item.totalCost}`],
    ],
    theme: 'grid',
    styles: { fontSize: 11, cellPadding: 8, textColor: [51, 65, 85] },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' }, // Emerald-500
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  // Closing Balance Box
  const isSurplus = item.currentBalance >= 0;
  doc.setFillColor(isSurplus ? 236 : 254, isSurplus ? 253 : 226, isSurplus ? 245 : 226); // emerald-50 or rose-50
  doc.setDrawColor(isSurplus ? 16 : 225, isSurplus ? 185 : 29, isSurplus ? 129 : 72); // emerald-500 or rose-600
  doc.setLineWidth(0.5);
  doc.roundedRect(15, finalY, 180, 22, 3, 3, 'FD');
  
  doc.setTextColor(isSurplus ? 4 : 159, isSurplus ? 120 : 18, isSurplus ? 87 : 57); // emerald-700 or rose-700
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Net Closing Balance:', 25, finalY + 14);
  
  doc.setFontSize(18);
  doc.text(`${item.currentBalance} BDT`, 185, finalY + 15, { align: 'right' });

  // Add Page for Daily Logs
  doc.addPage();
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(0, 0, 210, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Daily Meal Consumption Log', 15, 16);

  autoTable(doc, {
    startY: 35,
    head: [['Date', 'Lunch', 'Dinner', 'Guest', 'Total Meals']],
    body: item.dailyLogs.map(log => [
        format(new Date(log.date), 'dd MMM (EEE)'),
        log.lunch ? '1' : '-',
        log.dinner ? '1' : '-',
        (log.guestLunch + log.guestDinner) > 0 ? (log.guestLunch + log.guestDinner).toString() : '-',
        ((log.lunch ? 1 : 0) + (log.dinner ? 1 : 0) + log.guestLunch + log.guestDinner).toString()
    ]),
    theme: 'striped',
    styles: { fontSize: 10, halign: 'center', cellPadding: 5, textColor: [71, 85, 105] },
    headStyles: { fillColor: [52, 211, 153], textColor: [255, 255, 255] }, // Emerald-400
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${i} of ${pageCount}`, 15, 285);
      doc.text(`Developed by Muhammad Al-amin | Meal Manager`, 195, 285, { align: 'right' });
  }

  return doc;
};

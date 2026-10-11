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

export const generatePDF = async (item: MemberReport, selectedMonth: string, monthlyRate?: number): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const [yPdf, mPdf] = selectedMonth.split('-').map(Number);
  const firstDayOfMonth = new Date(yPdf, mPdf - 1, 1);
  const monthName = format(firstDayOfMonth, 'MMMM yyyy');
  const daysInMonth = new Date(yPdf, mPdf, 0).getDate();
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  
  const startDateStr = format(firstDayOfMonth, 'dd MMM');
  const endDateStr = format(new Date(yPdf, mPdf - 1, daysInMonth), 'dd MMM yyyy');
  const periodStr = `Period: ${startDateStr} - ${endDateStr}`;

  const isSurplus = item.currentBalance >= 0;

  // Meal counts
  let lunchCount = 0;
  let dinnerCount = 0;
  let guestCount = 0;
  item.dailyLogs.forEach(l => {
    if (l.lunch) lunchCount++;
    if (l.dinner) dinnerCount++;
    guestCount += (Number(l.guestLunch) || 0) + (Number(l.guestDinner) || 0);
  });
  const fallbackRate = monthlyRate || 65;
  const ratePerMeal = item.totalMeals > 0 ? (Math.round((item.totalCost / item.totalMeals) * 100) / 100) : fallbackRate;

  // 1. Load Logo
  let logoDataUrl = '';
  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    const loadPromise = new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(null), 1500);
      img.onload = () => { clearTimeout(timeoutId); resolve(null); };
      img.onerror = () => { clearTimeout(timeoutId); resolve(null); };
    });
    img.src = '/logo.png';
    await loadPromise;
    const canvas = document.createElement('canvas');
    const MAX_SIZE = 140;
    let width = img.width || 140;
    let height = img.height || 140;
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
    // Continue if logo fails
  }

  // ==========================================
  // HEADER BANNER (Y: 0 to 30 mm)
  // ==========================================
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.rect(0, 0, 210, 30, 'F');

  // Decorative circles in header
  doc.setFillColor(5, 150, 105); // darker emerald
  doc.circle(185, 4, 26, 'F');
  doc.setFillColor(52, 211, 153); // lighter emerald
  doc.circle(162, 24, 14, 'F');

  // Brand Logo
  if (logoDataUrl) {
    doc.setFillColor(255, 255, 255);
    doc.circle(23, 15, 9.5, 'F');
    doc.addImage(logoDataUrl, 'PNG', 15, 7, 16, 16);
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Meal Manager', 38, 15);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(209, 250, 229);
    doc.text('Monthly Meal Statement', 38, 21);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Meal Manager', 15, 15);
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(209, 250, 229);
    doc.text('Monthly Meal Statement', 15, 21);
  }

  // Header Right
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE / STATEMENT', 195, 13, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 250, 229);
  doc.text(`Billing Month: ${monthName}`, 195, 19, { align: 'right' });

  // ==========================================
  // ROW 1: BILL TO & INVOICE META (Y: 34 to 53 mm)
  // ==========================================
  // Bill To Card (Left)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, 34, 88, 19, 2.5, 2.5, 'FD');

  // Green accent bar
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(17, 36.5, 2, 14, 1, 1, 'F');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 22, 38.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(item.memberName, 22, 44);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Phone: ${item.phone || 'N/A'}`, 22, 49);

  // Invoice Details Card (Right)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(107, 34, 88, 19, 2.5, 2.5, 'FD');

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE NO', 113, 38.5);
  doc.text('ISSUE DATE', 155, 38.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`INV-${format(new Date(), 'yyMM')}-${item.memberId.substring(0, 4).toUpperCase()}`, 113, 44);
  doc.text(format(new Date(), 'dd MMM, yyyy'), 155, 44);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(periodStr, 113, 49);

  // ==========================================
  // ROW 2: 5 METRIC KPI CARDS (Y: 56 to 72 mm)
  // ==========================================
  const kpiY = 56;
  const kpiH = 16;
  const kpiCount = 5;
  const kpiGap = 3.2;
  const kpiW = (180 - (kpiGap * (kpiCount - 1))) / kpiCount; // ~33.44mm

  // 1. Total Meals
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFillColor(16, 185, 129); // Green pill
  doc.roundedRect(16, kpiY + 2.5, 1.8, 11, 0.9, 0.9, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL MEALS', 20.5, kpiY + 5.5);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(String(item.totalMeals), 20.5, kpiY + 13);

  // 2. Lunch
  const kpi2X = 15 + kpiW + kpiGap;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(kpi2X, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFillColor(245, 158, 11); // Amber pill
  doc.roundedRect(kpi2X + 1, kpiY + 2.5, 1.8, 11, 0.9, 0.9, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('LUNCH', kpi2X + 5.5, kpiY + 5.5);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(String(lunchCount), kpi2X + 5.5, kpiY + 13);

  // 3. Dinner
  const kpi3X = kpi2X + kpiW + kpiGap;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(kpi3X, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFillColor(59, 130, 246); // Blue pill
  doc.roundedRect(kpi3X + 1, kpiY + 2.5, 1.8, 11, 0.9, 0.9, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DINNER', kpi3X + 5.5, kpiY + 5.5);
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(String(dinnerCount), kpi3X + 5.5, kpiY + 13);

  // 4. Guest
  const kpi4X = kpi3X + kpiW + kpiGap;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(kpi4X, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFillColor(139, 92, 246); // Purple pill
  doc.roundedRect(kpi4X + 1, kpiY + 2.5, 1.8, 11, 0.9, 0.9, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('GUEST', kpi4X + 5.5, kpiY + 5.5);
  doc.setFontSize(13);
  doc.setTextColor(guestCount > 0 ? 124 : 15, guestCount > 0 ? 58 : 23, guestCount > 0 ? 237 : 42);
  doc.text(String(guestCount), kpi4X + 5.5, kpiY + 13);

  // 5. Rate / Meal
  const kpi5X = kpi4X + kpiW + kpiGap;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(kpi5X, kpiY, kpiW, kpiH, 2, 2, 'FD');
  doc.setFillColor(13, 148, 136); // Teal pill
  doc.roundedRect(kpi5X + 1, kpiY + 2.5, 1.8, 11, 0.9, 0.9, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('RATE / MEAL', kpi5X + 5.5, kpiY + 5.5);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${ratePerMeal} BDT`, kpi5X + 5.5, kpiY + 13);

  // ==========================================
  // ROW 3: ACCOUNT SUMMARY TABLE (Y: 76 to 112 mm)
  // ==========================================
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Account Summary', 15, 76.5);

  autoTable(doc, {
    startY: 78.5,
    margin: { left: 15, right: 15 },
    head: [['Description', 'Amount (BDT)']],
    body: [
      ['Previous Balance (Brought Forward)', `${item.prevBalance >= 0 ? '+' : ''}${item.prevBalance}`],
      ['Total Deposit (Current Month)', `+${item.advanceDeposit + item.finalDeposit}`],
      ['Total Available Funds', `${item.remainingDeposit}`],
      [
        guestCount > 0 
          ? `Total Meals Consumed (${item.totalMeals}) [L: ${lunchCount}, D: ${dinnerCount}, Guest: ${guestCount}]`
          : `Total Meals Consumed (${item.totalMeals})`, 
        `-${item.totalCost}`
      ],
    ],
    theme: 'grid',
    styles: { 
      fontSize: 8, 
      cellPadding: 2, 
      textColor: [51, 65, 85] 
    },
    headStyles: { 
      fillColor: [16, 185, 129], // Emerald-500
      textColor: [255, 255, 255], 
      fontStyle: 'bold', 
      fontSize: 8 
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.row.index === 1) {
          data.cell.styles.textColor = [16, 185, 129]; // Deposit green
        } else if (data.row.index === 2) {
          data.cell.styles.fontStyle = 'bold'; // Available bold
        } else if (data.row.index === 3) {
          data.cell.styles.textColor = [225, 29, 72]; // Meals red
        }
      }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const summaryTableEndY = (doc as any).lastAutoTable.finalY || 110;

  // ==========================================
  // ROW 4: DAILY MEAL LOG CALENDAR (Y: 114 to 220 mm)
  // ==========================================
  const calHeaderY = summaryTableEndY + 5;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Daily Meal Log - ${monthName}`, 15, calHeaderY);

  // Legend on right (Lunch, Dinner, Guest)
  doc.setFillColor(245, 158, 11); // Amber
  doc.circle(137, calHeaderY - 1, 1.8, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Lunch', 140, calHeaderY);

  doc.setFillColor(59, 130, 246); // Blue
  doc.circle(157, calHeaderY - 1, 1.8, 'F');
  doc.text('Dinner', 160, calHeaderY);

  doc.setFillColor(139, 92, 246); // Purple
  doc.circle(177, calHeaderY - 1, 1.8, 'F');
  doc.text('Guest (+G)', 180, calHeaderY);

  // Days of week header
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const gridStartX = 15;
  const gridW = 180;
  const cellGap = 1.6;
  const cellW = (gridW - (cellGap * 6)) / 7; // ~24.3mm
  const cellH = 14;

  const weekdayY = calHeaderY + 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  weekdays.forEach((dayName, idx) => {
    const xCenter = gridStartX + idx * (cellW + cellGap) + (cellW / 2);
    doc.text(dayName, xCenter, weekdayY, { align: 'center' });
  });

  // Calendar cells
  const calGridStartY = weekdayY + 2.5;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayIndex = startDayOfWeek + day - 1;
    const col = dayIndex % 7;
    const row = Math.floor(dayIndex / 7);

    const cellX = gridStartX + col * (cellW + cellGap);
    const cellY = calGridStartY + row * (cellH + cellGap);

    const dateStr = `${yPdf}-${String(mPdf).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const log = item.dailyLogs.find(l => l.date === dateStr);
    const lunch = log ? log.lunch : false;
    const dinner = log ? log.dinner : false;
    const guest = log ? (Number(log.guestLunch) || 0) + (Number(log.guestDinner) || 0) : 0;
    const dayTotal = (lunch ? 1 : 0) + (dinner ? 1 : 0) + guest;

    // Card background
    if (dayTotal === 0) {
      doc.setFillColor(254, 226, 226); // Soft red/pink
      doc.setDrawColor(252, 165, 165); // Red border
      doc.setLineWidth(0.3);
      doc.roundedRect(cellX, cellY, cellW, cellH, 2, 2, 'FD');
    } else {
      doc.setFillColor(230, 249, 240); // Soft mint green
      doc.setDrawColor(134, 239, 172); // Green border
      doc.setLineWidth(0.3);
      doc.roundedRect(cellX, cellY, cellW, cellH, 2, 2, 'FD');
    }

    // Date number (Top-Left)
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(day).padStart(2, '0'), cellX + 2.5, cellY + 4);

    // Total meals (Top-Right)
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    if (dayTotal === 0) {
      doc.setTextColor(239, 68, 68); // Red 0
    } else {
      doc.setTextColor(16, 185, 129); // Green total
    }
    doc.text(String(dayTotal), cellX + cellW - 2.5, cellY + 4, { align: 'right' });

    // L / D / Guest Circle Badges (Bottom Row)
    const badgeY = cellY + 9.5;
    const badgeR = 2.2;

    if (guest > 0) {
      // 3 badges: L, D, +G
      const badgeL_X = cellX + 4.8;
      const badgeD_X = cellX + 12.1;
      const badgeG_X = cellX + 19.5;

      // Lunch Pill
      if (lunch) {
        doc.setFillColor(245, 158, 11); // Amber-500
        doc.circle(badgeL_X, badgeY, badgeR, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text('L', badgeL_X, badgeY + 0.7, { align: 'center' });
      } else {
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.circle(badgeL_X, badgeY, badgeR, 'FD');
        doc.setTextColor(203, 213, 225);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text('L', badgeL_X, badgeY + 0.7, { align: 'center' });
      }

      // Dinner Pill
      if (dinner) {
        doc.setFillColor(59, 130, 246); // Blue-500
        doc.circle(badgeD_X, badgeY, badgeR, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text('D', badgeD_X, badgeY + 0.7, { align: 'center' });
      } else {
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.circle(badgeD_X, badgeY, badgeR, 'FD');
        doc.setTextColor(203, 213, 225);
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'bold');
        doc.text('D', badgeD_X, badgeY + 0.7, { align: 'center' });
      }

      // Guest Pill (Purple)
      doc.setFillColor(139, 92, 246); // Purple-500
      doc.circle(badgeG_X, badgeY, badgeR, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      doc.text(`+${guest}`, badgeG_X, badgeY + 0.7, { align: 'center' });
    } else {
      // 2 badges: L, D (Centered)
      const badgeL_X = cellX + (cellW / 2) - 3.4;
      const badgeD_X = cellX + (cellW / 2) + 3.4;

      // Lunch Pill
      if (lunch) {
        doc.setFillColor(245, 158, 11); // Amber-500
        doc.circle(badgeL_X, badgeY, badgeR, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('L', badgeL_X, badgeY + 0.8, { align: 'center' });
      } else {
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.circle(badgeL_X, badgeY, badgeR, 'FD');
        doc.setTextColor(203, 213, 225);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('L', badgeL_X, badgeY + 0.8, { align: 'center' });
      }

      // Dinner Pill
      if (dinner) {
        doc.setFillColor(59, 130, 246); // Blue-500
        doc.circle(badgeD_X, badgeY, badgeR, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('D', badgeD_X, badgeY + 0.8, { align: 'center' });
      } else {
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(255, 255, 255);
        doc.circle(badgeD_X, badgeY, badgeR, 'FD');
        doc.setTextColor(203, 213, 225);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('D', badgeD_X, badgeY + 0.8, { align: 'center' });
      }
    }
  }

  // Calculate Calendar End Y
  const totalCalendarRows = Math.ceil((startDayOfWeek + daysInMonth) / 7);
  const calendarEndY = calGridStartY + (totalCalendarRows * (cellH + cellGap));

  // ==========================================
  // ROW 5: NET CLOSING BALANCE BANNER (Y: bottom of calendar)
  // ==========================================
  const balanceBoxY = Math.min(calendarEndY + 4, 252);
  const balanceBoxH = 18;

  doc.setFillColor(isSurplus ? 240 : 255, isSurplus ? 253 : 241, isSurplus ? 244 : 242);
  doc.setDrawColor(isSurplus ? 16 : 225, isSurplus ? 185 : 29, isSurplus ? 129 : 72);
  doc.setLineWidth(0.6);
  doc.roundedRect(15, balanceBoxY, 180, balanceBoxH, 2.5, 2.5, 'FD');

  // Left Text
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isSurplus ? 4 : 225, isSurplus ? 120 : 29, isSurplus ? 87 : 72);
  doc.text('Net Closing Balance', 21, balanceBoxY + 7.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${item.remainingDeposit} available - ${item.totalCost} meal cost (${isSurplus ? 'surplus balance' : 'amount due'})`,
    21, 
    balanceBoxY + 13
  );

  // Right Amount
  doc.setFontSize(19);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isSurplus ? 4 : 225, isSurplus ? 120 : 29, isSurplus ? 87 : 72);
  doc.text(`${isSurplus ? '+' : ''}${item.currentBalance} BDT`, 190, balanceBoxY + 11.5, { align: 'right' });

  // ==========================================
  // FOOTER (Y: 284 mm)
  // ==========================================
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(15, 283, 195, 283);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Page 1 of 1', 15, 287);
  doc.text('Developed by Muhammad Al-amin | Meal Manager', 195, 287, { align: 'right' });

  return doc;
};

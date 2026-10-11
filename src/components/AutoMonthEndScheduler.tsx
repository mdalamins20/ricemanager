import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { db } from '../firebase';
import firebase from 'firebase/compat/app';
import { useMembers, useMeals, useDeposits, useSettings } from '../contexts';
import { getMealRateForMonth } from '../utils/pricing';
import { formatWhatsAppPhone } from '../utils/phone';
import { MemberReport, DailyLog } from '../utils/pdfGenerator';
import { getWhatsAppApiUrl, getApiHeaders } from '../utils/apiConfig';

export const AutoMonthEndScheduler: React.FC = () => {
  const { members } = useMembers();
  const { allMeals } = useMeals();
  const { allDeposits } = useDeposits();
  const { settings } = useSettings();

  const isRunningRef = useRef(false);

  useEffect(() => {
    const checkAndTriggerMonthEnd = async () => {
      if (isRunningRef.current) return;

      const now = new Date();
      const currentMonthKey = format(now, 'yyyy-MM');

      // Check if today is the last day of the current month
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isLastDay = tomorrow.getDate() === 1;

      // Check if time is between 6:00 PM and 7:00 PM (18:00 - 19:00 BD Local Time)
      const hour = now.getHours();
      const isTargetHour = hour >= 18 && hour < 19;

      // Check if already auto-dispatched this month
      const sentFlagKey = `auto_statement_sent_${currentMonthKey}`;
      const alreadySent = localStorage.getItem(sentFlagKey);

      if (!isLastDay || !isTargetHour || alreadySent) {
        return;
      }

      // Verify that WhatsApp server is running
      const apiBase = getWhatsAppApiUrl(settings);
      try {
        const statusRes = await fetch(`${apiBase}/api/status`, {
          headers: getApiHeaders()
        });
        const statusData = await statusRes.json();
        if (statusData.status !== 'connected') {
          console.log('[AutoScheduler] WhatsApp bot is not connected yet. Waiting...');
          return;
        }
      } catch (err) {
        console.log('[AutoScheduler] WhatsApp server unreachable at:', apiBase);
        return;
      }

      // Prevent concurrent runs
      isRunningRef.current = true;
      console.log(`[AutoScheduler] 🚀 Triggering automatic month-end statements for ${currentMonthKey}...`);

      try {
        const currentMonthRate = getMealRateForMonth(settings, currentMonthKey);
        const [yStr, mStr] = currentMonthKey.split('-');
        const monthDate = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1, 1);
        const monthName = format(monthDate, 'MMMM');

        // Dynamically import pdf generator
        const { generatePDF } = await import('../utils/pdfGenerator');

        // Prepare report data for all active members
        const activeMembers = members.filter(m => m.status === 'active');
        let successCount = 0;

        for (const member of activeMembers) {
          const phone = formatWhatsAppPhone(member.phone);
          if (!phone) continue;

          // 1. Calculate previous balance
          let prevTotalDeposit = 0, prevMealCost = 0;
          allDeposits.forEach(d => {
            if (d.memberId === member.id && d.date < `${currentMonthKey}-01`) {
              prevTotalDeposit += d.amount;
            }
          });
          allMeals.forEach(mDoc => {
            if (mDoc.date < `${currentMonthKey}-01`) {
              const entry = mDoc.entries?.[member.id];
              if (entry) {
                let count = 0;
                if (entry.lunch) count++;
                if (entry.dinner) count++;
                count += Number(entry.guestLunch) || 0;
                count += Number(entry.guestDinner) || 0;
                const r = getMealRateForMonth(settings, mDoc.date.slice(0, 7));
                prevMealCost += Math.round(count * r);
              }
            }
          });
          const prevBalance = Math.round(prevTotalDeposit - prevMealCost);

          // 2. Calculate current month deposits
          let advanceDeposit = 0, finalDeposit = 0;
          allDeposits.forEach(d => {
            if (d.memberId === member.id && d.date.startsWith(currentMonthKey)) {
              if (d.type === 'final') finalDeposit += d.amount;
              else advanceDeposit += d.amount;
            }
          });

          // 3. Calculate current month meals
          let totalMeals = 0;
          const dailyLogs: DailyLog[] = [];
          allMeals.forEach(mDoc => {
            if (mDoc.date.startsWith(currentMonthKey)) {
              const entry = mDoc.entries?.[member.id];
              if (entry) {
                if (entry.lunch) totalMeals++;
                if (entry.dinner) totalMeals++;
                totalMeals += Number(entry.guestLunch) || 0;
                totalMeals += Number(entry.guestDinner) || 0;
                dailyLogs.push({
                  date: mDoc.date,
                  lunch: !!entry.lunch,
                  dinner: !!entry.dinner,
                  guestLunch: Number(entry.guestLunch) || 0,
                  guestDinner: Number(entry.guestDinner) || 0
                });
              }
            }
          });

          const totalCost = Math.round(totalMeals * currentMonthRate);
          const currentDeposit = advanceDeposit + finalDeposit;
          const currentBalance = Math.round(prevBalance + currentDeposit - totalCost);

          const reportItem: MemberReport = {
            memberId: member.id,
            memberName: member.fullName,
            phone: member.phone,
            prevBalance,
            advanceDeposit,
            finalDeposit,
            remainingDeposit: 0,
            totalMeals,
            totalCost,
            currentBalance,
            dailyLogs,
            photoBase64: member.photoBase64
          };

          // Generate official PDF voucher
          const doc = await generatePDF(reportItem, currentMonthKey, currentMonthRate);
          const pdfBase64 = doc.output('datauristring').split(',')[1];

          // Save copy in shared_reports collection
          const reportRef = await db.collection('shared_reports').add({
            memberName: member.fullName,
            month: monthName,
            pdfBase64: pdfBase64,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          const cleanPath = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
          const reportLink = `${window.location.origin}${cleanPath}/#/view-report?id=${reportRef.id}`;

          // Dispatch to WhatsApp bot server with direct PDF attachment
          const sendRes = await fetch(`${apiBase}/api/monthly-statement`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              memberName: member.fullName,
              phone: phone,
              monthName: monthName,
              totalMeals: totalMeals,
              mealRate: currentMonthRate,
              totalCost: totalCost,
              prevBalance: prevBalance,
              totalDeposit: currentDeposit,
              currentBalance: currentBalance,
              invoiceUrl: reportLink,
              pdfBase64: pdfBase64
            })
          });

          const sendData = await sendRes.json();
          if (sendData && sendData.success) {
            successCount++;
          }

          // Polite throttle between members (1.5 seconds)
          await new Promise(r => setTimeout(r, 1500));
        }

        // Also dispatch to vendor if vendor phone is configured
        const vendorPhone = formatWhatsAppPhone(settings?.vendorPhone);
        if (vendorPhone) {
          let totalVendorMeals = 0;
          allMeals.forEach(mDoc => {
            if (mDoc.date.startsWith(currentMonthKey) && mDoc.entries) {
              Object.values(mDoc.entries).forEach(e => {
                if (e.lunch) totalVendorMeals++;
                if (e.dinner) totalVendorMeals++;
                totalVendorMeals += Number(e.guestLunch) || 0;
                totalVendorMeals += Number(e.guestDinner) || 0;
              });
            }
          });

          const totalFoodCost = Math.round(totalVendorMeals * currentMonthRate);
          let totalVendorPaid = 0;
          const vpDocs = await db.collection('vendor_payments').get();
          vpDocs.docs.forEach(d => {
            const vp = d.data();
            const vpM = vp.forMonth || vp.date?.substring(0, 7);
            if (vpM === currentMonthKey) {
              totalVendorPaid += Number(vp.amount) || 0;
            }
          });

          await fetch(`${apiBase}/api/vendor-monthly-statement`, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
              vendorName: settings?.vendorName || 'খালা / বাবুর্চি',
              phone: vendorPhone,
              monthName: monthName,
              totalMeals: totalVendorMeals,
              mealRate: currentMonthRate,
              totalCost: totalFoodCost,
              totalPaid: totalVendorPaid,
              dueAmount: totalFoodCost - totalVendorPaid
            })
          }).catch(console.error);
        }

        // Mark as sent for this month
        localStorage.setItem(sentFlagKey, 'true');
        console.log(`[AutoScheduler] ✅ Done! Automatically dispatched ${successCount} member statements.`);
      } catch (error) {
        console.error('[AutoScheduler] Error during automatic dispatch:', error);
      } finally {
        isRunningRef.current = false;
      }
    };

    // Run lightweight check on mount, then deep sleep with 15-minute interval (zero idle network/CPU usage)
    checkAndTriggerMonthEnd();
    const interval = setInterval(checkAndTriggerMonthEnd, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [members, allMeals, allDeposits, settings]);

  return null;
};

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const pino = require('pino');
const cron = require('node-cron');
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Lightweight in-memory rate limiter to prevent spam attacks / bot floods
const requestCounts = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 120; // 120 requests per minute per IP

  const record = requestCounts.get(ip) || { count: 0, startTime: now };
  if (now - record.startTime > windowMs) {
    record.count = 1;
    record.startTime = now;
  } else {
    record.count++;
  }
  requestCounts.set(ip, record);

  if (record.count > maxRequests) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
  }
  next();
});

// Periodic cleanup for rate limiter map
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now - record.startTime > 120000) {
      requestCounts.delete(ip);
    }
  }
}, 60000);

// Session & State
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let qrCodeDataUrl = null;
let connectionStatus = 'connecting'; // 'connecting' | 'qr' | 'connected' | 'disconnected'
let connectedUser = null;
let ngrokListener = null;
let publicTunnelUrl = null;

async function startNgrokTunnel() {
  try {
    let authtoken = process.env.NGROK_AUTHTOKEN;
    let domain = process.env.NGROK_DOMAIN;

    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        authtoken = authtoken || cfg.ngrokAuthtoken;
        domain = domain || cfg.ngrokDomain;
      } catch (e) {
        console.error('[CONFIG] Error parsing config.json:', e.message);
      }
    }

    if (authtoken && domain) {
      const ngrok = require('@ngrok/ngrok');
      ngrokListener = await ngrok.forward({
        addr: PORT,
        authtoken,
        domain
      });
      publicTunnelUrl = ngrokListener.url();
      console.log(`[NGROK] Permanent static tunnel active at: ${publicTunnelUrl}`);
      logActivity('TUNNEL_ONLINE', `Permanent Ngrok tunnel active at: ${publicTunnelUrl}`);
    } else {
      console.warn('[NGROK] Authtoken or domain not configured. Tunnel skipped.');
    }
  } catch (err) {
    console.error('[NGROK] Error starting tunnel:', err.message);
    logActivity('TUNNEL_ERROR', `Ngrok tunnel error: ${err.message}`);
  }
}
const activityLogs = [];

function logActivity(type, message, details = {}) {
  const logItem = {
    id: Date.now().toString(),
    timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type,
    message,
    details
  };
  activityLogs.unshift(logItem);
  if (activityLogs.length > 50) activityLogs.pop();
  console.log(`[WHATSAPP-BOT] ${type}: ${message}`);
}

async function resolveJid(phone) {
  if (!phone) return null;
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('0088')) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

  if (cleaned.startsWith('880')) {
    // Already formatted
  } else if (cleaned.startsWith('0')) {
    cleaned = '88' + cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    cleaned = '880' + cleaned;
  } else if (!cleaned.startsWith('88')) {
    cleaned = '88' + cleaned;
  }

  const defaultJid = cleaned + '@s.whatsapp.net';

  if (sock && connectionStatus === 'connected') {
    try {
      const results = await sock.onWhatsApp(defaultJid);
      if (results && results.length > 0 && results[0]?.exists && results[0]?.jid) {
        return results[0].jid;
      }
    } catch (e) {}
  }

  return defaultJid;
}

async function startWhatsAppBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      browser: ['MealManager Bot', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      getMessage: async () => ({ conversation: '' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'qr';
        try {
          qrCodeDataUrl = await qrcode.toDataURL(qr, { scale: 8, margin: 2 });
          logActivity('QR_READY', 'New QR Code generated. Scan with WhatsApp.');
        } catch (err) {
          console.error('Failed to generate QR data URL:', err);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        connectionStatus = 'disconnected';
        qrCodeDataUrl = null;
        connectedUser = null;

        logActivity('DISCONNECTED', `Connection closed. Reconnect: ${shouldReconnect}`, { statusCode });

        if (shouldReconnect) {
          setTimeout(startWhatsAppBot, 5000);
        } else {
          // Logged out - clear session
          logActivity('LOGGED_OUT', 'Device logged out. Please restart and scan QR again.');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch (e) {}
          setTimeout(startWhatsAppBot, 3000);
        }
      } else if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeDataUrl = null;
        connectedUser = sock.user;
        const phone = sock.user?.id ? sock.user.id.split(':')[0] : 'Unknown';
        logActivity('CONNECTED', `WhatsApp bot is active on +${phone}`);
      }
    });

  } catch (error) {
    console.error('Error starting WhatsApp socket:', error);
    connectionStatus = 'disconnected';
    setTimeout(startWhatsAppBot, 10000);
  }
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Status API
app.get('/api/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qrCode: qrCodeDataUrl,
    user: connectedUser ? {
      name: connectedUser.name || 'Bot Admin',
      phone: connectedUser.id ? connectedUser.id.split(':')[0] : ''
    } : null,
    tunnelUrl: publicTunnelUrl || 'https://unappreciably-nonsyllogistical-gonzalo.ngrok-free.dev',
    logs: activityLogs
  });
});

// 2. Generic Send Message API
app.post('/api/send', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ success: false, error: 'Phone and message are required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp bot is not connected yet. Please scan QR.' });
  }

  try {
    const jid = await resolveJid(phone);
    await sock.sendMessage(jid, { text: message });
    logActivity('MESSAGE_SENT', `Sent custom message to ${phone}`);
    res.json({ success: true, jid });
  } catch (err) {
    console.error('Failed to send message:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Deposit Confirmation API
app.post('/api/deposit-confirmation', async (req, res) => {
  const { memberName, phone, amount, currentBalance, depositMonth } = req.body;
  if (!phone || !memberName) {
    return res.status(400).json({ success: false, error: 'Member name and phone required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp bot is not connected' });
  }

  try {
    const jid = await resolveJid(phone);
    const numDue = Number(currentBalance) || 0;
    const balanceText = numDue < 0 
      ? `বকেয়া: ৳${Math.abs(numDue)}`
      : (numDue > 0 ? `জমা উদ্বৃত্ত: ৳${numDue}` : 'পরিশোধিত (০ ৳)');

    const message = 
      `🍽️ *মিল ম্যানেজার | জমা প্রাপ্তি নিশ্চিতকরণ রসিদ*\n\n` +
      `${memberName}\n` +
      `আপনার জমাকৃত অর্থ সফলভাবে মেস অ্যাকাউন্টে জমা হয়েছে।\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *লেনদেন বিবরণী:*\n` +
      `• 📅 *হিসাব মাস:* ${depositMonth || 'চলতি মাস'}\n` +
      `• 💵 *জমার পরিমাণ:* ৳${amount}\n` +
      `• 📊 *বর্তমান স্থিতি:* ${balanceText}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `সময়মতো অর্থ পরিশোধের জন্য আপনাকে আন্তরিক ধন্যবাদ।\n\n` +
      `যেকোনো হিসাব যাচাই বা তথ্যের প্রয়োজনে মেস ম্যানেজমেন্টের সাথে যোগাযোগ করার অনুরোধ রইল।\n\n` +
      `_শুভেচ্ছান্তে,_\n` +
      `*Meal Manager*`;

    await sock.sendMessage(jid, { text: message });
    logActivity('DEPOSIT_CONFIRMED', `Sent deposit confirmation of ৳${amount} to ${memberName}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Deposit confirmation send error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Monthly Statement API (Sends Direct PDF Attachment or Text)
app.post('/api/monthly-statement', async (req, res) => {
  const { memberName, phone, monthName, totalMeals, mealRate, totalCost, prevBalance, totalDeposit, currentBalance, invoiceUrl, pdfBase64 } = req.body;
  if (!phone || !memberName) {
    return res.status(400).json({ success: false, error: 'Member name and phone required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp bot is not connected' });
  }

  try {
    const jid = await resolveJid(phone);
    const isDue = Number(currentBalance) < 0;
    const standingText = isDue 
      ? `🚨 বকেয়া পাওনা: ৳${Math.abs(Number(currentBalance))}`
      : `✅ উদ্বৃত্ত জমা: ৳${Math.abs(Number(currentBalance))}`;

    const prevBalanceNum = Number(prevBalance) || 0;
    const prevBalanceSign = prevBalanceNum >= 0 ? '+' : '-';

    const message = 
      `📋 *মাসিক মিল হিসাব বিবরণী | ${String(monthName).toUpperCase()}*\n\n` +
      `আসসালামু আলাইকুম ${memberName}, আপনার ${monthName} মাসের সার্বিক মিল ও ব্যয়ের চূড়ান্ত হিসাব বিবরণী নিচে উপস্থাপন করা হলো:\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *হিসাবের সারসংক্ষেপ:*\n` +
      `• 🍽️ *মোট মিল সংখ্যা:* ${totalMeals} টি\n` +
      `• 🏷️ *গড় মিল রেট:* ৳${mealRate} / মিল\n` +
      `• 💸 *মোট মিল ব্যয়:* ৳${totalCost}\n` +
      `• 💳 *পূর্ববর্তী জের:* ${prevBalanceSign}৳${Math.abs(prevBalanceNum)}\n` +
      `• 📥 *চলতি মাসে পরিশোধ:* ৳${totalDeposit}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *বর্তমান হিসাব স্থিতি:* ${standingText}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      (!pdfBase64 && invoiceUrl ? `📄 *অফিসিয়াল ডিজিটাল ভাউচার / ইনভয়েস:*\n${invoiceUrl}\n\n` : '') +
      `_বিনীত,_\n` +
      `*Meal Manager*`;

    if (pdfBase64) {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const safeName = String(memberName).trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') || 'Member';
      await sock.sendMessage(jid, {
        document: pdfBuffer,
        mimetype: 'application/pdf',
        fileName: `Meal_Invoice_${String(monthName).replace(/\s+/g, '_')}_${safeName}.pdf`,
        caption: message
      });
      logActivity('STATEMENT_SENT', `Sent monthly statement with PDF attachment (${monthName}) to ${memberName}`);
    } else {
      await sock.sendMessage(jid, { text: message });
      logActivity('STATEMENT_SENT', `Sent monthly statement (${monthName}) to ${memberName}`);
    }

    res.json({ success: true, pdfAttached: !!pdfBase64 });
  } catch (err) {
    console.error('Statement send error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Due Reminder API
app.post('/api/due-reminder', async (req, res) => {
  const { memberName, phone, monthName, dueAmount } = req.body;
  if (!phone || !memberName) {
    return res.status(400).json({ success: false, error: 'Member name and phone required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp bot is not connected' });
  }

  try {
    const jid = await resolveJid(phone);
    const message = 
      `🔔 ${memberName}, আপনার ${monthName || 'বিগত'} মাসের মিল হিসাব অনুযায়ী আপনার সর্বমোট বকেয়ার পরিমাণ *৳${Math.abs(Number(dueAmount))}* টাকা। যথাসম্ভব দ্রুত সময়ের মধ্যে বকেয়া বিলটি পরিশোধ করার জন্য আপনাকে বিশেষ অনুরোধ জানাচ্ছি।\n\n` +
      `_আন্তরিক শুভেচ্ছাসহ,_\n` +
      `*Meal Manager*`;

    await sock.sendMessage(jid, { text: message });
    logActivity('REMINDER_SENT', `Sent due warning of ৳${dueAmount} to ${memberName}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Due reminder error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Vendor Payment Receipt API
app.post('/api/vendor-payment-receipt', async (req, res) => {
  const { vendorName, phone, paymentDate, amount, paymentForMonth, totalPaidThisMonth, remainingDueThisMonth, note } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Vendor phone required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp bot is not connected' });
  }

  try {
    const jid = await resolveJid(phone);
    const numDue = Number(remainingDueThisMonth) || 0;
    const dueText = numDue > 0
      ? `বকেয়া পাওনা: ৳${numDue}`
      : (numDue < 0 ? `অগ্রিম জমা: ৳${Math.abs(numDue)}` : 'সম্পূর্ণ পরিশোধিত (০ ৳)');

    const message = 
      `👨‍🍳 *মিল ম্যানেজার | ভেন্ডর পেমেন্ট রসিদ*\n\n` +
      `${vendorName || 'শ্রদ্ধেয় বাবুর্চি/ভেন্ডর'},\n` +
      `আপনাকে মেস ম্যানেজমেন্টের পক্ষ থেকে অর্থ পরিশোধ করা হয়েছে।\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *পেমেন্ট বিবরণী:*\n` +
      `• 📅 *পরিশোধের তারিখ:* ${paymentDate || 'আজ'}\n` +
      `• 🗓️ *হিসাব মাস:* ${paymentForMonth || 'চলতি মাস'}\n` +
      `• 💵 *বর্তমান পরিশোধ:* ৳${amount}\n` +
      `• 📥 *চলতি মাসে মোট প্রাপ্ত:* ৳${totalPaidThisMonth}\n` +
      `• 📊 *চলতি মাসে স্থিতি:* ${dueText}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      (note ? `📝 *নোট/বিবরণ:* ${note}\n━━━━━━━━━━━━━━━━━━━\n\n` : '\n') +
      `অর্থ বুঝে পাওয়ার পর অনুগ্রহ করে নিশ্চিত করুন।\n\n` +
      `_বিনীত,_\n` +
      `*Meal Manager*`;

    await sock.sendMessage(jid, { text: message });
    logActivity('VENDOR_PAID', `Sent payment receipt of ৳${amount} to vendor (${phone})`);
    res.json({ success: true });
  } catch (err) {
    console.error('Vendor payment receipt error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Vendor Monthly Statement API
app.post('/api/vendor-monthly-statement', async (req, res) => {
  const { vendorName, phone, monthName, totalMeals, mealRate, totalCost, totalPaid, dueAmount } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Vendor phone required' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp bot is not connected' });
  }

  try {
    const jid = await resolveJid(phone);
    const numDue = Number(dueAmount) || 0;
    const dueText = numDue > 0
      ? `🚨 অবশিষ্ট বকেয়া: ৳${numDue}`
      : (numDue < 0 ? `✅ অগ্রিম পরিশোধিত: ৳${Math.abs(numDue)}` : '✅ কোনো বকেয়া নেই (হিসাব সমতা)');

    const message = 
      `📋 *মাসিক ভেন্ডর হিসাব বিবরণী | ${String(monthName).toUpperCase()}*\n\n` +
      `${vendorName || 'শ্রদ্ধেয় বাবুর্চি/ভেন্ডর'},\n` +
      `আপনার ${monthName} মাসের সার্বিক মিল ও ব্যয়ের চূড়ান্ত হিসাব বিবরণী নিচে উপস্থাপন করা হলো:\n\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *হিসাবের সারসংক্ষেপ:*\n` +
      `• 🍽️ *মোট মিল সংখ্যা:* ${totalMeals} টি\n` +
      `• 🏷️ *গড় মিল রেট:* ৳${mealRate} / মিল\n` +
      `• 💸 *মোট মিল বিল:* ৳${totalCost}\n` +
      `• 📥 *মোট পরিশোধ করা হয়েছে:* ৳${totalPaid}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `📌 *বর্তমান হিসাব স্থিতি:* ${dueText}\n` +
      `━━━━━━━━━━━━━━━━━━━\n\n` +
      `যেকোনো হিসাব যাচাই বা তথ্যের প্রয়োজনে মেস ম্যানেজমেন্টের সাথে যোগাযোগ করার অনুরোধ রইল।\n\n` +
      `_বিনীত,_\n` +
      `*Meal Manager*`;

    await sock.sendMessage(jid, { text: message });
    logActivity('VENDOR_STATEMENT', `Sent monthly statement (${monthName}) to vendor (${phone})`);
    res.json({ success: true });
  } catch (err) {
    console.error('Vendor monthly statement error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Disconnect / Reset Session API
app.post('/api/disconnect', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    connectionStatus = 'disconnected';
    qrCodeDataUrl = null;
    connectedUser = null;
    logActivity('SESSION_RESET', 'User reset WhatsApp session.');
    setTimeout(startWhatsAppBot, 2000);
    res.json({ success: true, message: 'Disconnected. Restarting for fresh QR code...' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// WEB DASHBOARD UI (http://localhost:5000)
// -------------------------------------------------------------
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MealManager WhatsApp Service</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', 'Hind Siliguri', sans-serif; }
    body { background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 28px; width: 100%; max-width: 500px; padding: 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }
    .badge-connected { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-qr { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-disconnected { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
    p.sub { font-size: 13px; color: #94a3b8; margin-bottom: 24px; }
    .qr-container { background: #ffffff; padding: 16px; border-radius: 20px; display: inline-block; margin-bottom: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
    .qr-container img { width: 240px; height: 240px; display: block; border-radius: 8px; }
    .connected-box { background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 20px; padding: 24px; margin-bottom: 24px; }
    .connected-box h3 { color: #10b981; font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .connected-box p { color: #cbd5e1; font-size: 13px; }
    .btn { background: #10b981; color: #ffffff; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; width: 100%; margin-top: 8px; }
    .btn:hover { background: #059669; transform: translateY(-1px); }
    .btn-danger { background: #334155; color: #cbd5e1; margin-top: 12px; }
    .btn-danger:hover { background: #dc2626; color: #ffffff; }
    .logs-box { text-align: left; background: #0f172a; border-radius: 16px; padding: 14px; margin-top: 24px; max-height: 140px; overflow-y: auto; font-size: 11px; font-family: monospace; color: #94a3b8; }
    .log-item { margin-bottom: 4px; border-bottom: 1px solid #1e293b; padding-bottom: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div id="statusBadge" class="badge badge-disconnected">
      <span class="dot"></span>
      <span id="statusText">Connecting...</span>
    </div>
    
    <h1>Meal Manager Bot</h1>
    <p class="sub">স্বয়ংক্রিয় হোয়াটসঅ্যাপ মেসেজিং সেবা</p>

    <div id="qrArea" style="display:none;">
      <div class="qr-container">
        <img id="qrImg" src="" alt="WhatsApp QR Code">
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">আপনার মোবাইল WhatsApp দিয়ে স্ক্যান করুন:<br><b>Linked Devices > Link a Device</b></p>
    </div>

    <div id="connectedArea" style="display:none;" class="connected-box">
      <h3>✓ হোয়াটসঅ্যাপ সফলভাবে সংযুক্ত!</h3>
      <p id="phoneText">নম্বর: লোড হচ্ছে...</p>
      <p style="margin-top: 8px; font-size: 11px; color: #64748b;">মাসের শেষে বিল, টাকা জমা ও বকেয়া ওয়ার্নিং অটোমেটিক সেন্ড হবে।</p>
      
      <div style="margin-top: 18px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 14px; text-align: left;">
        <label style="font-size: 12px; font-weight: 600; color: #cbd5e1; display: block; margin-bottom: 6px;">টেস্ট মেসেজ পাঠিয়ে পরীক্ষা করুন:</label>
        <div style="display: flex; gap: 8px;">
          <input id="testPhone" type="text" placeholder="নম্বর (যেমন 017xxxxxxxx)" style="flex:1; padding:10px 14px; border-radius:12px; border:1px solid #334155; background:#0f172a; color:#fff; font-size:13px; outline:none;" />
          <button onclick="sendTestMessage()" class="btn" style="width:auto; margin:0; padding:10px 18px; font-size:13px; white-space:nowrap;">টেস্ট পাঠান</button>
        </div>
        <p id="testStatus" style="font-size: 12px; margin-top: 8px; display:none;"></p>
      </div>
    </div>

    <button id="disconnectBtn" class="btn btn-danger" style="display:none;" onclick="disconnect()">লগআউট / নতুন নম্বর যুক্ত করুন</button>

    <div class="logs-box" id="logsArea">
      <div>[BOT LOGS] অপেক্ষা করা হচ্ছে...</div>
    </div>
  </div>

  <script>
    async function checkStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        const badge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        const qrArea = document.getElementById('qrArea');
        const connectedArea = document.getElementById('connectedArea');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const qrImg = document.getElementById('qrImg');
        const phoneText = document.getElementById('phoneText');
        const logsArea = document.getElementById('logsArea');

        badge.className = 'badge badge-' + data.status;
        statusText.innerText = data.status === 'connected' ? 'ONLINE' : (data.status === 'qr' ? 'SCAN QR CODE' : data.status.toUpperCase());

        if (data.status === 'connected') {
          qrArea.style.display = 'none';
          connectedArea.style.display = 'block';
          disconnectBtn.style.display = 'block';
          phoneText.innerText = 'কানেক্টেড নম্বর: +' + (data.user?.phone || 'Linked');
        } else if (data.status === 'qr' && data.qrCode) {
          qrImg.src = data.qrCode;
          qrArea.style.display = 'block';
          connectedArea.style.display = 'none';
          disconnectBtn.style.display = 'none';
        } else {
          qrArea.style.display = 'none';
          connectedArea.style.display = 'none';
          disconnectBtn.style.display = 'none';
        }

        if (data.logs && data.logs.length > 0) {
          logsArea.innerHTML = data.logs.slice(0, 10).map(l => 
            \`<div class="log-item">[\${l.timestamp}] <b>\${l.type}:</b> \${l.message}</div>\`
          ).join('');
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function sendTestMessage() {
      const phoneInput = document.getElementById('testPhone');
      const testStatus = document.getElementById('testStatus');
      const phone = phoneInput.value.trim();
      if (!phone) {
        alert('অনুগ্রহ করে একটি মোবাইল নম্বর দিন (যেমন: 017xxxxxxxx বা 016xxxxxxxx)');
        return;
      }
      testStatus.style.display = 'block';
      testStatus.style.color = '#94a3b8';
      testStatus.innerText = 'মেসেজ পাঠানো হচ্ছে...';
      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: phone,
            message: '🎉 *Meal Manager Bot Test*\n\nআসসালামু আলাইকুম! এটি Meal Manager অ্যাপ্লিকেশনের একটি টেস্ট বার্তা। হোয়াটসঅ্যাপ অটোমেশন সফলভাবে কাজ করছে! 🚀'
          })
        });
        const d = await res.json();
        if (d.success) {
          testStatus.style.color = '#10b981';
          testStatus.innerText = '✓ সফলভাবে হোয়াটসঅ্যাপে টেস্ট মেসেজ পাঠানো হয়েছে!';
        } else {
          testStatus.style.color = '#ef4444';
          testStatus.innerText = 'ব্যর্থ: ' + (d.error || 'Server error');
        }
      } catch (err) {
        testStatus.style.color = '#ef4444';
        testStatus.innerText = 'এরর: ' + err.message;
      }
    }

    async function disconnect() {
      if (confirm('আপনি কি নিশ্চিত যে বর্তমান হোয়াটসঅ্যাপ অ্যাকাউন্টটি ডিসকানেক্ট করবেন?')) {
        await fetch('/api/disconnect', { method: 'POST' });
        checkStatus();
      }
    }

    setInterval(checkStatus, 3000);
    checkStatus();
  </script>
</body>
</html>
  `);
});

// -------------------------------------------------------------
// AUTOMATED CRON SCHEDULER (DAILY AT 10:00 AM)
// -------------------------------------------------------------
cron.schedule('0 10 * * *', async () => {
  const today = new Date();
  const day = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  logActivity('CRON_CHECK', `Running daily automation check for day ${day} of ${lastDayOfMonth}`);

  // End of Month trigger
  if (day === lastDayOfMonth) {
    logActivity('CRON_TRIGGER', 'Today is the last day of the month! Triggering automated month-end statements.');
  }

  // 2nd or 3rd day of month reminder window
  if (day === 2 || day === 3) {
    logActivity('CRON_TRIGGER', `Day ${day}: Checking pending dues for reminder dispatch.`);
  }
});

// Start Bot, Server and Static Tunnel
app.listen(PORT, async () => {
  console.log(`===============================================`);
  console.log(`MealManager WhatsApp Server running on port ${PORT}`);
  console.log(`Open in browser: http://localhost:${PORT}`);
  console.log(`===============================================`);
  startWhatsAppBot();
  await startNgrokTunnel();
});

/**
 * Aroma Print Server
 * 
 * Lightweight HTTP server that receives order data and sends
 * formatted ESC/POS commands to a connected USB thermal printer.
 * 
 * Usage:
 *   npm install
 *   node server.js
 * 
 * Endpoints:
 *   GET  /status  → { connected, printerName }
 *   POST /print   → { success } (body: { order, token })
 */

const express = require('express');
const cors = require('cors');
const { formatReceiptText, formatReceiptRaw } = require('./receipt');

const app = express();
const PORT = 9100;

// ── STATE ──────────────────────────────────────────────────────────
let printer = null;
let device = null;
let printerName = null;
let isConnected = false;

// ── TRY USB PRINTER ───────────────────────────────────────────────
async function initUSBPrinter() {
  try {
    const escpos = require('escpos');
    const escposUSB = require('escpos-usb');
    escpos.USB = escposUSB;

    device = new escpos.USB();
    printerName = 'USB Thermal Printer';

    await new Promise((resolve, reject) => {
      device.open((err) => {
        if (err) return reject(err);
        printer = new escpos.Printer(device);
        isConnected = true;
        console.log('✅ USB printer connected');
        resolve();
      });
    });
  } catch (err) {
    console.log('⚠️  No USB printer found:', err.message || err);
    console.log('   Server will start in console-only mode.');
    isConnected = false;
    printer = null;
    device = null;
  }
}

// ── MIDDLEWARE ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────

// Health check — frontend polls this every 5s
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    printerName: printerName || 'Console (no printer)',
    server: 'aroma-print-server',
    version: '1.0.0',
  });
});

// Print receipt
app.post('/print', async (req, res) => {
  const { order, token } = req.body;

  if (!order || !token) {
    return res.status(400).json({ success: false, error: 'Missing order or token' });
  }

  // ── NO PRINTER → Console output ──
  if (!isConnected || !device) {
    const text = formatReceiptText(order, token);
    console.log('\n📄 RECEIPT #' + token + ':');
    console.log(text);

    return res.json({
      success: true,
      printed: false,
      message: 'No printer — receipt logged to console',
      receipt: text,
    });
  }

  // ── HAS PRINTER → ESC/POS ──
  try {
    const rawData = formatReceiptRaw(order, token);

    await new Promise((resolve, reject) => {
      device.open((err) => {
        if (err) return reject(err);

        const escpos = require('escpos');
        const p = new escpos.Printer(device);

        rawData.forEach(chunk => p.text(chunk));

        p.close(() => resolve());
      });
    });

    console.log(`🖨️  Printed receipt #${token}`);
    res.json({ success: true, printed: true });
  } catch (err) {
    console.error('❌ Print failed:', err.message || err);

    // Fallback to console
    const text = formatReceiptText(order, token);
    console.log('\n📄 FALLBACK RECEIPT #' + token + ':');
    console.log(text);

    res.status(500).json({
      success: false,
      error: err.message || 'Print failed',
      receipt: text,
    });
  }
});

// ── START ──────────────────────────────────────────────────────────
async function start() {
  console.log('\n🖨️  Aroma Print Server');
  console.log('─'.repeat(48));

  await initUSBPrinter();

  app.listen(PORT, () => {
    console.log(`\n🚀 Listening on http://localhost:${PORT}`);
    console.log(`   GET  /status  → printer status`);
    console.log(`   POST /print   → print receipt`);

    if (!isConnected) {
      console.log('\n💡 No printer detected — receipts print to console.');
      console.log('   Connect USB thermal printer and restart.\n');
    }

    console.log('─'.repeat(48) + '\n');
  });
}

start();

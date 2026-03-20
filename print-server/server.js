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
const { formatReceipt } = require('./receipt');

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

    // Test open/close to verify connection
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
    console.log('   Server will start anyway. Connect printer and restart.');
    isConnected = false;
    printer = null;
    device = null;
  }
}

// ── MIDDLEWARE ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────

// Health check
app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    printerName: printerName || null,
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

  // Format the receipt
  const receiptData = formatReceipt(order, token);

  // If no printer, log receipt to console (useful for testing)
  if (!isConnected || !device) {
    console.log('\n📄 RECEIPT (no printer connected — console output):');
    console.log('─'.repeat(48));
    // Strip ESC codes for console display
    const readable = receiptData
      .join('')
      .replace(/[\x1B\x1D][\x00-\x7F]*/g, '')
      .replace(/\x0A/g, '\n');
    console.log(readable);
    console.log('─'.repeat(48));

    return res.json({
      success: true,
      printed: false,
      message: 'No printer connected — receipt logged to console',
    });
  }

  // Print via ESC/POS
  try {
    await new Promise((resolve, reject) => {
      device.open((err) => {
        if (err) return reject(err);

        const escpos = require('escpos');
        const p = new escpos.Printer(device);

        // Send raw data
        receiptData.forEach(chunk => {
          p.text(chunk);
        });

        p.close(() => {
          resolve();
        });
      });
    });

    console.log(`🖨️  Printed receipt #${token}`);
    res.json({ success: true, printed: true });
  } catch (err) {
    console.error('❌ Print failed:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Print failed' });
  }
});

// ── START ──────────────────────────────────────────────────────────
async function start() {
  console.log('\n🖨️  Aroma Print Server');
  console.log('─'.repeat(40));

  await initUSBPrinter();

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`   GET  /status  → printer status`);
    console.log(`   POST /print   → print receipt`);
    console.log('─'.repeat(40));

    if (!isConnected) {
      console.log('\n💡 No printer detected. Receipts will be logged to console.');
      console.log('   Connect a USB thermal printer and restart the server.\n');
    }
  });
}

start();

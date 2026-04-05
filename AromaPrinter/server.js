/**
 * Aroma Print Server v3.0.0 (Unified Stable)
 * 
 * Supports:
 * - Direct thermal printing on Windows (pdf-to-printer)
 * - Direct thermal printing on macOS (CUPS/lp)
 * - Dynamic system username detection
 * - Browser-to-Local communication (CORS + PNA headers)
 * - Network-wide access (0.0.0.0 binding)
 */

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');
const { print: printToPrinter } = require('pdf-to-printer');
const { formatReceiptText, formatReceiptRaw } = require('./receipt');

const app = express();
const HTTP_PORT = 9100;
const HTTPS_PORT = 9443;
const isWindows = os.platform() === 'win32';

// ── STATE ──────────────────────────────────────────────────────────
let printerName = null;
let isConnected = false;

// ── PRINTER DETECTION ─────────────────────────────────────────────

function detectWindowsPrinter() {
  try {
    const output = execSync(
      'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: 'utf-8' }
    );

    const printers = output
      .split('\n')
      .map(p => p.trim())
      .filter(p =>
        p &&
        !p.toLowerCase().includes('pdf') &&
        !p.toLowerCase().includes('onenote') &&
        !p.toLowerCase().includes('microsoft') &&
        !p.toLowerCase().includes('fax')
      );

    if (printers.length > 0) {
      printerName = printers[0];
      isConnected = true;
      console.log(`✅ Windows printer detected: ${printerName}`);
    } else {
      printerName = null;
      isConnected = false;
      console.log('⚠️ No thermal/POS printer found on Windows.');
    }
  } catch (err) {
    console.log('⚠️ PowerShell detection failed:', err.message);
    isConnected = false;
  }
}

function detectMacPrinter() {
  try {
    const output = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8' }).trim();
    const match = output.match(/system default destination:\s*(.+)/);

    if (match) {
      printerName = match[1].trim();
      isConnected = true;
      console.log(`✅ Mac printer detected: ${printerName}`);
    } else {
      // Fallback: search for POS/80/Receipt
      const printers = execSync('lpstat -p 2>/dev/null', { encoding: 'utf-8' });
      const posMatch = printers.match(/printer\s+([\w_-]*(?:POS|thermal|receipt|80)[\w_-]*)/i);
      if (posMatch) {
        printerName = posMatch[1];
        isConnected = true;
        console.log(`✅ Mac POS printer found: ${printerName}`);
      } else {
        isConnected = false;
        console.log('⚠️ No printer detected via CUPS.');
      }
    }
  } catch (err) {
    console.log('⚠️ CUPS not available:', err.message);
    isConnected = false;
  }
}

function detectPrinter() {
  if (isWindows) {
    detectWindowsPrinter();
  } else {
    detectMacPrinter();
  }
}

// ── PRINTING LOGIC ────────────────────────────────────────────────

async function printReceipt(rawData, token) {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `aroma_receipt_${token}_${Date.now()}.bin`);
  
  // Write raw ESC/POS data to temp file
  const buffer = Buffer.from(rawData.join(''), 'binary');
  fs.writeFileSync(tmpFile, buffer);

  if (isWindows) {
    return printViaWindows(tmpFile);
  } else {
    return printViaCUPS(tmpFile);
  }
}

function printViaWindows(filePath) {
  return new Promise((resolve, reject) => {
    printToPrinter(filePath, { printer: printerName })
      .then(() => {
        try { fs.unlinkSync(filePath); } catch {}
        resolve("Windows Print Job Sent");
      })
      .catch(err => {
        try { fs.unlinkSync(filePath); } catch {}
        reject(err);
      });
  });
}

function printViaCUPS(tmpFile) {
  return new Promise((resolve, reject) => {
    const cmd = `lp -d "${printerName}" -o raw "${tmpFile}"`;
    exec(cmd, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

// ── HTTPS CERTIFICATES ───────────────────────────────────────────

function getOrCreateCert() {
  const certDir = path.join(__dirname, '.certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  console.log('🔐 Generating self-signed certificate...');
  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  try {
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`);
    const gitignorePath = path.join(certDir, '.gitignore');
    fs.writeFileSync(gitignorePath, '*\n');
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } catch (err) {
    console.log('⚠️ Could not generate SSL cert:', err.message);
    return null;
  }
}

// ── MIDDLEWARE ─────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Browser-to-Local Network Access (PNA) Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Private-Network', 'true');
  next();
});

// ── ROUTES ────────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  detectPrinter();
  res.json({
    connected: isConnected,
    printerName: printerName || null,
    username: os.userInfo().username,
    server: 'aroma-print-server',
    version: '3.0.0',
    platform: os.platform()
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.post('/print', async (req, res) => {
  const { order, token } = req.body;

  if (!order || !token) {
    return res.status(400).json({ success: false, error: 'Missing order or token' });
  }

  // Log receipt to console
  const text = formatReceiptText(order, token);
  console.log(`\n📄 RECEIPT #${token}:\n${text}`);

  if (!isConnected || !printerName) {
    return res.json({
      success: true,
      printed: false,
      message: 'No printer detected — receipt logged to console'
    });
  }

  try {
    const rawData = formatReceiptRaw(order, token);
    const result = await printReceipt(rawData, token);
    console.log(`🖨️ Printed #${token} → ${printerName} (${result})`);
    res.json({ success: true, printed: true });
  } catch (err) {
    console.error('❌ Print failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── START SERVER ───────────────────────────────────────────────────

function start() {
  console.log(`\n🖨️  Aroma Print Server v3.0.0 (${os.platform()})`);
  console.log('─'.repeat(48));

  detectPrinter();

  // Listen on all network interfaces (0.0.0.0)
  http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP  → http://localhost:${HTTP_PORT}`);
  });

  const certs = getOrCreateCert();
  if (certs) {
    https.createServer(certs, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`🔒 HTTPS → https://localhost:${HTTPS_PORT}`);
    });
  }

  console.log(`\n   GET  /status  → status & username`);
  console.log(`   POST /print   → print order`);
  console.log('─'.repeat(48) + '\n');
}

start();

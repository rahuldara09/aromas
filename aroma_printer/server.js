/**
 * Aroma Print Server v4.0.1 - Windows & Mac Compatible
 *
 * Uses PowerShell on Windows and CUPS (lp) on Mac/Linux.
 * Also serves HTTPS so production HTTPS pages can reach it.
 *
 * Endpoints:
 *   GET  /status  → { connected, printerName, platform }
 *   POST /print   → { success } (body: { order, token })
 */

const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');
const { formatReceiptText, formatReceiptRaw } = require('./receipt');

const app = express();
const HTTP_PORT = 9100;
const HTTPS_PORT = 9443;

// Robust Windows check
const isWindows = os.platform() === 'win32' || process.platform === 'win32';

// ── STATE ──────────────────────────────────────────────────────────
let printerName = null;
let isConnected = false;

// ── WINDOWS DETECTION (PURE POWERSHELL) ───────────────────────────
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
        !p.toLowerCase().includes('microsoft')
      );

    if (printers.length > 0) {
      printerName = printers[0];
      isConnected = true;
      console.log(`✅ Windows printer detected: ${printerName}`);
    } else {
      printerName = null;
      isConnected = false;
      console.log('⚠️ No Windows thermal/POS printer found');
    }
  } catch (err) {
    console.log('⚠️ PowerShell detection failed:', err.message);
    isConnected = false;
  }
}

// ── MAC/LINUX DETECTION (CUPS) ────────────────────────────────────
function detectMacPrinter() {
  try {
    const output = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8' }).trim();
    const match = output.match(/system default destination:\s*(.+)/);

    if (match) {
      printerName = match[1].trim();
      isConnected = true;
      console.log(`✅ Mac printer detected: ${printerName}`);
    } else {
      isConnected = false;
      console.log('⚠️ No Mac printer detected via lpstat');
    }
  } catch (err) {
    console.log('⚠️ CUPS not available on this system');
    isConnected = false;
  }
}

// ── UNIVERSAL DETECTION ───────────────────────────────────────────
function detectPrinter() {
  if (isWindows) {
    detectWindowsPrinter();
  } else {
    detectMacPrinter();
  }
}

// ── WINDOWS PRINTING (VIA POWERSHELL RAW PRINT) ───────────────────
async function printViaWindows(rawData, token) {
  const tmpFile = path.join(os.tmpdir(), `receipt_${token}.bin`);
  const buffer = Buffer.from(rawData.join(''), 'binary');
  fs.writeFileSync(tmpFile, buffer);

  const scriptPath = path.join(__dirname, 'scripts', 'raw-print.ps1');

  return new Promise((resolve, reject) => {
    // Escaping the printer name for PowerShell
    const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -printerName "${printerName}" -filePath "${tmpFile}"`;

    exec(cmd, (err, stdout, stderr) => {
      // Cleanup
      try { fs.unlinkSync(tmpFile); } catch {}

      if (err) {
        console.error('❌ PowerShell Print Error:', stderr || stdout || err.message);
        reject(new Error(stderr || stdout || err.message));
      } else {
        console.log(`✅ ${stdout.trim()}`);
        resolve(stdout.trim());
      }
    });
  });
}

// ── MAC PRINTING (VIA CUPS) ────────────────────────────────────────
function printViaCUPS(rawData, token) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `receipt_${token}.bin`);
    const buffer = Buffer.from(rawData.join(''), 'binary');
    fs.writeFileSync(tmpFile, buffer);

    const cmd = `lp -d "${printerName}" -o raw "${tmpFile}"`;
    exec(cmd, (err, stdout, stderr) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

// ── GENERATE SELF-SIGNED CERT (for HTTPS) ────────────────────────
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
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`,
      { stdio: 'pipe' }
    );
    fs.writeFileSync(path.join(certDir, '.gitignore'), '*\n');
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } catch (err) {
    console.log('⚠️ Could not generate SSL cert:', err.message);
    return null;
  }
}

// Robust CORS & Private Network Access (PNA) middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Support specific origins for stricter loopback access
  if (origin && (origin.includes('aromadhaba.in') || origin.includes('localhost'))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  // Mandatory for Chrome's Private Network Access preflights (OPTIONS)
  // Also keeps loopback access alive for GET/POST
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Max-Age', '86400'); // Cache preflight for 24h

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors());
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  // Only re-detect if we haven't found a printer or if explicitly requested
  if (!isConnected || !printerName || req.query.refresh === 'true') {
    detectPrinter();
  }

  res.json({
    connected: isConnected,
    printerName: printerName || null,
    username: os.userInfo().username,
    server: 'aroma-print-server',
    version: '4.0.1',
    platform: os.platform(),
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

  const text = formatReceiptText(order, token);
  console.log('\n📄 RECEIPT #' + token + ':');
  console.log(text);

  if (!isConnected || !printerName) {
    return res.json({
      success: true,
      printed: false,
      message: 'No printer — receipt logged to console',
      receipt: text,
    });
  }

  try {
    const rawData = formatReceiptRaw(order, token);

    if (isWindows) {
      await printViaWindows(rawData, token);
    } else {
      await printViaCUPS(rawData, token);
    }

    console.log(`🖨️ Printed #${token} → ${printerName}`);
    res.json({ success: true, printed: true });
  } catch (err) {
    console.error('❌ Print failed:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      receipt: text,
    });
  }
});

// ── START ──────────────────────────────────────────────────────────
function start() {
  console.log(`\n🖨️ Aroma Print Server v4.0.1 (${os.platform()})`);
  console.log('─'.repeat(48));

  detectPrinter();

  http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n🚀 HTTP  → http://localhost:${HTTP_PORT}`);
  });

  const certs = getOrCreateCert();
  if (certs) {
    https.createServer(certs, app).listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`🔒 HTTPS → https://localhost:${HTTPS_PORT}`);
    });
  }

  console.log(`\n   GET  /status  → printer status`);
  console.log(`   POST /print   → print receipt`);

  if (isConnected) {
    console.log(`\n✅ Printer ready: ${printerName}`);
  } else {
    console.log('\n💡 No printer detected — receipts print to console.');
  }

  console.log('─'.repeat(48) + '\n');
}

start();

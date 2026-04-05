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

// Robust Windows check
const isWindows = os.platform() === "win32" || process.platform === "win32";

// ── STATE ───────────────────────────────
let printerName = null;
let isConnected = false;

// ── WINDOWS DETECTION (PURE POWERSHELL) ───────────
function detectWindowsPrinter() {
  try {
    const output = execSync(
      'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: "utf-8" }
    );

    const printers = output
      .split("\n")
      .map(p => p.trim())
      .filter(p =>
        p &&
        !p.toLowerCase().includes("pdf") &&
        !p.toLowerCase().includes("onenote") &&
        !p.toLowerCase().includes("microsoft")
      );

    if (printers.length > 0) {
      printerName = printers[0];
      isConnected = true;
      console.log(`✅ Windows printer detected: ${printerName}`);
    } else {
      printerName = null;
      isConnected = false;
      console.log("⚠️ No Windows thermal/POS printer found");
    }
  } catch (err) {
    console.log("⚠️ PowerShell detection failed:", err.message);
    isConnected = false;
  }
}

// ── MAC DETECTION ───────────────────────
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

// ── UNIVERSAL DETECTION ─────────────────
function detectPrinter() {
  if (isWindows) {
    detectWindowsPrinter();
  } else {
    detectMacPrinter();
  }
}

// ── WINDOWS PRINTING (VIA PDF-TO-PRINTER) ─────────
async function printViaWindows(rawData, token) {
  const tmpFile = path.join(os.tmpdir(), `receipt_${token}.bin`);
  const buffer = Buffer.from(rawData.join(''), 'binary');
  fs.writeFileSync(tmpFile, buffer);

  try {
    await printToPrinter(tmpFile, { printer: printerName });
    // Cleanup
    try { fs.unlinkSync(tmpFile); } catch {}
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    throw err;
  }
}

// ── MAC PRINTING (VIA CUPS) ───────────────────────
function printViaCUPS(rawData, token) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join('/tmp', `receipt_${token}.bin`);
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

// ── CERT ───────────────────────────────
function getOrCreateCert() {
  const certDir = path.join(__dirname, '.certs');
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

  try {
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`);
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } catch {
    return null;
  }
}

// ── MIDDLEWARE ─────────────────────────
app.use(cors());
app.use(express.json());

// Browser Privacy Network fix
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Private-Network', 'true');
  next();
});

// ── ROUTES ────────────────────────────

app.get('/status', (req, res) => {
  detectPrinter();

  res.json({
    connected: isConnected,
    printerName: printerName,
    username: os.userInfo().username,
    server: "aroma-print-server",
    version: "4.0.0",
    platform: os.platform()
  });
});

app.get('/health', (req, res) => {
  res.send("OK");
});

app.post('/print', async (req, res) => {
  const { order, token } = req.body;

  const text = formatReceiptText(order, token);
  console.log(`\n📄 RECEIPT #${token}:\n${text}`);

  if (!isConnected || !printerName) {
    return res.json({
      success: true,
      printed: false,
      message: "No printer — logged to console"
    });
  }

  try {
    const rawData = formatReceiptRaw(order, token);
    
    if (isWindows) {
      await printViaWindows(rawData, token);
    } else {
      await printViaCUPS(rawData, token);
    }

    res.json({ success: true, printed: true });
  } catch (err) {
    console.error('❌ Print failed:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ── START ─────────────────────────────

function start() {
  console.log(`\n🖨️  Aroma Print Server v4.0.0 (${os.platform()})\n`);

  detectPrinter();

  // Listen on 0.0.0.0 as per your working version
  http.createServer(app).listen(HTTP_PORT, "0.0.0.0", () => {
    console.log(`🚀 http://localhost:${HTTP_PORT}`);
  });

  const cert = getOrCreateCert();
  if (cert) {
    https.createServer(cert, app).listen(HTTPS_PORT, "0.0.0.0", () => {
      console.log(`🔒 https://localhost:${HTTPS_PORT}`);
    });
  }
}

start();

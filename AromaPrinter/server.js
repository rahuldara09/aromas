/**
 * Aroma Print Server
 * 
 * Uses macOS CUPS (lp command) to print ESC/POS data to thermal printer.
 * Also generates self-signed HTTPS cert so production HTTPS sites can reach it.
 * 
 * Endpoints:
 *   GET  /status  → { connected, printerName }
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
const { print: printToPrinter } = require('pdf-to-printer');
const { formatReceiptText, formatReceiptRaw } = require('./receipt');

const isWindows = os.platform() === 'win32';

const app = express();
const HTTP_PORT = 9100;
const HTTPS_PORT = 9443;

// ── STATE ──────────────────────────────────────────────────────────
let printerName = null;
let isConnected = false;

// ── DETECT PRINTER ───────────────────────────────────────────────
// ── DETECT PRINTER (WINDOWS ASYNC) ────────────────────────────────
function getWindowsPrinter() {
  return new Promise((resolve) => {
    exec("wmic printer get name", (err, stdout) => {
      if (err) {
        console.log("WMIC ERROR:", err);
        return resolve(null);
      }

      const printers = stdout
        .split("\n")
        .map(p => p.trim())
        .filter(p =>
          p &&
          p !== "Name" &&
          !p.toLowerCase().includes("pdf") &&
          !p.toLowerCase().includes("onenote")
        );

      console.log("Detected printers:", printers);
      resolve(printers.length > 0 ? printers[0] : null);
    });
  });
}

function detectMacPrinterSync() {
  try {
    // Get default printer
    const output = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8' }).trim();
    const match = output.match(/system default destination:\s*(.+)/);
    if (match) {
      printerName = match[1].trim();
      isConnected = true;
      return;
    }

    // Fallback: list all printers and pick first POS/thermal one
    const printers = execSync('lpstat -p 2>/dev/null', { encoding: 'utf-8' });
    const posMatch = printers.match(/printer\s+([\w_-]*(?:POS|thermal|receipt|80)[\w_-]*)/i);
    if (posMatch) {
      printerName = posMatch[1];
      isConnected = true;
      return;
    }
    isConnected = false;
  } catch (err) {
    isConnected = false;
  }
}

// ── PRINT LOGIC ──────────────────────────────────────────────────
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
    // Print using lp with raw option
    const cmd = `lp -d "${printerName}" -o raw "${tmpFile}"`;
    exec(cmd, (err, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch {}

      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout.trim());
      }
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
    execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost"`, { stdio: 'pipe' });
    
    // Add to .gitignore
    const gitignorePath = path.join(certDir, '.gitignore');
    fs.writeFileSync(gitignorePath, '*\n');

    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  } catch (err) {
    console.log('⚠️  Could not generate SSL cert:', err.message);
    return null;
  }
}

// ── MIDDLEWARE ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  // ⚡ CRITICAL FIX FOR CHROME PRIVATE NETWORK ACCESS (PNA)
  if (req.headers['access-control-request-private-network']) {
    res.header('Access-Control-Allow-Private-Network', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────

app.get('/status', async (req, res) => {
  if (isWindows) {
    const printer = await getWindowsPrinter();
    printerName = printer;
    isConnected = !!printer;
  } else {
    detectMacPrinterSync();
  }
  
  res.json({
    connected: isConnected,
    printerName: printerName || null,
    username: os.userInfo().username,
    server: 'aroma-print-server',
    version: '2.2.0',
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

  // Always log to console
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

  // Print command
  try {
    const rawData = formatReceiptRaw(order, token);
    const result = await printReceipt(rawData, token);
    console.log(`🖨️  Printed #${token} → ${printerName} (${result})`);
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
async function start() {
  console.log(`\n🖨️  Aroma Print Server v2.2 (${os.platform()})`);
  console.log('─'.repeat(48));

  if (isWindows) {
    const printer = await getWindowsPrinter();
    printerName = printer;
    isConnected = !!printer;
  } else {
    detectMacPrinterSync();
  }

  // HTTP server
  http.createServer(app).listen(HTTP_PORT, () => {
    console.log(`\n🚀 HTTP  → http://localhost:${HTTP_PORT}`);
  });

  // HTTPS server (for production site mixed-content fix)
  const certs = getOrCreateCert();
  if (certs) {
    https.createServer(certs, app).listen(HTTPS_PORT, () => {
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

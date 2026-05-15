const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, exec } = require('child_process');
const { formatReceiptText, formatReceiptRaw, formatReportText, formatReportRaw } = require('./receipt');

const app = express();
const HTTP_PORT = 9100;
const PHYSICAL_PRINT_DELAY_MS = 3000;

const TEMP_FILE_CLEANUP_DELAY_MS = 8000;

const isWindows = os.platform() === 'win32' || process.platform === 'win32';

let activePrinterName = null;
let isConnected = false;
let availablePrinters = []; // [{ name, score }]

let printQueue = Promise.resolve();
let pendingJobCount = 0;

function enqueuePrintJob(jobFn) {
  const position = pendingJobCount;
  pendingJobCount++;
  printQueue = printQueue.then(async () => {
    try {
      await jobFn();
    } catch (err) {
      console.error('❌ Queue job error:', err.message);
    } finally {
      pendingJobCount = Math.max(0, pendingJobCount - 1);
    }
  });
  return position;
}

// ── THERMAL PRINTER SCORING ────────────────────────────────────────
const THERMAL_KEYWORDS = ['epson', 'pos', 'thermal', 'tm-t', 'tm_t', 'receipt', 'rp', 'xp', 'star', 'citizen', 'sewoo', 'bixolon', 'rongta', 'xprinter'];
const AVOID_KEYWORDS = ['pdf', 'onenote', 'microsoft', 'airprint', 'fax', 'xps', 'virtual', 'docuprint', 'foxit'];

function scorePrinter(name) {
  const lower = name.toLowerCase();
  if (AVOID_KEYWORDS.some(k => lower.includes(k))) return -1;
  return THERMAL_KEYWORDS.reduce((score, k) => score + (lower.includes(k) ? 10 : 0), 1);
}

// ── WINDOWS DETECTION ─────────────────────────────────────────────
function detectWindowsPrinters() {
  try {
    const output = execSync(
      'powershell -WindowStyle Hidden -NonInteractive -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: 'utf-8', windowsHide: true }
    );

    const all = output.split('\n').map(p => p.trim()).filter(Boolean);
    availablePrinters = all
      .map(name => ({ name, score: scorePrinter(name) }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (availablePrinters.length > 0) {
      if (!activePrinterName) {
        activePrinterName = availablePrinters[0].name;
      }
      isConnected = true;
      console.log(`✅ Windows printers: ${availablePrinters.map(p => p.name).join(', ')}`);
      console.log(`   Active: ${activePrinterName}`);
    } else {
      isConnected = false;
      console.log('⚠️ No suitable Windows printer found');
    }
  } catch (err) {
    console.log('⚠️ PowerShell detection failed:', err.message);
    isConnected = false;
  }
}

// ── MAC/LINUX DETECTION (CUPS) ────────────────────────────────────
function detectMacPrinters() {
  try {
    let allNames = [];

    // Primary: enumerate all accepted queues
    try {
      const out = execSync('lpstat -a 2>/dev/null', { encoding: 'utf-8' }).trim();
      allNames = out.split('\n').map(line => line.split(' ')[0].trim()).filter(Boolean);
    } catch (_) { }

    // Fallback: parse `lpstat -p` printer list
    if (allNames.length === 0) {
      try {
        const out = execSync('lpstat -p 2>/dev/null', { encoding: 'utf-8' }).trim();
        allNames = out
          .split('\n')
          .filter(line => line.startsWith('printer '))
          .map(line => line.split(' ')[1])
          .filter(Boolean);
      } catch (_) { }
    }

    availablePrinters = allNames
      .map(name => ({ name, score: scorePrinter(name) }))
      .filter(p => p.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (availablePrinters.length > 0 && !activePrinterName) {
      const best = availablePrinters[0];
      if (best.score > 1) {
        // Clear thermal match — use it
        activePrinterName = best.name;
      } else {
        // All printers are generic — prefer the OS default if set
        try {
          const defaultOut = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8' }).trim();
          const m = defaultOut.match(/system default destination:\s*(.+)/);
          activePrinterName = m ? m[1].trim() : best.name;
        } catch (_) {
          activePrinterName = best.name;
        }
      }
      isConnected = true;
      console.log(`✅ Mac printers: ${availablePrinters.map(p => p.name).join(', ')}`);
      console.log(`   Active: ${activePrinterName}`);
      return;
    }

    if (availablePrinters.length > 0) {
      // activePrinterName already set — just refresh the list
      isConnected = true;
      return;
    }

    // Last resort: lpstat -d
    const defaultOut = execSync('lpstat -d 2>/dev/null', { encoding: 'utf-8' }).trim();
    const m = defaultOut.match(/system default destination:\s*(.+)/);
    if (m) {
      activePrinterName = m[1].trim();
      availablePrinters = [{ name: activePrinterName, score: 1 }];
      isConnected = true;
      console.log(`✅ Mac default printer: ${activePrinterName}`);
    } else {
      isConnected = false;
      console.log('⚠️ No Mac printer detected');
    }
  } catch (err) {
    console.log('⚠️ Mac printer detection failed:', err.message);
    isConnected = false;
  }
}

function detectPrinters() {
  if (isWindows) {
    detectWindowsPrinters();
  } else {
    detectMacPrinters();
  }
}

function printerExists(name) {
  return availablePrinters.some(p => p.name === name);
}

// ── WINDOWS PRINTING ───────────────────────────────────────────────
async function printViaWindows(rawData, token, targetPrinter) {
  const tmpFile = path.join(os.tmpdir(), `receipt_${token}_${Date.now()}.bin`);
  const buffer = Buffer.from(rawData.join(''), 'binary');
  fs.writeFileSync(tmpFile, buffer);

  const scriptPath = path.join(__dirname, 'scripts', 'raw-print.ps1');
  const printer = targetPrinter || activePrinterName;

  return new Promise((resolve, reject) => {
    const cmd = `powershell -WindowStyle Hidden -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}" -printerName "${printer}" -filePath "${tmpFile}"`;
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) { } }, TEMP_FILE_CLEANUP_DELAY_MS);
      if (err) {
        console.error('❌ PowerShell print error:', stderr || stdout || err.message);
        reject(new Error(stderr || stdout || err.message));
      } else {
        console.log(`✅ ${stdout.trim()}`);
        resolve(stdout.trim());
      }
    });
  });
}

// ── MAC PRINTING (CUPS) ────────────────────────────────────────────
function printViaCUPS(rawData, token, targetPrinter) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `receipt_${token}_${Date.now()}.bin`);
    const buffer = Buffer.from(rawData.join(''), 'binary');
    fs.writeFileSync(tmpFile, buffer);

    const printer = targetPrinter || activePrinterName;
    const cmd = `lp -d "${printer}" -o raw "${tmpFile}"`;

    exec(cmd, (err, stdout, stderr) => {
      // Delay cleanup — CUPS reads the file asynchronously after `lp` returns.
      // Immediate deletion can produce incomplete receipts on slow spool paths.
      setTimeout(() => { try { fs.unlinkSync(tmpFile); } catch (_) { } }, TEMP_FILE_CLEANUP_DELAY_MS);

      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function physicalPrint(rawData, token, targetPrinter) {
  if (isWindows) {
    await printViaWindows(rawData, token, targetPrinter);
  } else {
    await printViaCUPS(rawData, token, targetPrinter);
  }
}

// ── MIDDLEWARE ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('aromadhaba.in') || origin.includes('localhost'))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.set('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────

app.get('/status', (req, res) => {
  if (!isConnected || !activePrinterName || req.query.refresh === 'true') {
    detectPrinters();
  }
  res.json({
    connected: isConnected,
    printerName: activePrinterName || null,
    username: os.userInfo().username,
    server: 'byte-printer',
    version: '5.0.0',
    platform: os.platform(),
    queueDepth: pendingJobCount,
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Returns all printers detected on the system, scored by thermal compatibility.
app.get('/printers', (req, res) => {
  detectPrinters();
  res.json({
    printers: availablePrinters,
    active: activePrinterName,
    connected: isConnected,
  });
});

// Returns current print queue depth — useful for diagnostics.
app.get('/queue-status', (req, res) => {
  res.json({
    queued: pendingJobCount,
    processing: pendingJobCount > 0,
  });
});

// Switches the active printer. Validates the name against the detected list.
app.post('/set-printer', (req, res) => {
  const { printerName: requested } = req.body;
  if (!requested) {
    return res.status(400).json({ success: false, error: 'Missing printerName' });
  }

  detectPrinters();

  if (!printerExists(requested)) {
    return res.status(404).json({
      success: false,
      error: `Printer "${requested}" not found`,
      available: availablePrinters.map(p => p.name),
    });
  }

  activePrinterName = requested;
  isConnected = true;
  console.log(`🖨️ Active printer set to: ${activePrinterName}`);
  res.json({ success: true, printerName: activePrinterName });
});

app.post('/print', (req, res) => {
  const { order, token, printerName: requestedPrinter } = req.body;

  if (!order || !token) {
    return res.status(400).json({ success: false, error: 'Missing order or token' });
  }

  const text = formatReceiptText(order, token);
  console.log('\n📄 RECEIPT #' + token + ':');
  console.log(text);

  if (!isConnected || !activePrinterName) {
    return res.json({
      success: true,
      printed: false,
      message: 'No printer — receipt logged to console',
      receipt: text,
    });
  }

  // Validate explicit printer; fall back to active printer if unknown.
  let targetPrinter = activePrinterName;
  if (requestedPrinter && requestedPrinter !== activePrinterName) {
    if (printerExists(requestedPrinter)) {
      targetPrinter = requestedPrinter;
    } else {
      console.warn(`⚠️ Printer "${requestedPrinter}" not found — using active: ${activePrinterName}`);
    }
  }

  // Respond immediately so the UI stays fast.
  // The physical print job runs inside the serial queue.
  const position = pendingJobCount;
  res.json({ success: true, printed: true, queued: true, position, printerName: targetPrinter });

  enqueuePrintJob(async () => {
    try {
      const rawData = formatReceiptRaw(order, token);
      await physicalPrint(rawData, token, targetPrinter);
      console.log(`🖨️ Printed #${token} → ${targetPrinter}`);
    } catch (err) {
      console.error(`❌ Print failed #${token}:`, err.message);

      // Retry once on the active printer if a specific printer was requested and failed.
      if (targetPrinter !== activePrinterName) {
        try {
          console.log(`🔁 Retrying #${token} on fallback: ${activePrinterName}`);
          const rawData = formatReceiptRaw(order, token);
          await physicalPrint(rawData, token, activePrinterName);
          console.log(`✅ Fallback print succeeded #${token}`);
        } catch (retryErr) {
          console.error(`❌ Fallback print also failed #${token}:`, retryErr.message);
        }
      }
    }

    // Hardware safety delay — thermal printer buffer needs to fully drain
    // before the next ESC/POS job starts, otherwise initial bytes get corrupted.
    await new Promise(r => setTimeout(r, PHYSICAL_PRINT_DELAY_MS));
  });
});

app.post('/print-report', (req, res) => {
  const reportData = req.body;

  if (!reportData || !reportData.summary) {
    return res.status(400).json({ success: false, error: 'Missing report data' });
  }

  const token = `RPT-${Date.now()}`;
  const text = formatReportText(reportData);
  console.log('\n📊 REPORT:');
  console.log(text);

  if (!isConnected || !activePrinterName) {
    return res.json({
      success: true,
      printed: false,
      message: 'No printer — report logged to console',
      report: text,
    });
  }

  res.json({ success: true, printed: true, queued: true });

  enqueuePrintJob(async () => {
    try {
      const rawData = formatReportRaw(reportData);
      await physicalPrint(rawData, token, activePrinterName);
      console.log(`🖨️ Report printed → ${activePrinterName}`);
    } catch (err) {
      console.error('❌ Report print failed:', err.message);
    }
    await new Promise(r => setTimeout(r, PHYSICAL_PRINT_DELAY_MS));
  });
});

// ── START ──────────────────────────────────────────────────────────
function start() {
  console.log(`\n🖨️ BytePrinter v5.0.0 (${os.platform()})`);
  console.log('─'.repeat(48));

  detectPrinters();

  http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`\n🚀 HTTP  → http://localhost:${HTTP_PORT}`);
    console.log(`\n   GET  /status       → printer status + queue depth`);
    console.log(`   GET  /printers     → list all detected printers`);
    console.log(`   GET  /queue-status → live queue depth`);
    console.log(`   POST /print        → enqueue receipt print job`);
    console.log(`   POST /set-printer  → switch active printer`);
    console.log(`   POST /print-report → enqueue report print job`);

    if (isConnected) {
      console.log(`\n✅ Printer ready: ${activePrinterName}`);
      if (availablePrinters.length > 1) {
        console.log(`   Also available: ${availablePrinters.slice(1).map(p => p.name).join(', ')}`);
      }
    } else {
      console.log('\n💡 No printer detected — receipts print to console.');
    }

    console.log('─'.repeat(48) + '\n');
  });
}

start();

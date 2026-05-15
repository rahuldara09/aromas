/**
 * next-server.ts
 *
 * Runs the Next.js standalone server as a hidden background utility process.
 *
 * WHY utilityProcess.fork() instead of spawn():
 *   spawn(process.execPath, [script]) re-launches the Electron binary, which
 *   macOS registers as a new app instance → Dock icon + "exec" terminal window.
 *
 *   utilityProcess.fork() is Electron's purpose-built API for background
 *   Node.js workers: no Dock icon, no visible window, no extra app entry,
 *   fully managed by Electron's own process model.
 *
 * Dev:  Next.js dev server is already running on :3000 — just connect to it.
 * Prod: Fork the compiled standalone/server.js on a random free port.
 */

import { app, utilityProcess } from 'electron';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';

let serverProcess: Electron.UtilityProcess | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      server.close(() => {
        if (addr && typeof addr === 'object') resolve(addr.port);
        else reject(new Error('Could not determine free port'));
      });
    });
  });
}

function waitForServer(port: number, timeoutMs = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const attempt = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, res => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };

    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Server did not respond within ${timeoutMs / 1000}s`));
      } else {
        setTimeout(attempt, 500);
      }
    };

    attempt();
  });
}

// ─── Minimal .env parser ──────────────────────────────────────────────────────
// Loads API keys (Firebase, Resend, Upstash) bundled as Contents/Resources/.env
// Without these, all vendor-auth API routes fail with "Network error".
function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    console.warn(`[next-server] ⚠️  No env file at ${filePath} — API routes may fail`);
    return {};
  }

  const vars: Record<string, string> = {};
  for (const raw of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.substring(0, eq).trim();
    let val = line.substring(eq + 1).trim();
    if (val.length >= 2 &&
        ((val.startsWith('"') && val.endsWith('"')) ||
         (val.startsWith("'") && val.endsWith("'")))) {
      val = val.slice(1, -1);
    }
    if (key) vars[key] = val;
  }

  console.log(`[next-server] ✅ Loaded ${Object.keys(vars).length} env vars`);
  return vars;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function startNextServer(): Promise<number> {
  // ── Development ─────────────────────────────────────────────────────────────
  if (!app.isPackaged) {
    console.log('[next-server] Dev — connecting to Next.js dev server on :3000');
    await waitForServer(3000, 30_000).catch(() => {
      console.warn('[next-server] ⚠️  Run `npm run dev` first');
    });
    return 3000;
  }

  // ── Production ───────────────────────────────────────────────────────────────
  const port = await findFreePort();

  // asarUnpack puts .next/standalone at a real filesystem path:
  //   app.getAppPath()         → ...Resources/app.asar  (virtual)
  //   path.dirname(appAsar)    → ...Resources/
  //   + app.asar.unpacked/...  → real directory on disk
  const appAsar = app.getAppPath();
  const standaloneDir = path.join(
    path.dirname(appAsar),
    'app.asar.unpacked',
    '.next',
    'standalone',
  );
  const serverScript = path.join(standaloneDir, 'server.js');

  console.log('[next-server] standaloneDir :', standaloneDir);
  console.log('[next-server] serverScript  :', serverScript);
  console.log('[next-server] port          :', port);

  if (!fs.existsSync(serverScript)) {
    throw new Error(
      `server.js not found at:\n  ${serverScript}\n` +
      `Run "npm run build && npm run electron:prepare" before packaging.`,
    );
  }

  // Load bundled API keys — Firebase Admin, Resend, Upstash
  const bundledEnv = loadEnvFile(path.join(process.resourcesPath, '.env'));

  // ── utilityProcess.fork() ────────────────────────────────────────────────
  // Electron's proper API for background Node.js processes:
  //   ✓ No Dock icon on macOS
  //   ✓ No "exec" terminal window
  //   ✓ No visible app entry in Windows Task Manager
  //   ✓ Fully managed lifecycle (killed automatically when Electron quits)
  //   ✓ No ELECTRON_RUN_AS_NODE hack needed
  serverProcess = utilityProcess.fork(serverScript, [], {
    cwd: standaloneDir,
    stdio: 'ignore',          // completely silent — no pipes, no visible output
    serviceName: 'ByteBusiness POS Server',   // shown in Activity Monitor / Task Manager
    env: {
      ...process.env,
      ...bundledEnv,
      ELECTRON_APP: '1',      // tells Next.js middleware: vendor-only mode
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
  });

  serverProcess.on('spawn', () => {
    console.log('[next-server] ✅ Utility process spawned');
  });

  serverProcess.on('exit', code => {
    if (code !== 0) {
      console.error(`[next-server] ❌ Server exited with code ${code}`);
    }
    serverProcess = null;
  });

  await waitForServer(port);
  console.log(`[next-server] ✅ Ready at http://127.0.0.1:${port}`);
  return port;
}

export function stopNextServer(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

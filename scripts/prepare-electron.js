/**
 * prepare-electron.js
 *
 * Runs after `next build` and before electron-builder.
 * Next.js standalone output does NOT automatically include:
 *   - .next/static  (CSS, JS chunks, fonts)
 *   - public/       (logos, images, manifest)
 *
 * This script copies both into the standalone directory so the bundled
 * Electron app can serve them correctly.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STANDALONE = path.join(ROOT, '.next', 'standalone');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠️  Source not found — skipping: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('\n🔧 Preparing Electron build...');
console.log(`   Standalone: ${STANDALONE}`);

// Warn if .env.local is missing — API routes will fail at runtime without it
const envFile = path.join(ROOT, '.env.local');
if (!fs.existsSync(envFile)) {
  console.error('❌ .env.local not found — API routes (Firebase, Resend, Upstash) will fail in the packaged app.');
  console.error('   Create .env.local with your production keys before packaging.');
  process.exit(1);
} else {
  console.log('   ✅ .env.local found — will be bundled as app resource.');
}

if (!fs.existsSync(STANDALONE)) {
  console.error('❌ .next/standalone not found — run `npm run build` first.');
  process.exit(1);
}

// Copy static chunks
const staticSrc  = path.join(ROOT, '.next', 'static');
const staticDest = path.join(STANDALONE, '.next', 'static');
console.log('   Copying .next/static...');
copyDir(staticSrc, staticDest);

// Copy public folder
const publicSrc  = path.join(ROOT, 'public');
const publicDest = path.join(STANDALONE, 'public');
console.log('   Copying public/...');
copyDir(publicSrc, publicDest);

console.log('✅ Electron build prepared.\n');

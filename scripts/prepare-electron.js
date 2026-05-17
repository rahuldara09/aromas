/**
 * prepare-electron.js
 *
 * Copies required Next.js assets into standalone build
 * and removes broken standalone junction/symlink folders
 * that break electron-builder on Windows.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const STANDALONE = path.join(ROOT, ".next", "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Source not found: ${src}`);
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanupBrokenStandalone(dir) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    try {
      const stat = fs.lstatSync(fullPath);

      // Remove symlinks/junctions
      if (stat.isSymbolicLink()) {
        console.log(`Removing symlink: ${fullPath}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
        continue;
      }

      // Remove broken hashed folders
      const isBrokenHashFolder =
        entry.name.match(/-[a-f0-9]{8,}$/) &&
        (
          entry.name.includes("firebase-admin") ||
          entry.name.includes("rimraf") ||
          entry.name.includes("next")
        );

      if (isBrokenHashFolder) {
        console.log(`Removing broken hash folder: ${fullPath}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
        continue;
      }

      if (stat.isDirectory()) {
        cleanupBrokenStandalone(fullPath);
      }
    } catch (err) {
      console.log(`Skipping problematic path: ${fullPath}`);
    }
  }
}

console.log("\n🔧 Preparing Electron build...");
console.log(`Standalone: ${STANDALONE}`);

if (!fs.existsSync(STANDALONE)) {
  console.error("❌ .next/standalone not found.");
  process.exit(1);
}

// Copy static assets
copyDir(
  path.join(ROOT, ".next", "static"),
  path.join(STANDALONE, ".next", "static")
);

// Copy public folder
copyDir(
  path.join(ROOT, "public"),
  path.join(STANDALONE, "public")
);

// Cleanup broken standalone folders
cleanupBrokenStandalone(STANDALONE);

// ── Fix Turbopack hashed external module IDs ─────────────────────────────────
// Next.js 16 uses Turbopack which renames external packages with a content hash
// e.g. "firebase-admin-a14c8a5423a75469/app" instead of "firebase-admin/app".
// The standalone server's require() cannot find these hashed names, so we
// create stub packages that forward each hashed name to the real package.
fixTurbopackExternals();

console.log("✅ Electron build prepared.\n");

function fixTurbopackExternals() {
  const chunksDir = path.join(STANDALONE, ".next", "server", "chunks");
  if (!fs.existsSync(chunksDir)) return;

  // Find the turbopack runtime file
  const runtimeFile = fs.readdirSync(chunksDir)
    .find(f => f.startsWith("[turbopack]_runtime"));
  if (!runtimeFile) {
    console.log("ℹ  No Turbopack runtime found — skipping external stub fix");
    return;
  }

  const runtime = fs.readFileSync(path.join(chunksDir, runtimeFile), "utf-8");
  const nodeModulesDir = path.join(STANDALONE, "node_modules");
  const created = new Set();

  // Match: "packageName-{16hexchars}" and optionally "/subpath"
  // Handles both plain packages (firebase-admin) and scoped (@google-cloud/firestore)
  const re = /"((?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*)-([a-f0-9]{16})(\/[^"]*)?"(?!:)/g;

  let match;
  while ((match = re.exec(runtime)) !== null) {
    const pkgName = match[1];
    const hash = match[2];
    const subpath = match[3] || null; // strip leading /
    const hashedId = `${pkgName}-${hash}`;
    console.log(
      '[next-server] MATCH:',
      pkgName,
      hash,
      subpath
    );

    // Only stub if the real package is present in standalone node_modules
    if (!fs.existsSync(path.join(nodeModulesDir, pkgName))) continue;

    const stubDir = path.join(nodeModulesDir, hashedId);

    if (!created.has(hashedId)) {
      created.add(hashedId);
      if (!fs.existsSync(stubDir)) {
        fs.mkdirSync(stubDir, { recursive: true });

        fs.writeFileSync(path.join(stubDir, "package.json"), JSON.stringify({
          name: hashedId, version: "1.0.0", main: "index.js"
        }));

        fs.writeFileSync(
          path.join(stubDir, "index.js"),
          `module.exports = require(${JSON.stringify(pkgName)});\n`
        );

        console.log(`  Turbopack stub: ${hashedId}  →  ${pkgName}`);
      }
    }

    // Create sub-path stub  e.g. firebase-admin-{hash}/app.js → firebase-admin/app
    if (subpath) {
      const stubFile = path.join(stubDir, subpath + ".js");
      if (!fs.existsSync(stubFile)) {
        const dir = path.dirname(stubFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          stubFile,
          `module.exports = require(${JSON.stringify(pkgName + "/" + subpath)});\n`
        );
      }
    }
  }

  if (created.size > 0) {
    console.log(`✅ Created ${created.size} Turbopack external stub(s)`);
  }
}
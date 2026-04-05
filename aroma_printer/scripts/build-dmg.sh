#!/bin/bash

# Configuration
APP_NAME="AromaPrinter"
BINARY_NAME="aroma-print-server-macos"
DIST_DIR="./dist"
APP_DIR="${DIST_DIR}/${APP_NAME}.app"
DOWNLOADS_DIR="../public/downloads"

echo "🚀 Starting DMG build process..."

# 1. Clean previous builds
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# 2. Build Binary using pkg
echo "📦 Building macos binary..."
npx pkg . --targets node18-macos-x64 --output "${DIST_DIR}/${BINARY_NAME}"

# 3. Create .app structure (minimal)
echo "📂 Creating .app structure..."
mkdir -p "${APP_DIR}/Contents/MacOS"
mv "${DIST_DIR}/${BINARY_NAME}" "${APP_DIR}/Contents/MacOS/${APP_NAME}"

# 4. Create Info.plist (optional but good for macOS)
cat <<EOF > "${APP_DIR}/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>com.aroma.printer</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>
EOF

# 5. Create DMG
echo "💿 Creating Disk Image (.dmg)..."
mkdir -p "${DOWNLOADS_DIR}"
rm -f "${DOWNLOADS_DIR}/aroma-printer.dmg"

hdiutil create -volname "${APP_NAME}" -srcfolder "${DIST_DIR}" -ov -format UDZO "${DOWNLOADS_DIR}/aroma-printer.dmg"

echo "✅ DMG created successfully at ${DOWNLOADS_DIR}/aroma-printer.dmg"

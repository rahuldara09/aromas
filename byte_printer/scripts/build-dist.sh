#!/bin/bash

# Configuration
APP_NAME="BytePrinter"
MAC_BINARY="byte-printer-macos"
WIN_BINARY="byte-printer-win.exe"
DIST_DIR="./dist"
APP_DIR="${DIST_DIR}/${APP_NAME}.app"
DOWNLOADS_DIR="../public/downloads"

echo "🚀 Starting Universal Distribution Build..."

# 0. Clean previous builds
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"
mkdir -p "${DOWNLOADS_DIR}"

# 1. Build macOS Binary & DMG
echo "🍎 Building macOS Package..."
npx pkg . --targets node18-macos-x64 --output "${DIST_DIR}/${MAC_BINARY}"

# Create .app structure
mkdir -p "${APP_DIR}/Contents/MacOS"
mv "${DIST_DIR}/${MAC_BINARY}" "${APP_DIR}/Contents/MacOS/${APP_NAME}"
chmod +x "${APP_DIR}/Contents/MacOS/${APP_NAME}"

# Create Info.plist
cat <<EOF > "${APP_DIR}/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>com.byte.printer</string>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleVersion</key>
    <string>4.1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>
EOF

# Create DMG
rm -f "${DOWNLOADS_DIR}/byte_printer_mac.dmg"
hdiutil create -volname "${APP_NAME}" -srcfolder "${DIST_DIR}" -ov -format UDZO "${DOWNLOADS_DIR}/byte_printer_mac.dmg"

# Create Mac ZIP (Alternative)
echo "📦 Creating macOS ZIP (Alternative)..."
rm -f "${DOWNLOADS_DIR}/byte_printer_mac.zip"
zip -r "${DOWNLOADS_DIR}/byte_printer_mac.zip" "${APP_DIR}"

# 2. Build Windows Binary & ZIP
echo "🪟 Building Windows Package..."
npx pkg . --targets node18-win-x64 --output "${DIST_DIR}/${WIN_BINARY}"
rm -f "${DOWNLOADS_DIR}/byte_printer_win.zip"
zip -j "${DOWNLOADS_DIR}/byte_printer_win.zip" "${DIST_DIR}/${WIN_BINARY}"

# 3. Build Core (Source Code) ZIP
echo "📦 Packaging Core Source Code..."
rm -f "${DOWNLOADS_DIR}/byte_printer.zip"
zip -r "${DOWNLOADS_DIR}/byte_printer.zip" . -x "**/node_modules/*" "**/dist/*" "**/scripts/*" "**/.git/*"

echo "✅ Universal Distribution Complete!"
echo "📍 Mac: ${DOWNLOADS_DIR}/byte_printer_mac.dmg"
echo "📍 Win: ${DOWNLOADS_DIR}/byte_printer_win.zip"
echo "📍 Core: ${DOWNLOADS_DIR}/byte_printer.zip"

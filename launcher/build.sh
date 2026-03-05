#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="EssayBuddy"
BINARY_NAME="EssayBuddy"
BUNDLE="$SCRIPT_DIR/dist/$APP_NAME.app"

echo "-> Cleaning previous build..."
rm -rf "$SCRIPT_DIR/dist"
mkdir -p "$BUNDLE/Contents/MacOS"
mkdir -p "$BUNDLE/Contents/Resources"

# -- Compile (universal binary) ------------------------------------------------
echo "-> Compiling Swift (arm64)..."
swiftc \
    -target arm64-apple-macosx12.0 \
    -framework Cocoa \
    -framework WebKit \
    -O \
    "$SCRIPT_DIR/EssayBuddy.swift" \
    -o "$SCRIPT_DIR/EssayBuddy-arm64"

echo "-> Compiling Swift (x86_64)..."
swiftc \
    -target x86_64-apple-macosx12.0 \
    -framework Cocoa \
    -framework WebKit \
    -O \
    "$SCRIPT_DIR/EssayBuddy.swift" \
    -o "$SCRIPT_DIR/EssayBuddy-x86_64"

echo "-> Creating universal binary..."
lipo -create \
    "$SCRIPT_DIR/EssayBuddy-arm64" \
    "$SCRIPT_DIR/EssayBuddy-x86_64" \
    -output "$BUNDLE/Contents/MacOS/$BINARY_NAME"

rm -f "$SCRIPT_DIR/EssayBuddy-arm64" "$SCRIPT_DIR/EssayBuddy-x86_64"

# -- Bundle --------------------------------------------------------------------
echo "-> Assembling bundle..."
cp "$SCRIPT_DIR/Info.plist" "$BUNDLE/Contents/"
cp "$SCRIPT_DIR/AppIcon.icns" "$BUNDLE/Contents/Resources/"

# -- DMG ----------------------------------------------------------------------
echo "-> Creating DMG..."
STAGING="$SCRIPT_DIR/dmg-staging"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -r "$BUNDLE" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$STAGING" \
    -ov -format UDZO \
    "$SCRIPT_DIR/dist/$APP_NAME.dmg" \
    > /dev/null

rm -rf "$STAGING"

echo ""
echo "Done: $SCRIPT_DIR/dist/$APP_NAME.dmg"
echo "  Open the DMG and drag '$APP_NAME' to /Applications"

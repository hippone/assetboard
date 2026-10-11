#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h:h}"
app_dir="$project_dir/dist/Assetboard.app"
mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources/Board"
xcrun swiftc "$project_dir/desktop/Assetboard.swift" "$project_dir/desktop/CloudflareInventory.swift" "$project_dir/desktop/LocalDatabase.swift" "$project_dir/desktop/OCRImporter.swift" "$project_dir/desktop/AIRecognizer.swift" "$project_dir/desktop/IconFetcher.swift" "$project_dir/desktop/LocalCLI.swift" -o "$app_dir/Contents/MacOS/Assetboard" -framework Cocoa -framework WebKit -framework PDFKit -framework Vision -lsqlite3 -O
cp "$project_dir/desktop/Info.plist" "$app_dir/Contents/Info.plist"
cp "$project_dir/index.html" "$project_dir/styles.css" "$project_dir/material.css" "$project_dir/app.js" "$app_dir/Contents/Resources/Board/"
cp "$project_dir/theme.js" "$project_dir/asset-data.js" "$project_dir/demo-data.js" "$project_dir/panorama.js" "$project_dir/panorama-view.js" "$app_dir/Contents/Resources/Board/"
cp "$project_dir/desktop/gmail_local.py" "$app_dir/Contents/Resources/Board/"
icon_src="$project_dir/desktop/icon-1024.png"
icon_dir="$project_dir/dist/AppIcon.iconset"
rm -rf "$icon_dir"
mkdir -p "$icon_dir"
# icon-1024.png is full-bleed with no baked shadow: macOS applies the mask and shadow (see desktop/icons.py, --legacy for the pre-masked variant).
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$icon_src" --out "$icon_dir/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$icon_src" --out "$icon_dir/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$icon_dir" -o "$app_dir/Contents/Resources/AppIcon.icns"
if [[ -n "${SIGNING_IDENTITY:-}" ]]; then
  codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$app_dir"
else
  codesign --force --sign - "$app_dir"
fi
codesign --verify --deep --strict "$app_dir"
"$app_dir/Contents/MacOS/Assetboard" --test-store
"$app_dir/Contents/MacOS/Assetboard" --test-cloudflare
"$app_dir/Contents/MacOS/Assetboard" --test-cloudflare-inventory
"$app_dir/Contents/MacOS/Assetboard" --test-github
"$app_dir/Contents/MacOS/Assetboard" --test-ocr
"$app_dir/Contents/MacOS/Assetboard" --test-icons
"$app_dir/Contents/MacOS/Assetboard" --test-local
"$app_dir/Contents/MacOS/Assetboard" --test-webview
"$app_dir/Contents/MacOS/Assetboard" --test-ai
printf '%s\n' "$app_dir"

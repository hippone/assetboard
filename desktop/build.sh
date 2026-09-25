#!/bin/zsh
set -euo pipefail
project_dir="${0:A:h:h}"
app_dir="$project_dir/dist/Assetboard.app"
mkdir -p "$app_dir/Contents/MacOS" "$app_dir/Contents/Resources/Board"
xcrun swiftc "$project_dir/desktop/Assetboard.swift" -o "$app_dir/Contents/MacOS/Assetboard" -framework Cocoa -framework WebKit -O
cp "$project_dir/desktop/Info.plist" "$app_dir/Contents/Info.plist"
cp "$project_dir/index.html" "$project_dir/styles.css" "$project_dir/material.css" "$project_dir/app.js" "$app_dir/Contents/Resources/Board/"
cp "$project_dir/theme.js" "$app_dir/Contents/Resources/Board/"
mkdir -p "$app_dir/Contents/Resources/Board/assets"
cp "$project_dir"/assets/*.png "$app_dir/Contents/Resources/Board/assets/"
"$app_dir/Contents/MacOS/Assetboard" --make-icon "$project_dir/dist/icon.png"
icon_dir="$project_dir/dist/AppIcon.iconset"
mkdir -p "$icon_dir"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$project_dir/dist/icon.png" --out "$icon_dir/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$project_dir/dist/icon.png" --out "$icon_dir/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$icon_dir" -o "$app_dir/Contents/Resources/AppIcon.icns"
codesign --force --sign - "$app_dir"
"$app_dir/Contents/MacOS/Assetboard" --test-store
printf '%s\n' "$app_dir"

#!/bin/zsh
set -euo pipefail

if [[ "${SIGNING_IDENTITY:-}" != 'Developer ID Application:'* ]]; then
  print -u2 'Set SIGNING_IDENTITY to your Developer ID Application certificate name.'
  exit 1
fi

project_dir="${0:A:h:h}"
"$project_dir/desktop/build.sh"

app_dir="$project_dir/dist/Assetboard.app"
archive_path="$project_dir/dist/Assetboard-macOS-arm64-0.1.0.zip"
codesign --verify --deep --strict --verbose=2 "$app_dir"
ditto -c -k --sequesterRsrc --keepParent "$app_dir" "$archive_path"
unzip -tq "$archive_path"
shasum -a 256 "$archive_path"
printf '%s\n' "$archive_path"

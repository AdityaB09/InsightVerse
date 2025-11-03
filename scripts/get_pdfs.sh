#!/usr/bin/env bash
set -euo pipefail

# Where to save PDFs (adjust if your project expects a different path)
OUT_DIR="data/pdfs"
mkdir -p "$OUT_DIR"

# Three public PDFs (swap these for your own if you prefer)
declare -A PDFS=(
  ["attention-is-all-you-need.pdf"]="https://arxiv.org/pdf/1706.03762.pdf"
  ["adam-optimization.pdf"]="https://arxiv.org/pdf/1412.6980.pdf"
  ["vgg-very-deep-cnn.pdf"]="https://arxiv.org/pdf/1409.1556.pdf"
)

echo "Downloading PDFs to $OUT_DIR ..."
for name in "${!PDFS[@]}"; do
  url="${PDFS[$name]}"
  echo " - $name"
  curl -L --fail --retry 3 --connect-timeout 10 "$url" -o "$OUT_DIR/$name"
done

echo "Download complete. Files:"
ls -lh "$OUT_DIR"

# Optional: quick integrity check (hashes)
echo
echo "SHA256 checksums:"
if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT_DIR"/*.pdf
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT_DIR"/*.pdf
else
  echo "No shasum/sha256sum found; skipping."
fi

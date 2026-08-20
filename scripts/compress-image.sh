#!/usr/bin/env bash

# Encodes a source PNG into the AVIF and WebP pair the site ships, writing both
# next to the input. Use it whenever an illustration in src/assets/images/ is
# updated and needs to be re-exported, e.g.:
#
#   scripts/compress-image.sh src/assets/images/macintosh.png
#
# The defaults are tuned for large, grainy illustrations with an alpha channel:
# they keep film grain and small legends intact rather than chasing the smallest
# file. AVIF is the preferred format, optimized for quality. WebP is a fallback
# for browsers without AVIF support and is kept nearer the size budget. Override
# either with `--avif-quality` / `--webp-quality`.

set -euo pipefail

declare -i AVIF_QUALITY=80
declare -i WEBP_QUALITY=90

usage() {
  command cat <<-USAGE
		Usage: scripts/compress-image.sh [options] <image.png>...

		Options:
		  --avif-quality <n>  AVIF quality, 0-100 (default: ${AVIF_QUALITY})
		  --webp-quality <n>  WebP quality, 0-100 (default: ${WEBP_QUALITY})
		  -h, --help          Show this message
	USAGE
}

declare -a inputs=()

while [[ $# -gt 0 ]]; do
  case "$1" in
  --avif-quality)
    AVIF_QUALITY="${2:?--avif-quality needs a value}"
    shift 2
    ;;
  --webp-quality)
    WEBP_QUALITY="${2:?--webp-quality needs a value}"
    shift 2
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  -*)
    echo "Unknown option: $1" >&2
    usage >&2
    exit 1
    ;;
  *)
    inputs+=("$1")
    shift
    ;;
  esac
done

if [[ ${#inputs[@]} -eq 0 ]]; then
  usage >&2
  exit 1
fi

for tool in magick cwebp; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Missing ${tool}." >&2
    exit 1
  fi
done

size_of() {
  local bytes
  bytes=$(stat -f%z "$1" 2>/dev/null || stat -c%s "$1")
  awk -v bytes="${bytes}" 'BEGIN { printf "%.0f KB", bytes / 1024 }'
}

dissimilarity() {
  local score
  score=$(magick compare -metric DSSIM "$1" "$2" null: 2>&1 || true)
  [[ ${score} =~ \(([0-9.]+)\) ]] && echo "${BASH_REMATCH[1]}" || echo "?"
}

for input in "${inputs[@]}"; do
  if [[ ! -f ${input} ]]; then
    echo "No such file: ${input}" >&2
    exit 1
  fi

  avif="${input%.*}.avif"
  webp="${input%.*}.webp"

  magick "${input}" -quality "${AVIF_QUALITY}" "${avif}"

  # -sharp_yuv softens the chroma subsampling artifacts on fine detail, and
  # -alpha_q 100 keeps the cutout edge lossless.
  cwebp -q "${WEBP_QUALITY}" -m 6 -sharp_yuv -alpha_q 100 -metadata none "${input}" -o "${webp}" -quiet

  echo "${input} ($(size_of "${input}"))"
  echo "  -> ${avif}  $(size_of "${avif}")  q${AVIF_QUALITY}  dssim $(dissimilarity "${input}" "${avif}")"
  echo "  -> ${webp}  $(size_of "${webp}")  q${WEBP_QUALITY}  dssim $(dissimilarity "${input}" "${webp}")"
done

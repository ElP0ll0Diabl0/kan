#!/usr/bin/env bash
# Build the Kan Teams app package: template manifest.json with the real bot id +
# domain, then zip manifest.json + the two icons at the zip root.
#
# Usage:
#   MICROSOFT_BOT_ID=<app-client-id> KAN_DOMAIN=kan.c3industries.com ./build.sh
# or:
#   ./build.sh <MICROSOFT_BOT_ID> <KAN_DOMAIN>
#
# Output: teams/manifest/dist/kan-teams.zip  (upload via Teams admin center / sideload)
set -euo pipefail

cd "$(dirname "$0")"

BOT_ID="${1:-${MICROSOFT_BOT_ID:-}}"
DOMAIN="${2:-${KAN_DOMAIN:-}}"

if [[ -z "$BOT_ID" || -z "$DOMAIN" ]]; then
  echo "error: need MICROSOFT_BOT_ID and KAN_DOMAIN" >&2
  echo "usage: MICROSOFT_BOT_ID=<id> KAN_DOMAIN=<host> ./build.sh" >&2
  exit 1
fi

# Reject a scheme in the domain — Teams validDomains must be a bare host.
if [[ "$DOMAIN" == *"://"* ]]; then
  echo "error: KAN_DOMAIN must be a bare host (no https://), got: $DOMAIN" >&2
  exit 1
fi

# GUID sanity check on the bot id (8-4-4-4-12 hex).
if ! [[ "$BOT_ID" =~ ^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$ ]]; then
  echo "error: MICROSOFT_BOT_ID does not look like a GUID: $BOT_ID" >&2
  exit 1
fi

for icon in color.png outline.png; do
  if [[ ! -f "$icon" ]]; then
    echo "error: missing $icon — run ./gen-icons.py to create placeholders" >&2
    exit 1
  fi
done

# Validate icon dimensions if sips is available (macOS).
if command -v sips >/dev/null 2>&1; then
  check_dim() {
    local f="$1" want="$2"
    local w h
    w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')
    h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
    if [[ "$w" != "$want" || "$h" != "$want" ]]; then
      echo "warning: $f is ${w}x${h}, Teams expects ${want}x${want}" >&2
    fi
  }
  check_dim color.png 192
  check_dim outline.png 32
fi

mkdir -p dist
# Template the manifest (leave the source manifest.json with placeholders intact).
sed -e "s|\${{MICROSOFT_BOT_ID}}|$BOT_ID|g" \
    -e "s|\${{KAN_DOMAIN}}|$DOMAIN|g" \
    manifest.json > dist/manifest.json

# Fail loudly if any placeholder survived.
if grep -q '\${{' dist/manifest.json; then
  echo "error: unsubstituted placeholders remain in dist/manifest.json:" >&2
  grep -n '\${{' dist/manifest.json >&2
  exit 1
fi

# Validate JSON.
if command -v python3 >/dev/null 2>&1; then
  python3 -c "import json,sys; json.load(open('dist/manifest.json'))" \
    || { echo "error: dist/manifest.json is not valid JSON" >&2; exit 1; }
fi

# Zip the three files at the zip ROOT (Teams rejects nested dirs).
rm -f dist/kan-teams.zip
( cd dist && cp ../color.png ../outline.png . \
  && zip -q kan-teams.zip manifest.json color.png outline.png \
  && rm -f color.png outline.png )

echo "built dist/kan-teams.zip"
unzip -l dist/kan-teams.zip

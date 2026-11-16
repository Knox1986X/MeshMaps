#!/usr/bin/env bash
# Builds an OpenMapTiles-schema PMTiles archive for one region on YOUR computer.
# The app needs: vector tiles with layers transportation, building, water, landcover, poi
# (planetiler's default profile produces exactly that, incl. render_height for buildings).
#
# Usage:  tools/build-region.sh kurgan
# Needs:  Java 21+, ~8 GB RAM, ~10 GB disk, internet (Geofabrik + planetiler release on GitHub).
set -euo pipefail

REGION="${1:-kurgan}"
WORK="${WORK:-$(pwd)/data}"
mkdir -p "$WORK"

case "$REGION" in
  kurgan)
    OSM_NAME="ural-fed-district-latest.osm.pbf"           # Geofabrik: Уральский федеральный округ
    OSM_URL="https://download.geofabrik.de/russia/${OSM_NAME}"
    BOUNDS="61.7,54.0,68.9,57.0"                          # W,S,E,N — Курганская область
    ;;
  *)
    echo "Unknown region: $REGION (known: kurgan)" >&2
    exit 1
    ;;
esac

if [ ! -f "$WORK/planetiler.jar" ]; then
  curl -fL -o "$WORK/planetiler.jar" \
    "https://github.com/onthegomap/planetiler/releases/latest/download/planetiler.jar"
fi
if [ ! -f "$WORK/$OSM_NAME" ]; then
  curl -fL -o "$WORK/$OSM_NAME" "$OSM_URL"
fi

java -Xmx6g -jar "$WORK/planetiler.jar" \
  --osm-path="$WORK/$OSM_NAME" \
  --bounds="$BOUNDS" \
  --maxzoom=14 \
  --output="$WORK/$REGION.pmtiles" \
  --force

echo "Готово: $WORK/$REGION.pmtiles — импортируйте его в разделе «Регионы»."

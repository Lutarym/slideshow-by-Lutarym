#!/bin/bash
# Lutarym Slideshow Cleanup Script
# Prüft Dateinamen auf Verfallsdatum (DD.MM.YYYY.jpg) und verschiebt/löscht abgelaufene Bilder

BILDER_DIR="/media/Synology/slideshow/bilder"
ARCHIV_DIR="/media/Synology/slideshow/archiv"
ACTION="${1:-archive}"

TODAY=$(date +%Y%m%d)

mkdir -p "$ARCHIV_DIR"

for file in "$BILDER_DIR"/*.jpg "$BILDER_DIR"/*.JPG; do
  [ -f "$file" ] || continue

  filename=$(basename "$file")

  if [[ "$filename" =~ ([0-9]{2})\.([0-9]{2})\.([0-9]{4}) ]]; then
    day="${BASH_REMATCH[1]}"
    month="${BASH_REMATCH[2]}"
    year="${BASH_REMATCH[3]}"
    filedate="${year}${month}${day}"

    if [ "$filedate" -lt "$TODAY" ]; then
      if [ "$ACTION" = "delete" ]; then
        rm "$file"
      else
        mv "$file" "$ARCHIV_DIR/"
      fi
    fi
  fi
done

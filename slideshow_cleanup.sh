#!/bin/bash
# Lutarym Slideshow Cleanup
# Verschiebt oder loescht Bilder, deren Datum im Dateinamen (DD.MM.YYYY) abgelaufen ist.
# Aufruf: bash slideshow_cleanup.sh archive
#         bash slideshow_cleanup.sh delete

BILDER_DIR="/media/Synology/slideshow/bilder"
ARCHIV_DIR="/media/Synology/slideshow/archiv"
LOG="/config/slideshow_cleanup.log"

ACTION="${1:-archive}"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG"
}

if [ ! -d "$BILDER_DIR" ]; then
  log "FEHLER: Bildverzeichnis nicht gefunden: $BILDER_DIR"
  exit 1
fi

if [ "$ACTION" != "archive" ] && [ "$ACTION" != "delete" ]; then
  log "FEHLER: Ungueltige Aktion: $ACTION"
  exit 1
fi

if [ "$ACTION" = "archive" ]; then
  mkdir -p "$ARCHIV_DIR" || {
    log "FEHLER: Archivverzeichnis nicht anlegbar: $ARCHIV_DIR"
    exit 1
  }
fi

TODAY=$(date +%Y%m%d)
ANZAHL=0

# -maxdepth 1 damit Unterordner (z.B. das Archiv) nicht mitverarbeitet werden
while IFS= read -r -d '' file; do
  filename=$(basename "$file")

  if [[ ! "$filename" =~ ([0-9]{2})\.([0-9]{2})\.([0-9]{4}) ]]; then
    continue
  fi

  day="${BASH_REMATCH[1]}"
  month="${BASH_REMATCH[2]}"
  year="${BASH_REMATCH[3]}"

  # Datum auf Gueltigkeit pruefen, z.B. 31.02. aussortieren
  if ! date -d "${year}-${month}-${day}" >/dev/null 2>&1; then
    log "UEBERSPRUNGEN (ungueltiges Datum): $filename"
    continue
  fi

  filedate="${year}${month}${day}"

  if [ "$filedate" -ge "$TODAY" ]; then
    continue
  fi

  if [ "$ACTION" = "delete" ]; then
    if rm -- "$file"; then
      log "GELOESCHT: $filename"
      ANZAHL=$((ANZAHL + 1))
    else
      log "FEHLER beim Loeschen: $filename"
    fi
  else
    ziel="$ARCHIV_DIR/$filename"
    # Vorhandene Datei im Archiv nicht ueberschreiben
    if [ -e "$ziel" ]; then
      basis="${filename%.*}"
      endung="${filename##*.}"
      ziel="$ARCHIV_DIR/${basis}_$(date +%Y%m%d%H%M%S).${endung}"
    fi
    if mv -- "$file" "$ziel"; then
      log "ARCHIVIERT: $filename"
      ANZAHL=$((ANZAHL + 1))
    else
      log "FEHLER beim Verschieben: $filename"
    fi
  fi
done < <(find "$BILDER_DIR" -maxdepth 1 -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print0)

log "Durchlauf beendet, Aktion=$ACTION, verarbeitet=$ANZAHL"
exit 0

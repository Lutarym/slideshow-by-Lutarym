# Lutarym Slideshow Card

Lovelace Card für Bilderslideshows mit automatischem Verfallsdatum.

Bilder werden anhand des Dateinamens (DD.MM.YYYY.jpg) automatisch ausgeblendet und bei Bereinigung archiviert oder gelöscht.

## Voraussetzung

Die NAS-Freigabe muss in Home Assistant als Netzwerkspeicher (Media) eingebunden sein:

**Einstellungen → System → Speicher → Netzwerkspeicher hinzufügen**

## Installation

### HACS

1. HACS → Frontend → Custom Repositories
2. URL: `https://github.com/Lutarym/slideshow-by-Lutarym`
3. Kategorie: Lovelace
4. Installieren und HA neu starten

### Manuell

`lutarym-slideshow-card.js` nach `/config/www/` kopieren.

In `configuration.yaml`:
```yaml
frontend:
  extra_module_url:
    - /local/lutarym-slideshow-card.js
```

## Cleanup einrichten

### 1. Script kopieren

`slideshow_cleanup.sh` nach `/config/scripts/` kopieren.

Pfade im Script anpassen (BILDER_DIR und ARCHIV_DIR).

### 2. Shell Command in configuration.yaml

```yaml
shell_command:
  slideshow_cleanup_archive: "bash /config/scripts/slideshow_cleanup.sh archive"
  slideshow_cleanup_delete: "bash /config/scripts/slideshow_cleanup.sh delete"
```

### 3. Automation in configuration.yaml

```yaml
automation:
  - alias: "Slideshow Cleanup"
    id: slideshow_cleanup
    trigger:
      - platform: time
        at: "00:00:00"
    action:
      - service: shell_command.slideshow_cleanup_archive
```

HA neu starten.

## Card im Dashboard

Im Dashboard-Editor "Card hinzufügen" → Lutarym Slideshow.

Alle Einstellungen werden über die UI konfiguriert.

## Datumsformat

Dateinamen: `DD.MM.YYYY.jpg`

Beispiele: `26.08.2026.jpg`, `31.12.2025.jpg`

## Lizenz

MIT

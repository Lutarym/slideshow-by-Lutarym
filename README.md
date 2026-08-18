# Lutarym Slideshow Card

Lovelace Card für Slideshows mit Bildwechsel-Intervall und Bildverwaltung.

## Installation

### HACS (empfohlen)

1. HACS öffnen
2. Frontend → Custom Repositories
3. URL: `https://github.com/lutarym/lutarym-slideshow-card`
4. Kategorie: `Lovelace`
5. Installieren

### Manuell

```bash
mkdir -p /root/config/www/community/lutarym-slideshow
wget https://raw.githubusercontent.com/lutarym/lutarym-slideshow-card/main/dist/lutarym-slideshow-card.js -O /root/config/www/community/lutarym-slideshow/lutarym-slideshow-card.js
```

## Konfiguration

### configuration.yaml

```yaml
frontend:
  extra_module_url:
    - /local/community/lutarym-slideshow/lutarym-slideshow-card.js
```

### Dashboard

```yaml
type: custom:lutarym-slideshow-card
smb_host: srv-nas03
smb_share: Home Assistant
smb_user: !secret smb_user
smb_password: !secret smb_password
image_path: /slideshow/bilder/
archive_path: /slideshow/archiv/
interval_minutes: 5
action: archive
```

## Optionen

| Option | Type | Standard | Beschreibung |
|--------|------|----------|-------------|
| `smb_host` | string | - | NAS Hostname/IP |
| `smb_share` | string | - | SMB Share Name |
| `smb_user` | string | - | SMB Benutzer |
| `smb_password` | string | - | SMB Passwort |
| `image_path` | string | - | Bildverzeichnis |
| `archive_path` | string | - | Archivverzeichnis |
| `interval_minutes` | number | 5 | Bildwechsel in Minuten |
| `action` | string | archive | `archive` oder `delete` |

## Datumsformat

Bilder: `DD.MM.YYYY.jpg`

Beispiele:
- `26.08.2026.jpg` → Verfällt 26.08.2026
- `31.12.2025.jpg` → Verfällt 31.12.2025

Bilder mit Verfallsdatum in Zukunft: angezeigt
Bilder mit Verfallsdatum in Vergangenheit: bei Cleanup archiviert/gelöscht

## Lizenz

MIT

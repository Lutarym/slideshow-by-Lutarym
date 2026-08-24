# Lutarym Slideshow

Lovelace Card für Slideshows mit Bildwechsel-Intervall.

## Installation

### HACS

1. HACS öffnen → Frontend
2. Custom Repositories
3. URL: `https://github.com/lutarym/lutarym-slideshow`
4. Kategorie: `Lovelace`
5. Installieren

### Manuell

```bash
mkdir -p /root/config/www/lutarym-slideshow
wget https://raw.githubusercontent.com/lutarym/lutarym-slideshow/main/lutarym-slideshow-card.js -O /root/config/www/lutarym-slideshow/lutarym-slideshow-card.js
```

## Konfiguration

### configuration.yaml

```yaml
frontend:
  extra_module_url:
    - /local/lutarym-slideshow/lutarym-slideshow-card.js
```

### Dashboard

```yaml
type: custom:lutarym-slideshow-card
smb_path: \\192.168.10.10\ordner
image_path: bilder
archive_path: archiv
interval_minutes: 5
action: archive
```

## Optionen

| Option | Typ | Standard | Beschreibung |
|--------|-----|----------|-------------|
| `smb_path` | string | - | SMB-Pfad (z.B. `\\192.168.10.10\ordner`) |
| `image_path` | string | - | Bildverzeichnis |
| `archive_path` | string | - | Archivverzeichnis |
| `interval_minutes` | number | 5 | Bildwechsel in Minuten |
| `action` | string | archive | `archive` oder `delete` |

## Datumsformat

`DD.MM.YYYY.jpg`

Beispiele:
- `26.08.2026.jpg`
- `31.12.2025.jpg`

Lizenz: MIT

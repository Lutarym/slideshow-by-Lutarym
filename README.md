# Lutarym Slideshow

Eine Home Assistant Lovelace Card mit Custom Integration für Slideshows von SMB-Freigaben (z.B. Synology NAS) mit automatischer Bildverwaltung basierend auf Verfallsdaten im Dateinamen.

## Features

✅ Bildwechsel-Slideshow von SMB-Freigaben
✅ Bildwechsel-Intervall über UI konfigurierbar (in Minuten)
✅ Automatische Verwaltung abgelaufener Bilder (täglich um Mitternacht)
✅ Bilder archivieren oder löschen basierend auf Verfallsdatum im Dateinamen
✅ Manuelles Cleanup über Button
✅ UI-Umschalter zwischen Archivieren und Löschen
✅ Einfache Datumsformat-Erkennung (DD.MM.YYYY)

## Installation

### 1. Custom Integration installieren

SSH in dein HAOS-System:
```bash
ssh root@your-ha-ip
```

Verzeichnis erstellen:
```bash
mkdir -p /root/config/custom_components/lutarym_slideshow
```

Dateien kopieren:
- `lutarym_slideshow/__init__.py` → `/root/config/custom_components/lutarym_slideshow/__init__.py`
- `lutarym_slideshow/manifest.json` → `/root/config/custom_components/lutarym_slideshow/manifest.json`

### 2. Lovelace Card installieren

```bash
mkdir -p /root/config/www/community/lutarym-slideshow
```

Datei kopieren:
- `lutarym-slideshow-card.js` → `/root/config/www/community/lutarym-slideshow/lutarym-slideshow-card.js`

### 3. Frontend-Ressource registrieren

In `configuration.yaml`:
```yaml
frontend:
  extra_module_url:
    - /local/community/lutarym-slideshow/lutarym-slideshow-card.js
```

### 4. Home Assistant neu starten

Settings → System → System Restart

## Konfiguration

### secrets.yaml

Füge deine SMB-Credentials hinzu:
```yaml
smb_user: "dein_synology_benutzer"
smb_password: "dein_synology_passwort"
```

### Dashboard Card

Im Dashboard Editor, füge eine neue "Custom: Lutarym Slideshow" Card hinzu:

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

## Konfigurationsparameter

| Parameter | Beschreibung | Beispiel |
|-----------|-------------|---------|
| `smb_host` | Hostname/IP der Synology NAS | `srv-nas03` |
| `smb_share` | Name der SMB-Freigabe | `Home Assistant` |
| `smb_user` | SMB-Benutzer (aus secrets.yaml) | `!secret smb_user` |
| `smb_password` | SMB-Passwort (aus secrets.yaml) | `!secret smb_password` |
| `image_path` | Pfad zu den Bildern im Share | `/slideshow/bilder/` |
| `archive_path` | Pfad zum Archiv-Ordner | `/slideshow/archiv/` |
| `interval_minutes` | Wechselzeit in Minuten | `5` |
| `action` | `archive` oder `delete` | `archive` |

## Datumsformat

Bilder müssen folgendes Format im Namen haben:
```
DD.MM.YYYY.jpg
```

Beispiele:
- `26.08.2026.jpg` → Verfällt am 26.08.2026
- `31.12.2025.jpg` → Verfällt am 31.12.2025
- `screenshot_01.01.2027.jpg` → Funktioniert auch mit Präfix

**Bilder mit Verfallsdatum in der Zukunft:** Werden angezeigt
**Bilder mit Verfallsdatum in der Vergangenheit:** Werden bei Cleanup archiviert/gelöscht

## Automatische Bereinigung

Die Integration prüft täglich um **00:00 Uhr** auf abgelaufene Dateien.

Du kannst auch manuell über den Button "Jetzt bereinigen" in der Card eine Bereinigung auslösen.

## Dateistruktur auf der NAS

```
Home Assistant (Share)
├── slideshow/
│   ├── bilder/
│   │   ├── 26.08.2026.jpg
│   │   ├── 27.08.2026.jpg
│   │   ├── 28.08.2026.jpg
│   │   └── ...
│   └── archiv/
│       ├── 25.08.2026.jpg  (abgelaufene Bilder)
│       └── ...
```

## Troubleshooting

### "Fehler beim Laden: Connection refused"
- SMB-Host, Share-Name und Credentials überprüfen
- Firewall/Netzwerk-Einstellungen überprüfen
- NAS erreichbar? Ping-Test durchführen

### "Keine Bilder gefunden"
- `image_path` muss mit `/` beginnen und enden
- Dateinamen müssen das Format `DD.MM.YYYY.jpg` haben
- Überprüfe Groß-/Kleinschreibung bei Pfaden

### "smbclient not installed"
- Home Assistant Logs überprüfen
- Integration deinstallieren und neu installieren
- HAOS neu starten

### Bilder werden nicht angezeigt
- Browser-Cache leeren (Strg+F5)
- Auf SMB-Zugriff prüfen (Dateirechte, Netzwerk)
- Status-Meldung in der Card lesen

## Version

- **1.0.0** (2026)

## Lizenz

MIT

## Support

Für Fragen und Probleme: GitHub Issues

---

**Entwickler:** Lutarym

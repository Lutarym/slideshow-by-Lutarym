# Installationsanleitung - Lutarym Slideshow

## Schritt 1: Custom Integration installieren

### 1.1 SSH-Verbindung

Verbinde dich via SSH mit deinem HAOS-System:

```bash
ssh root@your-ha-ip
# oder mit Hostname:
ssh root@homeassistant.local
```

### 1.2 Verzeichnis erstellen

```bash
mkdir -p /root/config/custom_components/lutarym_slideshow
```

### 1.3 Dateien kopieren

Kopiere folgende Dateien in das Verzeichnis:

```bash
# Option A: Mit SCP (von deinem Computer)
scp lutarym_slideshow/__init__.py root@your-ha-ip:/root/config/custom_components/lutarym_slideshow/
scp lutarym_slideshow/manifest.json root@your-ha-ip:/root/config/custom_components/lutarym_slideshow/

# Option B: Mit Studio Code Server (HA Add-on)
# In HA: Settings → Apps → Studio Code Server
# Dann: File Explorer → config/custom_components/lutarym_slideshow/
# Neue Dateien erstellen und Code kopieren
```

### 1.4 Struktur überprüfen

Nach dem Kopieren sollte die Struktur so aussehen:

```
/root/config/
└── custom_components/
    └── lutarym_slideshow/
        ├── __init__.py
        └── manifest.json
```

## Schritt 2: Lovelace Card installieren

### 2.1 Verzeichnis erstellen

```bash
mkdir -p /root/config/www/community/lutarym-slideshow
```

### 2.2 Card-Datei kopieren

```bash
# Mit SCP:
scp lutarym-slideshow-card.js root@your-ha-ip:/root/config/www/community/lutarym-slideshow/

# Oder manuell in Studio Code Server kopieren:
# File Explorer → config/www/community/lutarym-slideshow/lutarym-slideshow-card.js
```

### 2.3 Struktur überprüfen

```
/root/config/
└── www/
    └── community/
        └── lutarym-slideshow/
            └── lutarym-slideshow-card.js
```

## Schritt 3: Frontend-Ressource registrieren

### Option A: Via configuration.yaml

Öffne `configuration.yaml` und füge hinzu:

```yaml
frontend:
  extra_module_url:
    - /local/community/lutarym-slideshow/lutarym-slideshow-card.js
```

### Option B: Via Studio Code Server

1. Settings → System → Studio Code Server
2. File Explorer → `config/configuration.yaml` öffnen
3. Eintrag hinzufügen (siehe Option A)

## Schritt 4: SMB-Credentials speichern

### secrets.yaml bearbeiten

1. Settings → System → Studio Code Server oder SSH
2. Datei: `config/secrets.yaml`
3. Folgende Zeilen hinzufügen:

```yaml
smb_user: "dein_synology_benutzer"
smb_password: "dein_synology_passwort"
```

**Wichtig:** Speichern!

## Schritt 5: Home Assistant neu starten

1. Settings → System → System Restart
2. Warten bis HA neu gestartet ist (2-3 Minuten)

## Schritt 6: Card im Dashboard hinzufügen

### 6.1 Dashboard öffnen

1. Wechsel zu deinem Dashboard
2. Klick auf "Edit Dashboard" (Stift-Symbol)

### 6.2 Card hinzufügen

1. Klick auf "Create Card"
2. Suchfeld: `custom:lutarym-slideshow-card`
3. Wähle "Custom: Lutarym Slideshow"

### 6.3 Konfiguration eingeben

Der Code-Editor sollte sich öffnen. Ersetze den Inhalt mit:

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

Passe folgende Werte an:
- `smb_host`: Deine Synology IP oder Hostname
- `smb_share`: Name deiner Freigabe
- `image_path`: Pfad zu deinen Bildern
- `archive_path`: Pfad zum Archiv-Ordner

### 6.4 Speichern

1. Klick auf "Save"
2. Dashboard-Bearbeitung beenden

## Schritt 7: NAS-Struktur vorbereiten

Stelle sicher, dass folgende Ordner auf deiner Synology NAS existieren:

```
Home Assistant (Share)
├── slideshow/
│   ├── bilder/     (hier kommen deine JPG-Bilder hin)
│   └── archiv/     (hier landen abgelaufene Bilder)
```

Falls nicht vorhanden, erstelle sie manuell auf der NAS.

## Schritt 8: Bilder hinzufügen

Kopiere deine Bilder mit dem richtigen Dateinamen in den `bilder/` Ordner:

```
26.08.2026.jpg
27.08.2026.jpg
31.12.2026.jpg
```

Das Datumsformat ist wichtig: **DD.MM.YYYY.jpg**

## Überprüfung

1. Öffne dein Dashboard
2. Die Slideshow-Card sollte sichtbar sein
3. Status zeigt: "X Bilder geladen"
4. Bilder sollten wechseln

Falls nicht:
- Browser-Cache leeren (Strg+F5)
- HA-Logs überprüfen (Settings → System → Logs)
- SMB-Verbindung testen

## Troubleshooting während Installation

### "custom_components Verzeichnis existiert nicht"
→ SSH-Befehl nochmal ausführen: `mkdir -p /root/config/custom_components/lutarym_slideshow`

### "Permissionen verweigert"
→ SSH mit `root` verbunden? Überprüfe: `whoami`

### "Card wird nicht angezeigt"
→ Hat HA neu gestartet? Überprüfe: Settings → System → Restart History

### "Card lädt Bilder nicht"
→ Überprüfe SMB-Credentials und Pfade
→ Logs: Settings → System → Logs → Filter: "lutarym_slideshow"

---

**Brauchst du Hilfe?** → README.md oder GitHub Issues

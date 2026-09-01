class LutarymSlideshowCard extends HTMLElement {
  setConfig(config) {
    const prev = this.config || {};
    this.config = config;

    this.intervalSeconds = parseInt(config.interval_seconds) > 0 ? parseInt(config.interval_seconds) : 30;
    this.archiveMode = config.action !== "delete";
    this.mediaPath = this._cleanPath(config.media_path || "");
    this.archivePath = this._cleanPath(config.archive_path || "");
    this.imageHeight = parseInt(config.image_height) > 0 ? parseInt(config.image_height) : 300;
    this.imageFit = config.image_fit || "contain";

    if (!this.images) {
      this.images = [];
      this.currentIndex = 0;
    }

    if (this._rendered) {
      if (prev.image_height !== config.image_height || prev.image_fit !== config.image_fit) {
        this._render();
        this._showImage();
      }
      if (prev.interval_seconds !== config.interval_seconds) {
        this._startSlideshow();
      }
      if (this._cleanPath(prev.media_path || "") !== this.mediaPath) {
        this._loadImages();
      }
    }
  }

  _cleanPath(path) {
    return String(path).trim().replace(/^\/+/, "").replace(/\/+$/, "");
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._rendered = true;
      this._render();
      this._loadImages();
      this._startReloadTimer();
    }
  }

  connectedCallback() {
    if (this._rendered && !this._timer && this.images && this.images.length > 1) {
      this._startSlideshow();
    }
    if (this._rendered && !this._reloadTimer) {
      this._startReloadTimer();
    }
  }

  disconnectedCallback() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    if (this._reloadTimer) {
      clearInterval(this._reloadTimer);
      this._reloadTimer = null;
    }
  }

  static getConfigElement() {
    return document.createElement("lutarym-slideshow-editor");
  }

  static getStubConfig() {
    return {
      media_path: "",
      archive_path: "",
      interval_seconds: 30,
      action: "archive",
      image_height: 300,
      image_fit: "contain"
    };
  }

  _render() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          overflow: hidden;
          padding: 0;
          position: relative;
        }
        .image-container {
          width: 100%;
          height: ${this.imageHeight}px;
          background: transparent;
          position: relative;
          overflow: hidden;
        }
        .image-container img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: ${this.imageFit};
          opacity: 0;
          transition: opacity 0.6s ease;
        }
        .image-container img.active {
          opacity: 1;
        }
        .hinweis {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 14px;
          color: var(--secondary-text-color, #888);
          text-align: center;
          padding: 0 16px;
        }
      </style>
      <ha-card>
        <div class="image-container" id="imageContainer">
          <div class="hinweis" id="hinweis">Lädt</div>
        </div>
      </ha-card>
    `;
  }

  _setHinweis(text) {
    const container = this.shadowRoot && this.shadowRoot.getElementById("imageContainer");
    if (!container) return;

    let el = container.querySelector(".hinweis");
    if (!text) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.className = "hinweis";
      container.appendChild(el);
    }
    el.textContent = text;
  }

  _istGueltigesDatum(tag, monat, jahr) {
    const d = new Date(jahr, monat - 1, tag);
    return d.getFullYear() === jahr && d.getMonth() === monat - 1 && d.getDate() === tag;
  }

  async _loadImages() {
    if (this._loading) return;
    if (!this.mediaPath) {
      this._setHinweis("Kein Bildverzeichnis konfiguriert");
      return;
    }
    if (!this._hass) return;

    this._loading = true;

    try {
      const mediaId = "media-source://media_source/local/" + this.mediaPath;

      const result = await this._hass.callWS({
        type: "media_source/browse_media",
        media_content_id: mediaId
      });

      if (!result || !result.children || result.children.length === 0) {
        this.images = [];
        this._stopSlideshow();
        this._setHinweis("Keine Bilder gefunden");
        return;
      }

      const heute = new Date();
      heute.setHours(0, 0, 0, 0);

      const kandidaten = [];

      for (const child of result.children) {
        const name = child.title ? String(child.title).toLowerCase() : "";
        if (!name.endsWith(".jpg") && !name.endsWith(".jpeg") && !name.endsWith(".png")) continue;

        const treffer = child.title.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!treffer) continue;

        const tag = parseInt(treffer[1], 10);
        const monat = parseInt(treffer[2], 10);
        const jahr = parseInt(treffer[3], 10);

        if (!this._istGueltigesDatum(tag, monat, jahr)) continue;

        const ablauf = new Date(jahr, monat - 1, tag);
        if (ablauf < heute) continue;

        kandidaten.push({ child: child, name: child.title, ablauf: ablauf });
      }

      const aufgeloest = await Promise.all(
        kandidaten.map(async (k) => {
          try {
            const res = await this._hass.callWS({
              type: "media_source/resolve_media",
              media_content_id: k.child.media_content_id
            });
            if (res && res.url) {
              return { name: k.name, url: res.url, ablauf: k.ablauf };
            }
          } catch (e) {
            return null;
          }
          return null;
        })
      );

      const gueltige = aufgeloest.filter((x) => x !== null);
      gueltige.sort((a, b) => a.name.localeCompare(b.name));

      const alterName = this.images[this.currentIndex] ? this.images[this.currentIndex].name : null;
      this.images = gueltige;

      if (this.images.length === 0) {
        this.currentIndex = 0;
        this._stopSlideshow();
        this._setHinweis("Keine gültigen Bilder");
        return;
      }

      const neuerIndex = alterName ? this.images.findIndex((x) => x.name === alterName) : -1;
      this.currentIndex = neuerIndex >= 0 ? neuerIndex : 0;

      this._setHinweis("");
      this._showImage();
      this._startSlideshow();
    } catch (error) {
      console.error("Lutarym Slideshow:", error);
      this._setHinweis("Fehler beim Laden");
    } finally {
      this._loading = false;
    }
  }

  _showImage() {
    const container = this.shadowRoot && this.shadowRoot.getElementById("imageContainer");
    if (!container || !this.images || this.images.length === 0) return;

    const aktuell = this.images[this.currentIndex];
    if (!aktuell) return;

    const img = document.createElement("img");
    img.alt = aktuell.name;

    img.addEventListener("error", () => {
      img.remove();
      if (!this._reloadNachFehler) {
        this._reloadNachFehler = true;
        this._loadImages().finally(() => {
          this._reloadNachFehler = false;
        });
      }
    });

    img.src = aktuell.url;
    container.appendChild(img);

    requestAnimationFrame(() => {
      const alte = container.querySelectorAll("img.active");
      alte.forEach((el) => el.classList.remove("active"));
      img.classList.add("active");
      this._setHinweis("");

      setTimeout(() => {
        const weg = container.querySelectorAll("img:not(.active)");
        weg.forEach((el) => el.remove());
      }, 800);
    });
  }

  _startSlideshow() {
    this._stopSlideshow();
    if (!this.images || this.images.length <= 1) return;

    this._timer = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.images.length;
      this._showImage();
    }, this.intervalSeconds * 1000);
  }

  _stopSlideshow() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _startReloadTimer() {
    if (this._reloadTimer) {
      clearInterval(this._reloadTimer);
    }
    this._reloadTimer = setInterval(() => {
      this._loadImages();
    }, 60 * 60 * 1000);
  }

  getCardSize() {
    return Math.ceil(this.imageHeight / 50);
  }
}


class LutarymSlideshowEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setHass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this.querySelector(".editor")) {
      this._render();
    }
  }

  _fireChanged() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config } }
    }));
  }

  _render() {
    this.innerHTML = `
      <style>
        .editor {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px 0;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .field label {
          font-weight: 500;
          font-size: 14px;
          color: var(--primary-text-color);
        }
        .field input,
        .field select {
          padding: 8px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 4px;
          font-size: 14px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
        }
        .field input:focus,
        .field select:focus {
          outline: none;
          border-color: var(--primary-color, #03a9f4);
        }
        .field .hint {
          font-size: 12px;
          color: var(--secondary-text-color, #666);
        }
      </style>
      <div class="editor">
        <div class="field">
          <label>SMB-Pfad</label>
          <input type="text" id="smb_path" value="${this._config.smb_path || ""}">
          <div class="hint">Nur zur Dokumentation, z.B. \\192.168.10.10\HomeAssistant</div>
        </div>
        <div class="field">
          <label>Bildverzeichnis (Media-Pfad)</label>
          <input type="text" id="media_path" value="${this._config.media_path || ""}">
          <div class="hint">z.B. Synology/slideshow/bilder</div>
        </div>
        <div class="field">
          <label>Archivverzeichnis</label>
          <input type="text" id="archive_path" value="${this._config.archive_path || ""}">
          <div class="hint">z.B. Synology/slideshow/archiv</div>
        </div>
        <div class="field">
          <label>Bildwechsel (Sekunden)</label>
          <input type="number" id="interval_seconds" min="1" max="3600" value="${this._config.interval_seconds || 30}">
        </div>
        <div class="field">
          <label>Bildhöhe (Pixel)</label>
          <input type="number" id="image_height" min="100" max="1000" value="${this._config.image_height || 300}">
        </div>
        <div class="field">
          <label>Bildskalierung</label>
          <select id="image_fit">
            <option value="contain" ${this._config.image_fit === "contain" ? "selected" : ""}>Einpassen (contain)</option>
            <option value="cover" ${this._config.image_fit === "cover" ? "selected" : ""}>Füllen (cover)</option>
            <option value="fill" ${this._config.image_fit === "fill" ? "selected" : ""}>Strecken (fill)</option>
            <option value="none" ${this._config.image_fit === "none" ? "selected" : ""}>Original (none)</option>
          </select>
        </div>
        <div class="field">
          <label>Abgelaufene Bilder</label>
          <select id="action">
            <option value="archive" ${this._config.action === "archive" ? "selected" : ""}>In Archiv verschieben</option>
            <option value="delete" ${this._config.action === "delete" ? "selected" : ""}>Löschen</option>
          </select>
        </div>
      </div>
    `;

    this.querySelector("#smb_path").addEventListener("change", (e) => {
      this._config.smb_path = e.target.value;
      this._fireChanged();
    });

    this.querySelector("#media_path").addEventListener("change", (e) => {
      this._config.media_path = e.target.value;
      this._fireChanged();
    });

    this.querySelector("#archive_path").addEventListener("change", (e) => {
      this._config.archive_path = e.target.value;
      this._fireChanged();
    });

    this.querySelector("#interval_seconds").addEventListener("change", (e) => {
      this._config.interval_seconds = parseInt(e.target.value) || 30;
      this._fireChanged();
    });

    this.querySelector("#image_height").addEventListener("change", (e) => {
      this._config.image_height = parseInt(e.target.value) || 300;
      this._fireChanged();
    });

    this.querySelector("#image_fit").addEventListener("change", (e) => {
      this._config.image_fit = e.target.value;
      this._fireChanged();
    });

    this.querySelector("#action").addEventListener("change", (e) => {
      this._config.action = e.target.value;
      this._fireChanged();
    });
  }
}

customElements.define("lutarym-slideshow-card", LutarymSlideshowCard);
customElements.define("lutarym-slideshow-editor", LutarymSlideshowEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lutarym-slideshow-card",
  name: "Lutarym Slideshow",
  description: "Slideshow Card mit Bildverwaltung und Verfallsdatum"
});

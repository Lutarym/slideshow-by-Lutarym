class LutarymSlideshowCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.images = [];
    this.currentIndex = 0;
    this.intervalMinutes = config.interval_minutes || 5;
    this.archiveMode = config.action !== "delete";
    this.mediaPath = config.media_path || "";
    this.archivePath = config.archive_path || "";
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this._rendered = true;
      this._render();
      this._loadImages();
    }
  }

  static getConfigElement() {
    return document.createElement("lutarym-slideshow-editor");
  }

  static getStubConfig() {
    return {
      media_path: "",
      archive_path: "",
      interval_minutes: 5,
      action: "archive"
    };
  }

  _render() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = "";
    } else {
      this.attachShadow({ mode: "open" });
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          padding: 16px;
          overflow: hidden;
        }
        .image-container {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          background: var(--secondary-background-color, #f0f0f0);
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .image-container img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0;
          transition: opacity 0.6s ease;
        }
        .image-container img.active {
          opacity: 1;
        }
        .no-images {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: var(--secondary-text-color, #999);
          font-size: 14px;
        }
        .controls {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 12px;
        }
        .control-group {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .control-group label {
          font-size: 13px;
          color: var(--primary-text-color);
          white-space: nowrap;
        }
        .control-group input[type="number"] {
          width: 60px;
          padding: 4px 6px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 4px;
          font-size: 13px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
        }
        .control-group select {
          padding: 4px 6px;
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 4px;
          font-size: 13px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
        }
        .btn {
          padding: 6px 14px;
          background: var(--primary-color, #03a9f4);
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }
        .btn:hover {
          opacity: 0.85;
        }
        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          color: var(--secondary-text-color, #666);
        }
        .status-bar .error {
          color: var(--error-color, #db4437);
        }
        .status-bar .success {
          color: var(--success-color, #43a047);
        }
      </style>

      <ha-card>
        <div class="image-container" id="imageContainer">
          <div class="no-images" id="placeholder">Keine Bilder</div>
        </div>

        <div class="controls">
          <div class="control-group">
            <label>Intervall (Min):</label>
            <input type="number" id="interval" min="1" max="120" value="${this.intervalMinutes}">
          </div>
          <div class="control-group">
            <label>Abgelaufen:</label>
            <select id="action">
              <option value="archive" ${this.archiveMode ? "selected" : ""}>Archiv</option>
              <option value="delete" ${!this.archiveMode ? "selected" : ""}>Löschen</option>
            </select>
          </div>
          <button class="btn" id="cleanupBtn">Bereinigen</button>
        </div>

        <div class="status-bar">
          <span id="statusText">Lädt...</span>
          <span id="imageInfo"></span>
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById("interval").addEventListener("change", (e) => {
      this.intervalMinutes = parseInt(e.target.value) || 5;
      this._restartSlideshow();
    });

    this.shadowRoot.getElementById("action").addEventListener("change", (e) => {
      this.archiveMode = e.target.value === "archive";
    });

    this.shadowRoot.getElementById("cleanupBtn").addEventListener("click", () => {
      this._performCleanup();
    });
  }

  async _loadImages() {
    this._setStatus("Lädt Bilder...");

    if (!this.mediaPath) {
      this._setStatus("Kein Media-Pfad konfiguriert", "error");
      return;
    }

    try {
      const mediaId = "media-source://media_source/local/" + this.mediaPath;

      const result = await this._hass.callWS({
        type: "media_source/browse_media",
        media_content_id: mediaId
      });

      if (!result || !result.children || result.children.length === 0) {
        this._setStatus("Keine Bilder gefunden", "error");
        this.images = [];
        this._updateDisplay();
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const validImages = [];

      for (const child of result.children) {
        if (!child.title || !child.title.toLowerCase().endsWith(".jpg")) continue;

        const dateMatch = child.title.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (!dateMatch) continue;

        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]);
        const year = parseInt(dateMatch[3]);

        try {
          const expiryDate = new Date(year, month - 1, day);
          if (expiryDate >= today) {
            const resolved = await this._hass.callWS({
              type: "media_source/resolve_media",
              media_content_id: child.media_content_id
            });

            if (resolved && resolved.url) {
              validImages.push({
                name: child.title,
                url: resolved.url,
                expiry: expiryDate
              });
            }
          }
        } catch (e) {
          // Ungültiges Datum, überspringen
        }
      }

      this.images = validImages;
      this.currentIndex = 0;
      this._updateDisplay();
      this._startSlideshow();
      this._setStatus(this.images.length + " Bilder geladen", "success");
    } catch (error) {
      this._setStatus("Fehler: " + error.message, "error");
    }
  }

  _startSlideshow() {
    if (this._timer) clearInterval(this._timer);

    if (this.images.length > 1) {
      this._timer = setInterval(() => {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this._updateDisplay();
      }, this.intervalMinutes * 60 * 1000);
    }
  }

  _restartSlideshow() {
    this._startSlideshow();
  }

  _updateDisplay() {
    const container = this.shadowRoot.getElementById("imageContainer");
    const info = this.shadowRoot.getElementById("imageInfo");

    if (this.images.length === 0) {
      container.innerHTML = '<div class="no-images">Keine Bilder verfügbar</div>';
      info.textContent = "";
      return;
    }

    const current = this.images[this.currentIndex];

    let img = container.querySelector("img.active");
    const newImg = document.createElement("img");
    newImg.src = current.url;
    newImg.alt = current.name;
    container.appendChild(newImg);

    requestAnimationFrame(() => {
      if (img) img.classList.remove("active");
      newImg.classList.add("active");

      setTimeout(() => {
        const oldImgs = container.querySelectorAll("img:not(.active)");
        oldImgs.forEach((el) => el.remove());
        const placeholder = container.querySelector(".no-images");
        if (placeholder) placeholder.remove();
      }, 700);
    });

    info.textContent = (this.currentIndex + 1) + " / " + this.images.length;
  }

  async _performCleanup() {
    const btn = this.shadowRoot.getElementById("cleanupBtn");
    btn.disabled = true;
    this._setStatus("Bereinigung läuft...");

    try {
      const serviceData = {
        action: this.archiveMode ? "archive" : "delete"
      };

      await this._hass.callService("automation", "trigger", {
        entity_id: "automation.slideshow_cleanup"
      });

      this._setStatus("Bereinigung abgeschlossen", "success");
      setTimeout(() => this._loadImages(), 2000);
    } catch (error) {
      this._setStatus("Fehler: " + error.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  _setStatus(text, type) {
    const el = this.shadowRoot.getElementById("statusText");
    el.textContent = text;
    el.className = type || "";
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  getCardSize() {
    return 4;
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
    this._render();
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
          <div class="hint">z.B. \\\\192.168.10.10\\HomeAssistant</div>
        </div>
        <div class="field">
          <label>Bildverzeichnis</label>
          <input type="text" id="media_path" value="${this._config.media_path || ""}">
          <div class="hint">Pfad in HA Media, z.B. Synology/slideshow/bilder</div>
        </div>
        <div class="field">
          <label>Archivverzeichnis</label>
          <input type="text" id="archive_path" value="${this._config.archive_path || ""}">
          <div class="hint">z.B. Synology/slideshow/archiv</div>
        </div>
        <div class="field">
          <label>Bildwechsel (Minuten)</label>
          <input type="number" id="interval_minutes" min="1" max="120" value="${this._config.interval_minutes || ""}">
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

    const fields = ["smb_path", "media_path", "archive_path", "interval_minutes", "action"];
    fields.forEach((field) => {
      const el = this.querySelector("#" + field);
      if (!el) return;

      const event = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(event, (e) => {
        let val = e.target.value;
        if (field === "interval_minutes") val = parseInt(val) || "";
        this._config = { ...this._config, [field]: val };
        this.dispatchEvent(new CustomEvent("config-changed", {
          detail: { config: this._config }
        }));
      });
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

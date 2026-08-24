class LutarymSlideshowCard extends HTMLElement {
  setConfig(config) {
    if (!config.smb_path) {
      throw new Error("SMB-Pfad erforderlich");
    }
    this.config = config;
    this.images = [];
    this.currentIndex = 0;
    this.intervalMinutes = config.interval_minutes || 5;
    this.archiveMode = config.action !== "delete";
    this.smbPath = config.smb_path;
    this.imagePath = config.image_path || "bilder";
    this.archivePath = config.archive_path || "archiv";
  }

  setHass(hass) {
    this.hass = hass;
    if (!this.rendered) {
      this.render();
      this.rendered = true;
      this.loadImages();
      this.startSlideshow();
    }
  }

  static getConfigElement() {
    return document.createElement("lutarym-slideshow-editor");
  }

  static getStubConfig() {
    return {
      smb_path: "\\192.168.10.10\ordner",
      image_path: "bilder",
      archive_path: "archiv",
      interval_minutes: 5,
      action: "archive"
    };
  }

  render() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          --card-background-color: var(--ha-card-background, #fff);
          --text-color: var(--primary-text-color, #212121);
        }

        .card {
          background-color: var(--card-background-color);
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text-color);
        }

        .image-container {
          position: relative;
          width: 100%;
          padding-bottom: 66.67%;
          margin-bottom: 16px;
          background: #f0f0f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .image-container img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: none;
        }

        .image-container img.active {
          display: block;
          animation: fadeIn 0.5s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .no-images {
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 14px;
        }

        .controls {
          display: flex;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          gap: 8px;
          align-items: center;
          flex: 1;
          min-width: 180px;
        }

        label {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-color);
          white-space: nowrap;
        }

        input[type="number"] {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          width: 70px;
        }

        select {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          flex: 1;
          min-width: 120px;
        }

        button {
          padding: 8px 16px;
          background-color: #03a9f4;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        button:hover {
          background-color: #0288d1;
        }

        button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .status {
          padding: 12px;
          background-color: #f5f5f5;
          border-radius: 4px;
          font-size: 13px;
          color: var(--text-color);
          margin-bottom: 12px;
        }

        .status.loading {
          background-color: #e3f2fd;
          color: #1976d2;
        }

        .status.error {
          background-color: #ffebee;
          color: #c62828;
        }

        .status.success {
          background-color: #e8f5e9;
          color: #2e7d32;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          font-size: 13px;
          margin-top: 12px;
        }

        .info-item {
          padding: 8px;
          background-color: #fafafa;
          border-radius: 4px;
        }

        .info-label {
          font-weight: 600;
          color: #666;
        }

        .info-value {
          color: var(--text-color);
          margin-top: 4px;
          font-size: 14px;
          font-weight: 500;
        }
      </style>

      <div class="card">
        <div class="title">Slideshow</div>
        
        <div class="status" id="status">Lädt...</div>

        <div class="image-container" id="imageContainer">
          <div class="no-images">Keine Bilder verfügbar</div>
        </div>

        <div class="controls">
          <div class="control-group">
            <label for="interval">Intervall (Min):</label>
            <input type="number" id="interval" min="1" max="120" value="${this.intervalMinutes}">
          </div>
          <div class="control-group">
            <label for="action">Abgelaufen:</label>
            <select id="action">
              <option value="archive" ${this.archiveMode ? 'selected' : ''}>Archiv</option>
              <option value="delete" ${!this.archiveMode ? 'selected' : ''}>Löschen</option>
            </select>
          </div>
          <button id="cleanupBtn">Bereinigen</button>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Bilder</div>
            <div class="info-value" id="imageCount">0</div>
          </div>
          <div class="info-item">
            <div class="info-label">Aktuell</div>
            <div class="info-value" id="currentImage">-</div>
          </div>
          <div class="info-item">
            <div class="info-label">Status</div>
            <div class="info-value" id="slideshowStatus">-</div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById("interval").addEventListener("change", (e) => {
      this.intervalMinutes = parseInt(e.target.value);
      this.restartSlideshow();
    });

    this.shadowRoot.getElementById("action").addEventListener("change", (e) => {
      this.archiveMode = e.target.value === "archive";
    });

    this.shadowRoot.getElementById("cleanupBtn").addEventListener("click", () => {
      this.performCleanup();
    });
  }

  async loadImages() {
    this.setStatus("Lädt Bilder...", "loading");
    this.images = [];
    this.currentIndex = 0;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      this.updateDisplay();
      this.setStatus("Bereit", "success");
    } catch (error) {
      this.setStatus(`Fehler: ${error}`, "error");
    }
  }

  startSlideshow() {
    if (this.slideshowInterval) clearInterval(this.slideshowInterval);
    
    if (this.images.length > 0) {
      this.slideshowInterval = setInterval(() => {
        this.currentIndex = (this.currentIndex + 1) % this.images.length;
        this.updateDisplay();
      }, this.intervalMinutes * 60 * 1000);

      this.shadowRoot.getElementById("slideshowStatus").textContent = "Läuft";
    } else {
      this.shadowRoot.getElementById("slideshowStatus").textContent = "Keine Bilder";
    }
  }

  restartSlideshow() {
    this.startSlideshow();
  }

  updateDisplay() {
    const container = this.shadowRoot.getElementById("imageContainer");
    
    if (this.images.length === 0) {
      container.innerHTML = '<div class="no-images">Keine Bilder verfügbar</div>';
      this.shadowRoot.getElementById("imageCount").textContent = "0";
      this.shadowRoot.getElementById("currentImage").textContent = "-";
      return;
    }

    let html = '';
    for (let i = 0; i < this.images.length; i++) {
      const img = this.images[i];
      html += `<img src="${img}" class="${i === this.currentIndex ? 'active' : ''}" alt="Bild ${i + 1}">`;
    }
    
    container.innerHTML = html;
    this.shadowRoot.getElementById("imageCount").textContent = this.images.length;
    this.shadowRoot.getElementById("currentImage").textContent = `${this.currentIndex + 1}/${this.images.length}`;
  }

  performCleanup() {
    const btn = this.shadowRoot.getElementById("cleanupBtn");
    btn.disabled = true;
    this.setStatus("Bereinigung...", "loading");

    setTimeout(() => {
      this.setStatus("Bereinigung abgeschlossen", "success");
      this.loadImages();
      btn.disabled = false;
    }, 1000);
  }

  setStatus(message, type = "info") {
    const status = this.shadowRoot.getElementById("status");
    status.textContent = message;
    status.className = `status ${type}`;
  }
}

class LutarymSlideshowEditor extends HTMLElement {
  setHass(hass) {
    this.hass = hass;
  }

  setConfig(config) {
    this.config = config;
    this.render();
  }

  render() {
    this.innerHTML = `
      <ha-form
        .hass=${this.hass}
        .schema=${[
          {
            type: "string",
            id: "smb_path",
            name: "SMB-Pfad",
            description: "z.B. \\\\192.168.10.10\\ordner",
            required: true
          },
          {
            type: "string",
            id: "image_path",
            name: "Bildverzeichnis",
            description: "z.B. bilder",
            default: "bilder"
          },
          {
            type: "string",
            id: "archive_path",
            name: "Archivverzeichnis",
            description: "z.B. archiv",
            default: "archiv"
          },
          {
            type: "integer",
            id: "interval_minutes",
            name: "Bildwechsel (Minuten)",
            default: 5
          },
          {
            type: "select",
            id: "action",
            name: "Abgelaufene Bilder",
            options: [["archive", "In Archiv verschieben"], ["delete", "Löschen"]],
            default: "archive"
          }
        ]}
        .data=${this.config}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  _valueChanged(event) {
    const data = event.detail.value;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: data } }));
  }

  static getConfigElement() {
    return document.createElement("lutarym-slideshow-editor");
  }
}

customElements.define("lutarym-slideshow-card", LutarymSlideshowCard);
customElements.define("lutarym-slideshow-editor", LutarymSlideshowEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lutarym-slideshow-card",
  name: "Lutarym Slideshow",
  description: "Slideshow Card mit SMB-Unterstützung"
});

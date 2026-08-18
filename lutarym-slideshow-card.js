class LutarymSlideshowCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.images = [];
    this.currentIndex = 0;
    this.intervalMinutes = config.interval_minutes || 5;
    this.archiveMode = config.action !== "delete";
    this.smbHost = config.smb_host;
    this.smbShare = config.smb_share;
    this.smbUser = config.smb_user;
    this.smbPassword = config.smb_password;
    this.imagePath = config.image_path;
    this.archivePath = config.archive_path;
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

  render() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          --card-background-color: var(--ha-card-background, #fff);
          --card-border-radius: 12px;
          --text-color: var(--primary-text-color, #212121);
        }

        .card {
          background-color: var(--card-background-color);
          border-radius: var(--card-border-radius);
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
          min-width: 200px;
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
          transition: background-color 0.2s;
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
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
        }
      </style>

      <div class="card">
        <div class="title">Slideshow</div>
        
        <div class="status" id="status">Lädt Bilder...</div>

        <div class="image-container" id="imageContainer">
          <div class="no-images">Keine Bilder gefunden</div>
        </div>

        <div class="controls">
          <div class="control-group">
            <label for="interval">Intervall (Min):</label>
            <input type="number" id="interval" min="1" max="120" value="${this.intervalMinutes}">
          </div>
          <div class="control-group">
            <label for="action">Abgelaufene Dateien:</label>
            <select id="action">
              <option value="archive" ${this.archiveMode ? 'selected' : ''}>In Archiv verschieben</option>
              <option value="delete" ${!this.archiveMode ? 'selected' : ''}>Löschen</option>
            </select>
          </div>
          <button id="cleanupBtn">Jetzt bereinigen</button>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Bilder</div>
            <div class="info-value" id="imageCount">0</div>
          </div>
          <div class="info-item">
            <div class="info-label">Aktuelles</div>
            <div class="info-value" id="currentImage">-</div>
          </div>
          <div class="info-item">
            <div class="info-label">Status</div>
            <div class="info-value" id="slideshowStatus">Gestoppt</div>
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
    try {
      const response = await fetch("/api/lutarym_slideshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list",
          smb_host: this.smbHost,
          smb_share: this.smbShare,
          smb_user: this.smbUser,
          smb_password: this.smbPassword,
          image_path: this.imagePath
        })
      });

      const result = await response.json();
      if (result.error) {
        this.setStatus(`Fehler: ${result.error}`, "error");
        return;
      }

      this.images = result.images;
      this.currentIndex = 0;
      this.updateDisplay();
      this.setStatus(`${this.images.length} Bilder geladen`, "success");
    } catch (error) {
      this.setStatus(`Fehler beim Laden: ${error.message}`, "error");
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
      container.innerHTML = '<div class="no-images">Keine Bilder gefunden</div>';
      this.shadowRoot.getElementById("imageCount").textContent = "0";
      this.shadowRoot.getElementById("currentImage").textContent = "-";
      return;
    }

    const currentImage = this.images[this.currentIndex];
    const imagePath = `//${this.smbHost}/${this.smbShare}${this.imagePath}${currentImage}`;

    let html = '';
    for (let i = 0; i < this.images.length; i++) {
      const img = this.images[i];
      const path = `file:///${this.smbHost}/${this.smbShare}${this.imagePath}${img}`;
      html += `<img src="${path}" class="${i === this.currentIndex ? 'active' : ''}" alt="Bild ${i + 1}">`;
    }
    container.innerHTML = html;

    this.shadowRoot.getElementById("imageCount").textContent = this.images.length;
    this.shadowRoot.getElementById("currentImage").textContent = `${this.currentIndex + 1}/${this.images.length}`;
  }

  async performCleanup() {
    const btn = this.shadowRoot.getElementById("cleanupBtn");
    btn.disabled = true;
    this.setStatus("Bereinigung läuft...", "loading");

    try {
      const response = await fetch("/api/lutarym_slideshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cleanup",
          smb_host: this.smbHost,
          smb_share: this.smbShare,
          smb_user: this.smbUser,
          smb_password: this.smbPassword,
          image_path: this.imagePath,
          archive_path: this.archivePath,
          archive_mode: this.archiveMode
        })
      });

      const result = await response.json();
      if (result.error) {
        this.setStatus(`Fehler: ${result.error}`, "error");
      } else {
        const action = this.archiveMode ? "verschoben" : "gelöscht";
        const msg = `${result.moved?.length || result.deleted?.length || 0} Dateien ${action}`;
        this.setStatus(msg, "success");
        await this.loadImages();
      }
    } catch (error) {
      this.setStatus(`Fehler: ${error.message}`, "error");
    } finally {
      btn.disabled = false;
    }
  }

  setStatus(message, type = "info") {
    const status = this.shadowRoot.getElementById("status");
    status.textContent = message;
    status.className = `status ${type}`;
  }

  static getStubConfig() {
    return {
      smb_host: "srv-nas03",
      smb_share: "Home Assistant",
      smb_user: "!secret smb_user",
      smb_password: "!secret smb_password",
      image_path: "/slideshow/bilder/",
      archive_path: "/slideshow/archiv/",
      interval_minutes: 5,
      action: "archive"
    };
  }

  static getConfigElement() {
    return document.createElement("lutarym-slideshow-card-editor");
  }
}

customElements.define("lutarym-slideshow-card", LutarymSlideshowCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "lutarym-slideshow-card",
  name: "Lutarym Slideshow",
  description: "Slideshow mit SMB-Bildverwaltung"
});

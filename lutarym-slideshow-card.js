class LutarymSlideshowCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.images = [];
    this.currentIndex = 0;
    this.intervalMinutes = config.interval_minutes || 5;
    this.archiveMode = config.action !== "delete";
    this.mediaPath = config.media_path || "";
    this.archivePath = config.archive_path || "";
    this.imageHeight = config.image_height || 300;
    this.imageFit = config.image_fit || "contain";
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
      action: "archive",
      image_height: 300,
      image_fit: "contain"
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
      </style>
      <ha-card>
        <div class="image-container" id="imageContainer"></div>
      </ha-card>
    `;
  }

  async _loadImages() {
    if (!this.mediaPath) return;

    try {
      const mediaId = "media-source://media_source/local/" + this.mediaPath;

      const result = await this._hass.callWS({
        type: "media_source/browse_media",
        media_content_id: mediaId
      });

      if (!result || !result.children || result.children.length === 0) {
        this.images = [];
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
          // Ungültiges Datum
        }
      }

      this.images = validImages;
      this.currentIndex = 0;
      if (this.images.length > 0) {
        this._showImage();
        this._startSlideshow();
      }
    } catch (error) {
      console.error("Lutarym Slideshow:", error);
    }
  }

  _showImage() {
    const container = this.shadowRoot.getElementById("imageContainer");
    if (!container || this.images.length === 0) return;

    const current = this.images[this.currentIndex];
    const newImg = document.createElement("img");
    newImg.src = current.url;
    newImg.alt = current.name;
    container.appendChild(newImg);

    requestAnimationFrame(() => {
      const oldImgs = container.querySelectorAll("img.active");
      oldImgs.forEach((el) => el.classList.remove("active"));
      newImg.classList.add("active");

      setTimeout(() => {
        const remove = container.querySelectorAll("img:not(.active)");
        remove.forEach((el) => el.remove());
      }, 700);
    });
  }

  _startSlideshow() {
    if (this._timer) clearInterval(this._timer);
    if (this.images.length <= 1) return;

    this._timer = setInterval(() => {
      this.currentIndex = (this.currentIndex + 1) % this.images.length;
      this._showImage();
    }, this.intervalMinutes * 60 * 1000);
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
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
          <div class="hint">z.B. \\192.168.10.10\HomeAssistant</div>
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
          <label>Bildwechsel (Minuten)</label>
          <input type="number" id="interval_minutes" min="1" max="120" value="${this._config.interval_minutes || ""}">
        </div>
        <div class="field">
          <label>Bildhöhe (Pixel)</label>
          <input type="number" id="image_height" min="100" max="1000" value="${this._config.image_height || ""}">
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

    const fields = ["smb_path", "media_path", "archive_path", "interval_minutes", "image_height", "image_fit", "action"];
    fields.forEach((field) => {
      const el = this.querySelector("#" + field);
      if (!el) return;
      const event = el.tagName === "SELECT" ? "change" : "input";
      el.addEventListener(event, (e) => {
        let val = e.target.value;
        if (field === "interval_minutes" || field === "image_height") val = parseInt(val) || "";
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

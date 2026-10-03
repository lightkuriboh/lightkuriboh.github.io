/**
 * Main Application Coordinator
 */

const PRESETS = [
  { id: 0, name: "Original", category: "Baseline", color: "#8E8E93", desc: "Unprocessed original photograph" },
  { id: 1, name: "Kodak Portra 400", category: "Film", color: "#E6AF78", desc: "Warm pastel skin tones, soft contrast, fine micro T-grain" },
  { id: 2, name: "Kodak Tri-X 400", category: "Film", color: "#CCCCCC", desc: "Classic photojournalism B&W, deep punchy blacks, gritty silver grain" },
  { id: 3, name: "Fujifilm Velvia 50", category: "Film", color: "#2ECC71", desc: "High-saturation nature slide, vivid emeralds, deep polarized skies" },
  { id: 4, name: "Fujifilm Provia 100F", category: "Film", color: "#5DADE2", desc: "Neutral commercial slide film, clean highlights, cool Nordic clarity" },
  { id: 5, name: "CineStill 800T", category: "Film", color: "#E74C3C", desc: "Tungsten cinema stock with lifted murky shadows & red highlight halation" },
  { id: 6, name: "Kodak Kodachrome 64", category: "Film", color: "#F39C12", desc: "National Geographic vintage warmth: rich reds and archival cyan shadows" },
  { id: 7, name: "Ilford HP5 Plus 400", category: "Film", color: "#BDC3C7", desc: "Smooth documentary B&W with wide latitude and organic medium grain" },
  { id: 8, name: "Kodak Ektachrome E100", category: "Film", color: "#3498DB", desc: "Radiant cerulean skies, crisp clean neutrals, modern slide pop" },
  { id: 9, name: "Polaroid 600", category: "Film", color: "#1ABC9C", desc: "Instant vintage nostalgia: lifted murky cyan-green shadows, creamy highlights" },
  { id: 10, name: "Agfa Vista 200", category: "Film", color: "#E67E22", desc: "Nostalgic consumer print film: cheerful warm reds, summer vacation pop" },
  { id: 11, name: "Kodak Gold 200", category: "Film", color: "#FFC000", desc: "Warm golden consumer print film, nostalgic amber highlights, vacation tones" },
  { id: 12, name: "Fujifilm Pro 400H", category: "Film", color: "#76D7C4", desc: "Airy pastel wedding look, cool mint-cyan shadows, luminous skin tones" },
  { id: 13, name: "Kodak Ektar 100", category: "Film", color: "#E74C3C", desc: "Ultra-vivid saturated landscape negative, razor-sharp micro-contrast & micro-grain" },
  { id: 14, name: "Kodak T-Max 400", category: "Film", color: "#7F8C8D", desc: "Ultra-sharp modern tabular B&W, velvety continuous tones, refined T-grain" },
  { id: 15, name: "CineStill 50D", category: "Film", color: "#3498DB", desc: "Fine-grain daylight cinema stock, clean radiant skies, subtle red halation" },
  { id: 16, name: "Lush Natural Green", category: "Effect", color: "#27AE60", desc: "Vibrant emerald foliage pop with selective skin-tone protection" },
  { id: 17, name: "Punchy Contrast", category: "Effect", color: "#8E44AD", desc: "HDR micro-contrast and dynamic range clarity without neon clipping" },
  { id: 18, name: "Golden Hour Glow", category: "Effect", color: "#F1C40F", desc: "Sun-kissed amber warmth, peach shadows, and dreamy sunset bloom" },
  { id: 19, name: "Cinematic Teal & Orange", category: "Effect", color: "#16A085", desc: "Hollywood blockbuster complementary grade: teal shadows & amber skin tones" },
  { id: 20, name: "Soft Dreamy Pastel", category: "Effect", color: "#FFB6C1", desc: "Romantic Orton bloom diffusion, lifted matte blacks, watercolor pastel palette" },
  { id: 21, name: "Cyberpunk Neon", category: "Effect", color: "#D902EE", desc: "Futuristic neon aesthetic: deep magenta-violet shadows & radiant cyan highlights" },
  { id: 22, name: "Dark Film Noir", category: "Effect", color: "#2C3E50", desc: "1940s dramatic black-and-white, inky crushed shadows, gritty silver grain & vignette" },
  { id: 23, name: "Vintage 70s Fade", category: "Effect", color: "#D4AC0D", desc: "Faded retro print: milky lifted blacks, warm mustard shadows, soft corner falloff" },
  { id: 24, name: "Fuji Sensia 100", category: "Film", color: "#007E33", desc: "Warm travel slide film, gentle contrast, luminous yellows and natural skin" },
  { id: 25, name: "Chrome Sensia 200", category: "Film", color: "#E65100", desc: "Golden outdoor slide film, punchy midtones, rich amber warm highlights" },
  { id: 26, name: "Fuji Astia 100F", category: "Film", color: "#7B1FA2", desc: "Ultra-soft portrait transparency, delicate pastels, porcelain skin tones" },
  { id: 27, name: "Fuji Superia 200", category: "Film", color: "#008542", desc: "Iconic Japanese daylight snapshot film, crisp emerald shadows and vivid sky blues" },
  { id: 28, name: "Fuji Superia 800", category: "Film", color: "#2E7D32", desc: "Gritty high-speed night snapshot negative, moody cyan shadows and energetic grain" },
  { id: 29, name: "Fuji Pro 160C", category: "Film", color: "#00796B", desc: "Commercial portrait negative with punchy contrast, crisp mint shadows and luminous skin" },
  { id: 30, name: "Fuji Eterna 250D", category: "Film", color: "#00695C", desc: "Hollywood cinema daylight stock, muted pastel colors, gentle contrast, creamy shadow roll-off" },
  { id: 31, name: "Fuji F-64D", category: "Film", color: "#00897B", desc: "Ultra-fine daylight cinema stock, razor-sharp sharpness and clean natural fidelity" },
  { id: 32, name: "Kodak Portra 160", category: "Film", color: "#FFC20E", desc: "Ultra-fine grain studio portrait negative, silky low-contrast pastels and warm skin tones" },
  { id: 33, name: "Kodak Portra 800 HC", category: "Film", color: "#FFB300", desc: "High-speed portrait negative, punchy golden hour contrast, textured grain and amber glow" },
  { id: 34, name: "Ektachrome E100VS", category: "Film", color: "#0D47A1", desc: "Vivid Saturation slide film, fiery reds, deep cobalt skies and aggressive contrast" },
  { id: 35, name: "Kodak Kodachrome 25", category: "Film", color: "#C62828", desc: "Legendary K-14 slide stock, razor sharpness, virtually grainless, rich archival reds and amber" },
  { id: 36, name: "Kodak ColorPlus 200", category: "Film", color: "#D32F2F", desc: "Nostalgic 90s budget negative, warm yellow-olive cast, lifted shadows and cozy grain" },
  { id: 37, name: "Kodak Elite Color 200", category: "Film", color: "#F57F17", desc: "Prosumer print film, vibrant Kodak warmth, clean punchy midtones and crisp details" },
  { id: 38, name: "Ilford Delta 400", category: "Film", color: "#37474F", desc: "Modern tabular crystal B&W, extreme sharpness, velvety midtones and refined grain" },
  { id: 39, name: "Agfa Color XR 200", category: "Film", color: "#BF360C", desc: "Vintage 80s European negative, earthy tones, moss-olive shadows and warm aged paper fade" },
  { id: 40, name: "Agfa Precisa 100", category: "Film", color: "#0277BD", desc: "European slide film, electric cyan skies, punchy scarlet reds and high-contrast pop" },
  { id: 41, name: "Agfa Ultra Color 100", category: "Film", color: "#B71C1C", desc: "Ultra-saturated cult negative, intense hyper-real reds and yellows, bold graphic contrast" },
  { id: 42, name: "Lomography Negative 100", category: "Film", color: "#00838F", desc: "Saturated primary colors, punchy sunny contrast, warm nostalgic tones and subtle vignette" },
  { id: 43, name: "Lomography Negative 400", category: "Film", color: "#004D40", desc: "Punchy high-contrast street negative, warm golden bias, rich grain and vintage vignette" },
  { id: 44, name: "Lomography Redscale 100", category: "Film", color: "#BF360C", desc: "Inverted emulsion film, fiery burnt amber and incandescent red tones with heavy vignette" },
  { id: 45, name: "Ninoco 400", category: "Film", color: "#4A148C", desc: "Japanese indie street stock, moody magenta-violet shadows and glowing incandescent highlights" },
  { id: 46, name: "Vibe Photo 400 Blue", category: "Film", color: "#263238", desc: "Cold cinematic street aesthetic, icy steel-blue shadows, clean skin tones and moody ambiance" },
  { id: 47, name: "800 RED", category: "Film", color: "#B71C1C", desc: "High-speed redscale cinema stock with dramatic glowing crimson halation and fiery copper tones" },
];

class FilmApp {
  constructor() {
    this.selectedFilterId = 1; // Default: Portra 400
    this.activeCategory = 'all';

    this.params = {
      intensity: 1.0,
      grainStrength: 1.0,
      vignetteStrength: 1.0,
      exposure: 0.0,
      temperature: 0.0
    };

    this.currentImgWidth = 0;
    this.currentImgHeight = 0;
    this.originalImageData = null;
    this.filteredImageData = null;

    this.jobCounter = 0;
    this.pendingJobId = null;

    // Favorites persistence
    try {
      const stored = localStorage.getItem('film_magic_favorites');
      this.favorites = stored ? new Set(JSON.parse(stored)) : new Set([1, 3]);
    } catch (_) {
      this.favorites = new Set([1, 3]);
    }

    this.initWorker();
    this.initSlider();
    this.initUI();
    this.updateFavoriteButton();
    this.loadSampleImage();
  }

  initWorker() {
    this.worker = new Worker('js/filter_worker.js');

    this.worker.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'status') {
        const badge = document.getElementById('engineBadge');
        if (data.status === 'wasm_ready') {
          badge.textContent = 'WASM Ready';
          badge.style.color = '#2ecc71';
        } else {
          badge.textContent = 'JS Engine';
          badge.style.color = '#e6af78';
        }
        return;
      }

      // Filter processing complete
      if (data.id === this.pendingJobId) {
        const uint8 = new Uint8ClampedArray(data.rgbaBuffer);
        this.filteredImageData = new ImageData(uint8, data.width, data.height);
        this.slider.renderAfter(this.filteredImageData);

        // Update latency display
        const latencyBadge = document.getElementById('latencyBadge');
        if (latencyBadge) {
          latencyBadge.textContent = `⚡ ${data.latencyMs.toFixed(1)} ms (${data.engineType})`;
        }

        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
          statusIndicator.classList.remove('is-processing');
        }
      }
    };

    this.worker.onerror = (err) => {
      console.error('Filter worker error:', err);
      const statusIndicator = document.querySelector('.status-indicator');
      if (statusIndicator) {
        statusIndicator.classList.remove('is-processing');
      }
    };
  }

  initSlider() {
    this.slider = new SplitSlider(
      'dropZone',
      'canvasBefore',
      'canvasAfter',
      'splitDivider'
    );
  }

  initUI() {
    // Dynamic tab counts based on PRESETS catalog
    const filmCount = PRESETS.filter(p => p.category === 'Film').length;
    const effectCount = PRESETS.filter(p => p.category === 'Effect').length;
    const allCount = PRESETS.length;
    const btnAll = document.querySelector('.tab-btn[data-category="all"]');
    if (btnAll) btnAll.textContent = `All Presets (${allCount})`;
    const btnFilm = document.querySelector('.tab-btn[data-category="Film"]');
    if (btnFilm) btnFilm.textContent = `Historic Films (${filmCount})`;
    const btnEffect = document.querySelector('.tab-btn[data-category="Effect"]');
    if (btnEffect) btnEffect.textContent = `Creative Effects (${effectCount})`;
    const favCountEl = document.getElementById('favCount');
    if (favCountEl) favCountEl.textContent = this.favorites.size;

    // Populate carousel
    this.renderCarousel();

    // Category tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.category;
        this.renderCarousel();
      });
    });

    // Favorite toggle button in active filter bar
    const btnFav = document.getElementById('btnFavorite');
    if (btnFav) {
      btnFav.addEventListener('click', () => {
        this.toggleFavorite(this.selectedFilterId);
      });
    }

    // Buttons
    document.getElementById('btnSample').addEventListener('click', () => this.loadSampleImage());
    document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileSelect(e));
    document.getElementById('btnDownload').addEventListener('click', () => this.exportImage());

    // PWA Install Prompt Handling
    const btnInstall = document.getElementById('btnInstall');
    if (btnInstall) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
        btnInstall.style.display = 'inline-flex';
      });

      btnInstall.addEventListener('click', async () => {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          this.showToast('Film Magic installation accepted');
        }
        this.deferredPrompt = null;
        btnInstall.style.display = 'none';
      });

      window.addEventListener('appinstalled', () => {
        this.showToast('Film Magic installed successfully!');
        if (btnInstall) btnInstall.style.display = 'none';
      });
    }

    // Tune Drawer Toggle
    const tuneDrawer = document.getElementById('tuneDrawer');
    document.getElementById('btnTune').addEventListener('click', () => {
      tuneDrawer.classList.toggle('open');
    });

    document.getElementById('btnResetTune').addEventListener('click', () => {
      this.params = { intensity: 1.0, grainStrength: 1.0, vignetteStrength: 1.0, exposure: 0.0, temperature: 0.0 };
      this.syncSliders();
      this.triggerProcessing();
    });

    // Sliders
    this.bindSlider('sliderIntensity', 'valIntensity', (v) => { this.params.intensity = v / 100; return `${v}%`; });
    this.bindSlider('sliderGrain', 'valGrain', (v) => { this.params.grainStrength = v / 100; return `${v}%`; });
    this.bindSlider('sliderVignette', 'valVignette', (v) => { this.params.vignetteStrength = v / 100; return `${v}%`; });
    this.bindSlider('sliderExposure', 'valExposure', (v) => { this.params.exposure = v / 10; return `${v >= 0 ? '+' : ''}${(v / 10).toFixed(1)} EV`; });
    this.bindSlider('sliderWarmth', 'valWarmth', (v) => { this.params.temperature = v / 10; return `${v >= 0 ? '+' : ''}${(v / 10).toFixed(1)}`; });

    // Drag & Drop
    const dropZone = document.getElementById('dropZone');
    window.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) dropZone.classList.remove('drag-over'); });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) {
        this.loadFile(e.dataTransfer.files[0]);
      }
    });
  }

  bindSlider(id, valId, formatFn) {
    const input = document.getElementById(id);
    const label = document.getElementById(valId);
    input.addEventListener('input', () => {
      label.textContent = formatFn(parseFloat(input.value));
      this.triggerProcessing();
    });
  }

  syncSliders() {
    document.getElementById('sliderIntensity').value = this.params.intensity * 100;
    document.getElementById('valIntensity').textContent = `${Math.round(this.params.intensity * 100)}%`;

    document.getElementById('sliderGrain').value = this.params.grainStrength * 100;
    document.getElementById('valGrain').textContent = `${Math.round(this.params.grainStrength * 100)}%`;

    document.getElementById('sliderVignette').value = this.params.vignetteStrength * 100;
    document.getElementById('valVignette').textContent = `${Math.round(this.params.vignetteStrength * 100)}%`;

    document.getElementById('sliderExposure').value = this.params.exposure * 10;
    document.getElementById('valExposure').textContent = `${this.params.exposure >= 0 ? '+' : ''}${this.params.exposure.toFixed(1)} EV`;

    document.getElementById('sliderWarmth').value = this.params.temperature * 10;
    document.getElementById('valWarmth').textContent = `${this.params.temperature >= 0 ? '+' : ''}${this.params.temperature.toFixed(1)}`;
  }

  renderCarousel() {
    const track = document.getElementById('carouselTrack');
    track.innerHTML = '';

    const items = PRESETS.filter(p => {
      if (this.activeCategory === 'all') return true;
      if (this.activeCategory === 'Favorites') return this.favorites.has(p.id);
      return p.category === this.activeCategory;
    });

    if (this.activeCategory === 'Favorites' && items.length === 0) {
      track.innerHTML = `
        <div class="empty-favorites-msg">
          <span class="empty-star">★</span>
          <div><strong>No favorite films yet</strong></div>
          <div>Click the star button on any film stock to pin it to your quick-access favorites.</div>
        </div>
      `;
      return;
    }

    items.forEach(p => {
      const isFav = this.favorites.has(p.id);
      const card = document.createElement('div');
      card.className = `filter-card ${p.id === this.selectedFilterId ? 'active' : ''}`;
      card.dataset.filterId = p.id;
      card.innerHTML = `
        <div class="swatch-ring">
          <div class="swatch-fill">
            ${this.getSwatchIconSvg(p)}
          </div>
          ${isFav ? '<span class="card-fav-badge" title="Favorite">★</span>' : ''}
        </div>
        <div class="filter-card-name">${p.name}</div>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectFilter(p.id);
      });

      track.appendChild(card);
    });
  }

  getSwatchIconSvg(p) {
    if (p.id === 0) {
      return `<svg viewBox="0 0 50 50" width="100%" height="100%">
        <circle cx="25" cy="25" r="24" fill="#242428"/>
        <circle cx="25" cy="25" r="22" fill="none" stroke="#4a4a52" stroke-width="1.5"/>
        <circle cx="25" cy="25" r="9" fill="#101014"/>
        <text x="25" y="28" font-size="8" font-weight="900" fill="#E6AF78" text-anchor="middle" letter-spacing="0.5">RAW</text>
      </svg>`;
    }
    if (p.id === 9) {
      return `<svg viewBox="0 0 50 50" width="100%" height="100%">
        <rect width="50" height="50" fill="#18181a"/>
        <rect x="9" y="7" width="32" height="36" rx="2" fill="#f5f5f5"/>
        <rect x="13" y="10" width="24" height="22" rx="1" fill="#1abc9c"/>
        <rect x="13" y="34" width="2.5" height="3" fill="#e74c3c"/>
        <rect x="15.5" y="34" width="2.5" height="3" fill="#e67e22"/>
        <rect x="18" y="34" width="2.5" height="3" fill="#f1c40f"/>
        <rect x="20.5" y="34" width="2.5" height="3" fill="#2ecc71"/>
        <rect x="23" y="34" width="2.5" height="3" fill="#3498db"/>
        <text x="32" y="36.5" font-size="6" font-weight="900" fill="#222" text-anchor="middle">600</text>
      </svg>`;
    }
    if (p.category === 'Film') {
      const canisterInfo = {
        1: { body: '#FFC20E', stripe: '#1E1E1E', badge: '#1E1E1E', text: '#fff', label: 'PORTRA' },
        2: { body: '#181818', stripe: '#FFC20E', badge: '#E53935', text: '#fff', label: 'TRI-X' },
        3: { body: '#008542', stripe: '#ffffff', badge: '#8E44AD', text: '#fff', label: 'VELVIA' },
        4: { body: '#0076A8', stripe: '#008542', badge: '#0076A8', text: '#fff', label: 'PROVIA' },
        5: { body: '#0D1B2A', stripe: '#E63946', badge: '#E63946', text: '#00FFFF', label: '800T' },
        6: { body: '#B71C1C', stripe: '#FFB300', badge: '#FFB300', text: '#B71C1C', label: 'K-64' },
        7: { body: '#B0BEC5', stripe: '#263238', badge: '#263238', text: '#ECEFF1', label: 'HP5+' },
        8: { body: '#1565C0', stripe: '#ffffff', badge: '#0D47A1', text: '#FFEB3B', label: 'E100' },
        10: { body: '#C62828', stripe: '#1976D2', badge: '#1976D2', text: '#fff', label: 'VISTA' },
        11: { body: '#FFB300', stripe: '#D32F2F', badge: '#D32F2F', text: '#FFF9C4', label: 'GOLD' },
        12: { body: '#48C9B0', stripe: '#ffffff', badge: '#16A085', text: '#fff', label: '400H' },
        13: { body: '#B71C1C', stripe: '#212121', badge: '#212121', text: '#FF5252', label: 'EKTAR' },
        14: { body: '#212121', stripe: '#D81B60', badge: '#D81B60', text: '#fff', label: 'T-MAX' },
        15: { body: '#0288D1', stripe: '#CFD8DC', badge: '#ECEFF1', text: '#01579B', label: '50D' },
        24: { body: '#007E33', stripe: '#FFB300', badge: '#E65100', text: '#fff', label: 'SENSIA' },
        25: { body: '#E65100', stripe: '#007E33', badge: '#1B5E20', text: '#FFF8E1', label: 'SEN200' },
        26: { body: '#4A148C', stripe: '#E1BEE7', badge: '#00BFA5', text: '#fff', label: 'ASTIA' },
        27: { body: '#008542', stripe: '#E53935', badge: '#1E88E5', text: '#fff', label: 'SUP200' },
        28: { body: '#1B5E20', stripe: '#E53935', badge: '#FFD600', text: '#1B5E20', label: 'SUP800' },
        29: { body: '#00796B', stripe: '#E0F2F1', badge: '#E65100', text: '#fff', label: '160C' },
        30: { body: '#263238', stripe: '#80CBC4', badge: '#37474F', text: '#80CBC4', label: 'ETERNA' },
        31: { body: '#37474F', stripe: '#00BFA5', badge: '#00B0FF', text: '#fff', label: 'F-64D' },
        32: { body: '#FFC20E', stripe: '#1E1E1E', badge: '#1976D2', text: '#fff', label: '160' },
        33: { body: '#FFB300', stripe: '#E53935', badge: '#E65100', text: '#fff', label: '800HC' },
        34: { body: '#0D47A1', stripe: '#FF6D00', badge: '#D50000', text: '#FFEB3B', label: '100VS' },
        35: { body: '#C62828', stripe: '#FFD600', badge: '#FFD600', text: '#C62828', label: 'KM 25' },
        36: { body: '#D32F2F', stripe: '#FFC107', badge: '#FFC107', text: '#D32F2F', label: 'CP 200' },
        37: { body: '#1A237E', stripe: '#FFD600', badge: '#0D47A1', text: '#FFD600', label: 'ELITE' },
        38: { body: '#ECEFF1', stripe: '#263238', badge: '#D32F2F', text: '#FFFFFF', label: 'DELTA' },
        39: { body: '#BF360C', stripe: '#558B2F', badge: '#D50000', text: '#FFFFFF', label: 'XR 200' },
        40: { body: '#0277BD', stripe: '#D50000', badge: '#00E5FF', text: '#FFFFFF', label: 'PRECISA' },
        41: { body: '#B71C1C', stripe: '#FFD600', badge: '#4A148C', text: '#FFD600', label: 'ULTRA' },
        42: { body: '#00838F', stripe: '#FF6D00', badge: '#F50057', text: '#FFFFFF', label: 'LOMO 100' },
        43: { body: '#004D40', stripe: '#FFD600', badge: '#E91E63', text: '#FFFFFF', label: 'LOMO 400' },
        44: { body: '#BF360C', stripe: '#FF6F00', badge: '#DD2C00', text: '#FFD54F', label: 'REDSCALE' },
        45: { body: '#4A148C', stripe: '#FF4081', badge: '#00E5FF', text: '#FFFFFF', label: 'NINOCO' },
        46: { body: '#263238', stripe: '#00B0FF', badge: '#80DEEA', text: '#FFFFFF', label: 'VIBE' },
        47: { body: '#B71C1C', stripe: '#FF1744', badge: '#FFD600', text: '#B71C1C', label: '800RED' },
      }[p.id] || { body: p.color, stripe: '#fff', badge: '#222', text: '#fff', label: 'FILM' };

      return `<svg viewBox="0 0 50 50" width="100%" height="100%">
        <rect width="50" height="50" fill="#161618"/>
        <path d="M24,15 L44,17 Q48,25 43,35 L24,37 Z" fill="#2b1d15"/>
        <rect x="30" y="17.5" width="3" height="2" rx="0.5" fill="#120c08"/>
        <rect x="36" y="18.5" width="3" height="2" rx="0.5" fill="#120c08"/>
        <rect x="30" y="32.5" width="3" height="2" rx="0.5" fill="#120c08"/>
        <rect x="36" y="33.5" width="3" height="2" rx="0.5" fill="#120c08"/>
        <rect x="13" y="6" width="8" height="4" rx="1" fill="#757575"/>
        <rect x="7" y="9.5" width="20" height="3" rx="1" fill="#9e9e9e"/>
        <rect x="7" y="37.5" width="20" height="3" rx="1" fill="#9e9e9e"/>
        <rect x="8" y="12" width="18" height="26" rx="2" fill="${canisterInfo.body}"/>
        <rect x="8" y="15" width="18" height="4" fill="${canisterInfo.stripe}"/>
        <rect x="9" y="22" width="16" height="11" rx="1.5" fill="${canisterInfo.badge}"/>
        <text x="17" y="30" font-size="${canisterInfo.label.length > 5 ? 4.5 : (canisterInfo.label.length > 4 ? 5.2 : 6.2)}" font-weight="900" fill="${canisterInfo.text}" text-anchor="middle" letter-spacing="0.2">${canisterInfo.label}</text>
      </svg>`;
    }

    switch (p.id) {
      case 16:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#0d2818"/>
          <path d="M25,8 Q38,15 36,31 Q30,42 25,42 Q20,42 14,31 Q12,15 25,8 Z" fill="#2ecc71"/>
          <line x1="25" y1="12" x2="25" y2="40" stroke="#e8f8f5" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="25" y1="20" x2="32" y2="24" stroke="#e8f8f5" stroke-width="1"/>
          <line x1="25" y1="20" x2="18" y2="24" stroke="#e8f8f5" stroke-width="1"/>
          <line x1="25" y1="27" x2="31" y2="32" stroke="#e8f8f5" stroke-width="1"/>
          <line x1="25" y1="27" x2="19" y2="32" stroke="#e8f8f5" stroke-width="1"/>
        </svg>`;
      case 17:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#2d114d"/>
          <path d="M25,7 A18,18 0 0,0 25,43 Z" fill="#0f0f12"/>
          <path d="M25,7 A18,18 0 0,1 25,43 Z" fill="#ffffff"/>
          <circle cx="25" cy="25" r="18" fill="none" stroke="#8e44ad" stroke-width="2"/>
          <circle cx="18" cy="25" r="2.5" fill="#ffffff"/>
          <circle cx="32" cy="25" r="2.5" fill="#0f0f12"/>
        </svg>`;
      case 18:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#b34700"/>
          <line x1="25" y1="28" x2="25" y2="10" stroke="#ffe082" stroke-width="1.5"/>
          <line x1="25" y1="28" x2="11" y2="15" stroke="#ffe082" stroke-width="1.5"/>
          <line x1="25" y1="28" x2="39" y2="15" stroke="#ffe082" stroke-width="1.5"/>
          <path d="M15,28 A10,10 0 0,1 35,28 Z" fill="#ffb300"/>
          <line x1="7" y1="29" x2="43" y2="29" stroke="#4e2606" stroke-width="2"/>
          <line x1="14" y1="34" x2="36" y2="34" stroke="#ffd54f" stroke-width="1.2"/>
          <line x1="18" y1="38" x2="32" y2="38" stroke="#ffd54f" stroke-width="1.2"/>
        </svg>`;
      case 19:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#0f141c"/>
          <circle cx="18" cy="25" r="12" fill="#00ced1" opacity="0.8"/>
          <circle cx="32" cy="25" r="12" fill="#ff7a00" opacity="0.8"/>
          <line x1="5" y1="25" x2="45" y2="25" stroke="#e0fbfc" stroke-width="1.5" opacity="0.9"/>
        </svg>`;
      case 20:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#845070"/>
          <circle cx="25" cy="25" r="11" fill="#fff" opacity="0.3"/>
          <path d="M25,10 Q25,25 40,25 Q25,25 25,40 Q25,25 10,25 Q25,25 25,10 Z" fill="#ffffff"/>
          <circle cx="14" cy="15" r="1.5" fill="#fff0f5"/>
          <circle cx="36" cy="34" r="1.5" fill="#fff0f5"/>
        </svg>`;
      case 21:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#0f051d"/>
          <line x1="8" y1="32" x2="42" y2="32" stroke="#ff007f" stroke-width="0.8" opacity="0.4"/>
          <line x1="12" y1="37" x2="38" y2="37" stroke="#ff007f" stroke-width="0.8" opacity="0.4"/>
          <polygon points="25,11 38,27 25,37 12,27" fill="none" stroke="#ff007f" stroke-width="3"/>
          <polygon points="25,11 38,27 25,37 12,27" fill="none" stroke="#00f0ff" stroke-width="1.5"/>
          <circle cx="25" cy="24" r="2" fill="#ffffff"/>
        </svg>`;
      case 22:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#0a0a0e"/>
          <polygon points="40,8 8,40 40,40" fill="#e0e0e0" opacity="0.85"/>
          <line x1="8" y1="12" x2="42" y2="20" stroke="#0d0d11" stroke-width="3"/>
          <line x1="8" y1="18" x2="42" y2="26" stroke="#0d0d11" stroke-width="3"/>
          <line x1="8" y1="24" x2="42" y2="32" stroke="#0d0d11" stroke-width="3"/>
          <line x1="8" y1="30" x2="42" y2="38" stroke="#0d0d11" stroke-width="3"/>
          <line x1="8" y1="36" x2="42" y2="44" stroke="#0d0d11" stroke-width="3"/>
        </svg>`;
      case 23:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="25" fill="#f7f1e1"/>
          <circle cx="25" cy="21" r="8" fill="#e59866"/>
          <path d="M9,30 Q25,27 41,30" fill="none" stroke="#c0392b" stroke-width="2.5"/>
          <path d="M9,33 Q25,30 41,33" fill="none" stroke="#d35400" stroke-width="2.5"/>
          <path d="M9,36 Q25,33 41,36" fill="none" stroke="#f39c12" stroke-width="2.5"/>
          <path d="M9,39 Q25,36 41,39" fill="none" stroke="#6e2c00" stroke-width="2.5"/>
        </svg>`;
      default:
        return `<svg viewBox="0 0 50 50" width="100%" height="100%">
          <circle cx="25" cy="25" r="20" fill="${p.color}"/>
        </svg>`;
    }
  }

  getPreset(id) {
    const catalog = this.presets || PRESETS;
    return catalog.find(p => p.id === id) || catalog[0] || PRESETS[0];
  }

  selectFilter(id) {
    this.selectedFilterId = id;
    const p = this.getPreset(id);
    const filterNameEl = document.getElementById('filterName');
    if (filterNameEl) filterNameEl.textContent = p.name;
    const filterCatEl = document.getElementById('filterCategory');
    if (filterCatEl) filterCatEl.textContent = `(${p.category})`;
    const filterDescEl = document.getElementById('filterDesc');
    if (filterDescEl) filterDescEl.textContent = p.desc;
    const filterDotEl = document.getElementById('filterDot');
    if (filterDotEl) filterDotEl.style.backgroundColor = p.color;

    this.updateFavoriteButton();
    this.triggerProcessing();
  }

  isFavorite(id) {
    return this.favorites.has(id);
  }

  updateFavoriteButton() {
    const btn = document.getElementById('btnFavorite');
    if (btn) {
      const isFav = this.favorites.has(this.selectedFilterId);
      if (isFav) {
        btn.classList.add('active');
        btn.title = 'Remove from Favorites';
        btn.setAttribute('aria-label', 'Remove from Favorites');
      } else {
        btn.classList.remove('active');
        btn.title = 'Add to Favorites';
        btn.setAttribute('aria-label', 'Add to Favorites');
      }
    }
    const favCountEl = document.getElementById('favCount');
    if (favCountEl) favCountEl.textContent = this.favorites.size;
  }

  toggleFavorite(id = this.selectedFilterId) {
    const p = this.getPreset(id);
    let isFav;
    if (this.favorites.has(id)) {
      this.favorites.delete(id);
      isFav = false;
      this.showToast(`Removed "${p.name}" from Favorites`);
    } else {
      this.favorites.add(id);
      isFav = true;
      this.showToast(`Added "${p.name}" to Favorites`);
    }

    try {
      localStorage.setItem('film_magic_favorites', JSON.stringify(Array.from(this.favorites)));
    } catch (_) {}

    this.updateFavoriteButton();
    this.renderCarousel();
    return isFav;
  }

  loadSampleImage() {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      const maxDim = 1200;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      this.setImageData(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = () => {
      this.generateSyntheticTarget();
    };
    img.src = 'sample.jpg';
  }

  generateSyntheticTarget() {
    const w = 900;
    const h = 675;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    skyGrad.addColorStop(0, '#5ea3e8');
    skyGrad.addColorStop(1, '#d8eafc');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.4);

    // Sun
    const sunGrad = ctx.createRadialGradient(w * 0.7, h * 0.15, 5, w * 0.7, h * 0.15, 80);
    sunGrad.addColorStop(0, 'rgba(255, 255, 240, 1.0)');
    sunGrad.addColorStop(0.5, 'rgba(255, 235, 180, 0.5)');
    sunGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, w, h * 0.4);

    // Hills & Foliage
    ctx.fillStyle = '#2f6d2f';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.4);
    ctx.bezierCurveTo(w * 0.25, h * 0.32, w * 0.7, h * 0.45, w, h * 0.35);
    ctx.lineTo(w, h * 0.75);
    ctx.lineTo(0, h * 0.75);
    ctx.fill();

    // Portrait swatches in foliage
    const swatches = [
      { x: w * 0.2, color: '#f2c1a2' },
      { x: w * 0.45, color: '#c98a5e' },
      { x: w * 0.7, color: '#7a452a' },
    ];
    swatches.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, h * 0.48, 100, 70);
    });

    // Dark Street & Specular lights
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(0, h * 0.75, w, h * 0.25);

    const neon1 = ctx.createRadialGradient(w * 0.25, h * 0.88, 2, w * 0.25, h * 0.88, 50);
    neon1.addColorStop(0, '#ffffff');
    neon1.addColorStop(0.3, '#ffcc44');
    neon1.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = neon1;
    ctx.fillRect(0, h * 0.75, w * 0.5, h * 0.25);

    const neon2 = ctx.createRadialGradient(w * 0.75, h * 0.88, 2, w * 0.75, h * 0.88, 50);
    neon2.addColorStop(0, '#ffffff');
    neon2.addColorStop(0.3, '#66ccff');
    neon2.addColorStop(1, 'rgba(0, 100, 255, 0)');
    ctx.fillStyle = neon2;
    ctx.fillRect(w * 0.5, h * 0.75, w * 0.5, h * 0.25);

    const imgData = ctx.getImageData(0, 0, w, h);
    this.setImageData(imgData);
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) this.loadFile(file);
  }

  loadFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Downscale image if larger than 2048px for fast responsive editing
        let w = img.width;
        let h = img.height;
        const maxDim = 2048;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        this.setImageData(imgData);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  setImageData(imgData) {
    this.currentImgWidth = imgData.width;
    this.currentImgHeight = imgData.height;
    this.originalImageData = imgData;

    this.slider.setDimensions(imgData.width, imgData.height);
    this.slider.renderBefore(imgData);

    this.triggerProcessing();
  }

  triggerProcessing() {
    if (!this.originalImageData) return;

    this.jobCounter++;
    this.pendingJobId = this.jobCounter;

    const statusIndicator = document.querySelector('.status-indicator');
    if (statusIndicator) {
      statusIndicator.classList.add('is-processing');
    }

    // Clone pixel buffer to send to worker
    const bufferCopy = this.originalImageData.data.slice().buffer;

    this.worker.postMessage({
      id: this.pendingJobId,
      rgbaBuffer: bufferCopy,
      width: this.currentImgWidth,
      height: this.currentImgHeight,
      filterId: this.selectedFilterId,
      params: this.params
    }, [bufferCopy]);
  }

  showToast(message) {
    if (typeof document === 'undefined') return;
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }

  async exportImage() {
    if (!this.filteredImageData) return;

    const canvas = document.createElement('canvas');
    canvas.width = this.currentImgWidth;
    canvas.height = this.currentImgHeight;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(this.filteredImageData, 0, 0);

    const preset = this.getPreset(this.selectedFilterId);
    const filterName = (preset ? preset.name : 'preset').replace(/\s+/g, '_');
    const fileName = `film_magic_${filterName}.png`;

    try {
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'PNG Image',
            accept: { 'image/png': ['.png'] }
          }]
        });
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.showToast(`Saved to device: ${fileName}`);
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }

    if (typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.showToast(`Saved to local device: ${fileName}`);
    }
  }

  // Alias for clarity
  saveImageToDevice() {
    return this.exportImage();
  }
}

// Bootstrap application on load
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.app = new FilmApp();

    // Register Service Worker for PWA offline capabilities
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      navigator.serviceWorker.register('./sw.js').then((registration) => {
        console.log('Film Magic SW registered:', registration.scope);
      }).catch((err) => {
        console.warn('Film Magic SW registration failed:', err);
      });
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRESETS, FilmApp };
}


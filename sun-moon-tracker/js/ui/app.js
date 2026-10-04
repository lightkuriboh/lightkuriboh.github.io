/**
 * App - Main UI Coordinator & Ephemeris State Controller
 */

import { AstronomyEngine } from '../engine/astronomy.js';
import { ARView } from '../ar/ar_view.js';
import { I18n } from './i18n.js';
import { FeatureGate } from './feature_gate.js';
import { FieldKitMath, SensorPresets } from './field_kit.js';
import { MeteorShowerEngine } from '../engine/meteor_shower.js';

export class App {
    constructor() {
        // Current state
        const now = new Date();
        this.selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        this.currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();
        this.isLiveTime = true;
        this.isPlayingTimelapse = false;
        this.timelapseInterval = null;

        // Location (Default: Hanoi, Vietnam; can auto-detect GPS or select presets)
        this.location = {
            name: "Hanoi, Vietnam",
            lat: 21.0285,
            lon: 105.8542,
            utcOffset: -now.getTimezoneOffset() / 60.0
        };

        // World photography presets
        this.presets = [
            { name: "📍 My GPS Location", lat: null, lon: null },
            { name: "Hanoi, Vietnam", lat: 21.0285, lon: 105.8542, offset: 7 },
            { name: "Tokyo, Japan (Mt. Fuji)", lat: 35.3606, lon: 138.7274, offset: 9 },
            { name: "Reykjavik, Iceland (Aurora)", lat: 64.1466, lon: -21.9426, offset: 0 },
            { name: "Banff National Park, Canada", lat: 51.1784, lon: -115.5708, offset: -6 },
            { name: "Paris, France", lat: 48.8566, lon: 2.3522, offset: 2 },
            { name: "London, UK (Greenwich)", lat: 51.4826, lon: 0.0077, offset: 1 },
            { name: "New York, USA", lat: 40.7128, lon: -74.0060, offset: -4 },
            { name: "San Francisco, USA", lat: 37.7749, lon: -122.4194, offset: -7 },
            { name: "Sydney, Australia", lat: -33.8688, lon: 151.2093, offset: 10 },
            { name: "Patagonia, Chile (Torres del Paine)", lat: -51.2532, lon: -72.8814, offset: -3 }
        ];

        // Engine results cache
        this.solarTimes = null;
        this.lunarTimes = null;
        this.moonPhase = null;
        this.sunTrajectory = [];
        this.moonTrajectory = [];

        // Modules & Services
        this.arView = null;
        this.i18n = new I18n();
        this.featureGate = new FeatureGate();

        // Dial Canvas
        this.dialCanvas = document.getElementById('solar-dial-canvas');
        this.dialCtx = this.dialCanvas ? this.dialCanvas.getContext('2d') : null;
    }

    async init() {
        this.arView = new ARView('ar-canvas', 'camera-video');

        await this.i18n.init();
        this.i18n.applyTranslations(document);
        await this.featureGate.init();

        this.initDOM();
        this.initFieldKit();
        this.bindEvents();
        this.registerServiceWorker();

        // Calculate and update view
        this.recalculateDailyEphemeris();
        this.updateTimeScrubber(this.currentMinuteOfDay, false);

        // Start render loop for AR canvas
        const loop = () => {
            this.arView.render();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);

        // Live ticker (updates every 10 seconds if user is in 'Now' mode)
        setInterval(() => {
            if (this.isLiveTime && !this.isPlayingTimelapse) {
                const now = new Date();
                this.currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();
                this.updateTimeScrubber(this.currentMinuteOfDay, false);
            }
        }, 10000);

        // Auto prompt GPS if possible
        if ("geolocation" in navigator) {
            this.detectGPS(false);
        }
    }

    initDOM() {
        // Date Input
        const dateInput = document.getElementById('date-picker-input');
        if (dateInput) {
            dateInput.value = this.formatDateForInput(this.selectedDate);
        }

        // Location presets dropdown
        const locSelect = document.getElementById('location-preset-select');
        if (locSelect) {
            locSelect.innerHTML = '';
            this.presets.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.name;
                opt.textContent = p.name;
                if (p.name === this.location.name) opt.selected = true;
                locSelect.appendChild(opt);
            });
        }

        this.updateLocationLabel();
    }

    bindEvents() {
        // Date Picker
        const dateInput = document.getElementById('date-picker-input');
        if (dateInput) {
            dateInput.addEventListener('change', (e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                this.selectedDate = new Date(y, m - 1, d);
                this.recalculateDailyEphemeris();
                this.updateCurrentCalculations();
            });
        }

        // Prev / Next Day buttons
        document.getElementById('btn-prev-day')?.addEventListener('click', () => this.shiftDay(-1));
        document.getElementById('btn-next-day')?.addEventListener('click', () => this.shiftDay(1));
        document.getElementById('btn-today')?.addEventListener('click', () => {
            const now = new Date();
            this.selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (dateInput) dateInput.value = this.formatDateForInput(this.selectedDate);
            this.isLiveTime = true;
            this.currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();
            this.recalculateDailyEphemeris();
            this.updateTimeScrubber(this.currentMinuteOfDay, false);
        });

        // Time Scrubber Slider
        const timeSlider = document.getElementById('time-slider');
        if (timeSlider) {
            timeSlider.addEventListener('input', (e) => {
                this.isLiveTime = false;
                this.updateTimeScrubber(Number(e.target.value), true);
            });
        }

        // Play / Pause Timelapse button
        const btnPlay = document.getElementById('btn-timelapse');
        if (btnPlay) {
            btnPlay.addEventListener('click', () => this.toggleTimelapse());
        }

        // Reset to "Now" button
        document.getElementById('btn-reset-now')?.addEventListener('click', () => {
            const now = new Date();
            this.isLiveTime = true;
            this.currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();
            this.updateTimeScrubber(this.currentMinuteOfDay, false);
        });

        // Location presets
        document.getElementById('location-preset-select')?.addEventListener('change', (e) => {
            const found = this.presets.find(p => p.name === e.target.value);
            if (found) {
                if (found.lat === null) {
                    this.detectGPS(true);
                } else {
                    this.location.name = found.name;
                    this.location.lat = found.lat;
                    this.location.lon = found.lon;
                    if (found.offset !== undefined) this.location.utcOffset = found.offset;
                    this.updateLocationLabel();
                    this.recalculateDailyEphemeris();
                    this.updateCurrentCalculations();
                }
            }
        });

        // GPS Button
        document.getElementById('btn-use-gps')?.addEventListener('click', () => this.detectGPS(true));

        // Custom coordinates modal
        document.getElementById('btn-custom-coords')?.addEventListener('click', () => {
            const latStr = prompt("Enter Latitude (-90 to +90):", this.location.lat);
            if (latStr === null) return;
            const lonStr = prompt("Enter Longitude (-180 to +180):", this.location.lon);
            if (lonStr === null) return;

            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);
            if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                this.location.name = `Custom (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`;
                this.location.lat = lat;
                this.location.lon = lon;
                this.updateLocationLabel();
                this.recalculateDailyEphemeris();
                this.updateCurrentCalculations();
            } else {
                alert("Invalid coordinates.");
            }
        });

        // Camera Toggle
        const btnCamera = document.getElementById('btn-toggle-camera');
        if (btnCamera) {
            btnCamera.addEventListener('click', async () => {
                if (this.arView.cameraActive) {
                    this.arView.stopCamera();
                    btnCamera.innerHTML = `<span>📷 Enable Live AR Camera</span>`;
                    btnCamera.classList.remove('active');
                    document.getElementById('ar-badge')?.classList.remove('badge-live');
                } else {
                    try {
                        btnCamera.innerHTML = `<span>⏳ Starting Camera...</span>`;
                        await this.arView.startCamera();
                        await this.arView.requestDeviceOrientation();
                        btnCamera.innerHTML = `<span>⏹️ Stop Camera (360° Mode)</span>`;
                        btnCamera.classList.add('active');
                        document.getElementById('ar-badge')?.classList.add('badge-live');
                    } catch (err) {
                        alert("Camera access denied or unavailable: " + (err.message || err));
                        btnCamera.innerHTML = `<span>📷 Enable Live AR Camera</span>`;
                        btnCamera.classList.remove('active');
                    }
                }
            });
        }

        // Device Orientation enable
        document.getElementById('btn-enable-sensors')?.addEventListener('click', async () => {
            const granted = await this.arView.requestDeviceOrientation();
            if (granted) {
                document.getElementById('btn-enable-sensors').style.display = 'none';
            }
        });

        // Celestial Visibility Filters (Both vs Sun Only vs Moon Only)
        document.getElementById('btn-filter-both')?.addEventListener('click', () => this.setCelestialVisibility(true, true));
        document.getElementById('btn-filter-sun')?.addEventListener('click', () => this.setCelestialVisibility(true, false));
        document.getElementById('btn-filter-moon')?.addEventListener('click', () => this.setCelestialVisibility(false, true));

        document.getElementById('chip-filter-both')?.addEventListener('click', () => this.setCelestialVisibility(true, true));
        document.getElementById('chip-filter-sun')?.addEventListener('click', () => this.setCelestialVisibility(true, false));
        document.getElementById('chip-filter-moon')?.addEventListener('click', () => this.setCelestialVisibility(false, true));

        // Layer toggles checkboxes
        document.getElementById('toggle-sun')?.addEventListener('change', (e) => {
            this.setCelestialVisibility(e.target.checked, this.arView.showMoonPath);
        });
        document.getElementById('toggle-moon')?.addEventListener('change', (e) => {
            this.setCelestialVisibility(this.arView.showSunPath, e.target.checked);
        });
        document.getElementById('toggle-grid')?.addEventListener('change', (e) => {
            this.arView.showGrid = e.target.checked;
        });

        // Calibration Offset slider
        const calibSlider = document.getElementById('compass-calib-slider');
        if (calibSlider) {
            calibSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.arView.calibrationOffset = val;
                document.getElementById('calib-value').textContent = `${val > 0 ? '+' : ''}${val}°`;
            });
        }

        // Language Selector
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = this.i18n.locale;
            langSelect.addEventListener('change', async (e) => {
                await this.i18n.setLocale(e.target.value);
                this.updateFieldKitCalculations();
                this.renderMeteorShowers();
            });
        }

        // View Tabs (AR Camera View vs Ephemeris Cards vs 2D Celestial Dial vs Field Kit)
        const tabBtns = document.querySelectorAll('.nav-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const targetId = btn.dataset.tab;
                document.querySelectorAll('.view-tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(targetId)?.classList.add('active');
                if (targetId === 'tab-dial') {
                    this.drawSolarDial();
                } else if (targetId === 'tab-fieldkit') {
                    this.updateFieldKitCalculations();
                    this.renderMeteorShowers();
                }
            });
        });
    }

    setCelestialVisibility(showSun, showMoon) {
        this.arView.showSunPath = showSun;
        this.arView.showMoonPath = showMoon;

        // Sync Checkboxes
        const chkSun = document.getElementById('toggle-sun');
        if (chkSun) chkSun.checked = showSun;
        const chkMoon = document.getElementById('toggle-moon');
        if (chkMoon) chkMoon.checked = showMoon;

        // Sync Scrubber Filter Buttons
        document.getElementById('btn-filter-both')?.classList.toggle('active', showSun && showMoon);
        document.getElementById('btn-filter-sun')?.classList.toggle('active', showSun && !showMoon);
        document.getElementById('btn-filter-moon')?.classList.toggle('active', !showSun && showMoon);

        // Sync AR HUD Chips
        document.getElementById('chip-filter-both')?.classList.toggle('active', showSun && showMoon);
        document.getElementById('chip-filter-sun')?.classList.toggle('active', showSun && !showMoon);
        document.getElementById('chip-filter-moon')?.classList.toggle('active', !showSun && showMoon);

        // Dim inactive HUD cards
        const readoutSun = document.querySelector('.readout-card.solar');
        if (readoutSun) readoutSun.style.opacity = showSun ? '1' : '0.35';
        const readoutMoon = document.querySelector('.readout-card.lunar');
        if (readoutMoon) readoutMoon.style.opacity = showMoon ? '1' : '0.35';

        // Redraw 2D dial if visible
        this.drawSolarDial();
    }

    detectGPS(showAlert = true) {
        if (!("geolocation" in navigator)) {
            if (showAlert) alert("Geolocation not supported by your browser.");
            return;
        }

        const btn = document.getElementById('btn-use-gps');
        if (btn) btn.classList.add('loading');

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                if (btn) btn.classList.remove('loading');
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                this.location.lat = lat;
                this.location.lon = lon;
                this.location.name = `GPS (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`;
                this.location.utcOffset = -new Date().getTimezoneOffset() / 60.0;

                const locSelect = document.getElementById('location-preset-select');
                if (locSelect) locSelect.value = "📍 My GPS Location";

                this.updateLocationLabel();
                this.recalculateDailyEphemeris();
                this.updateCurrentCalculations();
                if (showAlert) {
                    console.log(`GPS Location locked: ${lat}, ${lon}`);
                }
            },
            (err) => {
                if (btn) btn.classList.remove('loading');
                console.warn("GPS error:", err);
                if (showAlert) {
                    alert("Could not obtain GPS location: " + err.message + ". Using preset location instead.");
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    }

    updateLocationLabel() {
        const el = document.getElementById('current-location-text');
        if (el) {
            el.textContent = `${this.location.name} (${this.location.lat.toFixed(2)}°, ${this.location.lon.toFixed(2)}°) • UTC${this.location.utcOffset >= 0 ? '+' : ''}${this.location.utcOffset}`;
        }
    }

    shiftDay(days) {
        this.selectedDate.setDate(this.selectedDate.getDate() + days);
        const dateInput = document.getElementById('date-picker-input');
        if (dateInput) dateInput.value = this.formatDateForInput(this.selectedDate);
        this.recalculateDailyEphemeris();
        this.updateCurrentCalculations();
    }

    formatDateForInput(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    recalculateDailyEphemeris() {
        const y = this.selectedDate.getFullYear();
        const m = this.selectedDate.getMonth() + 1;
        const d = this.selectedDate.getDate();
        const offset = this.location.utcOffset;
        const lat = this.location.lat;
        const lon = this.location.lon;

        // 1. Solar Times
        this.solarTimes = AstronomyEngine.calculateSolarTimes(y, m, d, offset, lat, lon);

        // 2. Lunar Times
        this.lunarTimes = AstronomyEngine.calculateLunarTimes(y, m, d, offset, lat, lon);

        // 3. Trajectories (sampled every 15 mins for smooth curves)
        this.sunTrajectory = AstronomyEngine.calculateSunTrajectory(y, m, d, offset, lat, lon, 15);
        this.moonTrajectory = AstronomyEngine.calculateMoonTrajectory(y, m, d, offset, lat, lon, 15);

        // Pass to AR View
        if (this.arView) {
            this.arView.sunTrajectory = this.sunTrajectory;
            this.arView.moonTrajectory = this.moonTrajectory;
        }

        // Update UI summary cards
        this.renderEphemerisCards();
        this.drawSolarDial();
        this.renderMeteorShowers();
        this.updateFieldKitCalculations();
    }

    updateTimeScrubber(minuteOfDay, userInitiated = true) {
        this.currentMinuteOfDay = Math.max(0, Math.min(1439, minuteOfDay));

        const timeSlider = document.getElementById('time-slider');
        if (timeSlider && !userInitiated) {
            timeSlider.value = this.currentMinuteOfDay;
        }

        const hours = Math.floor(this.currentMinuteOfDay / 60);
        const mins = this.currentMinuteOfDay % 60;
        const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

        const readout = document.getElementById('scrubber-time-readout');
        if (readout) {
            readout.textContent = timeStr + (this.isLiveTime ? " (LIVE)" : "");
        }

        this.updateCurrentCalculations();
    }

    updateCurrentCalculations() {
        const y = this.selectedDate.getFullYear();
        const m = this.selectedDate.getMonth() + 1;
        const d = this.selectedDate.getDate();
        const hours = Math.floor(this.currentMinuteOfDay / 60);
        const mins = this.currentMinuteOfDay % 60;
        const offset = this.location.utcOffset;
        const lat = this.location.lat;
        const lon = this.location.lon;

        const jd = AstronomyEngine.calculateJulianDate(y, m, d, hours, mins, 0, offset);

        const sunPos = AstronomyEngine.calculateSunPosition(jd, lat, lon);
        const moonPos = AstronomyEngine.calculateMoonPosition(jd, lat, lon);
        const moonPhase = AstronomyEngine.calculateMoonPhase(jd);

        this.moonPhase = moonPhase;

        const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

        // Pass to AR View
        if (this.arView) {
            this.arView.sunPosition = sunPos;
            this.arView.moonPosition = moonPos;
            this.arView.moonPhase = moonPhase;
            this.arView.currentTimeStr = timeStr;
        }

        // Update HUD Quick Readouts
        document.getElementById('hud-sun-az')?.replaceChildren(document.createTextNode(`${Math.round(sunPos.azimuth)}°`));
        document.getElementById('hud-sun-alt')?.replaceChildren(document.createTextNode(`${Math.round(sunPos.altitude)}°`));
        document.getElementById('hud-moon-az')?.replaceChildren(document.createTextNode(`${Math.round(moonPos.azimuth)}°`));
        document.getElementById('hud-moon-alt')?.replaceChildren(document.createTextNode(`${Math.round(moonPos.altitude)}°`));

        // Photography guidance tip
        const tip = AstronomyEngine.getPhotographyTip(sunPos.altitude, moonPhase.illuminationFraction, moonPos.isAboveHorizon);
        const tipTitle = document.getElementById('photo-tip-title');
        const tipDesc = document.getElementById('photo-tip-desc');
        if (tipTitle) tipTitle.textContent = tip.title;
        if (tipDesc) tipDesc.textContent = tip.desc;

        // Render Moon Phase visualizer on Card
        this.renderMoonCanvas(moonPhase);
        this.drawSolarDial();
    }

    toggleTimelapse() {
        const btn = document.getElementById('btn-timelapse');
        if (this.isPlayingTimelapse) {
            this.stopTimelapse();
            if (btn) btn.innerHTML = `<span>▶️ Play 24h</span>`;
        } else {
            this.isPlayingTimelapse = true;
            this.isLiveTime = false;
            if (btn) btn.innerHTML = `<span>⏸️ Pause</span>`;
            this.timelapseInterval = setInterval(() => {
                this.currentMinuteOfDay = (this.currentMinuteOfDay + 10) % 1440;
                this.updateTimeScrubber(this.currentMinuteOfDay, false);
            }, 80);
        }
    }

    stopTimelapse() {
        this.isPlayingTimelapse = false;
        if (this.timelapseInterval) {
            clearInterval(this.timelapseInterval);
            this.timelapseInterval = null;
        }
    }

    renderEphemerisCards() {
        const st = this.solarTimes;
        const lt = this.lunarTimes;
        if (!st || !lt) return;

        // Sun Card
        document.getElementById('val-sunrise')?.replaceChildren(document.createTextNode(st.sunrise));
        document.getElementById('val-solar-noon')?.replaceChildren(document.createTextNode(`${st.solarNoon} (Alt ${st.solarNoonAltitude}°) `));
        document.getElementById('val-sunset')?.replaceChildren(document.createTextNode(st.sunset));
        document.getElementById('val-day-length')?.replaceChildren(document.createTextNode(`${st.dayLengthHours} hrs`));

        // Golden & Blue Hours
        document.getElementById('val-gh-morning')?.replaceChildren(document.createTextNode(
            st.goldenHourMorning.valid ? `${st.goldenHourMorning.start} - ${st.goldenHourMorning.end}` : "N/A"
        ));
        document.getElementById('val-gh-evening')?.replaceChildren(document.createTextNode(
            st.goldenHourEvening.valid ? `${st.goldenHourEvening.start} - ${st.goldenHourEvening.end}` : "N/A"
        ));
        document.getElementById('val-bh-morning')?.replaceChildren(document.createTextNode(
            st.blueHourMorning.valid ? `${st.blueHourMorning.start} - ${st.blueHourMorning.end}` : "N/A"
        ));
        document.getElementById('val-bh-evening')?.replaceChildren(document.createTextNode(
            st.blueHourEvening.valid ? `${st.blueHourEvening.start} - ${st.blueHourEvening.end}` : "N/A"
        ));

        // Twilights
        document.getElementById('val-civil-twilight')?.replaceChildren(document.createTextNode(`${st.civilDawn} / ${st.civilDusk}`));
        document.getElementById('val-nautical-twilight')?.replaceChildren(document.createTextNode(`${st.nauticalDawn} / ${st.nauticalDusk}`));
        document.getElementById('val-astro-twilight')?.replaceChildren(document.createTextNode(`${st.astroDawn} / ${st.astroDusk}`));

        // Moon Card
        document.getElementById('val-moonrise')?.replaceChildren(document.createTextNode(lt.moonrise));
        document.getElementById('val-moonset')?.replaceChildren(document.createTextNode(lt.moonset));
        document.getElementById('val-moon-transit')?.replaceChildren(document.createTextNode(`${lt.transit} (Alt ${lt.transitAltitude}°) `));
    }

    renderMoonCanvas(phase) {
        const canvas = document.getElementById('moon-phase-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = w * 0.42;

        ctx.clearRect(0, 0, w, h);

        // Glow
        const glow = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.3);
        glow.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.3, 0, 2 * Math.PI);
        ctx.fill();

        // Dark sphere
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.clip();

        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // Craters texture simulation
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.arc(cx - r * 0.3, cy - r * 0.2, r * 0.25, 0, 2 * Math.PI);
        ctx.arc(cx + r * 0.25, cy + r * 0.35, r * 0.35, 0, 2 * Math.PI);
        ctx.arc(cx + r * 0.1, cy - r * 0.4, r * 0.2, 0, 2 * Math.PI);
        ctx.fill();

        // Illuminated phase
        ctx.fillStyle = '#f1f5f9';
        const illum = phase.illuminationFraction;
        const isWaxing = phase.phaseFraction < 0.5;

        ctx.beginPath();
        if (isWaxing) {
            ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
            const ellW = r * (2 * illum - 1);
            ctx.ellipse(cx, cy, Math.abs(ellW), r, 0, Math.PI / 2, -Math.PI / 2, ellW < 0);
        } else {
            ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false);
            const ellW = r * (2 * illum - 1);
            ctx.ellipse(cx, cy, Math.abs(ellW), r, 0, -Math.PI / 2, Math.PI / 2, ellW < 0);
        }
        ctx.fill();
        ctx.restore();

        // Rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();

        // Textual info under moon
        document.getElementById('moon-phase-name')?.replaceChildren(document.createTextNode(phase.name));
        document.getElementById('moon-illum-percent')?.replaceChildren(document.createTextNode(`${phase.illuminationPercent}% Illuminated`));
        document.getElementById('moon-age-days')?.replaceChildren(document.createTextNode(`Age: ${phase.ageDays} days`));
        document.getElementById('moon-next-full')?.replaceChildren(document.createTextNode(`Next Full Moon in ${phase.daysToFullMoon} days`));
        document.getElementById('moon-next-new')?.replaceChildren(document.createTextNode(`Next New Moon in ${phase.daysToNewMoon} days`));
    }

    drawSolarDial() {
        if (!this.dialCtx || !this.solarTimes || !this.lunarTimes) return;
        const ctx = this.dialCtx;
        const w = this.dialCanvas.width;
        const h = this.dialCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const radius = w * 0.42;

        ctx.clearRect(0, 0, w, h);

        // Dial outer rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Concentric circles (Altitude 0°, 30°, 60°)
        [0.33, 0.66].forEach(f => {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.beginPath();
            ctx.arc(cx, cy, radius * f, 0, 2 * Math.PI);
            ctx.stroke();
        });

        // Cardinal directions
        const cardinals = [
            { l: 'N', a: 0, c: '#f43f5e' },
            { l: 'E', a: 90, c: '#38bdf8' },
            { l: 'S', a: 180, c: '#ffb703' },
            { l: 'W', a: 270, c: '#38bdf8' }
        ];

        cardinals.forEach(cd => {
            const rad = (cd.a - 90) * Math.PI / 180.0;
            const x = cx + Math.cos(rad) * (radius + 14);
            const y = cy + Math.sin(rad) * (radius + 14);
            ctx.fillStyle = cd.c;
            ctx.font = 'bold 12px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cd.l, x, y);
        });

        // Helper to convert (Azimuth, Altitude) to 2D Dial (x, y)
        // 0° alt = outer edge (r = radius), 90° alt = center (r = 0)
        const azAltToDial = (az, alt) => {
            const rNorm = Math.max(0, (90 - alt) / 90) * radius;
            const rad = (az - 90) * Math.PI / 180.0;
            return {
                x: cx + Math.cos(rad) * rNorm,
                y: cy + Math.sin(rad) * rNorm
            };
        };

        // Draw Sun Trajectory on Dial (if enabled)
        if (this.arView.showSunPath && this.sunTrajectory.length > 0) {
            ctx.beginPath();
            let started = false;
            this.sunTrajectory.forEach(pt => {
                if (pt.isAboveHorizon) {
                    const p = azAltToDial(pt.azimuth, pt.altitude);
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                    else ctx.lineTo(p.x, p.y);
                }
            });
            ctx.strokeStyle = '#ffb703';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Draw Moon Trajectory on Dial (if enabled)
        if (this.arView.showMoonPath && this.moonTrajectory.length > 0) {
            ctx.beginPath();
            let started = false;
            this.moonTrajectory.forEach(pt => {
                if (pt.isAboveHorizon) {
                    const p = azAltToDial(pt.azimuth, pt.altitude);
                    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                    else ctx.lineTo(p.x, p.y);
                }
            });
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw Current Sun marker (if enabled)
        if (this.arView.showSunPath && this.arView.sunPosition && this.arView.sunPosition.isAboveHorizon) {
            const sp = azAltToDial(this.arView.sunPosition.azimuth, this.arView.sunPosition.altitude);
            ctx.fillStyle = '#ffb703';
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 7, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // Draw Current Moon marker (if enabled)
        if (this.arView.showMoonPath && this.arView.moonPosition && this.arView.moonPosition.isAboveHorizon) {
            const mp = azAltToDial(this.arView.moonPosition.azimuth, this.arView.moonPosition.altitude);
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(mp.x, mp.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    initFieldKit() {
        const sensorSelect = document.getElementById('fk-fov-sensor');
        if (sensorSelect) {
            sensorSelect.innerHTML = '';
            SensorPresets.forEach((s, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = `${s.name} (${s.width}×${s.height}mm)`;
                if (idx === 0) opt.selected = true;
                sensorSelect.appendChild(opt);
            });
        }

        // Add event listeners on all Field Kit inputs
        const fkIds = [
            'fk-fov-sensor', 'fk-fov-fl',
            'fk-fs-fl', 'fk-fs-ap', 'fk-fs-near',
            'fk-ne-fl', 'fk-ne-ap', 'fk-ne-pitch',
            'fk-nd-base', 'fk-nd-stops',
            'fk-moon-fl',
            'fk-db-lat2', 'fk-db-lon2'
        ];
        fkIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => this.updateFieldKitCalculations());
                el.addEventListener('change', () => this.updateFieldKitCalculations());
            }
        });

        this.updateFieldKitCalculations();
    }

    updateFieldKitCalculations() {
        // 1. FOV
        const sensorIdx = parseInt(document.getElementById('fk-fov-sensor')?.value || '0', 10);
        const sensor = SensorPresets[sensorIdx] || SensorPresets[0];
        const fovFl = parseFloat(document.getElementById('fk-fov-fl')?.value || '24');
        if (sensor && fovFl > 0) {
            const fov = FieldKitMath.calculateFOV(sensor.width, sensor.height, fovFl);
            const elH = document.getElementById('val-fk-hfov');
            const elV = document.getElementById('val-fk-vfov');
            const elD = document.getElementById('val-fk-dfov');
            if (elH) elH.textContent = `${fov.hFov.toFixed(1)}°`;
            if (elV) elV.textContent = `${fov.vFov.toFixed(1)}°`;
            if (elD) elD.textContent = `${fov.dFov.toFixed(1)}°`;
        }

        // 2. Focus Stacking
        const fsFl = parseFloat(document.getElementById('fk-fs-fl')?.value || '35');
        const fsAp = parseFloat(document.getElementById('fk-fs-ap')?.value || '8');
        const fsNear = parseFloat(document.getElementById('fk-fs-near')?.value || '1.5');
        if (fsFl > 0 && fsAp > 0 && fsNear > 0) {
            const fs = FieldKitMath.calculateFocusStack(fsFl, fsAp, fsNear, Infinity);
            const elHfd = document.getElementById('val-fk-hfd');
            const elShots = document.getElementById('val-fk-fs-shots');
            const elFar = document.getElementById('val-fk-fs-far');
            if (elHfd) elHfd.textContent = `${fs.hfd.toFixed(2)} m`;
            if (elShots) elShots.textContent = `${fs.recommendedShots} shot${fs.recommendedShots > 1 ? 's' : ''}`;
            if (elFar) elFar.textContent = (fs.farFocus === Infinity) ? '∞ (Infinity)' : `${fs.farFocus.toFixed(2)} m`;
        }

        // 3. Night Exposure
        const neFl = parseFloat(document.getElementById('fk-ne-fl')?.value || '14');
        const neAp = parseFloat(document.getElementById('fk-ne-ap')?.value || '2.8');
        const nePitch = parseFloat(document.getElementById('fk-ne-pitch')?.value || '4.2');
        if (neFl > 0 && neAp > 0) {
            const ne = FieldKitMath.calculateNightExposure(neFl, neAp, nePitch);
            const elNpf = document.getElementById('val-fk-ne-npf');
            const el500 = document.getElementById('val-fk-ne-500');
            const elIso = document.getElementById('val-fk-ne-iso');
            if (elNpf) elNpf.textContent = ne.shutterSpeedStr;
            if (el500) el500.textContent = `${ne.rule500.toFixed(1)}s`;
            if (elIso) elIso.textContent = `ISO ${ne.recommendedISO}`;
        }

        // 4. ND Filter
        const ndBase = parseFloat(document.getElementById('fk-nd-base')?.value || '0.008');
        const ndStops = parseFloat(document.getElementById('fk-nd-stops')?.value || '10');
        if (ndBase > 0) {
            const nd = FieldKitMath.calculateNdFilter(ndBase, ndStops);
            const elRes = document.getElementById('val-fk-nd-result');
            const elBulb = document.getElementById('val-fk-nd-bulb');
            if (elRes) elRes.textContent = nd.formatted;
            if (elBulb) elBulb.textContent = nd.bulbRequired ? '⚠️ Yes (Bulb mode)' : 'No (Normal shutter)';
        }

        // 5. Apparent Size
        const moonFl = parseFloat(document.getElementById('fk-moon-fl')?.value || '400');
        if (moonFl > 0) {
            const app = FieldKitMath.calculateApparentSize(moonFl, 24.0, 0.53);
            const elSize = document.getElementById('val-fk-moon-size');
            const elPct = document.getElementById('val-fk-moon-percent');
            const elReq = document.getElementById('val-fk-moon-req');
            if (elSize) elSize.textContent = `${app.sizeMm.toFixed(2)} mm`;
            if (elPct) elPct.textContent = `${app.percent.toFixed(1)}% frame height`;
            if (elReq) elReq.textContent = `${Math.round(app.reqFocalFor50Percent)} mm`;
        }

        // 6. Distance & Bearing
        const lat2 = parseFloat(document.getElementById('fk-db-lat2')?.value || '21.033');
        const lon2 = parseFloat(document.getElementById('fk-db-lon2')?.value || '105.845');
        if (!isNaN(lat2) && !isNaN(lon2)) {
            const db = FieldKitMath.calculateDistanceBearing(this.location.lat, this.location.lon, lat2, lon2);
            const elDist = document.getElementById('val-fk-db-dist');
            const elBear = document.getElementById('val-fk-db-bearing');
            if (elDist) elDist.textContent = `${db.distKm.toFixed(2)} km (${db.distMiles.toFixed(2)} mi)`;
            if (elBear) elBear.textContent = `${db.bearingDeg.toFixed(1)}° (${db.cardinal})`;
        }
    }

    renderMeteorShowers() {
        const container = document.getElementById('meteor-shower-list');
        if (!container) return;

        const h = Math.floor(this.currentMinuteOfDay / 60);
        const m = this.currentMinuteOfDay % 60;
        const illumFraction = this.moonPhase ? (this.moonPhase.fraction || 0.0) : 0.0;

        const showers = MeteorShowerEngine.calculateAll(
            this.selectedDate,
            h,
            m,
            this.location.utcOffset,
            this.location.lat,
            this.location.lon,
            illumFraction
        );

        container.innerHTML = '';
        showers.forEach(s => {
            const card = document.createElement('div');
            card.style.background = s.isPeakToday
                ? 'rgba(245, 158, 11, 0.15)'
                : (s.isCurrentlyActive ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)');
            card.style.border = s.isPeakToday
                ? '1px solid rgba(245, 158, 11, 0.5)'
                : (s.isCurrentlyActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid var(--border-glass)');
            card.style.borderRadius = 'var(--radius-md)';
            card.style.padding = '12px 14px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '6px';

            const statusBadge = s.isPeakToday
                ? '<span style="background: #f59e0b; color: #000; font-weight: 700; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">🔥 PEAK TONIGHT</span>'
                : (s.isCurrentlyActive
                    ? '<span style="background: rgba(56, 189, 248, 0.3); color: #38bdf8; font-weight: 700; font-size: 0.68rem; padding: 2px 6px; border-radius: 4px;">✨ ACTIVE</span>'
                    : '<span style="color: var(--text-muted); font-size: 0.68rem;">Inactive</span>');

            const horizonBadge = s.isRadiantAboveHorizon
                ? '<span style="color: #4ade80;">Above Horizon</span>'
                : '<span style="color: var(--text-muted);">Below Horizon</span>';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 700; font-size: 0.9rem;">${s.info.name}</div>
                    ${statusBadge}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">
                    Peak: ${s.info.peakMonth}/${s.info.peakDay} • Peak ZHR: ${s.info.peakZhr}/hr
                </div>
                <div style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--text-muted); display: flex; justify-content: space-between;">
                    <span>Radiant: Az ${s.radiantAzimuth.toFixed(0)}° Alt ${s.radiantAltitude.toFixed(0)}°</span>
                    <span>${horizonBadge}</span>
                </div>
                ${s.isCurrentlyActive ? `
                <div style="font-size: 0.78rem; font-weight: 600; color: ${s.isPeakToday ? 'var(--solar-gold)' : 'var(--lunar-cyan)'}; margin-top: 2px;">
                    Est. Rate: ~${Math.round(s.estimatedVisibleRate)} meteors/hr
                </div>` : ''}
            `;
            container.appendChild(card);
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
            navigator.serviceWorker.register('sw.js').then(reg => {
                console.log("Service Worker registered successfully for offline ephemeris:", reg.scope);
            }).catch(err => {
                console.warn("Service Worker registration failed:", err);
            });
        }
    }
}

// Bootstrap application on DOM load
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

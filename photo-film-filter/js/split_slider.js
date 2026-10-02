/**
 * Interactive Before / After Split Slider Controller
 */
class SplitSlider {
  constructor(containerId, beforeCanvasId, afterCanvasId, dividerId) {
    this.container = document.getElementById(containerId);
    this.canvasBefore = document.getElementById(beforeCanvasId);
    this.canvasAfter = document.getElementById(afterCanvasId);
    this.divider = document.getElementById(dividerId);

    this.ctxBefore = this.canvasBefore.getContext('2d');
    this.ctxAfter = this.canvasAfter.getContext('2d');

    this.position = 0.5; // 0.0 to 1.0
    this.isDragging = false;

    this.initEvents();
  }

  initEvents() {
    const onStart = (e) => {
      this.isDragging = true;
      this.updatePositionFromEvent(e);
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      this.updatePositionFromEvent(e);
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    // Mouse events
    this.container.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    // Touch events for mobile
    this.container.addEventListener('touchstart', (e) => onStart(e.touches[0]), { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (this.isDragging) {
        e.preventDefault();
        onMove(e.touches[0]);
      }
    }, { passive: false });
    window.addEventListener('touchend', onEnd);

    window.addEventListener('resize', () => this.updateLayout());
  }

  updatePositionFromEvent(e) {
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    this.position = Math.max(0.01, Math.min(0.99, x / rect.width));
    this.updateLayout();
  }

  setDimensions(width, height) {
    this.canvasBefore.width = width;
    this.canvasBefore.height = height;
    this.canvasAfter.width = width;
    this.canvasAfter.height = height;

    this.updateLayout();
  }

  updateLayout() {
    const rect = this.container.getBoundingClientRect();
    const splitPx = rect.width * this.position;

    // Position divider element
    this.divider.style.left = `${splitPx}px`;

    // Clip the Before canvas so it only shows on the left side
    // Using CSS clip-path: polygon(0 0, splitPx 0, splitPx 100%, 0 100%)
    const pct = this.position * 100;
    this.canvasBefore.style.clipPath = `polygon(0 0, ${pct}% 0, ${pct}% 100%, 0 100%)`;
  }

  renderBefore(imageData) {
    this.ctxBefore.putImageData(imageData, 0, 0);
  }

  renderAfter(imageData) {
    this.ctxAfter.putImageData(imageData, 0, 0);
  }
}

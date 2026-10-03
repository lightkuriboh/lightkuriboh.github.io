import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');

test('PWA - manifest.json exists and fulfills installability criteria', () => {
  const manifestPath = path.join(webDir, 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');

  const content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);

  assert.strictEqual(manifest.name, 'Film Magic - Analog Film Simulation');
  assert.strictEqual(manifest.short_name, 'Film Magic');
  assert.strictEqual(manifest.start_url, './index.html');
  assert.strictEqual(manifest.display, 'standalone');
  assert.ok(manifest.theme_color, 'theme_color must be defined');
  assert.ok(manifest.background_color, 'background_color must be defined');

  // Verify icons
  assert.ok(Array.isArray(manifest.icons), 'icons must be an array');
  const sizes = manifest.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192'), 'Must include 192x192 icon');
  assert.ok(sizes.includes('512x512'), 'Must include 512x512 icon');

  // Verify physical icon files exist
  for (const icon of manifest.icons) {
    const iconPath = path.join(webDir, icon.src);
    assert.ok(fs.existsSync(iconPath), `Icon file ${icon.src} must exist`);
    assert.ok(fs.statSync(iconPath).size > 0, `Icon file ${icon.src} must not be empty`);
  }
});

test('PWA - Service Worker sw.js exists with lifecycle handlers', () => {
  const swPath = path.join(webDir, 'sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js must exist');

  const swContent = fs.readFileSync(swPath, 'utf8');
  assert.ok(swContent.includes('install'), 'sw.js must handle install event');
  assert.ok(swContent.includes('activate'), 'sw.js must handle activate event');
  assert.ok(swContent.includes('fetch'), 'sw.js must handle fetch event for offline support');
  assert.ok(swContent.includes('caches.open'), 'sw.js must use Cache Storage API');
});

test('PWA - index.html includes all required platform meta tags', () => {
  const indexPath = path.join(webDir, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // Manifest link
  assert.ok(html.includes('rel="manifest"'), 'index.html must link to manifest.json');

  // Theme color for Android / Chrome
  assert.ok(html.includes('name="theme-color"'), 'index.html must specify theme-color');

  // Apple iOS tags
  assert.ok(html.includes('name="apple-mobile-web-app-capable"'), 'index.html must have apple-mobile-web-app-capable');
  assert.ok(html.includes('name="apple-mobile-web-app-status-bar-style"'), 'index.html must have status bar style');
  assert.ok(html.includes('rel="apple-touch-icon"'), 'index.html must define apple-touch-icon');

  // Viewport for responsive mobile app behavior
  assert.ok(html.includes('name="viewport"'), 'index.html must specify viewport');
});

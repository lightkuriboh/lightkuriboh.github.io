import assert from 'node:assert';
import { MeteorShowerEngine, MAJOR_METEOR_SHOWERS } from '../js/engine/meteor_shower.js';

console.log("============================================================");
console.log("  LandscapeHelper Meteor Shower Unit Tests                  ");
console.log("============================================================");

function testCatalog() {
    console.log("[TEST 1] Major Meteor Shower Catalog...");
    assert.strictEqual(MAJOR_METEOR_SHOWERS.length, 12, "Catalog has 12 major showers");
    for (const shower of MAJOR_METEOR_SHOWERS) {
        assert.ok(shower.id, "Shower has ID");
        assert.ok(shower.name, "Shower has name");
        assert.ok(shower.peakZhr > 0, "Shower has positive peak ZHR");
        assert.ok(shower.radiantRaDeg >= 0 && shower.radiantRaDeg < 360, "Valid RA");
        assert.ok(shower.radiantDecDeg >= -90 && shower.radiantDecDeg <= 90, "Valid Dec");
    }
    console.log("  ✓ Catalog integrity PASSED!");
}

function testActiveWindow() {
    console.log("[TEST 2] Active Date Window Calculation (including year wrap)...");
    // Perseids: Jul 17 - Aug 24
    assert.strictEqual(MeteorShowerEngine.isDateInWindow(8, 12, 7, 17, 8, 24), true);
    assert.strictEqual(MeteorShowerEngine.isDateInWindow(7, 10, 7, 17, 8, 24), false);

    // Quadrantids: Dec 28 - Jan 12 (wraps year end)
    assert.strictEqual(MeteorShowerEngine.isDateInWindow(1, 4, 12, 28, 1, 12), true);
    assert.strictEqual(MeteorShowerEngine.isDateInWindow(12, 30, 12, 28, 1, 12), true);
    assert.strictEqual(MeteorShowerEngine.isDateInWindow(6, 15, 12, 28, 1, 12), false);
    console.log("  ✓ Date window calculation PASSED!");
}

function testPositionAndRates() {
    console.log("[TEST 3] Radiant Position & Rate Calculations...");
    const date = new Date(2025, 7, 12, 23, 0); // Perseids peak night (Aug 12)
    const positions = MeteorShowerEngine.calculateAll(date, 23, 0, 0.0, 45.0, 0.0, 0.1);

    assert.strictEqual(positions.length, 12);
    const perseids = positions.find(s => s.info.id === 'perseids');
    assert.ok(perseids, "Perseids found");
    assert.strictEqual(perseids.isCurrentlyActive, true);
    assert.strictEqual(perseids.isPeakToday, true);
    assert.ok(perseids.estimatedVisibleRate > 0, "Non-zero visible rate on peak night");

    // Month boundary peak check: Southern delta Aquariids peaks July 30
    // Check July 31 (1 day after July 30) -> should be peak
    const jul31 = new Date(2025, 6, 31, 23, 0);
    const posJul31 = MeteorShowerEngine.calculateAll(jul31, 23, 0, 0.0, 20.0, 0.0, 0.0);
    const deltaAquariidsJul31 = posJul31.find(s => s.info.id === 'delta_aquariids');
    assert.strictEqual(deltaAquariidsJul31.isPeakToday, true, "July 31 is peak for July 30 shower");

    // Check August 2 (3 days after July 30) -> not peak
    const aug2 = new Date(2025, 7, 2, 23, 0);
    const posAug2 = MeteorShowerEngine.calculateAll(aug2, 23, 0, 0.0, 20.0, 0.0, 0.0);
    const deltaAquariidsAug2 = posAug2.find(s => s.info.id === 'delta_aquariids');
    assert.strictEqual(deltaAquariidsAug2.isPeakToday, false, "August 2 is not peak for July 30 shower");

    console.log("  ✓ Position and rate calculations PASSED!");
}

testCatalog();
testActiveWindow();
testPositionAndRates();

console.log("\nAll Meteor Shower unit tests completed successfully!\n");

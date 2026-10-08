import assert from 'node:assert';
import { FeatureGate } from '../js/ui/feature_gate.js';

console.log("============================================================");
console.log("  LandscapeHelper Feature Gate Unit Tests                   ");
console.log("============================================================");

async function testFeatureGate() {
    console.log("[TEST 1] FeatureGate Initialization & Fallbacks...");
    const gate = new FeatureGate();
    assert.strictEqual(gate.initialized, false);

    // Initializing with non-existent path triggers built-in default features
    await gate.init('./non_existent_config.json');
    assert.strictEqual(gate.initialized, true);
    assert.ok(Object.keys(gate.features).length >= 10, "Has default features loaded");

    // Check default features
    assert.strictEqual(gate.isEnabled('sun_tracking'), true);
    assert.strictEqual(gate.isEnabled('moon_tracking'), true);
    assert.strictEqual(gate.isEnabled('fov_calculator'), true);
    assert.strictEqual(gate.isEnabled('unknown_tool'), false);

    console.log("  ✓ Fallback initialization PASSED!");

    console.log("[TEST 2] Category filtering & state mutation...");
    const tools = gate.getByCategory('tools');
    assert.ok(tools.length >= 7, "Contains all 7 Field Kit tools");

    const celestial = gate.getByCategory('celestial');
    assert.ok(celestial.length >= 5, "Contains celestial features");

    // Dynamic state mutation
    gate.setFeatureState('fov_calculator', 'disabled');
    assert.strictEqual(gate.isEnabled('fov_calculator'), false);

    gate.setFeatureState('fov_calculator', 'locked');
    assert.strictEqual(gate.isLocked('fov_calculator'), true);
    assert.strictEqual(gate.isEnabled('fov_calculator'), false);

    gate.setFeatureState('fov_calculator', 'enabled');
    assert.strictEqual(gate.isEnabled('fov_calculator'), true);

    console.log("  ✓ Feature mutation and queries PASSED!");
}

testFeatureGate().then(() => {
    console.log("\nAll FeatureGate unit tests completed successfully!\n");
});

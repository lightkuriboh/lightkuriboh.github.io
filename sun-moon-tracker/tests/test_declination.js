import { getDeclination } from '../js/engine/declination.js';

function assert(condition, message) {
    if (!condition) {
        console.error("Assertion FAILED:", message);
        process.exit(1);
    }
}

console.log("============================================================");
console.log("  LandscapeHelper Magnetic Declination Unit Tests           ");
console.log("============================================================");

console.log("[TEST 1] Known City Benchmark Declinations...");
// Test Hanoi: ~ -1.9° (expected within [-4.0, 0.0])
const decHanoi = getDeclination(21.03, 105.85);
console.log(`  Hanoi (21.03°, 105.85°): ${decHanoi.toFixed(2)}°`);
assert(decHanoi > -5.0 && decHanoi < 1.0, `Hanoi declination unexpected: ${decHanoi}`);

// Test Seattle: ~ +16° (expected within [+12.0, +20.0])
const decSeattle = getDeclination(47.6, -122.3);
console.log(`  Seattle (47.60°, -122.30°): ${decSeattle.toFixed(2)}°`);
assert(decSeattle > 10.0 && decSeattle < 22.0, `Seattle declination unexpected: ${decSeattle}`);

// Test Sydney: ~ +12.8° (expected within [+9.0, +16.0])
const decSydney = getDeclination(-33.86, 151.2);
console.log(`  Sydney (-33.86°, 151.20°): ${decSydney.toFixed(2)}°`);
assert(decSydney > 8.0 && decSydney < 18.0, `Sydney declination unexpected: ${decSydney}`);

// Test London: ~ +0.8° (expected within [-2.0, +3.0])
const decLondon = getDeclination(51.5, -0.12);
console.log(`  London (51.50°, -0.12°): ${decLondon.toFixed(2)}°`);
assert(decLondon > -3.0 && decLondon < 4.0, `London declination unexpected: ${decLondon}`);

// Test Invalid / NaN Inputs
const decInvalid = getDeclination(NaN, NaN);
assert(decInvalid === 0, `Invalid input should return 0, got ${decInvalid}`);

console.log("  ✓ All Declination benchmark tests PASSED!\n");
console.log(">>> ALL DECLINATION TESTS PASSED! <<<");

/**
 * Feature Gate Service for Web PWA.
 * Enables independent toggling, admin disabling, and paywalling of tools and celestial layers.
 */
export class FeatureGate {
    constructor() {
        this.features = {};
        this.initialized = false;
    }

    async init(configPath = './feature_config.json') {
        try {
            const resp = await fetch(configPath);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            this.features = data.features || {};
            this.initialized = true;
        } catch (err) {
            console.warn('FeatureGate: Falling back to default built-in configuration:', err);
            this.features = this.getDefaultFeatures();
            this.initialized = true;
        }
    }

    isEnabled(featureId) {
        const feature = this.features[featureId];
        return feature ? feature.state === 'enabled' : false;
    }

    isLocked(featureId) {
        const feature = this.features[featureId];
        return feature ? feature.state === 'locked' : false;
    }

    getFeature(featureId) {
        return this.features[featureId] || null;
    }

    getByCategory(category) {
        return Object.values(this.features).filter(f => f.category === category);
    }

    setFeatureState(featureId, state) {
        if (this.features[featureId]) {
            this.features[featureId].state = state;
        }
    }

    getDefaultFeatures() {
        return {
            sun_tracking: { id: 'sun_tracking', category: 'celestial', state: 'enabled', tier: 'free', icon: '☀️' },
            moon_tracking: { id: 'moon_tracking', category: 'celestial', state: 'enabled', tier: 'free', icon: '🌙' },
            milky_way: { id: 'milky_way', category: 'celestial', state: 'enabled', tier: 'free', icon: '🌌' },
            constellations: { id: 'constellations', category: 'celestial', state: 'enabled', tier: 'free', icon: '✨' },
            meteor_showers: { id: 'meteor_showers', category: 'celestial', state: 'enabled', tier: 'free', icon: '☄️' },
            comets: { id: 'comets', category: 'celestial', state: 'enabled', tier: 'free', icon: '💫' },
            fov_calculator: { id: 'fov_calculator', category: 'tools', state: 'enabled', tier: 'free', icon: '📐' },
            focus_stack_calculator: { id: 'focus_stack_calculator', category: 'tools', state: 'enabled', tier: 'free', icon: '🔍' },
            night_exposure_calculator: { id: 'night_exposure_calculator', category: 'tools', state: 'enabled', tier: 'free', icon: '🌟' },
            nd_filter_calculator: { id: 'nd_filter_calculator', category: 'tools', state: 'enabled', tier: 'free', icon: '🔆' },
            apparent_size_calculator: { id: 'apparent_size_calculator', category: 'tools', state: 'enabled', tier: 'free', icon: '📏' },
            sun_terrain_calculator: { id: 'sun_terrain_calculator', category: 'tools', state: 'enabled', tier: 'free', icon: '🏔️' },
            distance_bearing_calculator: { id: 'distance_bearing_calculator', category: 'tools', state: 'enabled', tier: 'free', icon: '🧭' },
        };
    }
}

export const featureGate = new FeatureGate();

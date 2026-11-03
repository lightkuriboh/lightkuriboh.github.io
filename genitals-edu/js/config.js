/**
 * Global Constants & Visual Configuration
 */
export const TISSUE_COLORS = {
  genitalTubercle: { color: '#8B5CF6', atlas: '#E5989B' },
  urogenitalFolds: { color: '#F59E0B', atlas: '#DF7986' },
  labioscrotalSwellings: { color: '#10B981', atlas: '#E8BEAC' },
  urogenitalSinus: { color: '#475569', atlas: '#802838' }
};

export const KEYS = Object.keys(TISSUE_COLORS);

export const CAM = {
  pos: [0, 0.05, 7.8],
  target: [0, 0.0, 0.0]
};

export const styleSets = {
  clay:  { amb: 0.22, hemi: 0.65, sun: 1.05, rim: 0.35, base: 0x3a4a66, sceneBg: 0x0c1220 },
  atlas: { amb: 0.38, hemi: 0.42, sun: 0.48, rim: 0.00, base: 0xc4b39f, sceneBg: 0xded6c9 }
};

export const emissiveBase = {
  clay: 0.08,
  atlas: 0.05
};

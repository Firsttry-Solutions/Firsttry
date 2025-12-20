import { deriveBlindSpots, verifyBlindSpotHash, computeBlindSpotHash } from './src/phase9_5b/blind_spot_map';

const input = {
  tenant_id: 'tenant-11',
  first_install_date: '2025-01-15T10:00:00Z',
  snapshot_runs: [],
  analysis_window: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z',
  },
};

const map = deriveBlindSpots(input);
console.log('Original coverage:', map.coverage_percentage);
console.log('Original hash:', map.canonical_hash);

// Verify original is valid
const isValid1 = verifyBlindSpotHash(map);
console.log('Original valid:', isValid1);

// Corrupt it
const originalCoverage = map.coverage_percentage;
map.coverage_percentage = 0;

console.log('New coverage:', map.coverage_percentage);
const newHash = computeBlindSpotHash(map);
console.log('New hash:', newHash);

// Verify corrupted
const isValid2 = verifyBlindSpotHash(map);
console.log('Corrupted valid:', isValid2);

console.log('Test expects: false, got:', isValid2);

const { deriveBlindSpots } = require('./src/phase9_5b/blind_spot_map.ts');

const input = {
  tenant_id: 'tenant-1',
  first_install_date: '2025-01-15T10:00:00Z',
  snapshot_runs: [],
  analysis_window: {
    start: '2025-01-01T00:00:00Z',
    end: '2025-01-31T23:59:59Z',
  },
};

const map = deriveBlindSpots(input);
console.log('Blind spots:');
console.log(JSON.stringify(map.blind_spot_periods, null, 2));

const { createHash } = require('crypto');

// Test hash computation with coverage
const data1 = '{"analysis_end":"2025-01-31T23:59:59Z","analysis_start":"2025-01-01T00:00:00Z","blind_spot_periods":[{"duration_days":14.583333333333334,"end_time":"2025-01-15T10:00:00Z","reason":"not_installed","reason_description":"FirstTry was not installed during this period","severity":"critical","start_time":"2025-01-01T00:00:00Z"},{"duration_days":16.416666666666668,"end_time":"2025-01-31T23:59:59Z","reason":"unknown","reason_description":"No snapshot data available for analysis window","duration_days":16.416666666666668,"severity":"critical","start_time":"2025-01-15T10:00:00Z"}],"coverage_percentage":3.2,"schema_version":"1.0","tenant_id":"tenant-11","total_blind_days":30.833333333333332}';

const data2 = '{"analysis_end":"2025-01-31T23:59:59Z","analysis_start":"2025-01-01T00:00:00Z","blind_spot_periods":[{"duration_days":14.583333333333334,"end_time":"2025-01-15T10:00:00Z","reason":"not_installed","reason_description":"FirstTry was not installed during this period","severity":"critical","start_time":"2025-01-01T00:00:00Z"},{"duration_days":16.416666666666668,"end_time":"2025-01-31T23:59:59Z","reason":"unknown","reason_description":"No snapshot data available for analysis window","duration_days":16.416666666666668,"severity":"critical","start_time":"2025-01-15T10:00:00Z"}],"coverage_percentage":0,"schema_version":"1.0","tenant_id":"tenant-11","total_blind_days":30.833333333333332}';

const hash1 = createHash('sha256').update(data1).digest('hex');
const hash2 = createHash('sha256').update(data2).digest('hex');

console.log('Hash 1:', hash1);
console.log('Hash 2:', hash2);
console.log('Equal:', hash1 === hash2);

import fs from 'fs';
import path from 'path';

const manifestPath = './manifest.yml';

try {
  if (!fs.existsSync(manifestPath)) {
    console.error(`FAIL: manifest.yml not found at ${manifestPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(manifestPath, 'utf-8');
  
  // Simple fallback YAML parsing (basic key: value extraction)
  const lines = raw.split('\n');
  const config = {};
  let currentSection = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
      currentSection = trimmed.slice(0, -1);
      config[currentSection] = [];
    } else if (trimmed.startsWith('- ')) {
      if (currentSection) {
        config[currentSection].push(trimmed.slice(2));
      }
    }
  });

  console.log('=== MANIFEST AUDIT ===');
  console.log(`Manifest file: ${manifestPath}`);
  console.log(`File size: ${raw.length} bytes`);
  console.log('');
  console.log('=== SCOPES ===');
  if (config.scopes) {
    config.scopes.forEach(s => console.log(`  - ${s}`));
  } else {
    console.log('  (no scopes declared)');
  }
  
  console.log('');
  console.log('=== MODULES ===');
  if (config.modules) {
    config.modules.forEach(m => console.log(`  - ${m}`));
  } else {
    console.log('  (no modules declared)');
  }

  console.log('');
  console.log('Raw manifest (first 500 chars):');
  console.log(raw.substring(0, 500));
  console.log('');
  console.log('✅ Manifest parsed successfully');
  process.exit(0);
} catch (err) {
  console.error(`❌ Manifest parsing failed: ${err.message}`);
  process.exit(1);
}

#!/usr/bin/env node

/**
 * RequestJira Classification Processor
 * Parses ripgrep output and classifies requestJira calls
 */

import fs from 'fs';

const detFile = process.argv[2];
const csvOut = process.argv[3];

if (!detFile || !csvOut) {
  console.error('Usage: processor_requestjira.mjs <rg_output_file> <csv_output_file>');
  process.exit(1);
}

const content = fs.readFileSync(detFile, 'utf-8').trim();

let stats = { total: 0, read: 0, write: 0, unknown: 0 };
const rows = [];

if (content) {
  const blocks = content.split(/^--$/m);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (!lines.length) continue;
    
    const m = lines[0].match(/^([^:]+):(\d+)[:|-](.*)$/);
    if (!m) continue;
    
    const file = m[1];
    const lineNum = m[2];
    let full = m[3];
    
    for (let i = 1; i < lines.length; i++) {
      full += ' ' + lines[i].replace(/^\d+[-|:]/, '');
    }
    
    if (!full.includes('.requestJira(')) continue;
    
    // Determine HTTP method
    let method = 'GET';
    const mt = full.match(/method\s*:\s*['"]?(POST|PUT|DELETE|PATCH)['"]?/i);
    if (mt) method = mt[1].toUpperCase();
    
    // Determine endpoint
    let endpoint = 'UNKNOWN';
    const rt = full.match(/route`([^`]+)`/);
    if (rt) {
      endpoint = rt[1];
    } else {
      const lt = full.match(/requestJira\(\s*["']([^"']+)["']/);
      if (lt) {
        endpoint = lt[1];
      } else if (full.match(/requestJira\(\s*\$\{|requestJira\(\s*[a-z_]/i)) {
        endpoint = 'DYNAMIC';
      }
    }
    
    // Classify
    let cls = 'UNKNOWN';
    if (method === 'GET' && endpoint !== 'UNKNOWN' && endpoint !== 'DYNAMIC') {
      cls = 'READ';
      stats.read++;
    } else if (/POST|PUT|DELETE|PATCH/.test(method) && endpoint !== 'UNKNOWN' && endpoint !== 'DYNAMIC') {
      cls = 'WRITE';
      stats.write++;
    } else {
      cls = (endpoint === 'DYNAMIC' || method === 'UNKNOWN') ? 'REVIEW_REQUIRED' : 'UNKNOWN';
      stats.unknown++;
    }
    
    stats.total++;
    rows.push({ file, lineNum, method, endpoint, cls });
  }
}

let csv = 'file,line,method,endpoint,classification\n';

// Sort rows deterministically by file path and line number
rows.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return parseInt(a.lineNum) - parseInt(b.lineNum);
});

for (const r of rows) {
  csv += `${r.file},${r.lineNum},${r.method},"${r.endpoint}",${r.cls}\n`;
}

fs.writeFileSync(csvOut, csv);
console.log(JSON.stringify(stats));

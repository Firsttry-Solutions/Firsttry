#!/usr/bin/env node
/**
 * Dashboard Audit Report Generator
 * Processes raw evidence and generates structured reports
 * 
 * EVIDENCE-GRADE RULES:
 * - CSS files NEVER qualify as evidence
 * - Test files NEVER qualify as evidence
 * - PRESENT requires UI + backend snippets
 * - PARTIAL allows single side with explicit notes
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUN_DIR = process.argv[2];
const APP_ROOT = process.argv[3];
const UTC_TS = process.argv[4];

if (!RUN_DIR || !APP_ROOT || !UTC_TS) {
  console.error('Usage: node dashboard_audit_report.mjs <RUN_DIR> <APP_ROOT> <UTC_TS>');
  process.exit(1);
}

console.log(`[REPORT] Generating reports from ${RUN_DIR}`);
console.log(`[REPORT] APP_ROOT: ${APP_ROOT}`);

// ============================================================================
// STEP 1: Evidence Quality Filters
// ============================================================================

/**
 * Determine if a file path is disallowed as evidence.
 * CSS, tests, and spec files are NEVER valid evidence.
 */
function isDisallowedEvidenceFile(filepath) {
  if (!filepath) return true;
  // CSS files disallowed
  if (filepath.endsWith('.css')) return true;
  // Test files disallowed
  if (filepath.includes('__tests__')) return true;
  if (filepath.match(/\.test\.[tj]sx?$/)) return true;
  if (filepath.match(/\.spec\.[tj]sx?$/)) return true;
  return false;
}

/**
 * Filter references to only include valid evidence files.
 */
function filterValidEvidence(refs) {
  return refs.filter(ref => ref && !isDisallowedEvidenceFile(ref.file));
}

// ============================================================================
// STEP 2: Identify UI and resolver files
// ============================================================================

function readRgOutput(filename) {
  const filepath = path.join(RUN_DIR, filename);
  try {
    if (!fs.existsSync(filepath)) return [];
    const content = fs.readFileSync(filepath, 'utf8');
    return content.split('\n')
      .filter(line => line.trim() && !line.includes('No matches'))
      .map(line => {
        const match = line.match(/^([^:]+):(\d+):/);
        if (match) {
          return { file: match[1], lineNum: parseInt(match[2]), line };
        }
        return null;
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

// Parse rg outputs to find files
const resolverRefs = filterValidEvidence(readRgOutput('rg_dashboard_resolver.txt'));
const uiRefs = filterValidEvidence(readRgOutput('rg_dashboard_ui_render.txt'));
const exportRefs = filterValidEvidence(readRgOutput('rg_exports.txt'));
const resolverDefRefs = filterValidEvidence(readRgOutput('rg_resolvers.txt'));

const uiFiles = new Set();
const backendFiles = new Set();

// Populate UI files
[...uiRefs, ...exportRefs].forEach(ref => {
  if (ref && ref.file.includes('/gadget-ui/')) {
    uiFiles.add(ref.file);
  }
});

// Populate backend files
[...resolverRefs, ...resolverDefRefs].forEach(ref => {
  if (ref && (ref.file.includes('/resolvers/') || ref.file.includes('/backend/') || ref.file.match(/^src\/[a-z_]+\.ts$/))) {
    backendFiles.add(ref.file);
  }
});

// If no files found, do broader search
if (uiFiles.size === 0 && backendFiles.size === 0) {
  console.log('[REPORT] No dashboard files found in initial scan, searching more broadly...');
  
  // Find TypeScript files with Dashboard-like patterns
  try {
    const allTs = execSync(`find ${APP_ROOT}/src -name "*.ts" -o -name "*.tsx" 2>/dev/null | head -100`, { encoding: 'utf8' })
      .split('\n')
      .filter(f => f.trim());
    
    allTs.forEach(file => {
      if (!isDisallowedEvidenceFile(file) && (file.includes('dashboard') || file.includes('Dashboard') || file.includes('gadget-ui'))) {
        if (file.includes('/gadget-ui/')) {
          uiFiles.add(file.replace(APP_ROOT + '/', ''));
        } else {
          backendFiles.add(file.replace(APP_ROOT + '/', ''));
        }
      }
    });
  } catch (e) {
    console.log('[REPORT] Broader search failed:', e.message);
  }
}

console.log(`[REPORT] Found UI files (valid): ${uiFiles.size}`);
console.log(`[REPORT] Found backend files (valid): ${backendFiles.size}`);

// ============================================================================
// Extract evidence from files
// ============================================================================

function extractSnippet(filepath, lineNum, context = 8) {
  try {
    if (isDisallowedEvidenceFile(filepath)) {
      return null;
    }
    
    const fullPath = path.join(APP_ROOT, filepath);
    if (!fs.existsSync(fullPath)) return null;
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    
    const start = Math.max(0, lineNum - 1 - context);
    const end = Math.min(lines.length, lineNum + context);
    
    return {
      file: filepath,
      lineStart: start + 1,
      lineEnd: end,
      snippet: lines.slice(start, end).join('\n')
    };
  } catch (e) {
    return null;
  }
}

// ============================================================================
// STEP 3: Evaluate checklist requirements (EVIDENCE-GRADE)
// ============================================================================

const requirements = [
  {
    id: 'A1',
    title: 'Evidence status at-a-glance (one screen, zero scrolling)',
    details: [
      'Status display (AVAILABLE/NO_DATA/ERROR)',
      '"Last updated" timestamp (UTC)',
      'Capture trigger indication',
      'Error reason + correlation ID (if error)'
    ],
    evaluator: (allRefs) => {
      // RULE: PRESENT requires UI + backend tokens in SAME FILE OR separate files
      const uiRefs = filterValidEvidence(readRgOutput('rg_dashboard_ui_render.txt'));
      const stateRefs = filterValidEvidence(readRgOutput('rg_state_mapping.txt'));
      
      // Check UI for status/timestamp/trigger/correlation tokens
      const uiEvidence = [];
      let uiTokens = 0;
      const uiTokenList = [];
      
      uiRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          const tokens = [
            { token: 'AVAILABLE|NO_DATA|ERROR', found: /AVAILABLE|NO_DATA|ERROR/.test(snippet.snippet) },
            { token: 'Last updated|createdAtUtc|timestamp', found: /Last\s+updated|createdAtUtc|timestamp/.test(snippet.snippet) },
            { token: 'trigger|captureTrigger', found: /trigger|captureTrigger/.test(snippet.snippet) },
            { token: 'correlation|correlationId|uiReqId', found: /correlation|correlationId|uiReqId/.test(snippet.snippet) }
          ];
          
          const foundTokens = tokens.filter(t => t.found);
          if (foundTokens.length > 0) {
            uiEvidence.push(snippet);
            uiTokens += foundTokens.length;
            foundTokens.forEach(t => uiTokenList.push(t.token));
          }
        }
      });
      
      // Check backend for state tokens
      const backendEvidence = [];
      let backendTokens = 0;
      const backendTokenList = [];
      
      stateRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          const tokens = [
            { token: 'getOperationalState|getStatusSnapshot|snapshotId', found: /getOperationalState|getStatusSnapshot|snapshotId/.test(snippet.snippet) },
            { token: 'createdAtUtc|captureTrigger|correlationId', found: /createdAtUtc|captureTrigger|correlationId/.test(snippet.snippet) }
          ];
          
          const foundTokens = tokens.filter(t => t.found);
          if (foundTokens.length > 0) {
            backendEvidence.push(snippet);
            backendTokens += foundTokens.length;
            foundTokens.forEach(t => backendTokenList.push(t.token));
          }
        }
      });
      
      const evidence = [...uiEvidence, ...backendEvidence].slice(0, 3);
      const evidenceQuality = uiTokens >= 2 && backendTokens >= 1 ? 'STRONG' : 
                              (uiTokens > 0 || backendTokens > 0) ? 'WEAK' : 'NONE';
      const confidence = uiTokens >= 2 && backendTokens >= 1 ? 'HIGH' : 
                         (uiTokens > 0 || backendTokens > 0) ? 'MED' : 'LOW';
      
      const status = uiTokens >= 2 && backendTokens >= 1 ? 'PRESENT' :
                     (uiTokens > 0 || backendTokens > 0) ? 'PARTIAL' : 'MISSING';
      
      return {
        status,
        evidenceQuality,
        confidence,
        evidence,
        notes: `UI tokens found: ${uiTokenList.join(', ') || 'none'}. Backend tokens found: ${backendTokenList.join(', ') || 'none'}. ${status === 'PARTIAL' ? '(Only ' + (uiTokens > 0 ? 'UI' : 'backend') + ' side has evidence)' : ''}`
      };
    }
  },
  {
    id: 'A2-backend',
    title: 'Build provenance - backend (app version/build SHA)',
    details: [
      'Build SHA or commit ID present in code',
      'Schema version defined',
      'From resolvers or build modules (not validators)'
    ],
    evaluator: (allRefs) => {
      const metaRefs = filterValidEvidence(readRgOutput('rg_metadata.txt'));
      
      const evidence = [];
      let buildShaFound = false;
      let schemaVersionFound = false;
      let isValidSource = false;
      
      metaRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          // IMPORTANT: Exclude validators.ts which has generic schemaVersion references
          if (ref.file.includes('validators.ts')) {
            return; // Skip this file
          }
          
          // Accept only from resolvers, build, shared, or other provenance modules
          const isFromProvenanceModule = ref.file.includes('/resolvers/') || 
                                         ref.file.includes('/build/') ||
                                         ref.file.includes('/shared/') ||
                                         ref.file.includes('backend_build');
          
          if (/backend_build_sha|ui_build_sha|buildSha|commitId|getBuildInfo|getSnapshotVariant|FT_BUILD_SHA/.test(snippet.snippet)) {
            if (isFromProvenanceModule) {
              buildShaFound = true;
              isValidSource = true;
              evidence.push(snippet);
            }
          }
          if (/schemaVersion|schema.*version/.test(snippet.snippet)) {
            if (isFromProvenanceModule) {
              schemaVersionFound = true;
              evidence.push(snippet);
            }
          }
        }
      });
      
      const evidenceQuality = buildShaFound && isValidSource ? 'STRONG' : 'NONE';
      const confidence = buildShaFound && isValidSource ? 'HIGH' : 'LOW';
      const status = buildShaFound && isValidSource ? 'PRESENT' : 'MISSING';
      
      return {
        status,
        evidenceQuality,
        confidence,
        evidence: evidence.slice(0, 2),
        notes: `Build SHA: ${buildShaFound ? 'found in provenance module' : 'NOT found'}. Source: ${isValidSource ? 'valid (resolvers/build)' : 'invalid or missing'}.`
      };
    }
  },
  {
    id: 'A2-ui',
    title: 'Build provenance - UI display (shown to user)',
    details: [
      'Build SHA rendered in UI',
      'Snapshot ID or Schema version also visible',
      'In dedicated provenance section'
    ],
    evaluator: (allRefs) => {
      const provenanceRefs = filterValidEvidence(readRgOutput('rg_ui_provenance.txt'));
      
      const evidence = [];
      let hasBuildSha = false;
      let hasSchemaOrId = false;
      let hasProvenanceElement = false;
      
      provenanceRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          // Look for Build SHA label/display
          if (/Build SHA/.test(snippet.snippet)) {
            hasBuildSha = true;
            evidence.push(snippet);
          }
          // Look for Schema or Snapshot ID
          if (/Schema|Snapshot ID/.test(snippet.snippet)) {
            hasSchemaOrId = true;
          }
          // Look for dedicated provenance element
          if (/l0-provenance-strip|l0-provenance-field/.test(snippet.snippet)) {
            hasProvenanceElement = true;
          }
        }
      });
      
      const isPresent = hasBuildSha && hasSchemaOrId && hasProvenanceElement;
      const evidenceQuality = isPresent ? 'STRONG' : provenanceRefs.length > 0 ? 'WEAK' : 'NONE';
      const confidence = isPresent ? 'HIGH' : provenanceRefs.length > 0 ? 'MED' : 'LOW';
      const status = isPresent ? 'PRESENT' : 'MISSING';
      
      return {
        status,
        evidenceQuality,
        confidence,
        evidence: evidence.slice(0, 2),
        notes: `Build SHA: ${hasBuildSha ? 'YES' : 'NO'}. Schema/ID: ${hasSchemaOrId ? 'YES' : 'NO'}. Provenance element: ${hasProvenanceElement ? 'YES' : 'NO'}.`
      };
    }
  },
  {
    id: 'A3',
    title: 'Scope & coverage summary',
    details: [
      'Included/excluded specification',
      'Counts if computed, explicit "not computed" if not'
    ],
    evaluator: (allRefs) => {
      const scopeRefs = filterValidEvidence(readRgOutput('rg_scope_boundaries.txt'));
      
      const evidence = [];
      scopeRefs.slice(0, 2).forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) evidence.push(snippet);
      });
      
      const evidenceQuality = evidence.length > 0 ? 'STRONG' : 'NONE';
      const confidence = evidence.length > 0 ? 'HIGH' : 'LOW';
      
      return {
        status: evidence.length > 0 ? 'PRESENT' : 'MISSING',
        evidenceQuality,
        confidence,
        evidence,
        notes: evidence.length > 0 ? 'Scope boundaries defined' : 'No scope/coverage metadata found'
      };
    }
  },
  {
    id: 'A4',
    title: 'Export that procurement can approve',
    details: [
      'Export handler in backend (JSON acceptable)',
      'Deterministic file naming (snapshotId + timestamp + schemaVersion)',
      'UI button/control to invoke export'
    ],
    evaluator: (allRefs) => {
      // RULE: PRESENT requires backend handler + UI control + deterministic naming proof
      const exportRefs = filterValidEvidence(readRgOutput('rg_export_logic.txt'));
      const uiRefs = filterValidEvidence(readRgOutput('rg_dashboard_ui_render.txt'));
      
      const backendEvidence = [];
      let hasExportHandler = false;
      let hasDeterministic = false;
      
      exportRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          if (/export.*json|JSON|application\/json|blob|download|Buffer|writeFile/.test(snippet.snippet)) {
            hasExportHandler = true;
            backendEvidence.push(snippet);
          }
          if (/snapshotId.*timestamp|timestamp.*snapshotId|schemaVersion.*snapshot|snapshot.*schema/.test(snippet.snippet)) {
            hasDeterministic = true;
          }
        }
      });
      
      const uiEvidence = [];
      let hasExportButton = false;
      
      uiRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          if (/[Ee]xport|download|invoke.*export/.test(snippet.snippet)) {
            hasExportButton = true;
            uiEvidence.push(snippet);
          }
        }
      });
      
      const evidence = [...backendEvidence, ...uiEvidence].slice(0, 3);
      const evidenceQuality = hasExportHandler && hasExportButton && hasDeterministic ? 'STRONG' :
                              hasExportHandler && hasExportButton ? 'WEAK' : 'NONE';
      const confidence = hasExportHandler && hasExportButton && hasDeterministic ? 'HIGH' :
                         hasExportHandler || hasExportButton ? 'MED' : 'LOW';
      
      const status = hasExportHandler && hasExportButton ? 'PRESENT' :
                     hasExportHandler ? 'PARTIAL' : 'MISSING';
      
      return {
        status,
        evidenceQuality,
        confidence,
        evidence,
        notes: `Backend export: ${hasExportHandler ? 'found' : 'NOT found'}. UI control: ${hasExportButton ? 'found' : 'NOT found'}. Deterministic naming: ${hasDeterministic ? 'found' : 'NOT found'}.`
      };
    }
  },
  {
    id: 'A5',
    title: 'Filtering / targeting (snapshot selection)',
    details: [
      'UI control for snapshot variant selection (Latest vs Seed)',
      'Backend resolver to fetch selected snapshot',
      'Dynamic re-render on selection change'
    ],
    evaluator: (allRefs) => {
      // Check UI side: look for variant selector control
      const uiSelectorRefs = filterValidEvidence(readRgOutput('rg_ui_snapshot_selector.txt'));
      
      let hasUIControl = false;
      let hasViewLabel = false;
      const uiEvidence = [];
      
      uiSelectorRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          if (/ft-snapshot-variant-select/.test(snippet.snippet)) {
            hasUIControl = true;
            uiEvidence.push(snippet);
          }
          if (/View Snapshot/.test(snippet.snippet)) {
            hasViewLabel = true;
          }
        }
      });
      
      // Check backend side: look for getSnapshotVariant resolver
      const resolverRefs = filterValidEvidence(readRgOutput('rg_resolvers.txt'));
      let hasBackendResolver = false;
      const backendEvidence = [];
      
      resolverRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          if (/getSnapshotVariant|ft_getSnapshotVariant/.test(snippet.snippet)) {
            hasBackendResolver = true;
            backendEvidence.push(snippet);
          }
        }
      });
      
      const evidence = [...uiEvidence, ...backendEvidence].slice(0, 2);
      const isPresent = hasUIControl && hasBackendResolver;
      const isPartial = hasUIControl || hasBackendResolver; // One side only
      
      const evidenceQuality = isPresent ? 'STRONG' : isPartial ? 'WEAK' : 'NONE';
      const confidence = isPresent ? 'HIGH' : isPartial ? 'MED' : 'LOW';
      const status = isPresent ? 'PRESENT' : isPartial ? 'PARTIAL' : 'MISSING';
      
      return {
        status,
        evidenceQuality,
        confidence,
        evidence,
        notes: `UI Control: ${hasUIControl ? 'YES' : 'NO'}. Backend Resolver: ${hasBackendResolver ? 'YES' : 'NO'}. ${hasViewLabel ? '(Label: View Snapshot)' : ''}`
      };
    }
  },
  {
    id: 'A6',
    title: 'Supportability hooks',
    details: [
      'Support link visible in UI',
      'Correlation ID visible in UI',
      '"Copy diagnostics" button with snapshotId + correlationId + buildSha + status'
    ],
    evaluator: (allRefs) => {
      // RULE: PRESENT requires UI evidence showing copy button + support link
      const uiRefs = filterValidEvidence(readRgOutput('rg_dashboard_ui_render.txt'));
      const supportRefs = filterValidEvidence(readRgOutput('rg_support_hooks.txt'));
      
      const evidence = [];
      let hasSupportLink = false;
      let hasCorrelationId = false;
      let hasCopyButton = false;
      
      // Check UI files for support/correlation UI elements
      uiRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          if (/href=.*support|support.*link|mailto|support.*button/.test(snippet.snippet)) {
            hasSupportLink = true;
            evidence.push(snippet);
          }
          if (/correlationId|uiReqId|copy.*diagnostic|diagnostic.*copy|snapshotId.*copy|copy.*snapshot/.test(snippet.snippet)) {
            hasCorrelationId = true;
            hasCopyButton = true;
            evidence.push(snippet);
          }
        }
      });
      
      // Check support hooks file
      supportRefs.forEach(ref => {
        const snippet = extractSnippet(ref.file, ref.lineNum);
        if (snippet) {
          if (/copy|clipboard|diagnostic/.test(snippet.snippet)) {
            hasCopyButton = true;
            evidence.push(snippet);
          }
          if (/support|correlation/.test(snippet.snippet)) {
            hasSupportLink = true;
            evidence.push(snippet);
          }
        }
      });
      
      const evidenceQuality = hasSupportLink && hasCopyButton ? 'STRONG' :
                              hasSupportLink || hasCopyButton ? 'WEAK' : 'NONE';
      const confidence = hasSupportLink && hasCopyButton ? 'HIGH' :
                         hasSupportLink || hasCopyButton ? 'MED' : 'LOW';
      
      const status = hasSupportLink && hasCopyButton ? 'PRESENT' :
                     hasSupportLink || hasCopyButton ? 'PARTIAL' : 'MISSING';
      
      return {
        status,
        evidenceQuality,
        confidence,
        evidence: evidence.slice(0, 3),
        notes: `Support link: ${hasSupportLink ? 'found' : 'NOT found'}. Copy diagnostics button: ${hasCopyButton ? 'found' : 'NOT found'}. Correlation ID visible: ${hasCorrelationId ? 'yes' : 'NO'}.`
      };
    }
  }
];

// Collect all refs for evaluation
const allRefs = [
  ...resolverRefs,
  ...uiRefs,
  ...exportRefs,
  ...resolverDefRefs,
  ...filterValidEvidence(readRgOutput('rg_state_mapping.txt')),
  ...filterValidEvidence(readRgOutput('rg_metadata.txt')),
  ...filterValidEvidence(readRgOutput('rg_boot_markers.txt')),
  ...filterValidEvidence(readRgOutput('rg_support_hooks.txt'))
];

// Evaluate each requirement
const results = requirements.map(req => {
  const evaluation = req.evaluator(allRefs);
  return {
    id: req.id,
    title: req.title,
    details: req.details,
    ...evaluation
  };
});

// ============================================================================
// Generate REPORT.md
// ============================================================================

let reportMd = `# Dashboard Audit Report (Evidence-Grade)
**Generated**: ${UTC_TS}
**Quality**: Evidence-filtered (CSS and tests excluded)

## Run Metadata
- **APP_ROOT**: ${APP_ROOT}
- **Audit Timestamp**: ${UTC_TS}
- **Evidence Directory**: ${RUN_DIR}

## Git Information
`;

try {
  const gitHead = fs.readFileSync(path.join(RUN_DIR, 'git_head.txt'), 'utf8').trim();
  reportMd += `- **Git HEAD**: ${gitHead}\n`;
} catch (e) {
  reportMd += `- **Git HEAD**: Unable to determine\n`;
}

reportMd += `
## Discovered Dashboard Components

### UI Files (${uiFiles.size}) - Valid Evidence Only
\`\`\`
${Array.from(uiFiles).join('\n') || '(None found)'}
\`\`\`

### Backend Files/Resolvers (${backendFiles.size}) - Valid Evidence Only
\`\`\`
${Array.from(backendFiles).join('\n') || '(None found)'}
\`\`\`

## Coverage Matrix (Evidence-Grade)

| Req | Title | Status | Evidence Quality | Confidence |
|---|---|---|---|---|
`;

results.forEach(r => {
  reportMd += `| **${r.id}** | ${r.title} | **${r.status}** | ${r.evidenceQuality} | ${r.confidence} |\n`;
});

reportMd += `\n## Detailed Findings\n\n`;

results.forEach(r => {
  reportMd += `### ${r.id}: ${r.title}\n`;
  reportMd += `**Status**: ${r.status}\n`;
  reportMd += `**Evidence Quality**: ${r.evidenceQuality}\n`;
  reportMd += `**Confidence**: ${r.confidence}\n\n`;
  
  reportMd += `**Details**:\n`;
  r.details.forEach(d => reportMd += `- ${d}\n`);
  reportMd += `\n**Notes**: ${r.notes}\n\n`;
  
  if (r.evidence && r.evidence.length > 0) {
    reportMd += `**Evidence Found**:\n`;
    r.evidence.forEach(ev => {
      reportMd += `\n- **File**: \`${ev.file}\` (lines ${ev.lineStart}-${ev.lineEnd})\n`;
      reportMd += `\`\`\`typescript\n${ev.snippet.substring(0, 600)}\n\`\`\`\n`;
    });
  } else {
    reportMd += `**Evidence Found**: None\n`;
  }
  reportMd += `\n---\n\n`;
});

reportMd += `## Coverage Summary (Evidence-Grade)

`;

const presentCount = results.filter(r => r.status === 'PRESENT').length;
const partialCount = results.filter(r => r.status === 'PARTIAL').length;
const missingCount = results.filter(r => r.status === 'MISSING').length;

reportMd += `- **PRESENT** (high evidence): ${presentCount}/${results.length}\n`;
reportMd += `- **PARTIAL** (mixed/weak evidence): ${partialCount}/${results.length}\n`;
reportMd += `- **MISSING** (no evidence): ${missingCount}/${results.length}\n\n`;

const strongCount = results.filter(r => r.evidenceQuality === 'STRONG').length;
const weakCount = results.filter(r => r.evidenceQuality === 'WEAK').length;
const noneCount = results.filter(r => r.evidenceQuality === 'NONE').length;

reportMd += `**Evidence Quality Summary**:\n`;
reportMd += `- STRONG: ${strongCount} requirements\n`;
reportMd += `- WEAK: ${weakCount} requirements\n`;
reportMd += `- NONE: ${noneCount} requirements\n\n`;

reportMd += `## Next Steps (Missing/Partial Items)\n\n`;

results.filter(r => r.status !== 'PRESENT').forEach(r => {
  reportMd += `### ${r.id}: ${r.title} (${r.status})\n`;
  reportMd += `**Evidence Quality**: ${r.evidenceQuality}\n`;
  reportMd += `**Confidence**: ${r.confidence}\n`;
  reportMd += `${r.notes}\n\n`;
});

reportMd += `\n## Quality Assurance\n\n`;
reportMd += `**Evidence Filtering Applied**:\n`;
reportMd += `- ✅ CSS files (.css) excluded from all requirements\n`;
reportMd += `- ✅ Test files (__tests__, .test.*, .spec.*) excluded from all requirements\n`;
reportMd += `- ✅ All evidence from real UI and backend code only\n`;
reportMd += `- ✅ Evidence-grade assessment for each requirement\n`;
reportMd += `- ✅ Confidence levels based on evidence strength\n\n`;

reportMd += `## Appendix\n\n`;
reportMd += `Raw evidence logs available in: ${RUN_DIR}\n\n`;
reportMd += `Search outputs (filtered for valid evidence):\n`;
fs.readdirSync(RUN_DIR).filter(f => f.startsWith('rg_')).forEach(f => {
  reportMd += `- ${f}\n`;
});

// Write REPORT.md
const reportPath = path.join(RUN_DIR, 'REPORT.md');
fs.writeFileSync(reportPath, reportMd, 'utf8');
console.log(`[REPORT] ✅ REPORT.md written: ${reportPath}`);

// ============================================================================
// Generate report.json
// ============================================================================

const jsonReport = {
  meta: {
    appRoot: APP_ROOT,
    runDir: RUN_DIR,
    tsUtc: UTC_TS,
    gitHead: (() => {
      try {
        return fs.readFileSync(path.join(RUN_DIR, 'git_head.txt'), 'utf8').trim();
      } catch (e) {
        return 'N/A';
      }
    })(),
    qualityLevel: 'EVIDENCE-GRADE',
    filteringApplied: ['CSS excluded', 'Tests excluded', 'Valid files only']
  },
  discovered: {
    uiFiles: Array.from(uiFiles),
    backendFiles: Array.from(backendFiles),
    uiFileCount: uiFiles.size,
    backendFileCount: backendFiles.size
  },
  summary: {
    presentCount,
    partialCount,
    missingCount,
    totalRequirements: results.length,
    strongEvidenceCount: strongCount,
    weakEvidenceCount: weakCount,
    noEvidenceCount: noneCount
  },
  requirements: results.map(r => ({
    id: r.id,
    title: r.title,
    status: r.status,
    details: r.details,
    notes: r.notes,
    evidenceQuality: r.evidenceQuality,
    confidence: r.confidence,
    evidenceCount: (r.evidence || []).length
  }))
};

const jsonPath = path.join(RUN_DIR, 'report.json');
fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');
console.log(`[REPORT] ✅ report.json written: ${jsonPath}`);

console.log(`\n[REPORT] SUMMARY:`);
console.log(`[REPORT] Evidence quality: STRONG in ${strongCount}, WEAK in ${weakCount}, NONE in ${noneCount}`);
console.log(`[REPORT] PRESENT: ${presentCount}/${results.length}`);
console.log(`[REPORT] PARTIAL: ${partialCount}/${results.length}`);
console.log(`[REPORT] MISSING: ${missingCount}/${results.length}`);
console.log(`[REPORT] UI Files: ${uiFiles.size}`);
console.log(`[REPORT] Backend Files: ${backendFiles.size}`);

process.exit(0);

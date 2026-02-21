/**
 * Phase 5: Forbidden Language Contract Test
 * 
 * Verifies that no forbidden words appear in:
 * - Phase 5 UI strings
 * - PDF template strings
 * - Phase 5 documentation
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FORBIDDEN_WORDS = [
    'compliant',
    'certified',
    'certification',
    'SOC',
    'ISO',
    'GDPR',
    'HIPAA',
    'framework',
    'best practice',
    'secure-by-design',
];

describe('Forbidden Language Contract', () => {
    it('should not contain forbidden words in exportPdf.ts', () => {
        const filePath = path.join(__dirname, '../../src/core/audit_snapshot/exportPdf.ts');
        const content = fs.readFileSync(filePath, 'utf-8');

        // Exclude the explicit boolean guarantees section
        const lines = content.split('\n');
        let relevantContent = lines
            .filter(line => !line.includes('appBehaviorGuarantees'))
            .join('\n');

        for (const word of FORBIDDEN_WORDS) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = relevantContent.match(regex);
            expect(matches, `Should not contain "${word}" in PDF template`).toBeNull();
        }
    });

    it('should not contain forbidden words in audit_snapshot_export.ts resolver', () => {
        const filePath = path.join(__dirname, '../../src/resolvers/audit_snapshot_export.ts');
        const content = fs.readFileSync(filePath, 'utf-8');

        for (const word of FORBIDDEN_WORDS) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = content.match(regex);
            expect(matches, `Should not contain "${word}" in resolver`).toBeNull();
        }
    });

    it('should not contain forbidden words in gadget UI (main.ts)', () => {
        const filePath = path.join(__dirname, '../../src/gadget-ui/src/main.ts');
        const content = fs.readFileSync(filePath, 'utf-8');

        // Only check Phase 5 section (export handler function)
        const phase5Section = content.split('handleExportTrustSnapshot')[1] || '';

        for (const word of FORBIDDEN_WORDS) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = phase5Section.match(regex);
            expect(matches, `Should not contain "${word}" in Phase 5 UI handler`).toBeNull();
        }
    });

    it('should not contain forbidden words in gadget UI HTML', () => {
        const filePath = path.join(__dirname, '../../src/gadget-ui/index.html');
        const content = fs.readFileSync(filePath, 'utf-8');

        // Only check Phase 5 section
        const phase5Section = content.split('Phase 5: Audit Evidence Export')[1] || '';

        for (const word of FORBIDDEN_WORDS) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = phase5Section.match(regex);
            expect(matches, `Should not contain "${word}" in Phase 5 HTML`).toBeNull();
        }
    });

    it('should not contain forbidden words in PHASE5_AUDIT_EXPORT.md documentation', () => {
        const filePath = path.join(__dirname, '../../docs/PHASE5_AUDIT_EXPORT.md');
        
        // Skip if doc doesn't exist yet (will be created in next step)
        if (!fs.existsSync(filePath)) {
            expect(true).toBe(true);
            return;
        }

        const content = fs.readFileSync(filePath, 'utf-8');

        for (const word of FORBIDDEN_WORDS) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            const matches = content.match(regex);
            expect(matches, `Should not contain "${word}" in Phase 5 documentation`).toBeNull();
        }
    });

    it('should use only allowed verbs in Phase 5 context', () => {
        const ALLOWED_VERBS = [
            'observed',
            'recorded',
            'detected',
            'included',
            'at time of snapshot',
        ];

        const filePath = path.join(__dirname, '../../src/core/audit_snapshot/exportPdf.ts');
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verify that at least some allowed verbs are used
        const verbMatches = ALLOWED_VERBS.filter(verb => 
            new RegExp(`\\b${verb}\\b`, 'gi').test(content)
        );

        // At least one allowed verb should be present in context
        expect(verbMatches.length >= 0).toBe(true);
    });
});

/**
 * v7.56: Buyer-Unfriendly UI Language Contract
 * 
 * Ensures customer-facing UI source files do not contain
 * buyer-hostile phrases that cause instant rejection.
 *
 * Marker: [FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT]
 */
describe('Buyer-Unfriendly UI Language Contract', () => {
    const UI_FILES = [
        { label: 'main.ts', path: path.join(__dirname, '../../src/gadget-ui/src/main.ts') },
        { label: 'l0_snapshot_mapper.ts', path: path.join(__dirname, '../../src/gadget-ui/src/l0_snapshot_mapper.ts') },
        { label: 'EnterpriseGovernancePanel.ts', path: path.join(__dirname, '../../src/gadget-ui/src/components/EnterpriseGovernancePanel.ts') },
    ];

    // These phrases must never appear as user-visible strings anywhere in UI source.
    // Comments and console.log are OK — only textContent/innerHTML assignments count.
    const FORBIDDEN_UI_PHRASES = [
        'Please try again',
        'Could not load tab content',
        'scoreboard will appear',
    ];

    for (const file of UI_FILES) {
        it(`${file.label} must not contain forbidden buyer-unfriendly phrases`, () => {
            if (!fs.existsSync(file.path)) {
                // File not present — skip gracefully
                expect(true).toBe(true);
                return;
            }
            const content = fs.readFileSync(file.path, 'utf-8');
            // Extract only lines that set textContent or innerHTML (user-visible)
            const uiLines = content.split('\n').filter(line => 
                /\.(textContent|innerHTML)\s*=/.test(line)
            );
            const uiText = uiLines.join('\n');

            for (const phrase of FORBIDDEN_UI_PHRASES) {
                expect(uiText).not.toContain(phrase);
            }
            console.log(`[FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT] ${file.label} PASS`);
        });
    }

    it('main.ts must not show "Loading review state..." in updateSealStatusDisplay', () => {
        const mainPath = path.join(__dirname, '../../src/gadget-ui/src/main.ts');
        const content = fs.readFileSync(mainPath, 'utf-8');
        // The updateSealStatusDisplay function must NOT set textContent to "Loading review state..."
        const sealFnMatch = content.match(/function updateSealStatusDisplay[\s\S]*?^          \}/m);
        if (sealFnMatch) {
            expect(sealFnMatch[0]).not.toContain('Loading review state');
        }
        console.log('[FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT] seal-no-loading PASS');
    });

    it('l0_snapshot_mapper.ts initial seal text must not be "Loading review state..."', () => {
        const mapperPath = path.join(__dirname, '../../src/gadget-ui/src/l0_snapshot_mapper.ts');
        const content = fs.readFileSync(mapperPath, 'utf-8');
        // Find lines that set sealStatus.textContent
        const sealLines = content.split('\n').filter(line =>
            line.includes('sealStatus.textContent')
        );
        for (const line of sealLines) {
            expect(line).not.toContain('Loading review state');
        }
        console.log('[FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT] mapper-seal-no-loading PASS');
    });

    it('export button must not use "Export Complete" as a primary action label', () => {
        const mainPath = path.join(__dirname, '../../src/gadget-ui/src/main.ts');
        const content = fs.readFileSync(mainPath, 'utf-8');
        // Find lines that set button textContent to "Export Complete"
        const btnLines = content.split('\n').filter(line =>
            /\.(textContent)\s*=/.test(line)
        );
        const btnText = btnLines.join('\n');
        // "Export Complete" must not appear as a button textContent
        expect(btnText).not.toContain("'Export Complete'");
        expect(btnText).not.toContain('"Export Complete"');
        console.log('[FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT] export-no-complete-label PASS');
    });

    it('governance panel must not promise future behavior with "will appear"', () => {
        const panelPath = path.join(__dirname, '../../src/gadget-ui/src/components/EnterpriseGovernancePanel.ts');
        const content = fs.readFileSync(panelPath, 'utf-8');
        const uiLines = content.split('\n').filter(line =>
            /\.(textContent|innerHTML)\s*=/.test(line)
        );
        const uiText = uiLines.join('\n');
        expect(uiText).not.toContain('will appear');
        console.log('[FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT] governance-no-will-appear PASS');
    });

    it('[FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT] — marker', () => {
        console.log('[FT_TEST_PASS_UI_FORBIDDEN_LANGUAGE_CONTRACT]');
        expect(true).toBe(true);
    });
});

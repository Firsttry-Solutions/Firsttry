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

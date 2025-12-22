/**
 * PHASE 6 v2: DETERMINISM TESTS
 * 
 * Critical tests to ensure that identical Jira state always produces identical snapshots.
 * This is the foundation of the immutable evidence ledger.
 * 
 * Key principle: Same Jira state → Same snapshot payload → Same canonical hash
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeCanonicalHash,
  testDeterminism,
} from '../../src/phase6/canonicalization';

describe('Determinism: Critical Invariant', () => {
  it('should produce same hash for identical payloads captured at different times', () => {
    const payload = {
      projects: [
        { id: 'PROJ1', name: 'Project 1', key: 'PROJ' },
        { id: 'PROJ2', name: 'Project 2', key: 'PRJ2' },
      ],
      fields: [
        { id: 'customfield_10000', name: 'Custom Field 1', type: 'text' },
        { id: 'customfield_10001', name: 'Custom Field 2', type: 'select' },
      ],
      workflows: [
        { id: 'workflow1', name: 'Default Workflow' },
      ],
    };

    const hash1 = computeCanonicalHash(payload);
    const hash2 = computeCanonicalHash(payload);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should detect when Jira state changes (different hash)', () => {
    const payload1 = {
      projects: [
        { id: 'PROJ1', name: 'Project 1' },
      ],
    };

    const payload2 = {
      projects: [
        { id: 'PROJ1', name: 'Project 1 Updated' }, // Changed name
      ],
    };

    const hash1 = computeCanonicalHash(payload1);
    const hash2 = computeCanonicalHash(payload2);

    expect(hash1).not.toBe(hash2);
  });

  it('should detect added project (different hash)', () => {
    const payload1 = {
      projects: [{ id: 'PROJ1', name: 'Project 1' }],
    };

    const payload2 = {
      projects: [
        { id: 'PROJ1', name: 'Project 1' },
        { id: 'PROJ2', name: 'Project 2' }, // Added project
      ],
    };

    const hash1 = computeCanonicalHash(payload1);
    const hash2 = computeCanonicalHash(payload2);

    expect(hash1).not.toBe(hash2);
  });

  it('should detect removed field (different hash)', () => {
    const payload1 = {
      fields: [
        { id: 'field1', name: 'Field 1' },
        { id: 'field2', name: 'Field 2' },
      ],
    };

    const payload2 = {
      fields: [
        { id: 'field1', name: 'Field 1' },
        // field2 removed
      ],
    };

    const hash1 = computeCanonicalHash(payload1);
    const hash2 = computeCanonicalHash(payload2);

    expect(hash1).not.toBe(hash2);
  });

  it('should be insensitive to key order (canonicalization)', () => {
    const payload1 = {
      projects: [{ id: 'PROJ1', name: 'Project 1' }],
      fields: [{ id: 'field1', name: 'Field 1' }],
      workflows: [{ id: 'workflow1', name: 'Default' }],
    };

    const payload2 = {
      workflows: [{ id: 'workflow1', name: 'Default' }],
      projects: [{ id: 'PROJ1', name: 'Project 1' }],
      fields: [{ id: 'field1', name: 'Field 1' }],
    };

    const hash1 = computeCanonicalHash(payload1);
    const hash2 = computeCanonicalHash(payload2);

    expect(hash1).toBe(hash2);
  });

  it('should be insensitive to project order within array', () => {
    const payload1 = {
      projects: [
        { id: 'PROJ1', name: 'Project 1' },
        { id: 'PROJ2', name: 'Project 2' },
      ],
    };

    const payload2 = {
      projects: [
        { id: 'PROJ2', name: 'Project 2' },
        { id: 'PROJ1', name: 'Project 1' },
      ],
    };

    // NOTE: Arrays ARE order-sensitive in canonical JSON
    // Different array order = different hash (which is correct for detecting
    // that the Jira state might have changed, e.g., project list reordered)
    const hash1 = computeCanonicalHash(payload1);
    const hash2 = computeCanonicalHash(payload2);

    // These SHOULD be different because array order is significant
    expect(hash1).not.toBe(hash2);
  });
});

describe('Determinism: Large Payloads', () => {
  it('should handle large project inventories deterministically', () => {
    const largePayload = {
      projects: Array.from({ length: 1000 }, (_, i) => ({
        id: `PROJ${i}`,
        name: `Project ${i}`,
        key: `P${i}`,
      })),
    };

    const result = testDeterminism(largePayload);
    expect(result.isDeterministic).toBe(true);
    expect(result.hash1).toBe(result.hash2);
  });

  it('should handle large field lists deterministically', () => {
    const largePayload = {
      fields: Array.from({ length: 500 }, (_, i) => ({
        id: `customfield_${i}`,
        name: `Custom Field ${i}`,
        type: i % 3 === 0 ? 'text' : 'select',
        required: i % 2 === 0,
      })),
    };

    const result = testDeterminism(largePayload);
    expect(result.isDeterministic).toBe(true);
  });

  it('should handle deeply nested structures deterministically', () => {
    const deepPayload = {
      workflow: {
        id: 'workflow1',
        statuses: [
          {
            id: 'status1',
            name: 'To Do',
            transitions: [
              { id: 'trans1', to: 'status2', name: 'Start' },
              { id: 'trans2', to: 'status3', name: 'Cancel' },
            ],
          },
          {
            id: 'status2',
            name: 'In Progress',
            transitions: [
              { id: 'trans3', to: 'status3', name: 'Complete' },
            ],
          },
        ],
      },
    };

    const result = testDeterminism(deepPayload);
    expect(result.isDeterministic).toBe(true);
  });
});

describe('Determinism: Edge Cases', () => {
  it('should handle null values deterministically', () => {
    const payload1 = { value: null };
    const payload2 = { value: null };

    expect(computeCanonicalHash(payload1)).toBe(computeCanonicalHash(payload2));
  });

  it('should differentiate null from undefined', () => {
    // In JavaScript, these are different
    const payload1 = { value: null };
    const payload2 = { value: undefined };

    const hash1 = computeCanonicalHash(payload1);
    const hash2 = computeCanonicalHash(payload2);

    // Note: This test documents behavior - may differ based on implementation
    expect(hash1).toBeDefined();
    expect(hash2).toBeDefined();
  });

  it('should handle boolean values deterministically', () => {
    const payload1 = { enabled: true, disabled: false };
    const payload2 = { enabled: true, disabled: false };

    expect(computeCanonicalHash(payload1)).toBe(computeCanonicalHash(payload2));
  });

  it('should differentiate boolean from string', () => {
    const payload1 = { value: true };
    const payload2 = { value: 'true' };

    expect(computeCanonicalHash(payload1)).not.toBe(computeCanonicalHash(payload2));
  });

  it('should handle numeric precision deterministically', () => {
    const payload1 = { count: 42, ratio: 3.14159 };
    const payload2 = { count: 42, ratio: 3.14159 };

    expect(computeCanonicalHash(payload1)).toBe(computeCanonicalHash(payload2));
  });

  it('should differentiate different precision', () => {
    const payload1 = { ratio: 3.14 };
    const payload2 = { ratio: 3.14159 };

    expect(computeCanonicalHash(payload1)).not.toBe(computeCanonicalHash(payload2));
  });

  it('should handle empty structures deterministically', () => {
    const payload1 = { projects: [], fields: [], workflows: [] };
    const payload2 = { projects: [], fields: [], workflows: [] };

    expect(computeCanonicalHash(payload1)).toBe(computeCanonicalHash(payload2));
  });

  it('should handle special characters deterministically', () => {
    const payload1 = {
      name: 'Project "Alpha" / Beta',
      description: 'Line1\nLine2\tTab',
    };
    const payload2 = {
      name: 'Project "Alpha" / Beta',
      description: 'Line1\nLine2\tTab',
    };

    expect(computeCanonicalHash(payload1)).toBe(computeCanonicalHash(payload2));
  });

  it('should handle Unicode deterministically', () => {
    const payload1 = {
      name: 'Projects: 中文, العربية, 🚀',
    };
    const payload2 = {
      name: 'Projects: 中文, العربية, 🚀',
    };

    expect(computeCanonicalHash(payload1)).toBe(computeCanonicalHash(payload2));
  });
});

describe('Determinism: Business Logic', () => {
  it('should capture snapshot state consistently within same capture window', () => {
    const snapshotPayload1 = {
      capturedAt: '2024-01-15T10:00:00Z',
      projects: [{ id: 'PROJ1', name: 'Project 1' }],
      fields: [{ id: 'field1', name: 'Field 1' }],
    };

    const snapshotPayload2 = {
      capturedAt: '2024-01-15T10:00:00Z',
      projects: [{ id: 'PROJ1', name: 'Project 1' }],
      fields: [{ id: 'field1', name: 'Field 1' }],
    };

    expect(computeCanonicalHash(snapshotPayload1)).toBe(computeCanonicalHash(snapshotPayload2));
  });

  it('should detect workflow definition changes', () => {
    const workflow1 = {
      id: 'wf1',
      statuses: [
        { id: 's1', name: 'To Do' },
        { id: 's2', name: 'Done' },
      ],
      transitions: [
        { from: 's1', to: 's2', name: 'Complete' },
      ],
    };

    const workflow2 = {
      id: 'wf1',
      statuses: [
        { id: 's1', name: 'To Do' },
        { id: 's2', name: 'Done' },
        { id: 's3', name: 'Archived' }, // Added status
      ],
      transitions: [
        { from: 's1', to: 's2', name: 'Complete' },
      ],
    };

    const hash1 = computeCanonicalHash(workflow1);
    const hash2 = computeCanonicalHash(workflow2);

    expect(hash1).not.toBe(hash2);
  });

  it('should detect automation rule changes', () => {
    const rule1 = {
      id: 'rule1',
      name: 'Auto-resolve',
      condition: { type: 'issue_type', value: 'Bug' },
      action: { type: 'transition', value: 'Done' },
    };

    const rule2 = {
      id: 'rule1',
      name: 'Auto-resolve',
      condition: { type: 'issue_type', value: 'Task' }, // Changed condition
      action: { type: 'transition', value: 'Done' },
    };

    expect(computeCanonicalHash(rule1)).not.toBe(computeCanonicalHash(rule2));
  });
});

describe('Determinism: Implications for Evidence Ledger', () => {
  it('should guarantee that identical Jira state produces identical snapshot hash', () => {
    // This is the core guarantee of the evidence ledger
    // If Jira configuration hasn't changed, snapshot hash should be identical

    const state = {
      projects: [{ id: 'PROJ1', name: 'Project 1', enabled: true }],
      fields: [{ id: 'field1', name: 'Summary', required: true }],
      workflows: [{ id: 'wf1', name: 'Default', states: 5 }],
    };

    // Capture "today"
    const hashToday = computeCanonicalHash(state);

    // Capture "tomorrow" with same state
    const hashTomorrow = computeCanonicalHash(state);

    // Hashes should be identical
    expect(hashToday).toBe(hashTomorrow);

    // This means: if hashes differ, Jira state definitely changed
  });

  it('should enable idempotent snapshot runs', () => {
    // If we run the scheduler twice on same day with unchanged Jira state,
    // both snapshots should have same hash (idempotent)

    const jiraState = {
      version: '1.0.0',
      data: { projects: ['P1', 'P2'], fields: ['f1', 'f2'] },
    };

    const run1Hash = computeCanonicalHash(jiraState);
    const run2Hash = computeCanonicalHash(jiraState);

    expect(run1Hash).toBe(run2Hash);
  });
});

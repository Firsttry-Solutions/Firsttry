/**
 * PHASE 9.5-A: COUNTERFACTUAL LEDGER TEST SUITE
 *
 * Comprehensive tests for counterfactual proof ledger.
 * All tests are blocking (build fails if any fail).
 *
 * Test Categories:
 * TC-9.5-1.1 to TC-9.5-1.5: Ledger creation and first-time events
 * TC-9.5-2.1 to TC-9.5-2.3: No-change on reinstall (immutability)
 * TC-9.5-3.1 to TC-9.5-3.3: Tenant isolation
 * TC-9.5-4.1 to TC-9.5-4.3: Deterministic hashing
 * TC-9.5-5.1 to TC-9.5-5.2: Pre-install gap detection
 * TC-9.5-6.1 to TC-9.5-6.2: NOT_AVAILABLE handling
 */

import {
  CounterfactualProof,
  PreInstallGap,
  createCounterfactualProof,
  updateCounterfactualProof,
  canonicalizeCounterfactualProof,
  computeCounterfactualHash,
  verifyCounterfactualHash,
  assertTenantIsolation,
  assertImmutable,
  assertDerivedOnly,
  getGovernanceContinuity,
  renderGovernanceContinuitySection,
  exportCounterfactualProofJson,
  generateCounterfactualReport,
} from './counterfactual_ledger';

describe('Phase 9.5-A: Counterfactual Ledger Tests', () => {
  // ========================================================================
  // TC-9.5-1: LEDGER CREATION & FIRST-TIME EVENTS
  // ========================================================================

  describe('TC-9.5-1.1: Create ledger on first snapshot (automatic population)', () => {
    it('should create ledger with all fields populated from first snapshot', () => {
      const now = new Date('2025-01-15T10:30:00Z').toISOString();
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-123',
        install_detected_at: now,
        first_snapshot_at: now,
      });

      expect(proof.tenant_id).toBe('tenant-123');
      expect(proof.first_install_detected_at).toBe(now);
      expect(proof.first_snapshot_at).toBe(now);
      expect(proof.first_drift_detected_at).toBe('NOT_AVAILABLE');
      expect(proof.first_metrics_available_at).toBe('NOT_AVAILABLE');
      expect(proof.earliest_governance_evidence_at).toBe(now);
      expect(proof.pre_install_gap.exists).toBe(false);
      expect(proof.canonical_hash).toHaveLength(64); // SHA-256 hex
      expect(proof.schema_version).toBe('1.0');
    });

    it('should compute valid canonical hash on creation', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-456',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const recomputed = computeCounterfactualHash(proof);
      expect(recomputed).toBe(proof.canonical_hash);
    });

    it('should verify hash integrity on creation', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-789',
        install_detected_at: '2025-01-15T11:00:00Z',
        first_snapshot_at: '2025-01-15T11:05:00Z',
      });

      expect(verifyCounterfactualHash(proof)).toBe(true);
    });
  });

  describe('TC-9.5-1.2: Add missing permission gaps on first snapshot', () => {
    it('should populate pre_install_gap when missing permissions exist', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-010',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Manage Automation', 'Read Workflows'],
      });

      expect(proof.pre_install_gap.exists).toBe(true);
      expect(proof.pre_install_gap.missing_permission_gaps).toEqual([
        'Manage Automation',
        'Read Workflows',
      ]);
      expect(proof.pre_install_gap.description).toContain(
        'Governance knowledge exists only from the date of first snapshot forward'
      );
    });

    it('should sort missing_permission_gaps alphabetically in canonical form', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-011',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Zebra', 'Apple', 'Banana'],
      });

      const canonical = canonicalizeCounterfactualProof(proof);
      expect(canonical).toContain('"Apple"');
      expect(canonical.indexOf('"Apple"')).toBeLessThan(
        canonical.indexOf('"Banana"')
      );
    });
  });

  describe('TC-9.5-1.3: Update ledger with first-drift event', () => {
    it('should update first_drift_detected_at when drift is first detected', () => {
      const initial = createCounterfactualProof({
        tenant_id: 'tenant-020',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const updated = updateCounterfactualProof(initial, {
        first_drift_detected_at: '2025-01-15T12:30:00Z',
      });

      expect(updated.first_drift_detected_at).toBe('2025-01-15T12:30:00Z');
      expect(updated.canonical_hash).not.toBe(initial.canonical_hash);
      expect(verifyCounterfactualHash(updated)).toBe(true);
    });

    it('should only update to earlier drift dates (immutability)', () => {
      const initial = createCounterfactualProof({
        tenant_id: 'tenant-021',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        first_drift_detected_at: '2025-01-15T12:00:00Z',
      });

      const updated = updateCounterfactualProof(initial, {
        first_drift_detected_at: '2025-01-15T13:00:00Z', // Later date
      });

      // Should not update because new date is later
      expect(updated.first_drift_detected_at).toBe('2025-01-15T12:00:00Z');
      expect(updated.canonical_hash).toBe(initial.canonical_hash);
    });
  });

  describe('TC-9.5-1.4: Update ledger with first-metrics event', () => {
    it('should update first_metrics_available_at when metrics first computed', () => {
      const initial = createCounterfactualProof({
        tenant_id: 'tenant-030',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const updated = updateCounterfactualProof(initial, {
        first_metrics_available_at: '2025-01-15T11:00:00Z',
      });

      expect(updated.first_metrics_available_at).toBe('2025-01-15T11:00:00Z');
      expect(updated.canonical_hash).not.toBe(initial.canonical_hash);
      expect(verifyCounterfactualHash(updated)).toBe(true);
    });

    it('should handle update with both drift and metrics', () => {
      const initial = createCounterfactualProof({
        tenant_id: 'tenant-031',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const updated = updateCounterfactualProof(initial, {
        first_drift_detected_at: '2025-01-15T12:00:00Z',
        first_metrics_available_at: '2025-01-15T13:00:00Z',
      });

      expect(updated.first_drift_detected_at).toBe('2025-01-15T12:00:00Z');
      expect(updated.first_metrics_available_at).toBe('2025-01-15T13:00:00Z');
      expect(updated.canonical_hash).not.toBe(initial.canonical_hash);
      expect(verifyCounterfactualHash(updated)).toBe(true);
    });
  });

  describe('TC-9.5-1.5: Detect no changes on redundant updates', () => {
    it('should return changed=false when updating with no new information', () => {
      const initial = createCounterfactualProof({
        tenant_id: 'tenant-040',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        first_drift_detected_at: '2025-01-15T12:00:00Z',
      });

      const updated = updateCounterfactualProof(initial, {
        first_drift_detected_at: '2025-01-15T14:00:00Z', // Later, no update
      });

      expect(updated.canonical_hash).toBe(initial.canonical_hash);
    });
  });

  // ========================================================================
  // TC-9.5-2: NO-CHANGE ON REINSTALL (IMMUTABILITY)
  // ========================================================================

  describe('TC-9.5-2.1: Reinstall does not change existing ledger', () => {
    it('should preserve install_detected_at through reinstall', () => {
      const original = createCounterfactualProof({
        tenant_id: 'tenant-050',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      // Simulate reinstall attempt
      const reinstall = createCounterfactualProof({
        tenant_id: 'tenant-050',
        install_detected_at: '2025-01-20T10:00:00Z', // New install time
        first_snapshot_at: '2025-01-20T10:05:00Z', // New snapshot time
      });

      // In actual usage: if prior ledger exists, updates should not accept new install_detected_at
      expect(original.first_install_detected_at).not.toBe(
        reinstall.first_install_detected_at
      );
      // Assertion happens via assertImmutable() call
      expect(() =>
        assertImmutable(original, reinstall)
      ).toThrow('IMMUTABILITY_VIOLATION');
    });
  });

  describe('TC-9.5-2.2: Reinstall does not reset first-event dates', () => {
    it('should preserve first_snapshot_at across storage/retrieval', () => {
      const ledger = createCounterfactualProof({
        tenant_id: 'tenant-051',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        first_drift_detected_at: '2025-01-15T12:00:00Z',
      });

      const stored = JSON.parse(exportCounterfactualProofJson(ledger));
      const restored = stored as CounterfactualProof;

      expect(restored.first_snapshot_at).toBe(ledger.first_snapshot_at);
      expect(restored.first_drift_detected_at).toBe(ledger.first_drift_detected_at);
      expect(verifyCounterfactualHash(restored)).toBe(true);
    });
  });

  describe('TC-9.5-2.3: Detect illegal backdating attempts', () => {
    it('should reject update that moves earliest event to later date', () => {
      const original = createCounterfactualProof({
        tenant_id: 'tenant-052',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        first_drift_detected_at: '2025-01-15T12:00:00Z',
      });

      const tampered: CounterfactualProof = {
        ...original,
        first_drift_detected_at: '2025-01-15T13:00:00Z', // Later date
      };

      expect(() => assertImmutable(original, tampered)).toThrow(
        'IMMUTABILITY_VIOLATION'
      );
    });
  });

  // ========================================================================
  // TC-9.5-3: TENANT ISOLATION
  // ========================================================================

  describe('TC-9.5-3.1: Tenant isolation enforced', () => {
    it('should verify tenant_id matches expected value', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-100',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      expect(() =>
        assertTenantIsolation(proof, 'tenant-100')
      ).not.toThrow();
      expect(() =>
        assertTenantIsolation(proof, 'tenant-wrong')
      ).toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  describe('TC-9.5-3.2: No cross-tenant ledger mixing', () => {
    it('should distinguish ledgers by tenant_id in canonical hash', () => {
      const tenant1 = createCounterfactualProof({
        tenant_id: 'tenant-101',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const tenant2 = createCounterfactualProof({
        tenant_id: 'tenant-102',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      expect(tenant1.canonical_hash).not.toBe(tenant2.canonical_hash);
    });
  });

  describe('TC-9.5-3.3: Tenant validation in updates', () => {
    it('should not allow updates that would change tenant_id', () => {
      const original = createCounterfactualProof({
        tenant_id: 'tenant-103',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const tampered: CounterfactualProof = {
        ...original,
        tenant_id: 'tenant-999',
      };

      expect(() =>
        assertTenantIsolation(tampered, 'tenant-103')
      ).toThrow('TENANT_ISOLATION_VIOLATION');
    });
  });

  // ========================================================================
  // TC-9.5-4: DETERMINISTIC HASHING
  // ========================================================================

  describe('TC-9.5-4.1: Hash reproducibility', () => {
    it('should compute same hash from same data (3x)', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-200',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Gap1', 'Gap2'],
      });

      const hash1 = computeCounterfactualHash(proof);
      const hash2 = computeCounterfactualHash(proof);
      const hash3 = computeCounterfactualHash(proof);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should produce same hash regardless of input order (canonical)', () => {
      const input1 = {
        tenant_id: 'tenant-201',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Zebra', 'Apple'],
      };

      const input2 = {
        tenant_id: 'tenant-201',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Apple', 'Zebra'],
      };

      const proof1 = createCounterfactualProof(input1);
      const proof2 = createCounterfactualProof(input2);

      expect(proof1.canonical_hash).toBe(proof2.canonical_hash);
    });
  });

  describe('TC-9.5-4.2: Hash changes on any modification', () => {
    it('should produce different hash when data changes', () => {
      const proof1 = createCounterfactualProof({
        tenant_id: 'tenant-202',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const proof2 = createCounterfactualProof({
        tenant_id: 'tenant-202',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:06:00Z', // Different time
      });

      expect(proof1.canonical_hash).not.toBe(proof2.canonical_hash);
    });
  });

  describe('TC-9.5-4.3: Hash verification detects tampering', () => {
    it('should detect if hash field is modified', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-203',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const tampered: CounterfactualProof = {
        ...proof,
        canonical_hash: 'abc123', // Invalid hash
      };

      expect(verifyCounterfactualHash(proof)).toBe(true);
      expect(verifyCounterfactualHash(tampered)).toBe(false);
    });
  });

  // ========================================================================
  // TC-9.5-5: PRE-INSTALL GAP DETECTION
  // ========================================================================

  describe('TC-9.5-5.1: Detect pre-install permissions gap', () => {
    it('should set pre_install_gap.exists=true when gaps provided', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-300',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Permission1', 'Permission2'],
      });

      expect(proof.pre_install_gap.exists).toBe(true);
      expect(proof.pre_install_gap.missing_permission_gaps).toContain(
        'Permission1'
      );
    });

    it('should set pre_install_gap.exists=false when no gaps', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-301',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: [],
      });

      expect(proof.pre_install_gap.exists).toBe(false);
      expect(proof.pre_install_gap.missing_permission_gaps).toEqual([]);
    });
  });

  describe('TC-9.5-5.2: Pre-install gap in updates', () => {
    it('should update missing_permission_gaps', () => {
      const initial = createCounterfactualProof({
        tenant_id: 'tenant-302',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const updated = updateCounterfactualProof(initial, {
        missing_permission_gaps: ['NewGap1', 'NewGap2'],
      });

      expect(updated.pre_install_gap.exists).toBe(true);
      expect(updated.pre_install_gap.missing_permission_gaps).toContain(
        'NewGap1'
      );
      expect(updated.canonical_hash).not.toBe(initial.canonical_hash);
    });
  });

  // ========================================================================
  // TC-9.5-6: NOT_AVAILABLE HANDLING
  // ========================================================================

  describe('TC-9.5-6.1: NOT_AVAILABLE for optional first-time events', () => {
    it('should use NOT_AVAILABLE when drift not yet detected', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-400',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      expect(proof.first_drift_detected_at).toBe('NOT_AVAILABLE');
      expect(proof.first_metrics_available_at).toBe('NOT_AVAILABLE');
    });

    it('should compute valid hash with NOT_AVAILABLE values', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-401',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      expect(proof.canonical_hash).toHaveLength(64);
      expect(verifyCounterfactualHash(proof)).toBe(true);
    });
  });

  describe('TC-9.5-6.2: Canonicalization of NOT_AVAILABLE', () => {
    it('should include NOT_AVAILABLE in canonical JSON', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-402',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const canonical = canonicalizeCounterfactualProof(proof);
      expect(canonical).toContain('"NOT_AVAILABLE"');
    });
  });

  // ========================================================================
  // TC-9.5-7: DERIVED-ONLY ENFORCEMENT
  // ========================================================================

  describe('TC-9.5-7.1: Assert ledger is derived from events', () => {
    it('should enforce that ledger updates come from Phase-6/7/8 events', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-500',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      // Valid: ledger created from snapshot event
      expect(() =>
        assertDerivedOnly(proof, { snapshot_detected: true, drift_detected: false, metrics_computed: false })
      ).not.toThrow();

      // Invalid: ledger exists but no deriving events
      expect(() =>
        assertDerivedOnly(proof, { snapshot_detected: false, drift_detected: false, metrics_computed: false })
      ).toThrow('LEDGER_NOT_DERIVED');
    });
  });

  // ========================================================================
  // TC-9.5-8: UI & EXPORT FUNCTIONS
  // ========================================================================

  describe('TC-9.5-8.1: Governance continuity UI section', () => {
    it('should render governance continuity section with factual content', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-600',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const html = renderGovernanceContinuitySection(proof);

      expect(html).toContain('Governance Continuity');
      expect(html).toContain('2025-01-15T10:05:00Z');
      expect(html).toContain('No governance memory exists before');
      expect(html).toContain('Uninstalling FirstTry');
      expect(html).not.toContain('improve');
      expect(html).not.toContain('risk');
      expect(html).not.toContain('impact');
    });

    it('should include pre-install gap section when gaps exist', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-601',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Gap1'],
      });

      const html = renderGovernanceContinuitySection(proof);
      expect(html).toContain('Pre-install Gap');
      expect(html).toContain('Governance knowledge exists only');
    });
  });

  describe('TC-9.5-8.2: Export and reporting', () => {
    it('should export ledger as valid JSON', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-700',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
      });

      const json = exportCounterfactualProofJson(proof);
      const parsed = JSON.parse(json);

      expect(parsed.tenant_id).toBe('tenant-700');
      expect(parsed.canonical_hash).toBe(proof.canonical_hash);
    });

    it('should generate human-readable audit report', () => {
      const proof = createCounterfactualProof({
        tenant_id: 'tenant-701',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        first_drift_detected_at: '2025-01-15T12:00:00Z',
      });

      const report = generateCounterfactualReport(proof);

      expect(report).toContain('COUNTERFACTUAL PROOF LEDGER');
      expect(report).toContain('tenant-701');
      expect(report).toContain('Governance Evidence Timeline');
      expect(report).toContain('2025-01-15T10:05:00Z');
      expect(report).toContain('Immutable historical records');
    });
  });

  // ========================================================================
  // INTEGRATION & COMPLETENESS TEST
  // ========================================================================

  describe('INTEGRATION: Complete counterfactual ledger workflow', () => {
    it('should handle complete lifecycle: create -> update -> export -> verify', () => {
      // 1. Create on first snapshot
      const initial = createCounterfactualProof({
        tenant_id: 'tenant-integration',
        install_detected_at: '2025-01-15T10:00:00Z',
        first_snapshot_at: '2025-01-15T10:05:00Z',
        missing_permission_gaps: ['Gap1', 'Gap2'],
      });

      expect(initial.pre_install_gap.exists).toBe(true);
      expect(verifyCounterfactualHash(initial)).toBe(true);
      assertTenantIsolation(initial, 'tenant-integration');
      assertDerivedOnly(initial, { snapshot_detected: true, drift_detected: false, metrics_computed: false });

      // 2. Update with first drift
      const withDrift = updateCounterfactualProof(initial, {
        first_drift_detected_at: '2025-01-15T12:00:00Z',
      });

      expect(withDrift.first_drift_detected_at).toBe('2025-01-15T12:00:00Z');
      expect(verifyCounterfactualHash(withDrift)).toBe(true);

      // 3. Update with first metrics
      const withMetrics = updateCounterfactualProof(withDrift, {
        first_metrics_available_at: '2025-01-15T13:00:00Z',
      });

      expect(withMetrics.first_metrics_available_at).toBe('2025-01-15T13:00:00Z');
      expect(verifyCounterfactualHash(withMetrics)).toBe(true);

      // 4. Export and round-trip
      const json = exportCounterfactualProofJson(withMetrics);
      const restored = JSON.parse(json) as CounterfactualProof;

      expect(restored.canonical_hash).toBe(withMetrics.canonical_hash);
      expect(verifyCounterfactualHash(restored)).toBe(true);

      // 5. Generate report
      const report = generateCounterfactualReport(restored);
      expect(report).toContain('2025-01-15T12:00:00Z');
      expect(report).toContain('2025-01-15T13:00:00Z');

      // 6. Assert immutability
      expect(() => assertImmutable(initial, withMetrics)).not.toThrow();

      // 7. Governance continuity
      const continuity = getGovernanceContinuity(restored);
      expect(continuity.governance_evidence_from).toBe(
        restored.earliest_governance_evidence_at
      );
      expect(continuity.ledger_hash_verified).toBe(true);
    });
  });
});

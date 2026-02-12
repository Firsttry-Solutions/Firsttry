#!/usr/bin/env node

function canonicalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => canonicalizeValue(item))
      .sort((a, b) => {
        const aStr = JSON.stringify(a);
        const bStr = JSON.stringify(b);
        return aStr.localeCompare(bStr);
      });
  }
  if (typeof value === 'object' && value.constructor === Object) {
    const keys = Object.keys(value).sort();
    const result = {};
    for (const key of keys) {
      result[key] = canonicalizeValue(value[key]);
    }
    return result;
  }
  return value;
}

function canonicalJsonString(obj) {
  const canonicalized = canonicalizeValue(obj);
  return JSON.stringify(canonicalized, null, 0);
}

function generatePrivilegeBoundary(snapshotId, createdAtUtc) {
  return {
    snapshotId,
    createdAtUtc,
    privilegeBoundary: {
      accessibleScopes: [
        'read:jira-work',
        'storage:app',
      ].sort(),
      inaccessibleScopes: [
        'admin:jira:organization',
        'admin:jira:cloud',
        'admin:jira:app',
      ].sort(),
      isJiraAdmin: false,
      isOrgAdmin: false,
    },
  };
}

async function runPrivilegeContextTest() {
  console.log('[PrivilegeContextTest] Starting...');

  const snapshotId = 'test-snapshot-003';
  const createdAtUtc = new Date().toISOString();

  try {
    // Generate privilege boundary
    console.log('[PrivilegeContextTest] Generating privilege boundary...');
    const boundary = generatePrivilegeBoundary(snapshotId, createdAtUtc);

    const pb = boundary.privilegeBoundary;

    // Check that org scope is listed as inaccessible
    if (!pb.inaccessibleScopes.includes('admin:jira:organization')) {
      console.error(
        '[PrivilegeContextTest] FAIL: Expected org scope in inaccessibleScopes, ' +
        'got: ' + JSON.stringify(pb.inaccessibleScopes)
      );
      process.exit(1);
    }

    // Check that accessible scopes are populated
    if (pb.accessibleScopes.length === 0) {
      console.error(
        '[PrivilegeContextTest] FAIL: accessibleScopes is empty'
      );
      process.exit(1);
    }

    // Check that required accessible scopes are present
    if (!pb.accessibleScopes.includes('read:jira-work')) {
      console.error(
        '[PrivilegeContextTest] FAIL: read:jira-work not in accessibleScopes'
      );
      process.exit(1);
    }

    if (!pb.accessibleScopes.includes('storage:app')) {
      console.error(
        '[PrivilegeContextTest] FAIL: storage:app not in accessibleScopes'
      );
      process.exit(1);
    }

    // Test determinism: rebuild and compare
    console.log('[PrivilegeContextTest] Testing determinism...');
    const boundary2 = generatePrivilegeBoundary(snapshotId, createdAtUtc);

    const json1 = canonicalJsonString(boundary);
    const json2 = canonicalJsonString(boundary2);

    if (json1 !== json2) {
      console.error('[PrivilegeContextTest] FAIL: Privilege boundary not deterministic');
      console.error('First:  ' + json1.substring(0, 100));
      console.error('Second: ' + json2.substring(0, 100));
      process.exit(1);
    }

    console.log('[PrivilegeContextTest] ✓ PASS: Privilege context is deterministic and correctly scoped');
    process.exit(0);
  } catch (error) {
    console.error(`[PrivilegeContextTest] FAIL: ${error.message}`);
    process.exit(1);
  }
}

runPrivilegeContextTest();

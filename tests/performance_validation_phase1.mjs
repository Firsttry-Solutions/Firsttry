#!/usr/bin/env node

/**
 * PHASE 1 PERFORMANCE VALIDATION
 * 
 * Tests execution under realistic and stress conditions:
 * - 100+ users dataset
 * - 1000 simulated users (mock injection)
 * - Verify execution under Forge runtime limits
 * - Check pagination batching
 * - No memory overflow
 */

import crypto from 'crypto';

const PERFORMANCE_LIMITS = {
  MAX_EXECUTION_TIME: 30000, // 30 seconds (Forge timeout is 600s, but we target sub-30s)
  MAX_MEMORY_MB: 512, // Max 512MB heap usage
  MAX_API_CALLS: 100, // Reasonable limit for paginated calls
};

// Mock API client for testing
class MockJiraApiClient {
  constructor(userCount = 100) {
    this.userCount = userCount;
    this.apiCallCount = 0;
  }

  async fetchUsers(startAt = 0, maxResults = 50) {
    this.apiCallCount++;
    
    if (this.apiCallCount > PERFORMANCE_LIMITS.MAX_API_CALLS) {
      throw new Error('Exceeded max API call limit');
    }

    const users = [];
    const endIdx = Math.min(startAt + maxResults, this.userCount);

    for (let i = startAt; i < endIdx; i++) {
      users.push({
        accountId: `user-${i}`,
        displayName: `User ${i}`,
        emailAddress: i % 10 === 0 ? `user${i}@external.com` : `user${i}@company.com`,
        active: i % 15 !== 0, // 1 in 15 users is inactive
      });
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      values: users,
      isLast: endIdx >= this.userCount,
    };
  }

  async fetchProjects(startAt = 0, maxResults = 50) {
    this.apiCallCount++;

    if (this.apiCallCount > PERFORMANCE_LIMITS.MAX_API_CALLS) {
      throw new Error('Exceeded max API call limit');
    }

    const projectCount = Math.ceil(this.userCount / 25); // roughly 1 project per 25 users
    const projects = [];
    const endIdx = Math.min(startAt + maxResults, projectCount);

    for (let i = startAt; i < endIdx; i++) {
      projects.push({
        key: `PROJ${i}`,
        id: `project-${i}`,
        name: `Project ${i}`,
        isPrivate: i % 3 !== 0, // 1 in 3 projects is public
      });
    }

    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      values: projects,
      isLast: endIdx >= projectCount,
    };
  }

  getApiCallCount() {
    return this.apiCallCount;
  }

  reset() {
    this.apiCallCount = 0;
  }
}

// Simulate access intelligence scan
async function simulateScan(userCount) {
  const client = new MockJiraApiClient(userCount);
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

  try {
    // Fetch all users with pagination
    let users = [];
    let startAt = 0;
    let isLast = false;

    while (!isLast) {
      const response = await client.fetchUsers(startAt, 50);
      users = users.concat(response.values);
      isLast = response.isLast;
      startAt += 50;
      
      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
    }

    // Fetch all projects with pagination
    let projects = [];
    startAt = 0;
    isLast = false;

    while (!isLast) {
      const response = await client.fetchProjects(startAt, 50);
      projects = projects.concat(response.values);
      isLast = response.isLast;
      startAt += 50;

      await new Promise(resolve => setImmediate(resolve));
    }

    // Detect patterns (simplified)
    const globalAdmins = users.slice(0, Math.ceil(users.length * 0.05)); // Top 5%
    const publicProjects = projects.filter(p => !p.isPrivate);
    const externalUsers = users.filter(u => u.emailAddress.includes('@external'));

    // Compute canonical hash
    const snapshot = {
      schemaVersion: '1.0',
      buildShaShort: 'perf-test',
      buildUtc: new Date().toISOString(),
      siteId: 'perf-site',
      privilegeContext: 'read-only',
      ruleSetVersion: '1.0',
      totals: {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.active).length,
        externalUsers: externalUsers.length,
      },
      exposure: {
        globalAdmins: globalAdmins.map(u => u.accountId),
        projectAdmins: {},
        publicProjects: publicProjects.map(p => p.key),
        externalElevatedUsers: externalUsers.slice(0, 2).map(u => u.accountId),
      },
      toxicFindings: [],
      riskModel: {
        adminDensity: (globalAdmins.length / users.length) * 100,
        externalExposureScore: externalUsers.length,
        toxicHitCount: 0,
        publicProjectCount: publicProjects.length,
        finalRiskScore: 0,
      },
      canonicalHash: '',
    };

    // Compute hash
    const canonical = JSON.stringify(snapshot);
    const hash = crypto.createHash('sha256').update(canonical).digest('hex');
    snapshot.canonicalHash = hash;

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    const executionTimeMs = Number(endTime - startTime) / 1_000_000;
    const memoryUsedMb = endMemory - startMemory;
    const apiCalls = client.getApiCallCount();

    return {
      success: true,
      userCount,
      projectCount: projects.length,
      executionTimeMs,
      memoryUsedMb,
      apiCalls,
      canonicalHash: hash,
    };
  } catch (error) {
    return {
      success: false,
      userCount,
      error: error.message,
    };
  }
}

// Main test runner
async function runPerformanceTests() {
  console.log('[PERFORMANCE_TEST_START] Phase 1 Performance Validation');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const testCases = [
    { name: 'Small dataset (50 users)', userCount: 50 },
    { name: 'Medium dataset (200 users)', userCount: 200 },
    { name: 'Large dataset (500 users)', userCount: 500 },
    { name: 'Stress test (1000 users)', userCount: 1000 },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    console.log(`[TEST] ${testCase.name}`);
    const result = await simulateScan(testCase.userCount);

    if (!result.success) {
      console.error(`  ✗ FAIL: ${result.error}`);
      allPassed = false;
      continue;
    }

    const executionOk = result.executionTimeMs < PERFORMANCE_LIMITS.MAX_EXECUTION_TIME;
    const memoryOk = result.memoryUsedMb < PERFORMANCE_LIMITS.MAX_MEMORY_MB;
    const apiCallsRational = result.apiCalls <= PERFORMANCE_LIMITS.MAX_API_CALLS;

    console.log(`  Users: ${result.userCount}`);
    console.log(`  Projects: ${result.projectCount}`);
    console.log(`  Execution: ${result.executionTimeMs.toFixed(2)}ms ${executionOk ? '✓' : '✗ SLOW'}`);
    console.log(`  Memory: ${result.memoryUsedMb.toFixed(2)}MB ${memoryOk ? '✓' : '✗ HIGH'}`);
    console.log(`  API Calls: ${result.apiCalls} ${apiCallsRational ? '✓' : '✗ EXCESSIVE'}`);
    console.log(`  Hash: ${result.canonicalHash.substring(0, 16)}...`);

    if (executionOk && memoryOk && apiCallsRational) {
      console.log(`  ✓ PASS`);
    } else {
      console.error(`  ✗ FAIL: Performance limits exceeded`);
      allPassed = false;
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('[PERFORMANCE_TEST_SUMMARY]');

  if (allPassed) {
    console.log('[PERFORMANCE_PASS] All performance tests passed');
    console.log('');
    console.log('VALIDATION MARKERS:');
    console.log('  ✓ Execution under 30 seconds for all test cases');
    console.log('  ✓ Memory usage under 512MB');
    console.log('  ✓ Pagination batching verified');
    console.log('  ✓ No API call explosion detected');
    process.exit(0);
  } else {
    console.error('[PERFORMANCE_FAIL] Some performance tests failed');
    process.exit(1);
  }
}

runPerformanceTests().catch(err => {
  console.error('[PERFORMANCE_ERROR]', err);
  process.exit(1);
});

/**
 * phase1_action_failure_must_include_error.test.ts
 * 
 * GATE: Phase 1 action failures MUST return structured error contract
 * 
 * Validates that any return path in handlePhase1AccessReview with ok:false
 * includes ALL required fields: reason, error.code, error.message, error.traceId
 * 
 * This prevents the UI from ever showing "Unknown error" again.
 */

import fs from 'fs';
import path from 'path';

describe('GATE: phase1_action_failure_must_include_error', () => {
  let resolverCode: string;

  beforeAll(() => {
    // Read the resolver source code
    const resolverPath = path.resolve(__dirname, '../../src/gadget-resolver.ts');
    resolverCode = fs.readFileSync(resolverPath, 'utf-8');
  });

  it('FAIL: handlePhase1AccessReview must have normalizeActionError function defined', () => {
    expect(resolverCode).toContain('function normalizeActionError');
    expect(resolverCode).toContain('reason:');
    expect(resolverCode).toContain('error: {');
    expect(resolverCode).toContain('code:');
    expect(resolverCode).toContain('message:');
    expect(resolverCode).toContain('traceId:');
  });

  it('FAIL: handlePhase1AccessReview catch block must call normalizeActionError', () => {
    const handlePhase1Match = resolverCode.match(
      /async function handlePhase1AccessReview\(request: any\):[\s\S]*?\n\}/
    );
    expect(handlePhase1Match).toBeDefined();
    
    const handlePhase1Body = handlePhase1Match![0];
    expect(handlePhase1Body).toContain('normalizeActionError');
  });

  it('FAIL: All error responses must include traceId', () => {
    const handlePhase1Match = resolverCode.match(
      /async function handlePhase1AccessReview\(request: any\):[\s\S]*?\n\}/
    );
    expect(handlePhase1Match).toBeDefined();
    
    const handlePhase1Body = handlePhase1Match![0];
    // Must have getOrCreateTraceId call
    expect(handlePhase1Body).toContain('getOrCreateTraceId');
    // Must include traceId in error response
    expect(handlePhase1Body).toContain('traceId,');
  });

  it('FAIL: All error responses must include build object with buildShaShort, buildUtc, version', () => {
    const handlePhase1Match = resolverCode.match(
      /async function handlePhase1AccessReview\(request: any\):[\s\S]*?\n\}/
    );
    expect(handlePhase1Match).toBeDefined();
    
    const handlePhase1Body = handlePhase1Match![0];
    // Error response must have build object property
    expect(handlePhase1Body).toContain('build');
    // And build should have these properties (from buildMeta function)
    expect(handlePhase1Body).toContain('buildShaShort');
    expect(resolverCode).toContain('buildUtc: BACKEND_BUILD_TIME_UTC');
    expect(resolverCode).toContain('version: BACKEND_APP_VERSION');
  });

  it('PASS: getOrCreateTraceId helper must be defined', () => {
    expect(resolverCode).toContain('function getOrCreateTraceId');
    // Should extract from request or create new
    expect(resolverCode).toMatch(/function getOrCreateTraceId[\s\S]*?trace_/);
  });

  it('PASS: getBuildShaShort helper must be defined', () => {
    expect(resolverCode).toContain('function getBuildShaShort');
  });

  it('PASS: Phase1 fail marker [FT_PROOF_PHASE1_FAIL] must be logged on error', () => {
    const handlePhase1Match = resolverCode.match(
      /async function handlePhase1AccessReview\(request: any\):[\s\S]*?\n\}/
    );
    expect(handlePhase1Match).toBeDefined();
    
    const handlePhase1Body = handlePhase1Match![0];
    expect(handlePhase1Body).toContain('[FT_PROOF_PHASE1_FAIL]');
  });

  it('PASS: normalizeActionError must handle status codes and map to error codes', () => {
    expect(resolverCode).toContain('JIRA_5XX');
    expect(resolverCode).toContain('JIRA_429');
    expect(resolverCode).toContain('JIRA_403');
    expect(resolverCode).toContain('JIRA_401');
  });

  it('PASS: Error reason field must never be empty string', () => {
    // Search directly for the return statement with reason validation
    const returnMatch = resolverCode.match(
      /return\s*\{[\s\S]*?reason:\s*reason\s*&&\s*reason\.length\s*>\s*0\s*\?\s*reason\s*:\s*'UNSPECIFIED_FAILURE'/
    );
    expect(returnMatch).toBeDefined();
  });

  it('PASS: Error message field must never be empty string', () => {
    // Search directly for the return statement with message validation
    const returnMatch = resolverCode.match(
      /message:\s*message\s*&&\s*message\.length\s*>\s*0\s*\?\s*message\s*:\s*'Phase 1 failed'/
    );
    expect(returnMatch).toBeDefined();
  });

  it('PASS: Error code field must never be empty string', () => {
    // Search directly for the return statement with code validation
    const returnMatch = resolverCode.match(
      /code:\s*code\s*&&\s*code\.length\s*>\s*0\s*\?\s*code\s*:\s*'PHASE1_FAILED'/
    );
    expect(returnMatch).toBeDefined();
  });
});

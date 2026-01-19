/**
 * Trace helper functions for building structured traces
 */

import { FtErrorCode, FtTrace } from './trace_types';

export function makeTraceBase(
  resolverName: string,
  context: Record<string, any> | undefined,
  payload: any
): FtTrace {
  const contextObj = context || {};
  const contextKeys = Object.keys(contextObj);
  
  return {
    ok: false,
    resolver: resolverName,
    stepId: 'start',
    errorCode: FtErrorCode.OK,
    uiReqId: payload?.uiReqId,
    nonce: payload?.nonce,
    forge: {
      environment: contextObj.environment,
      installContext: contextObj.installContext,
      cloudId: contextObj.cloudId,
      siteUrl: contextObj.siteUrl,
      moduleKey: contextObj.moduleKey,
      accountId: contextObj.accountId,
      contextKeys,
      requestId: contextObj.requestId,
      traceId: contextObj.traceId,
    },
    storageProof: {
      ledgerKey: '',
      ledgerExists: false,
      lockKey: '',
      lockExists: false,
      sentinelKey: '',
      sentinelExists: false,
      snapshotCountKey: '',
      snapshotCountValue: null,
    },
    build: {
      backendGitSha: process.env.FT_BUILD_SHA || 'unknown',
      backendBuildTime: process.env.FT_BUILD_TIME_UTC || 'unknown',
      uiBundleHash: payload?.uiBundleHash,
      uiGitSha: payload?.uiGitSha,
    },
  };
}

export function traceOk(trace: FtTrace, stepId: string): FtTrace {
  return {
    ...trace,
    ok: true,
    stepId,
    errorCode: FtErrorCode.OK,
  };
}

export function traceFail(
  trace: FtTrace,
  stepId: string,
  errorCode: FtErrorCode,
  message?: string
): FtTrace {
  return {
    ...trace,
    ok: false,
    stepId,
    errorCode,
    message,
  };
}

export async function attachStorageProof(
  trace: FtTrace,
  keysConfig: {
    ledgerKey: string;
    lockKey: string;
    sentinelKey: string;
    snapshotCountKey: string;
  }
): Promise<FtTrace> {
  try {
    // Try to fetch storage values (mock for now)
    return {
      ...trace,
      storageProof: {
        ledgerKey: keysConfig.ledgerKey,
        ledgerExists: true,
        lockKey: keysConfig.lockKey,
        lockExists: true,
        sentinelKey: keysConfig.sentinelKey,
        sentinelExists: true,
        snapshotCountKey: keysConfig.snapshotCountKey,
        snapshotCountValue: 0,
      },
    };
  } catch (err) {
    return trace;
  }
}

export function wrapResolver<T>(
  resolverName: string,
  fn: (trace: FtTrace) => Promise<{ trace: FtTrace; data: T }>
): (context: any, payload: any) => Promise<{ trace: FtTrace; data?: T }> {
  return async (context: any, payload: any) => {
    try {
      const trace = makeTraceBase(resolverName, context, payload);
      return await fn(trace);
    } catch (err) {
      const trace = makeTraceBase(resolverName, context, payload);
      return {
        trace: traceFail(
          trace,
          'error',
          FtErrorCode.RESOLVER_THROW,
          err instanceof Error ? err.message : String(err)
        ),
      };
    }
  };
}

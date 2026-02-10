import { invoke } from "@forge/bridge";

export type InvokeOk<T> = { ok: true; value: T };
export type InvokeErr = { ok: false; error: { code: "BRIDGE_UNAVAILABLE" | "INVOKE_FAILED"; message: string } };

function short(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e ?? "");
  return s.length > 220 ? s.slice(0, 220) : s;
}

export async function forgeInvoke<T>(resolver: string, payload: any): Promise<InvokeOk<T> | InvokeErr> {
  try {
    // Get correlation ID from window global (set at UI startup, fail-closed if missing)
    const correlationId = (window as any).__FT_CORRELATION_ID || "MISSING";
    
    // Generate unique request ID per invoke
    const uiReqId = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Enhance payload with correlation fields (read-only, no app mutation)
    const enhancedPayload = {
      ...payload,
      uiReqId,
      correlationId,
    };

    // Log invoke attempt
    // eslint-disable-next-line no-console
    console.log("[UI_INVOKE]", { resolver, uiReqId, correlationId });

    // Deterministic proof marker that bridge invocation path is being used
    // eslint-disable-next-line no-console
    console.log("[UI_BRIDGE_PROOF] using @forge/bridge invoke resolver=", resolver);

    const v = await invoke<T>(resolver, enhancedPayload);

    // Log successful invoke
    // eslint-disable-next-line no-console
    console.log("[UI_INVOKE_OK]", { resolver, uiReqId, correlationId });

    return { ok: true, value: v };
  } catch (e) {
    // Log invoke error
    // eslint-disable-next-line no-console
    console.error("[UI_INVOKE_ERR]", {
      resolver,
      message: short(e),
    });
    return { ok: false, error: { code: "INVOKE_FAILED", message: short(e) } };
  }
}

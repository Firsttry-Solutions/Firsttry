import { invoke } from "@forge/bridge";

export type InvokeOk<T> = { ok: true; value: T };
export type InvokeErr = { ok: false; error: { code: "BRIDGE_UNAVAILABLE" | "INVOKE_FAILED"; message: string } };

function short(e: unknown): string {
  const s = e instanceof Error ? e.message : String(e ?? "");
  return s.length > 220 ? s.slice(0, 220) : s;
}

export async function forgeInvoke<T>(resolver: string, payload: any): Promise<InvokeOk<T> | InvokeErr> {
  try {
    // Deterministic proof marker that bridge invocation path is being used
    // eslint-disable-next-line no-console
    console.log("[UI_BRIDGE_PROOF] using @forge/bridge invoke resolver=", resolver);

    const v = await invoke<T>(resolver, payload);
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: { code: "INVOKE_FAILED", message: short(e) } };
  }
}

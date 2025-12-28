import { assertReadOnlyRequest } from "./assert_read_only";

/**
 * Wraps a requestJira-like function to enforce read-only at runtime.
 * This wrapper is pure and only validates the request payload.
 */
export function wrapRequestJira<TReq extends { method?: string }>(
  requestJiraFn: (req: TReq, ...rest: any[]) => any
) {
  return async (req: any, ...rest: any[]) => {
    // Support two common shapes used in the codebase/tests:
    // - requestJira(route: string, options?: { method?: string })
    // - requestJira({ method, url, ... })
    if (typeof req === "string") {
      const route = req as string;
      const options = rest[0] as any;
      assertReadOnlyRequest(options?.method);
      return requestJiraFn(route, options);
    }

    assertReadOnlyRequest(req?.method);
    return requestJiraFn(req, ...rest);
  };
}

export { assertReadOnlyRequest } from "./assert_read_only";
export default wrapRequestJira;

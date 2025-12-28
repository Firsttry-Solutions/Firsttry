import { describe, it, expect } from "vitest";
import { wrapRequestJira } from "../src/runtime_guards";

describe("P8 wiring: requestJira wrapper behavior", () => {
  it("blocks POST via wrapped requestJira", async () => {
    const raw = async () => ({ status: 200 });
    const wrapped = wrapRequestJira(raw);

    await expect(
      wrapped({ method: "POST", url: "/rest/api/3/issue" } as any)
    ).rejects.toThrow(/read-only|READ_ONLY_GUARD/i);
  });

  it("allows GET via wrapped requestJira", async () => {
    const raw = async () => ({ status: 200 });
    const wrapped = wrapRequestJira(raw);

    const res = await wrapped({ method: "GET", url: "/rest/api/3/project" } as any);
    expect(res.status).toBe(200);
  });
});

import { describe as _d, test, expect as _e } from 'vitest';
import { wrapHandler } from '../src/ops/handler_wrapper';

// Handler that performs a Jira POST via the request api path
function makePostHandler() {
  return wrapHandler(async (request: any) => {
    // This should be intercepted by the wrapper applied in wrapHandler
    await request.api.asApp().requestJira('/rest/api/3/issue', { method: 'POST' });
    return { status: 200, body: 'ok' };
  }, 'p8-wiring-post');
}

// Handler that performs a Jira GET via the request api path
function makeGetHandler() {
  return wrapHandler(async (request: any) => {
    const res = await request.api.asUser().requestJira('/rest/api/3/issue/1', { method: 'GET' });
    return { status: 200, body: res };
  }, 'p8-wiring-get');
}

describe('P8 runtime wiring via handler_wrapper', () => {
  test('POST through handler_wrapper is blocked', async () => {
    const h = makePostHandler();
    const resp = await h({});
    // The wrapper should have converted the error into an error response
    expect(resp.status).not.toBe(200);
  });

  test('GET through handler_wrapper is allowed', async () => {
    const h = makeGetHandler();
    const resp = await h({});
    expect(resp.status).toBe(200);
    // The synthetic baseRequestJira returns an object with route/options
    expect((resp.body as any).route).toBe('/rest/api/3/issue/1');
  });
});

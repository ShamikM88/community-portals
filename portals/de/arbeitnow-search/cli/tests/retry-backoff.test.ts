import { afterEach, describe, expect, test } from "bun:test";
import { fetchWithBackoff } from "../src/helpers";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockFetch(statuses: number[]) {
  let calls = 0;
  globalThis.fetch = (async () => {
    const status = statuses[Math.min(calls, statuses.length - 1)]!;
    calls++;
    return new Response(status === 200 ? "ok" : "", { status });
  }) as unknown as typeof fetch;
  return () => calls;
}

const URL_OK = "https://www.arbeitnow.com/api/job-board-api?page=1";

describe("fetchWithBackoff", () => {
  test("retries a 429 and a 5xx, then returns the successful response", async () => {
    const calls = mockFetch([429, 503, 200]);
    const res = await fetchWithBackoff(URL_OK, "application/json", { baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(calls()).toBe(3);
  });

  test("gives up after six retries and says so", async () => {
    const calls = mockFetch([503]);
    await expect(fetchWithBackoff(URL_OK, "application/json", { baseDelayMs: 1 })).rejects.toThrow("503");
    expect(calls()).toBe(7);
  });

  test("does not retry a 404", async () => {
    const calls = mockFetch([404]);
    const res = await fetchWithBackoff(URL_OK, "application/json", { baseDelayMs: 1 });
    expect(res.status).toBe(404);
    expect(calls()).toBe(1);
  });
});

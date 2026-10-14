/**
 * The server's only network access (plan 0062 section 5, D-090): POST requests to the
 * ThrustCurve.org API, read-only, with a timeout, no redirects and a cap on the answer's size. Any
 * other URL is refused before a request is made, whatever a caller passes.
 */
import { THRUSTCURVE_BASE_URL, type Transport } from '@lo-fi-rocket/formats';

/** How long one request may take. */
export const REQUEST_TIMEOUT_MS = 20_000;
/** Largest answer read: a search of 50 motors or one data file is a few hundred kilobytes. */
export const MAX_RESPONSE_CHARACTERS = 4 * 1024 * 1024;
/** Requests one session may make, so a runaway loop cannot flood the service. */
export const MAX_REQUESTS_PER_SESSION = 200;

export type Fetch = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
    redirect: 'error';
  },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/** A Transport for the ThrustCurve client over `fetchImpl` (the global fetch in the server). */
export function thrustCurveTransport(fetchImpl: Fetch): Transport {
  let requests = 0;
  return async (url, init) => {
    if (!url.startsWith(THRUSTCURVE_BASE_URL)) {
      throw new Error(`only ${THRUSTCURVE_BASE_URL} may be contacted, not ${url}`);
    }
    requests += 1;
    if (requests > MAX_REQUESTS_PER_SESSION) {
      throw new Error(
        `this session has made its ${String(MAX_REQUESTS_PER_SESSION)} requests; reconnect to make more`,
      );
    }
    const response = await fetchImpl(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'error',
    });
    return {
      ok: response.ok,
      status: response.status,
      text: async () => {
        const t = await response.text();
        if (t.length > MAX_RESPONSE_CHARACTERS)
          throw new Error('ThrustCurve.org answered with more data than expected');
        return t;
      },
    };
  };
}

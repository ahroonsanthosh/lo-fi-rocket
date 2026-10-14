/** The only network access: ThrustCurve.org, with a timeout, no redirects and size limits (plan 0062). */
import { describe, expect, it } from 'vitest';
import {
  MAX_REQUESTS_PER_SESSION,
  MAX_RESPONSE_CHARACTERS,
  thrustCurveTransport,
  type Fetch,
} from './transport.js';

const post = { method: 'POST' as const, headers: {}, body: '{}' };

describe('thrustCurveTransport', () => {
  it('refuses any URL outside the ThrustCurve.org API before a request is made', async () => {
    let requests = 0;
    const t = thrustCurveTransport(() => {
      requests += 1;
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    });
    await expect(t('https://example.com/steal', post)).rejects.toThrow(
      /only https:\/\/www.thrustcurve.org\/api\/v1\/ may be contacted/,
    );
    await expect(
      t('https://www.thrustcurve.org.evil.example/api/v1/search.json', post),
    ).rejects.toThrow(/only/);
    expect(requests).toBe(0);
  });

  it('sends a timeout and refuses redirects, and refuses an oversized answer', async () => {
    let seen: Parameters<Fetch>[1] | undefined;
    const t = thrustCurveTransport((_url, init) => {
      seen = init;
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('x'.repeat(MAX_RESPONSE_CHARACTERS + 1)),
      });
    });
    const response = await t('https://www.thrustcurve.org/api/v1/search.json', post);
    expect(seen?.redirect).toBe('error');
    expect(seen?.signal).toBeInstanceOf(AbortSignal);
    await expect(response.text()).rejects.toThrow(/more data than expected/);
  });

  it('stops after the session’s request allowance', async () => {
    const t = thrustCurveTransport(() =>
      Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') }),
    );
    for (let i = 0; i < MAX_REQUESTS_PER_SESSION; i++)
      await t('https://www.thrustcurve.org/api/v1/search.json', post);
    await expect(t('https://www.thrustcurve.org/api/v1/search.json', post)).rejects.toThrow(
      /reconnect/,
    );
  });
});

/**
 * Simulation runner (plan 0014): the page asks for a flight and gets the
 * result or the physics' own error message. The worker runner keeps the
 * page responsive; the synchronous runner is for tests.
 */
import { designSimulationOptions, designVehicle, type RocketDesign } from '@lo-fi-rocket/formats';
import { simulateFlight, type FlightResult } from '@lo-fi-rocket/physics';

export type RunOutcome =
  | { readonly ok: true; readonly result: FlightResult; readonly millis: number }
  | { readonly ok: false; readonly message: string };

export interface Runner {
  run(design: RocketDesign): Promise<RunOutcome>;
}

export function runNow(design: RocketDesign): RunOutcome {
  const start = performance.now();
  try {
    const result = simulateFlight(designVehicle(design), designSimulationOptions(design));
    return { ok: true, result, millis: performance.now() - start };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function synchronousRunner(): Runner {
  return { run: (design) => Promise.resolve(runNow(design)) };
}

/**
 * A runner on a module Web Worker, created on the first run so that
 * environments without workers (tests) never touch it; one run at a time,
 * a new run supersedes the previous reply.
 */
export function workerRunner(): Runner {
  let worker: Worker | undefined;
  let sequence = 0;
  return {
    run: (design) =>
      new Promise<RunOutcome>((resolve) => {
        worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        const w = worker;
        sequence += 1;
        const mine = sequence;
        const onMessage = (e: MessageEvent<{ sequence: number; outcome: RunOutcome }>): void => {
          if (e.data.sequence !== mine) return;
          w.removeEventListener('message', onMessage);
          resolve(e.data.outcome);
        };
        w.addEventListener('message', onMessage);
        w.addEventListener(
          'error',
          (e) => {
            resolve({ ok: false, message: `The simulation worker failed: ${e.message}` });
          },
          { once: true },
        );
        w.postMessage({ sequence: mine, design });
      }),
  };
}

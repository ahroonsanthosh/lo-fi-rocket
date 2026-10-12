/**
 * Simulation runner (plan 0014): the page asks for a flight and gets the
 * result or the physics' own error message. The worker runner keeps the
 * page responsive; the synchronous runner is for tests.
 */
import {
  designSimulationOptions,
  designVehicle,
  runDispersion,
  type DispersionResult,
  type DispersionSettings,
  type RocketDesign,
} from '@lo-fi-rocket/formats';
import { simulateFlight, type FlightResult } from '@lo-fi-rocket/physics';

export type RunOutcome =
  | { readonly ok: true; readonly result: FlightResult; readonly millis: number }
  | { readonly ok: false; readonly message: string };

export type DispersionOutcome =
  | { readonly ok: true; readonly result: DispersionResult; readonly millis: number }
  | { readonly ok: false; readonly message: string };

export interface Runner {
  run(design: RocketDesign): Promise<RunOutcome>;
  runDispersion(
    design: RocketDesign,
    settings: DispersionSettings,
    onProgress?: (done: number, total: number) => void,
  ): Promise<DispersionOutcome>;
}

export function runDispersionNow(
  design: RocketDesign,
  settings: DispersionSettings,
  onProgress?: (done: number, total: number) => void,
): DispersionOutcome {
  const start = performance.now();
  try {
    const result = runDispersion(design, settings, onProgress);
    return { ok: true, result, millis: performance.now() - start };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
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
  return {
    run: (design) => Promise.resolve(runNow(design)),
    runDispersion: (design, settings, onProgress) =>
      Promise.resolve(runDispersionNow(design, settings, onProgress)),
  };
}

/**
 * A runner on a module Web Worker, created on the first run so that
 * environments without workers (tests) never touch it; one run at a time,
 * a new run supersedes the previous reply.
 */
export type WorkerRequest =
  | { readonly sequence: number; readonly kind: 'flight'; readonly design: RocketDesign }
  | {
      readonly sequence: number;
      readonly kind: 'dispersion';
      readonly design: RocketDesign;
      readonly settings: DispersionSettings;
    };
export type WorkerReply =
  | { readonly sequence: number; readonly kind: 'flight'; readonly outcome: RunOutcome }
  | { readonly sequence: number; readonly kind: 'dispersion'; readonly outcome: DispersionOutcome }
  | {
      readonly sequence: number;
      readonly kind: 'progress';
      readonly done: number;
      readonly total: number;
    };

export function workerRunner(): Runner {
  let worker: Worker | undefined;
  let sequence = 0;
  const ensure = (): Worker => {
    worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    return worker;
  };
  return {
    runDispersion: (design, settings, onProgress) =>
      new Promise<DispersionOutcome>((resolve) => {
        const w = ensure();
        sequence += 1;
        const mine = sequence;
        const onMessage = (e: MessageEvent<WorkerReply>): void => {
          if (e.data.sequence !== mine) return;
          if (e.data.kind === 'progress') {
            onProgress?.(e.data.done, e.data.total);
            return;
          }
          if (e.data.kind !== 'dispersion') return;
          w.removeEventListener('message', onMessage);
          resolve(e.data.outcome);
        };
        w.addEventListener('message', onMessage);
        const request: WorkerRequest = { sequence: mine, kind: 'dispersion', design, settings };
        w.postMessage(request);
      }),
    run: (design) =>
      new Promise<RunOutcome>((resolve) => {
        const w = ensure();
        sequence += 1;
        const mine = sequence;
        const onMessage = (e: MessageEvent<WorkerReply>): void => {
          if (e.data.sequence !== mine || e.data.kind !== 'flight') return;
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
        const request: WorkerRequest = { sequence: mine, kind: 'flight', design };
        w.postMessage(request);
      }),
  };
}

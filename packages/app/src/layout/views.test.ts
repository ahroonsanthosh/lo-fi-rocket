import { exampleDesign, newDesign } from '@lo-fi-rocket/formats';
import { describe, expect, it } from 'vitest';
import { machStatus } from './stability.js';
import { railExitStatus } from './panels.js';
import { EMPTY_STEP_PREFIX } from './steps.js';
import { isView, viewOf, VIEW_TITLE } from './views.js';

describe('views of the main screen', () => {
  const d = exampleDesign('v');
  it('a selection opens the view it belongs to', () => {
    const fins = d.components.find((c) => c.component.kind === 'finSet');
    expect(viewOf(fins?.id, d)).toBe('airframe');
    expect(viewOf(d.recovery[0]?.id, d)).toBe('recovery');
    expect(viewOf('motor', d)).toBe('motor');
    expect(viewOf('flight', d)).toBe('flight');
    expect(viewOf('launch', d)).toBe('launch');
    expect(viewOf(`${EMPTY_STEP_PREFIX}body`, newDesign('n', 'N'))).toBe('airframe');
    expect(viewOf(`${EMPTY_STEP_PREFIX}recovery`, newDesign('n', 'N'))).toBe('recovery');
  });
  it('no selection or an unknown one leaves the view as it is', () => {
    expect(viewOf(undefined, d)).toBeUndefined();
    expect(viewOf('nothing', d)).toBeUndefined();
  });
  it('every view has a title and only views are views', () => {
    expect(VIEW_TITLE.overview).toBe('Vehicle overview');
    expect(isView('flight')).toBe(true);
    expect(isView('cabin')).toBe(false);
  });
});

describe('statuses in words (D-UI-5, the flight warnings’ own boundaries)', () => {
  it('the maximum Mach regime, strictly above each boundary as designFlightWarnings does', () => {
    expect(machStatus(0.18)).toEqual({ severity: 'info', label: 'Subsonic' });
    expect(machStatus(0.8)).toEqual({ severity: 'info', label: 'Subsonic' });
    expect(machStatus(0.81)).toEqual({ severity: 'limitation', label: 'Transonic' });
    expect(machStatus(1.2)).toEqual({ severity: 'limitation', label: 'Transonic' });
    expect(machStatus(1.5)).toEqual({ severity: 'limitation', label: 'Supersonic' });
    expect(machStatus(2.1)).toEqual({
      severity: 'limitation',
      label: 'Beyond the validated range',
    });
  });
  it('rail exit below the minimum is a danger, at or above it is not (warning: v < minimum)', () => {
    expect(railExitStatus(14.9, 15, '15.0 m/s')).toEqual({
      severity: 'danger',
      label: 'Below 15.0 m/s',
    });
    expect(railExitStatus(15, 15, '15.0 m/s')).toEqual({
      severity: 'safe',
      label: 'At least 15.0 m/s',
    });
  });
});

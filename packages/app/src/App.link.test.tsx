/**
 * Opening a design from a link (plan 0063): the linked design opens with a fresh id and is stored
 * at once; the design that was open stays stored; a damaged link is reported and the autosave
 * opens instead.
 */
import {
  encodeDesignLink,
  exampleDesign,
  parseDesign,
  serializeDesign,
} from '@lo-fi-rocket/formats';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
import type { Storage } from './state/autosave.js';

function memory(): Storage & { readonly map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function withSaved(name: string): Storage & { readonly map: Map<string, string> } {
  const storage = memory();
  storage.setItem('lofi-rocket:last', 'mine');
  storage.setItem('lofi-rocket:design:mine', serializeDesign({ ...exampleDesign('mine'), name }));
  return storage;
}

describe('design links (plan 0063)', () => {
  it('open the linked design, store it under a new id and keep the previous one', () => {
    const storage = withSaved('My rocket');
    const shared = { ...exampleDesign('sender-id'), name: 'Shared rocket' };
    render(<App storage={storage} linkFragment={encodeDesignLink(shared)} />);
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Shared rocket');
    expect(screen.getByRole('region', { name: 'Warnings' })).toHaveTextContent(
      'Opened "Shared rocket" from a link',
    );
    const last = storage.map.get('lofi-rocket:last') ?? '';
    expect(last).not.toBe('mine');
    expect(last).not.toBe('sender-id');
    const stored = parseDesign(storage.map.get(`lofi-rocket:design:${last}`) ?? '');
    expect(serializeDesign({ ...stored, id: 'x' })).toBe(serializeDesign({ ...shared, id: 'x' }));
    expect(parseDesign(storage.map.get('lofi-rocket:design:mine') ?? '').name).toBe('My rocket');
  });

  it('report a damaged link and open the autosave instead', () => {
    const storage = withSaved('My rocket');
    render(<App storage={storage} linkFragment="#design=v1.not*valid" />);
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('My rocket');
    expect(screen.getByRole('region', { name: 'Warnings' })).toHaveTextContent(
      /The design link could not be opened.*characters a design link never has.*Your last design is open instead/,
    );
  });

  it('ignore other fragments', () => {
    const storage = withSaved('My rocket');
    render(<App storage={storage} linkFragment="#about" />);
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('My rocket');
  });
});

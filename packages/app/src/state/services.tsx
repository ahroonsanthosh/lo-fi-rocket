import { createContext, useContext } from 'react';
import type { KeyValueStore, Transport } from '@lo-fi-rocket/formats';

/** Browser services the components use, injected so tests can replace them. */
export interface Services {
  readonly transport: Transport;
  readonly motorStore: KeyValueStore | undefined;
  readonly readFile: (file: File) => Promise<string>;
}

export const ServicesContext = createContext<Services | undefined>(undefined);

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (s === undefined) throw new Error('useServices must be used inside the App');
  return s;
}

export function browserServices(motorStore: KeyValueStore | undefined): Services {
  return {
    transport: (url, init) => fetch(url, init),
    motorStore,
    readFile: (file) => file.text(),
  };
}

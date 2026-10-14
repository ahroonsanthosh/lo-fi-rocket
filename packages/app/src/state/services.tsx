import { createContext, useContext } from 'react';
import {
  InputTooLargeError,
  MAX_INPUT_BYTES,
  type KeyValueStore,
  type Transport,
} from '@lo-fi-rocket/formats';
import { workerRunner, type Runner } from '../simulation/runner.js';

/** Browser services the components use, injected so tests can replace them. */
export interface Services {
  readonly transport: Transport;
  readonly motorStore: KeyValueStore | undefined;
  readonly readFile: (file: File) => Promise<string>;
  readonly runner: Runner;
  /** Offer a text file to the user (a download in the browser). */
  readonly saveFile: (name: string, text: string, mime: string) => void;
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
    // A huge file is refused before it is read, so it cannot exhaust memory (plan 0061, D-090).
    readFile: (file) =>
      file.size > MAX_INPUT_BYTES
        ? Promise.reject(new InputTooLargeError(file.name, file.size, MAX_INPUT_BYTES))
        : file.text(),
    runner: workerRunner(),
    saveFile: (name, text, mime) => {
      const url = URL.createObjectURL(new Blob([text], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}

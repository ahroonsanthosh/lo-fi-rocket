import { createContext, useContext, type Dispatch } from 'react';
import type { Action, AppState } from './reducer.js';

export interface Store {
  readonly state: AppState;
  readonly dispatch: Dispatch<Action>;
}

export const StoreContext = createContext<Store | undefined>(undefined);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (store === undefined) throw new Error('useStore must be used inside the App');
  return store;
}

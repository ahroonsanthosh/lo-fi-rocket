/// <reference lib="webworker" />
import type { RocketDesign } from '@lo-fi-rocket/formats';
import { runNow } from './runner.js';

addEventListener('message', (e: MessageEvent<{ sequence: number; design: RocketDesign }>) => {
  const outcome = runNow(e.data.design);
  postMessage({ sequence: e.data.sequence, outcome });
});

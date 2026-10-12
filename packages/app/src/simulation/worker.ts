/// <reference lib="webworker" />
import { runDispersionNow, runNow, type WorkerReply, type WorkerRequest } from './runner.js';

addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.kind === 'flight') {
    const reply: WorkerReply = {
      sequence: req.sequence,
      kind: 'flight',
      outcome: runNow(req.design),
    };
    postMessage(reply);
    return;
  }
  const outcome = runDispersionNow(req.design, req.settings, (done, total) => {
    const progress: WorkerReply = { sequence: req.sequence, kind: 'progress', done, total };
    postMessage(progress);
  });
  const reply: WorkerReply = { sequence: req.sequence, kind: 'dispersion', outcome };
  postMessage(reply);
});

/**
 * Build with Claude on the site (plan 0082, D-122): copy a prompt, ask Claude in any Claude app on
 * the user's own plan, and paste the answer back; the design is built and flown here. Nothing is
 * uploaded and nothing is paid: the answer is read in this browser by the same code as the MCP
 * server's build_and_fly, and the only request is the read-only ThrustCurve.org lookup of a motor
 * the library lacks. The builder is loaded when the dialog opens, so it stays out of the first page.
 */
import { useEffect, useId, useMemo, useState, type DragEvent, type JSX } from 'react';
import { MAX_INPUT_BYTES, InputTooLargeError } from '@lo-fi-rocket/formats';
import type * as Paste from '@lo-fi-rocket/mcp/paste';
import { Button, Dialog } from '@lo-fi-rocket/ui';
import { storedMotors } from '../motors/library.js';
import { useServices } from '../state/services.js';

export interface BuildWithClaudeProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Replace the design with the one built, and fly it; resolves when the flight is shown. */
  readonly onBuilt: (built: Paste.PasteResult) => Promise<void>;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function BuildWithClaude({ open, onClose, onBuilt }: BuildWithClaudeProps): JSX.Element {
  const services = useServices();
  const [paste, setPaste] = useState<typeof Paste | undefined>(undefined);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const answerId = useId();

  useEffect(() => {
    if (!open || paste !== undefined) return;
    let live = true;
    import('@lo-fi-rocket/mcp/paste').then(
      (m) => {
        if (live) setPaste(m);
      },
      (e: unknown) => {
        if (live) setError(`The builder could not be loaded (${errorText(e)}). Reload the page.`);
      },
    );
    return () => {
      live = false;
    };
  }, [open, paste]);

  const prompt = useMemo(() => paste?.pastePrompt(), [paste]);
  const options = (): Paste.PasteOptions => ({
    transport: services.transport,
    library: services.motorStore === undefined ? [] : storedMotors(services.motorStore).motors,
  });

  const finish = async (build: () => Promise<Paste.PasteResult>): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      const built = await build();
      await onBuilt(built);
      setText('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const buildText = (): void => {
    if (paste === undefined) return;
    void finish(() => paste.buildFromPaste(text, options()));
  };

  const buildFile = (file: File): void => {
    if (paste === undefined) return;
    void finish(async () => {
      // A huge file is refused before it is read (plan 0061, D-090).
      if (file.size > MAX_INPUT_BYTES)
        throw new InputTooLargeError(file.name, file.size, MAX_INPUT_BYTES);
      const bytes = new Uint8Array(await file.arrayBuffer());
      return paste.buildFromFile(file.name, bytes, options());
    });
  };

  const copy = (): void => {
    if (prompt === undefined) return;
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined) {
      setError('This browser does not allow copying here: open “Show the prompt” and copy it.');
      return;
    }
    clipboard.writeText(prompt).then(
      () => {
        setCopied(true);
      },
      () => {
        setError('The browser blocked copying: open “Show the prompt” and copy it.');
      },
    );
  };

  const drop = (e: DragEvent<HTMLTextAreaElement>): void => {
    const file = e.dataTransfer.files[0];
    if (file === undefined) return;
    e.preventDefault();
    buildFile(file);
  };

  return (
    <Dialog
      open={open}
      title="Build with Claude"
      description="Describe your rocket to Claude on your own Claude plan, and fly what it builds. Free: nothing is uploaded, and no key or account is needed here."
      onClose={() => {
        if (!busy) onClose();
      }}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy || paste === undefined || text.trim() === ''}
            onClick={buildText}
          >
            {busy ? 'Building and flying…' : 'Build and fly'}
          </Button>
        </>
      }
    >
      <ol className="claude-steps">
        <li>
          <p>
            <strong>Copy the prompt.</strong> It tells Claude exactly what to answer with.
          </p>
          <Button onClick={copy} disabled={prompt === undefined}>
            {copied ? 'Copied' : 'Copy the prompt'}
          </Button>
          <details className="claude-steps__prompt">
            <summary>Show the prompt</summary>
            <textarea readOnly value={prompt ?? ''} aria-label="The prompt" rows={6} />
          </details>
        </li>
        <li>
          <p>
            <strong>Ask Claude.</strong> Paste the prompt into any Claude app (claude.ai, the
            desktop or phone app, Claude Code), then describe your rocket, or attach a photo, a
            parts list or a kit page.{' '}
            <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">
              Open claude.ai
            </a>
          </p>
        </li>
        <li>
          <p>
            <label htmlFor={answerId}>
              <strong>Paste Claude’s answer here.</strong>
            </label>{' '}
            The text of a design file works too (.lofi.json, OpenRocket, RASAero II .CDX1), or drop
            the file on the box.
          </p>
          <textarea
            id={answerId}
            className="claude-steps__answer"
            value={text}
            rows={8}
            spellCheck={false}
            placeholder="```json { … } ```"
            onChange={(e) => {
              setText(e.target.value);
              setError(undefined);
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) e.preventDefault();
            }}
            onDrop={drop}
          />
          <label className="lfr-button lfr-button--secondary claude-steps__file">
            Choose a file
            <input
              type="file"
              accept=".ork,.json,.CDX1,.cdx1,.xml,.txt"
              aria-label="Choose a design file or a saved answer"
              className="visually-hidden"
              disabled={busy || paste === undefined}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f !== undefined) buildFile(f);
                e.target.value = '';
              }}
            />
          </label>
        </li>
      </ol>
      {error === undefined ? null : (
        <p role="alert" className="claude-steps__error">
          {error}
        </p>
      )}
      <p className="muted">
        The figures are predictions, not guarantees. Claude may estimate what you did not say: every
        estimate, and every value left out, is listed with the result.
      </p>
    </Dialog>
  );
}

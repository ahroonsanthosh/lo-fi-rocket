import { useRef, type JSX } from 'react';
import { Button, type ButtonVariant } from './Button.js';

export interface FileButtonProps {
  readonly label: string;
  /** File types for the picker, for example ".ork,.xml". */
  readonly accept: string;
  readonly onFile: (file: File) => void;
  readonly variant?: ButtonVariant;
}

/**
 * Opens a file picker from a real, visibly focusable button. The file
 * input itself is out of the Tab order, so keyboard focus never lands on
 * an invisible control (the review found two such stops in the header).
 */
export function FileButton({ label, accept, onFile, variant }: FileButtonProps): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        variant={variant ?? 'secondary'}
        onClick={() => {
          input.current?.click();
        }}
      >
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        className="lfr-visually-hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f !== undefined) onFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}

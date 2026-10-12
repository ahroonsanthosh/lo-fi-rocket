import { useEffect, useId, useState, type JSX, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryKey } from '../glossary/glossary.js';

export interface TooltipProps {
  /** The tooltip text or content. Also the trigger's accessible description. */
  readonly content: ReactNode;
  /**
   * Renders the trigger. It must spread `triggerProps` on a focusable
   * element so that keyboard users can open the tooltip.
   */
  readonly children: (triggerProps: TooltipTriggerProps) => ReactNode;
}

export interface TooltipTriggerProps {
  readonly 'aria-describedby': string;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
  readonly onClick: () => void;
}

/**
 * A tooltip that opens on hover and on keyboard focus, stays open while
 * the pointer is over it, and closes with Escape (WCAG 2.2 SC 1.4.13).
 * A click pins it open for touch screens. Its content is always in the
 * DOM, so it is the trigger's description even while closed.
 */
export function Tooltip({ content, children }: TooltipProps): JSX.Element {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused || pinned) && !dismissed;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setDismissed(true);
        setPinned(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const trigger: TooltipTriggerProps = {
    'aria-describedby': id,
    onFocus: () => {
      setFocused(true);
      setDismissed(false);
    },
    onBlur: () => {
      setFocused(false);
      setPinned(false);
    },
    onClick: () => {
      setPinned((p) => !p);
      setDismissed(false);
    },
  };

  return (
    <span
      className="lfr-tooltip"
      onMouseEnter={() => {
        setHovered(true);
        setDismissed(false);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
    >
      {children(trigger)}
      <span id={id} role="tooltip" className="lfr-tooltip__bubble" hidden={!open}>
        {content}
      </span>
    </span>
  );
}

export interface TermProps {
  /** The glossary entry to explain. */
  readonly k: GlossaryKey;
  /** The visible text; the entry's term by default. */
  readonly children?: ReactNode;
  /** Accessible name when the visible text is only a symbol. */
  readonly ariaLabel?: string;
}

/**
 * A technical term with its plain-language explanation and what a good
 * value looks like, from the glossary. The term is a button so that it
 * can be focused and tapped; it does nothing else.
 */
export function Term({ k, children, ariaLabel }: TermProps): JSX.Element {
  const entry = GLOSSARY[k];
  return (
    <Tooltip
      content={
        <>
          <strong className="lfr-tooltip__title">{entry.name}</strong>
          <span className="lfr-tooltip__text">{entry.meaning}</span>
          <span className="lfr-tooltip__text">
            <strong>Good value: </strong>
            {entry.goodValue}
          </span>
        </>
      }
    >
      {(trigger) => (
        <button type="button" className="lfr-term" aria-label={ariaLabel} {...trigger}>
          {children ?? entry.term}
        </button>
      )}
    </Tooltip>
  );
}

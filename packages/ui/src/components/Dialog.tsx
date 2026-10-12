import {
  useEffect,
  useId,
  useRef,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  /** One sentence under the title; becomes the dialog's description. */
  readonly description?: string;
  /** Called on Escape and on the backdrop when `dismissible`; the caller closes the dialog. */
  readonly onClose: () => void;
  /**
   * False for a dialog that needs an explicit choice, such as an
   * acknowledgement: Escape and the backdrop then do nothing.
   */
  readonly dismissible?: boolean;
  readonly children?: ReactNode;
  /** The buttons; the first focusable element gets focus unless `initialFocus` says otherwise. */
  readonly actions: ReactNode;
  readonly initialFocus?: RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog (WAI-ARIA dialog pattern): focus moves into it on open,
 * Tab and Shift+Tab stay inside it, Escape closes it when dismissible,
 * and focus returns to the element that opened it.
 */
export function Dialog(props: DialogProps): JSX.Element | null {
  const { open, title, description, onClose, dismissible = true, children, actions } = props;
  const titleId = useId();
  const descId = useId();
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const initialFocus = props.initialFocus;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target =
      initialFocus?.current ?? box.current?.querySelector<HTMLElement>(FOCUSABLE) ?? box.current;
    target?.focus();
    return () => {
      opener.current?.focus();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (dismissible) onClose();
      return;
    }
    if (e.key !== 'Tab' || box.current === null) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      e.preventDefault();
      return;
    }
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="lfr-dialog__backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description === undefined ? undefined : descId}
        className="lfr-dialog"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="lfr-dialog__title">
          {title}
        </h2>
        {description === undefined ? null : (
          <p id={descId} className="lfr-dialog__description">
            {description}
          </p>
        )}
        {children === undefined ? null : <div className="lfr-dialog__body">{children}</div>}
        <div className="lfr-dialog__actions">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}

import { RefObject, useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusableIn(node: HTMLElement): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => !el.matches(':disabled'));
}

function currentFocus(): HTMLElement | null {
  const element = document.activeElement as HTMLElement | null;
  return element && element !== document.body ? element : null;
}

/** Modal keyboard behaviour: Escape closes, Tab stays inside, focus returns to the opener on close. */
export function useDialog(
  ref: RefObject<HTMLElement>,
  onClose: () => void,
  active = true,
  fallbackFocus?: () => HTMLElement | null,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;
  const openerRef = useRef<HTMLElement | null>(null);
  const wasActiveRef = useRef(false);
  // Capture the opener during render, before autoFocus or effects move focus into the dialog.
  if (active && !wasActiveRef.current) openerRef.current = currentFocus();
  wasActiveRef.current = active;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    // The opener may have unmounted (e.g. a closed menu item); use whatever now holds focus outside the dialog.
    if (!openerRef.current?.isConnected && !node?.contains(document.activeElement)) {
      openerRef.current = currentFocus();
    }
    if (node && !node.contains(document.activeElement)) {
      (node.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(node)[0] ?? node).focus();
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!node || event.defaultPrevented) return;
      // Ignore keys from portals such as pickers rendered outside the dialog.
      if (event.target instanceof Element && event.target !== document.body && !node.contains(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusableIn(node);
      if (items.length === 0) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const opener = openerRef.current?.isConnected ? openerRef.current : fallbackRef.current?.();
      opener?.focus();
    };
  }, [active, ref]);
}

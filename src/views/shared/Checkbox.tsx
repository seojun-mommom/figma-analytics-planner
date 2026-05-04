/** @jsx h */
import { h, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export type CheckboxState = 'checked' | 'indeterminate' | 'unchecked';

interface Props {
  state: CheckboxState;
  onToggle: () => void;
  ariaLabel?: string;
  title?: string;
}

// White checkmark and dash, drawn over the orange fill when checked / indeterminate.
const CHECK_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-6' stroke='%23ffffff' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";
const DASH_ICON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8h8' stroke='%23ffffff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\")";

export function Checkbox({ state, onToggle, ariaLabel, title }: Props): JSX.Element {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current === null) return;
    const el = ref.current;
    el.indeterminate = state === 'indeterminate';
    const s = el.style;
    // The plugin UI framework's global reset already sets `input { -webkit-appearance: none }`,
    // so we draw the box ourselves instead of trying to restore the native widget.
    s.setProperty('-webkit-appearance', 'none', 'important');
    s.setProperty('appearance', 'none', 'important');
    s.setProperty('width', '16px');
    s.setProperty('height', '16px');
    s.setProperty('border-radius', '3px');
    s.setProperty('cursor', 'pointer');
    s.setProperty('flex-shrink', '0');
    s.setProperty('margin', '0');
    s.setProperty('background-position', 'center');
    s.setProperty('background-repeat', 'no-repeat');
    s.setProperty('background-size', '14px 14px');

    if (state === 'unchecked') {
      s.setProperty('background-color', '#ffffff');
      s.setProperty('border', '1px solid #e5e7eb');
      s.setProperty('background-image', 'none');
    } else if (state === 'checked') {
      s.setProperty('background-color', '#FE6E12');
      s.setProperty('border', '1px solid #FE6E12');
      s.setProperty('background-image', CHECK_ICON);
    } else {
      s.setProperty('background-color', '#FE6E12');
      s.setProperty('border', '1px solid #FE6E12');
      s.setProperty('background-image', DASH_ICON);
    }
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'checked'}
      onChange={(): void => undefined}
      onClick={(e: JSX.TargetedMouseEvent<HTMLInputElement>): void => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e: KeyboardEvent): void => {
        if (e.key === ' ' || e.key === 'Enter') e.stopPropagation();
      }}
      aria-label={ariaLabel}
      title={title}
    />
  );
}

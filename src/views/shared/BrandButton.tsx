/** @jsx h */
import { h, JSX, ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { Button } from '@create-figma-plugin/ui';

const STYLE_ID = 'brand-button-orange-style';
const CSS = `
.brand-button button {
  background-color: #FE6E12 !important;
  color: #ffffff !important;
  border-color: #FE6E12 !important;
  transition: filter 0.15s ease;
}
.brand-button button:hover:not(:disabled) {
  filter: brightness(0.9);
}
.brand-button.disabled button,
.brand-button button:disabled {
  background-color: #FE6E12 !important;
  border-color: #FE6E12 !important;
}
`;

function ensureStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID) !== null) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

interface Props {
  onClick: () => void;
  disabled?: boolean;
  children: ComponentChildren;
}

export function BrandButton({ onClick, disabled, children }: Props): JSX.Element {
  useEffect(() => {
    ensureStyle();
  }, []);
  return (
    <div class="brand-button">
      <Button onClick={onClick} disabled={disabled}>
        {children}
      </Button>
    </div>
  );
}

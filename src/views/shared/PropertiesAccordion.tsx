/** @jsx h */
import { h, JSX } from 'preact';
import { useState } from 'preact/hooks';

import { EventProperty } from 'src/types/event';

interface Props {
  properties: EventProperty[];
}

// Shared "PROPERTIES (N)" accordion. Renders nothing when empty so callers
// can drop it in unconditionally. Used by both AllEvents and ImportEvents to
// keep the property list visually identical across surfaces.
export function PropertiesAccordion({ properties }: Props): JSX.Element | null {
  const [open, setOpen] = useState(false);
  if (properties.length === 0) return null;

  return (
    <div style={{ marginTop: '6px', minWidth: 0 }}>
      <button
        type="button"
        onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '4px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#6b7280',
          textAlign: 'left',
        }}
      >
        <span style={{ width: '10px', display: 'inline-block' }}>{open ? '▼' : '▶'}</span>
        <span>Properties</span>
        <span style={{ fontWeight: 500, color: '#9ca3af' }}>({properties.length})</span>
      </button>
      {open && (
        <div
          style={{
            paddingLeft: '16px',
            paddingTop: '4px',
            paddingBottom: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {properties.map((prop, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'baseline',
                minWidth: 0,
                fontSize: '12px',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  color: '#1a1a1a',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
                title={prop.name}
              >
                {prop.name}
              </span>
              {prop.valueType !== '' && (
                <span style={{ color: '#6b7280', flexShrink: 0 }}>
                  {prop.valueType}
                </span>
              )}
              {prop.required && (
                <span
                  style={{
                    color: 'rgb(217, 80, 80)',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  required
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

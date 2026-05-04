/** @jsx h */
import { Button, Container, Divider, VerticalSpace, Text } from '@create-figma-plugin/ui';
import { ComponentChildren, Fragment, h, JSX } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import amplitude from 'amplitude-js';

import { EventMapping, EventMetadata } from 'src/types/event';
import { exportToCsv } from 'src/services/csv';
import { PropertiesAccordion } from 'src/views/shared/PropertiesAccordion';
import { Checkbox, CheckboxState } from 'src/views/shared/Checkbox';
import { BrandButton } from 'src/views/shared/BrandButton';

export interface Props {
  events: EventMetadata[];
  mappings?: Record<string, EventMapping[]>;
  onMapEvent?: (event: EventMetadata) => void;
  onUnmapEvent?: (eventName: string, nodeId: string) => void;
  onDeleteEvent?: (eventName: string) => void;
  labelsVisible?: boolean;
  onToggleLabelsVisible?: () => void;
  namesVisible?: boolean;
  onToggleNames?: () => void;
  onFocusNode?: (nodeId: string) => void;
  onClearAllMappings?: () => void;
  // Per-event canvas expansion state. ui.tsx owns the map and forwards a
  // toggle callback that fans out TOGGLE_CARD messages to every nodeId
  // mapped for the event.
  expansion?: Record<string, boolean>;
  onToggleExpansion?: (eventName: string) => void;
  // Set by ui.tsx whenever a canvas selection lands on a mapped event. When
  // set, the list types that name into the search box (filtering down to
  // that single row) and auto-expands it, then calls onClearPendingFocus so
  // re-selecting the same canvas card re-fires the effect.
  pendingFocusEvent?: string | null;
  onClearPendingFocus?: () => void;
}

type FilterMode = 'all' | 'mapped' | 'unmapped';

function hasValue(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasItems<T>(arr: T[] | null | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

function matchesSearch(event: EventMetadata, mappings: EventMapping[], search: string): boolean {
  if (search.length === 0) return true;
  const q = search.toLowerCase();
  if (event.name.toLowerCase().includes(q)) return true;
  if (hasValue(event.description) && event.description.toLowerCase().includes(q)) return true;
  if (hasValue(event.category) && event.category.toLowerCase().includes(q)) return true;
  for (const m of mappings) {
    if (m.nodeName.toLowerCase().includes(q)) return true;
    if (m.screenName.toLowerCase().includes(q)) return true;
  }
  return false;
}

function MappedBadge({ mappings }: { mappings: EventMapping[] }): JSX.Element {
  const names = mappings.map((m) => m.nodeName);
  const display = names.length === 1
    ? names[0]
    : `${names[0]} +${names.length - 1}`;
  return (
    <span
      title={names.join(', ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        borderRadius: '3px',
        background: 'rgba(24, 160, 88, 0.12)',
        border: '1px solid rgba(24, 160, 88, 0.35)',
        color: 'rgb(24, 160, 88)',
        fontSize: '10px',
        fontWeight: 600,
        lineHeight: '1.2',
        flexShrink: 0,
        maxWidth: '60%',
        overflow: 'hidden',
      }}
    >
      <span aria-hidden="true">●</span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {display}
      </span>
    </span>
  );
}

function Badge({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span
      title={`${label}: ${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        background: 'var(--figma-color-bg-secondary, #f5f5f5)',
        border: '1px solid var(--figma-color-border, #e5e5e5)',
        fontSize: '11px',
        lineHeight: '1.4',
        color: 'var(--figma-color-text, #333)',
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--figma-color-text-secondary, #666)' }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

const FIELD_ROW_STYLE = {
  display: 'flex',
  flexDirection: 'row' as const,
  gap: '8px',
  marginBottom: '4px',
  alignItems: 'baseline' as const,
  minWidth: 0,
};

const FIELD_LABEL_STYLE = {
  flexShrink: 0,
  width: '76px',
  fontSize: '11px',
  fontWeight: 500 as const,
  color: 'var(--figma-color-text-secondary, #666)',
};

const FIELD_VALUE_STYLE = {
  flex: '1 1 auto',
  minWidth: 0,
  fontSize: '12px',
  lineHeight: '1.5',
  wordBreak: 'break-word' as const,
};

function FieldLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={FIELD_ROW_STYLE}>
      <div style={FIELD_LABEL_STYLE}>{label}</div>
      <div style={FIELD_VALUE_STYLE}>{value}</div>
    </div>
  );
}

function Accordion({ label, count, children }: { label: string; count?: number; children: ComponentChildren }): JSX.Element {
  const [open, setOpen] = useState(false);
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
          color: 'var(--figma-color-text-secondary, #666)',
          textAlign: 'left',
        }}
      >
        <span style={{ width: '10px', display: 'inline-block' }}>{open ? '▼' : '▶'}</span>
        <span>{label}</span>
        {count !== undefined && (
          <span style={{ fontWeight: 500, color: 'var(--figma-color-text-tertiary, #999)' }}>
            ({count})
          </span>
        )}
      </button>
      {open && (
        <div style={{ paddingLeft: '16px', paddingTop: '4px', paddingBottom: '6px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ChipList({ items }: { items: string[] }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {items.map((item, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            borderRadius: '3px',
            background: 'var(--figma-color-bg-secondary, #f5f5f5)',
            border: '1px solid var(--figma-color-border, #e5e5e5)',
            fontSize: '11px',
            lineHeight: '1.4',
          }}
          title={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}


function MappedNodeRow({
  mapping,
  onFocusNode,
  onUnmap,
}: {
  mapping: EventMapping;
  onFocusNode?: (nodeId: string) => void;
  onUnmap?: (nodeId: string) => void;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', minWidth: 0 }}>
      <button
        type="button"
        onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
          e.stopPropagation();
          onFocusNode?.(mapping.nodeId);
        }}
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '12px',
          fontWeight: 600,
          color: 'rgb(24, 160, 88)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={mapping.breadcrumb}
      >
        ✓ {mapping.nodeName}
      </button>
      {onUnmap !== undefined && (
        <button
          type="button"
          aria-label={`Unmap ${mapping.nodeName}`}
          title={`Unmap ${mapping.nodeName}`}
          onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
            e.stopPropagation();
            onUnmap(mapping.nodeId);
          }}
          style={{
            flexShrink: 0,
            padding: '3px 8px',
            background: 'transparent',
            border: '1px solid rgba(217, 80, 80, 0.45)',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '11px',
            lineHeight: 1,
            color: 'rgb(217, 80, 80)',
          }}
        >
          Unmap
        </button>
      )}
    </div>
  );
}

interface EventDetailsProps {
  event: EventMetadata;
  mappedNodes: EventMapping[];
  onMap?: () => void;
  onUnmap?: (nodeId: string) => void;
  onDelete?: () => void;
  onFocusNode?: (nodeId: string) => void;
  canvasExpanded?: boolean;
  onToggleCanvasExpansion?: () => void;
}

function EventDetails({
  event,
  mappedNodes,
  onMap,
  onUnmap,
  onDelete,
  onFocusNode,
  canvasExpanded = false,
  onToggleCanvasExpansion,
}: EventDetailsProps): JSX.Element {
  const isMapped = mappedNodes.length > 0;
  const tags = event.tags ?? [];
  const sources = event.sources ?? [];
  const properties = event.properties ?? [];
  const triggerValue = event.trigger as string | undefined;

  return (
    <div style={{ padding: '4px 8px 12px 24px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {hasValue(event.description) && <FieldLine label="Description" value={event.description} />}
      {hasValue(triggerValue) && <FieldLine label="Trigger" value={triggerValue} />}

      {(hasValue(event.activity) || hasValue(event.category)) && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', marginBottom: '4px' }}>
          {hasValue(event.activity) && <Badge label="Activity" value={event.activity} />}
          {hasValue(event.category) && <Badge label="Category" value={event.category} />}
        </div>
      )}

      {hasItems(tags) && (
        <Accordion label="Tags" count={tags.length}>
          <ChipList items={tags} />
        </Accordion>
      )}
      {hasItems(sources) && (
        <Accordion label="Sources" count={sources.length}>
          <ChipList items={sources} />
        </Accordion>
      )}
      <PropertiesAccordion properties={properties} />

      {isMapped && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--figma-color-text-secondary, #666)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Mapped to
          </div>
          {mappedNodes.map((m) => (
            <MappedNodeRow
              key={m.nodeId}
              mapping={m}
              onFocusNode={onFocusNode}
              onUnmap={onUnmap}
            />
          ))}
          {onToggleCanvasExpansion !== undefined && (
            <button
              type="button"
              onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                e.stopPropagation();
                onToggleCanvasExpansion();
              }}
              style={{
                alignSelf: 'flex-start',
                marginTop: '4px',
                padding: '4px 8px',
                background: 'transparent',
                border: '1px solid #FE6E12',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                color: '#FE6E12',
              }}
            >
              {canvasExpanded ? '▲ Collapse on canvas' : '▼ Expand on canvas'}
            </button>
          )}
        </div>
      )}

      {!isMapped && (onMap !== undefined || onDelete !== undefined) && (
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {onMap !== undefined && (
            <Button
              onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                e.stopPropagation();
                onMap();
              }}
              secondary
            >
              Map to selection
            </Button>
          )}
          {onDelete !== undefined && (
            <button
              type="button"
              onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid rgba(217, 80, 80, 0.45)',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                color: 'rgb(217, 80, 80)',
                lineHeight: 1.2,
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  event: EventMetadata;
  mappedNodes: EventMapping[];
  onMap?: () => void;
  onUnmap?: (nodeId: string) => void;
  onDelete?: () => void;
  onFocusNode?: (nodeId: string) => void;
  canvasExpanded?: boolean;
  onToggleCanvasExpansion?: () => void;
  open: boolean;
  onToggleOpen: () => void;
  highlighted?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
}

function CollapsibleRow({
  event,
  mappedNodes,
  onMap,
  onUnmap,
  onDelete,
  onFocusNode,
  canvasExpanded,
  onToggleCanvasExpansion,
  open,
  onToggleOpen,
  highlighted = false,
  selectMode = false,
  selected = false,
  onToggleSelected,
}: RowProps): JSX.Element {
  const isMapped = mappedNodes.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: highlighted ? '#FFF3E8' : 'transparent',
        transition: 'background-color 0.6s ease',
        borderRadius: 3,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleOpen}
        onKeyDown={(e: KeyboardEvent): void => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleOpen();
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 4px',
          minWidth: 0,
          cursor: 'pointer',
          borderRadius: '3px',
        }}
      >
        {selectMode && onToggleSelected !== undefined && (
          <Checkbox
            state={selected ? 'checked' : 'unchecked'}
            onToggle={onToggleSelected}
            ariaLabel={`Select ${event.name}`}
          />
        )}
        <span
          aria-hidden="true"
          style={{
            width: '12px',
            flexShrink: 0,
            color: 'var(--figma-color-text-secondary, #666)',
            fontSize: '10px',
          }}
        >
          {open ? '▼' : '▶'}
        </span>
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '13px',
            fontWeight: 600,
          }}
          title={event.name}
        >
          {event.name}
        </span>
        {isMapped && <MappedBadge mappings={mappedNodes} />}
      </div>

      {open && (
        <EventDetails
          event={event}
          mappedNodes={mappedNodes}
          onMap={onMap}
          onUnmap={onUnmap}
          onDelete={onDelete}
          onFocusNode={onFocusNode}
          canvasExpanded={canvasExpanded}
          onToggleCanvasExpansion={onToggleCanvasExpansion}
        />
      )}
      <Divider />
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div style={{ padding: '8px 4px 4px 4px', minWidth: 0 }}>
      <input
        type="text"
        value={value}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>): void => onChange(e.currentTarget.value)}
        onFocus={(e: JSX.TargetedFocusEvent<HTMLInputElement>): void => {
          e.currentTarget.style.borderColor = '#FE6E12';
        }}
        onBlur={(e: JSX.TargetedFocusEvent<HTMLInputElement>): void => {
          e.currentTarget.style.borderColor = '#e5e7eb';
        }}
        placeholder="Search events, nodes…"
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: '13px',
          border: '1px solid #e5e7eb',
          borderRadius: '3px',
          outline: 'none',
          background: '#ffffff',
          color: '#1a1a1a',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function FilterChips({
  mode,
  onChange,
  counts,
}: {
  mode: FilterMode;
  onChange: (m: FilterMode) => void;
  counts: { all: number; mapped: number; unmapped: number };
}): JSX.Element {
  const chip = (label: string, value: FilterMode, count: number): JSX.Element => {
    const selected = mode === value;
    return (
      <button
        type="button"
        onClick={(): void => onChange(value)}
        style={{
          padding: '4px 12px',
          fontSize: '11px',
          fontWeight: selected ? 600 : 500,
          lineHeight: 1.4,
          border: '1px solid',
          borderColor: selected ? '#FE6E12' : '#e5e7eb',
          borderRadius: '16px',
          background: selected ? '#FE6E12' : '#ffffff',
          color: selected ? '#ffffff' : '#6b7280',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {label} ({count})
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '6px', padding: '4px 4px 8px 4px', minWidth: 0, flexWrap: 'wrap' }}>
      {chip('All', 'all', counts.all)}
      {chip('Mapped', 'mapped', counts.mapped)}
      {chip('Unmapped', 'unmapped', counts.unmapped)}
    </div>
  );
}

interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  labelsVisible: boolean;
  onToggleLabelsVisible?: () => void;
  namesVisible: boolean;
  onToggleNames?: () => void;
  onClearAllMappings?: () => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
}

function SettingsMenu({
  open,
  onClose,
  labelsVisible,
  onToggleLabelsVisible,
  namesVisible,
  onToggleNames,
  onClearAllMappings,
  selectMode,
  onToggleSelectMode,
}: SettingsMenuProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent): void => {
      if (ref.current !== null && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer attachment to the next tick so the click that opened the menu
    // doesn't immediately close it.
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const itemBase = {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: '12px',
    textAlign: 'left' as const,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#1a1a1a',
    lineHeight: 1.4,
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: '48px',
        left: 0,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        minWidth: '200px',
        padding: '4px 0',
        zIndex: 20,
      }}
    >
      <button
        type="button"
        onClick={(): void => {
          onToggleSelectMode();
          onClose();
        }}
        onMouseEnter={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
          e.currentTarget.style.background = '#f9fafb';
        }}
        onMouseLeave={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
          e.currentTarget.style.background = 'transparent';
        }}
        style={itemBase}
      >
        {selectMode ? 'Exit Selection Mode' : 'Select to Export'}
      </button>
      {(onToggleLabelsVisible !== undefined || onToggleNames !== undefined) && (
        <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />
      )}
      {onToggleLabelsVisible !== undefined && (
        <button
          type="button"
          onClick={(): void => {
            onToggleLabelsVisible();
            onClose();
          }}
          onMouseEnter={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
            e.currentTarget.style.background = '#f9fafb';
          }}
          onMouseLeave={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
            e.currentTarget.style.background = 'transparent';
          }}
          style={itemBase}
        >
          {labelsVisible ? 'Hide All Labels' : 'Show All Labels'}
        </button>
      )}
      {onToggleNames !== undefined && (
        <button
          type="button"
          onClick={(): void => {
            onToggleNames();
            onClose();
          }}
          onMouseEnter={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
            e.currentTarget.style.background = '#f9fafb';
          }}
          onMouseLeave={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
            e.currentTarget.style.background = 'transparent';
          }}
          style={itemBase}
        >
          {namesVisible ? 'Hide Names' : 'Show Names'}
        </button>
      )}
      {onClearAllMappings !== undefined && (
        <Fragment>
          <div style={{ height: '1px', background: '#e5e7eb', margin: '4px 0' }} />
          <button
            type="button"
            onClick={(): void => {
              onClearAllMappings();
              onClose();
            }}
            onMouseEnter={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
              e.currentTarget.style.background = 'rgba(217, 80, 80, 0.08)';
            }}
            onMouseLeave={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
              e.currentTarget.style.background = 'transparent';
            }}
            style={{ ...itemBase, color: '#d95050' }}
          >
            Clear All Mappings
          </button>
        </Fragment>
      )}
    </div>
  );
}

function ConfirmDialog({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e: JSX.TargetedMouseEvent<HTMLDivElement>): void => e.stopPropagation()}
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          padding: '16px',
          minWidth: '280px',
          maxWidth: '360px',
        }}
      >
        <div style={{ fontSize: '13px', color: '#1a1a1a', lineHeight: 1.5, marginBottom: '12px' }}>
          {message}
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: '#ffffff',
              color: '#1a1a1a',
              border: '1px solid #e5e7eb',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              background: '#d95050',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AllEvents({
  events,
  mappings = {},
  onMapEvent,
  onUnmapEvent,
  onDeleteEvent,
  labelsVisible = true,
  onToggleLabelsVisible,
  namesVisible = true,
  onToggleNames,
  onFocusNode,
  onClearAllMappings,
  expansion = {},
  onToggleExpansion,
  pendingFocusEvent = null,
  onClearPendingFocus,
}: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  // Lifted out of CollapsibleRow so we can programmatically expand the row
  // that matches the current canvas selection.
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const [highlightedName, setHighlightedName] = useState<string | null>(null);

  useEffect(() => {
    amplitude.getInstance().logEvent('Tab Visited: All Events');
  });

  const toggleRow = useCallback((name: string): void => {
    setOpenRows((prev) => ({ ...prev, [name]: !(prev[name] ?? false) }));
  }, []);

  // Reacts to ui.tsx's pendingFocusEvent: type the event name into the
  // search input (which filters the list down to that one row) and
  // auto-expand the matching row. Filter chip is reset to 'all' so the
  // event is guaranteed to be visible regardless of mapped state.
  useEffect(() => {
    if (pendingFocusEvent === null) return;
    const name = pendingFocusEvent;
    setSearch(name);
    setFilterMode('all');
    setOpenRows((prev) => ({ ...prev, [name]: true }));
    setHighlightedName(name);
    onClearPendingFocus?.();
  }, [pendingFocusEvent]);

  // Decay the row-highlight after ~1.5s. The CollapsibleRow background
  // transition softens the revert to transparent.
  useEffect(() => {
    if (highlightedName === null) return;
    const id = window.setTimeout(() => setHighlightedName(null), 1500);
    return () => window.clearTimeout(id);
  }, [highlightedName]);

  const counts = useMemo(() => {
    let mapped = 0;
    for (const e of events) {
      if ((mappings[e.name] ?? []).length > 0) mapped++;
    }
    return { all: events.length, mapped, unmapped: events.length - mapped };
  }, [events, mappings]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const m = mappings[e.name] ?? [];
      const isMapped = m.length > 0;
      if (filterMode === 'mapped' && !isMapped) return false;
      if (filterMode === 'unmapped' && isMapped) return false;
      return matchesSearch(e, m, search);
    });
  }, [events, mappings, search, filterMode]);

  // Drop selections that no longer correspond to a known event (e.g. after
  // a Delete) so the export count and Select All toggle stay accurate.
  useEffect(() => {
    setSelectedNames((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(events.map((e) => e.name));
      let changed = false;
      const next = new Set<string>();
      for (const n of prev) {
        if (valid.has(n)) next.add(n);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [events]);

  const onToggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      const next = !prev;
      // Exiting selection mode clears the selection so the hidden state can't
      // silently affect the next export.
      if (!next) setSelectedNames(new Set());
      return next;
    });
  }, []);

  const onToggleSelectName = useCallback((name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const onSelectAllVisible = useCallback(() => {
    setSelectedNames(new Set(filteredEvents.map((e) => e.name)));
  }, [filteredEvents]);

  const onDeselectAll = useCallback(() => {
    setSelectedNames(new Set());
  }, []);

  const selectedExportableEvents = events.filter((e) => selectedNames.has(e.name));
  const selectionExportLabel = `Export (${selectedNames.size})`;

  // Tri-state for the bulk-select checkbox in the Select-mode bottom bar.
  // Computed against the visible (filtered) list so toggling never touches
  // events the user has filtered out.
  let selectAllState: CheckboxState = 'unchecked';
  if (selectedNames.size > 0) {
    selectAllState = filteredEvents.length > 0 && filteredEvents.every((e) => selectedNames.has(e.name))
      ? 'checked'
      : 'indeterminate';
  }
  const onToggleSelectAll = (): void => {
    if (selectAllState === 'checked') onDeselectAll();
    else onSelectAllVisible();
  };

  // Sole export path. Select-mode "Export (N)" → Amplitude Taxonomy CSV
  // (the same 29-column format produced by services/csv.ts → exportToCsv,
  // which the parser can round-trip).
  const onExportSelected = (): void => {
    if (selectedExportableEvents.length === 0) return;
    amplitude.logEvent('Export to CSV clicked', {
      mode: 'selection',
      count: selectedExportableEvents.length,
    });
    exportToCsv('amplitude-taxonomy.csv', selectedExportableEvents);
    // Auto-exit selection mode after export so the next session starts fresh;
    // onToggleSelectMode also clears selectedNames.
    onToggleSelectMode();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '89%', minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        <SearchInput value={search} onChange={setSearch} />
        <FilterChips mode={filterMode} onChange={setFilterMode} counts={counts} />
      </div>
      <Container
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
          padding: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: '4px 4px 16px 4px' }}>
          {events.length === 0 && (
            <div style={{ padding: '16px 4px' }}>
              <Text muted>No events yet. Add or import events to get started.</Text>
            </div>
          )}
          {events.length > 0 && filteredEvents.length === 0 && (
            <div style={{ padding: '16px 4px' }}>
              <Text muted>No events match your filters.</Text>
            </div>
          )}
          {filteredEvents.map((event, i) => (
            <CollapsibleRow
              key={`${event.name}-${i}`}
              event={event}
              mappedNodes={mappings[event.name] ?? []}
              onMap={onMapEvent !== undefined ? (): void => onMapEvent(event) : undefined}
              onUnmap={onUnmapEvent !== undefined ? (nodeId: string): void => onUnmapEvent(event.name, nodeId) : undefined}
              onDelete={onDeleteEvent !== undefined ? (): void => onDeleteEvent(event.name) : undefined}
              onFocusNode={onFocusNode}
              canvasExpanded={expansion[event.name] ?? false}
              onToggleCanvasExpansion={onToggleExpansion !== undefined ? (): void => onToggleExpansion(event.name) : undefined}
              open={openRows[event.name] ?? false}
              onToggleOpen={(): void => toggleRow(event.name)}
              highlighted={highlightedName === event.name}
              selectMode={selectMode}
              selected={selectedNames.has(event.name)}
              onToggleSelected={(): void => onToggleSelectName(event.name)}
            />
          ))}
        </div>
      </Container>

      <Divider />
      <VerticalSpace />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          gap: '8px',
        }}
      >
        {selectMode ? (
          <Fragment>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Checkbox
                state={selectAllState}
                onToggle={onToggleSelectAll}
                ariaLabel={selectAllState === 'checked' ? 'Deselect all' : 'Select all'}
              />
              <span style={{ color: '#6b7280', fontSize: '12px' }}>{selectedNames.size} selected</span>
            </div>
            <BrandButton onClick={onExportSelected} disabled={selectedNames.size === 0}>
              {selectionExportLabel}
            </BrandButton>
          </Fragment>
        ) : (
          <Fragment>
            <button
              type="button"
              aria-label="Settings"
              title="Settings"
              onClick={(): void => setSettingsOpen((v) => !v)}
              style={{
                padding: '6px 10px',
                background: '#ffffff',
                color: '#1a1a1a',
                border: '1px solid #e5e7eb',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
              }}
            >
              ⚙️
            </button>
            <SettingsMenu
              open={settingsOpen}
              onClose={(): void => setSettingsOpen(false)}
              labelsVisible={labelsVisible}
              onToggleLabelsVisible={onToggleLabelsVisible}
              namesVisible={namesVisible}
              onToggleNames={onToggleNames}
              onClearAllMappings={onClearAllMappings !== undefined ? (): void => setConfirmClear(true) : undefined}
              selectMode={selectMode}
              onToggleSelectMode={onToggleSelectMode}
            />
          </Fragment>
        )}
      </div>
      <VerticalSpace space="small" />

      {confirmClear && (
        <ConfirmDialog
          message="Are you sure? This will remove all mappings."
          confirmLabel="Clear All"
          onCancel={(): void => setConfirmClear(false)}
          onConfirm={(): void => {
            setConfirmClear(false);
            onClearAllMappings?.();
          }}
        />
      )}
    </div>
  );
}

export default AllEvents;

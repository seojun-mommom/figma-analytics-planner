/** @jsx h */
import { Button, Container, Divider, VerticalSpace, Text } from '@create-figma-plugin/ui';
import { ComponentChildren, h, JSX } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import amplitude from 'amplitude-js';

import { EventMapping, EventMetadata } from 'src/types/event';
import { exportToCsv } from 'src/services/csv';
import { PropertiesAccordion } from 'src/views/shared/PropertiesAccordion';

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
  onNavigateToFrame?: (frameId: string) => void;
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

type ViewMode = 'list' | 'screen';

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

interface ScreenGroup {
  screenName: string;
  // First non-empty frameId seen for this screen. Older mappings (pre-frameId)
  // may have an empty string — those rows still group correctly by name, but
  // the frame header navigation falls back to no-op until a frameId surfaces.
  frameId: string;
  rows: { event: EventMetadata; mapping: EventMapping }[];
}

function groupByScreen(events: EventMetadata[], mappings: Record<string, EventMapping[]>): ScreenGroup[] {
  const order: string[] = [];
  const lookup = new Map<string, ScreenGroup>();
  for (const event of events) {
    const eventMappings = mappings[event.name] ?? [];
    for (const mapping of eventMappings) {
      let group = lookup.get(mapping.screenName);
      if (group === undefined) {
        group = { screenName: mapping.screenName, frameId: mapping.frameId ?? '', rows: [] };
        lookup.set(mapping.screenName, group);
        order.push(mapping.screenName);
      } else if (group.frameId.length === 0 && (mapping.frameId ?? '').length > 0) {
        group.frameId = mapping.frameId;
      }
      group.rows.push({ event, mapping });
    }
  }
  return order.map((name) => lookup.get(name) as ScreenGroup);
}

interface ScreenRowProps {
  event: EventMetadata;
  rowMapping: EventMapping;
  allMappedNodes: EventMapping[];
  onMap?: () => void;
  onUnmap?: (nodeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
  canvasExpanded?: boolean;
  onToggleCanvasExpansion?: () => void;
}

function ScreenRow({
  event,
  rowMapping,
  allMappedNodes,
  onMap,
  onUnmap,
  onFocusNode,
  canvasExpanded,
  onToggleCanvasExpansion,
}: ScreenRowProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={(): void => setOpen((v) => !v)}
        onKeyDown={(e: KeyboardEvent): void => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '6px 4px 6px 18px',
          minWidth: 0,
          cursor: 'pointer',
          borderBottom: '1px solid var(--figma-color-border, #f0f0f0)',
          transition: 'background-color 0.12s ease',
        }}
        onMouseEnter={(e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
          e.currentTarget.style.background = 'var(--figma-color-bg-hover, rgba(0,0,0,0.04))';
        }}
        onMouseLeave={(e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '10px',
            flexShrink: 0,
            color: 'var(--figma-color-text-secondary, #666)',
            fontSize: '10px',
          }}
        >
          {open ? '▼' : '▶'}
        </span>
        <span style={{ color: 'var(--figma-color-text-secondary, #999)', flexShrink: 0 }}>└──</span>
        <span
          style={{
            fontWeight: 500,
            fontSize: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flexShrink: 0,
            maxWidth: '60%',
          }}
          title={event.name}
        >
          {event.name}
        </span>
        <span style={{ color: 'var(--figma-color-text-secondary, #999)', flexShrink: 0 }}>•</span>
        <span
          style={{
            color: 'var(--figma-color-text-secondary, #666)',
            fontSize: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: '1 1 auto',
          }}
          title={rowMapping.breadcrumb}
        >
          {rowMapping.nodeName}
        </span>
      </div>

      {open && (
        <EventDetails
          event={event}
          mappedNodes={allMappedNodes}
          onMap={onMap}
          onUnmap={onUnmap}
          onFocusNode={onFocusNode}
          canvasExpanded={canvasExpanded}
          onToggleCanvasExpansion={onToggleCanvasExpansion}
        />
      )}
    </div>
  );
}

function rowMatchesSearch(event: EventMetadata, mapping: EventMapping, search: string): boolean {
  if (search.length === 0) return true;
  const q = search.toLowerCase();
  if (event.name.toLowerCase().includes(q)) return true;
  if (hasValue(event.description) && event.description.toLowerCase().includes(q)) return true;
  if (hasValue(event.category) && event.category.toLowerCase().includes(q)) return true;
  if (mapping.nodeName.toLowerCase().includes(q)) return true;
  if (mapping.screenName.toLowerCase().includes(q)) return true;
  return false;
}

interface ScreenViewProps {
  events: EventMetadata[];
  mappings: Record<string, EventMapping[]>;
  search: string;
  onMapEvent?: (event: EventMetadata) => void;
  onUnmapEvent?: (eventName: string, nodeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
  onNavigateToFrame?: (frameId: string) => void;
  expansion: Record<string, boolean>;
  onToggleExpansion?: (eventName: string) => void;
}

function ScreenView({
  events,
  mappings,
  search,
  onMapEvent,
  onUnmapEvent,
  onFocusNode,
  onNavigateToFrame,
  expansion,
  onToggleExpansion,
}: ScreenViewProps): JSX.Element {
  const allGroups = useMemo(() => groupByScreen(events, mappings), [events, mappings]);
  const groups = useMemo(() => {
    if (search.length === 0) return allGroups;
    return allGroups
      .map((g) => ({
        screenName: g.screenName,
        frameId: g.frameId,
        rows: g.rows.filter((r) => rowMatchesSearch(r.event, r.mapping, search)),
      }))
      .filter((g) => g.rows.length > 0);
  }, [allGroups, search]);

  if (allGroups.length === 0) {
    return (
      <div style={{ padding: '16px 4px' }}>
        <Text muted>No mapped events yet. Map events to Figma elements from the List View.</Text>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: '16px 4px' }}>
        <Text muted>No mapped events match your search.</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: '8px 4px 16px 4px' }}>
      {groups.map((group) => {
        const navigate: (() => void) | undefined =
          onNavigateToFrame !== undefined && group.frameId.length > 0
            ? (): void => onNavigateToFrame(group.frameId)
            : undefined;
        const navigable = navigate !== undefined;
        return (
        <div key={group.screenName} style={{ marginBottom: '12px', minWidth: 0 }}>
          <div
            role={navigable ? 'button' : undefined}
            tabIndex={navigable ? 0 : undefined}
            onClick={navigate}
            onKeyDown={navigate !== undefined
              ? (e: KeyboardEvent): void => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate();
                  }
                }
              : undefined}
            onMouseEnter={navigable
              ? (e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                  e.currentTarget.style.background = '#FFF3E8';
                }
              : undefined}
            onMouseLeave={navigable
              ? (e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
                  e.currentTarget.style.background = 'transparent';
                }
              : undefined}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              padding: '6px 4px',
              borderBottom: '1px solid var(--figma-color-border, #e5e5e5)',
              minWidth: 0,
              cursor: navigable ? 'pointer' : 'default',
              background: 'transparent',
              transition: 'background-color 0.12s ease',
              borderRadius: 3,
            }}
            title={navigable ? `Go to ${group.screenName}` : group.screenName}
          >
            <span style={{ fontSize: '13px', flexShrink: 0 }}>📱</span>
            <span
              style={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: '1 1 auto',
              }}
            >
              {group.screenName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--figma-color-text-secondary, #666)', flexShrink: 0 }}>
              {group.rows.length}
            </span>
            {navigable && (
              <span
                aria-hidden="true"
                style={{
                  fontSize: '11px',
                  color: '#FE6E12',
                  flexShrink: 0,
                  fontWeight: 600,
                }}
              >
                ↗
              </span>
            )}
          </div>
          {group.rows.map((row, i) => (
            <ScreenRow
              key={`${row.mapping.nodeId}-${i}`}
              event={row.event}
              rowMapping={row.mapping}
              allMappedNodes={mappings[row.event.name] ?? []}
              onMap={onMapEvent !== undefined ? (): void => onMapEvent(row.event) : undefined}
              onUnmap={onUnmapEvent !== undefined ? (nodeId: string): void => onUnmapEvent(row.event.name, nodeId) : undefined}
              onFocusNode={onFocusNode}
              canvasExpanded={expansion[row.event.name] ?? false}
              onToggleCanvasExpansion={onToggleExpansion !== undefined ? (): void => onToggleExpansion(row.event.name) : undefined}
            />
          ))}
        </div>
        );
      })}
    </div>
  );
}

function ViewModeToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }): JSX.Element {
  const baseBtn = {
    flex: '1 1 0%',
    padding: '6px 8px',
    fontSize: '11px',
    fontWeight: 500 as const,
    cursor: 'pointer',
    border: '1px solid #e5e7eb',
    background: '#ffffff',
    color: '#1a1a1a',
  };
  const selected = {
    background: 'rgba(254, 110, 18, 0.08)',
    border: '1px solid #FE6E12',
    color: '#FE6E12',
    fontWeight: 600 as const,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'row', minWidth: 0, padding: '8px 4px 0 4px' }}>
      <button
        type="button"
        onClick={(): void => onChange('list')}
        style={{
          ...baseBtn,
          borderTopLeftRadius: '3px',
          borderBottomLeftRadius: '3px',
          borderRight: 'none',
          ...(mode === 'list' ? selected : {}),
        }}
      >
        List View
      </button>
      <button
        type="button"
        onClick={(): void => onChange('screen')}
        style={{
          ...baseBtn,
          borderTopRightRadius: '3px',
          borderBottomRightRadius: '3px',
          ...(mode === 'screen' ? selected : {}),
        }}
      >
        Screen View
      </button>
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
  onNavigateToFrame,
  expansion = {},
  onToggleExpansion,
  pendingFocusEvent = null,
  onClearPendingFocus,
}: Props): JSX.Element {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
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
  // search input (which filters the list down to that one row), force list
  // view, and auto-expand the matching row. Then notify ui.tsx that we've
  // consumed the focus so a re-selection of the same canvas card re-fires
  // the effect.
  useEffect(() => {
    if (pendingFocusEvent === null) return;
    const name = pendingFocusEvent;
    setSearch(name);
    setViewMode('list');
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

  const filteredEvents = useMemo(
    () => events.filter((e) => matchesSearch(e, mappings[e.name] ?? [], search)),
    [events, mappings, search]
  );

  const onClickCsvExport = (): void => {
    const eventsCsv = events.map((event) => ({
      Event: event.name,
      Trigger: event.trigger,
      'Event Description': event.description,
      'Dev Notes': event.notes,
    }));
    amplitude.logEvent('Export to CSV clicked');
    exportToCsv('taxonomy.csv', [...eventsCsv]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '89%', minHeight: 0 }}>
      <div style={{ flexShrink: 0 }}>
        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        <SearchInput value={search} onChange={setSearch} />
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
        {viewMode === 'list' ? (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, padding: '4px 4px 16px 4px' }}>
            {events.length === 0 && (
              <div style={{ padding: '16px 4px' }}>
                <Text muted>No events yet. Add or import events to get started.</Text>
              </div>
            )}
            {events.length > 0 && filteredEvents.length === 0 && (
              <div style={{ padding: '16px 4px' }}>
                <Text muted>No events match your search.</Text>
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
              />
            ))}
          </div>
        ) : (
          <ScreenView
            events={events}
            mappings={mappings}
            search={search}
            onMapEvent={onMapEvent}
            onUnmapEvent={onUnmapEvent}
            onFocusNode={onFocusNode}
            onNavigateToFrame={onNavigateToFrame}
            expansion={expansion}
            onToggleExpansion={onToggleExpansion}
          />
        )}
      </Container>

      <Divider />
      <VerticalSpace />
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '6px' }}>
          {onToggleLabelsVisible !== undefined && (
            <Button onClick={onToggleLabelsVisible} secondary>
              {labelsVisible ? 'Hide All Labels' : 'Show All Labels'}
            </Button>
          )}
          {onToggleNames !== undefined && (
            <Button onClick={onToggleNames} secondary>
              {namesVisible ? 'Hide Names' : 'Show Names'}
            </Button>
          )}
        </div>
        <Button onClick={onClickCsvExport} disabled={events.length === 0}>
          Export to CSV
        </Button>
      </div>
      <VerticalSpace space="small" />
    </div>
  );
}

export default AllEvents;

/** @jsx h */
import { Button, Container, Text } from '@create-figma-plugin/ui';
import { h, JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import amplitude from 'amplitude-js';

import { EventMapping, EventMetadata } from 'src/types/event';
import { PropertiesAccordion } from 'src/views/shared/PropertiesAccordion';

export interface Props {
  events: EventMetadata[];
  mappings?: Record<string, EventMapping[]>;
  onUnmapEvent?: (eventName: string, nodeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
  onNavigateToFrame?: (frameId: string) => void;
  onGoToAllEvents?: () => void;
}

interface NodeGroup {
  nodeId: string;
  nodeName: string;
  leaves: { event: EventMetadata; mapping: EventMapping }[];
}

interface FrameGroup {
  screenName: string;
  // First non-empty frameId observed for this screen. May be empty for legacy
  // mappings created before frameId was introduced — header navigation is a
  // no-op in that case.
  frameId: string;
  nodes: NodeGroup[];
  totalLeaves: number;
}

function hasValue(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasItems<T>(arr: T[] | null | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

function buildGroups(
  events: EventMetadata[],
  mappings: Record<string, EventMapping[]>
): FrameGroup[] {
  const eventByName = new Map<string, EventMetadata>();
  for (const e of events) eventByName.set(e.name, e);

  const frameOrder: string[] = [];
  const frameLookup = new Map<string, FrameGroup>();

  for (const [eventName, list] of Object.entries(mappings)) {
    const event = eventByName.get(eventName);
    if (event === undefined) continue;
    for (const mapping of list) {
      let frame = frameLookup.get(mapping.screenName);
      if (frame === undefined) {
        frame = {
          screenName: mapping.screenName,
          frameId: mapping.frameId ?? '',
          nodes: [],
          totalLeaves: 0,
        };
        frameLookup.set(mapping.screenName, frame);
        frameOrder.push(mapping.screenName);
      } else if (frame.frameId.length === 0 && (mapping.frameId ?? '').length > 0) {
        frame.frameId = mapping.frameId;
      }

      let node = frame.nodes.find((n) => n.nodeId === mapping.nodeId);
      if (node === undefined) {
        node = { nodeId: mapping.nodeId, nodeName: mapping.nodeName, leaves: [] };
        frame.nodes.push(node);
      }
      node.leaves.push({ event, mapping });
      frame.totalLeaves++;
    }
  }

  return frameOrder.map((name) => frameLookup.get(name) as FrameGroup);
}

function leafMatchesSearch(
  event: EventMetadata,
  mapping: EventMapping,
  search: string
): boolean {
  if (search.length === 0) return true;
  const q = search.toLowerCase();
  if (event.name.toLowerCase().includes(q)) return true;
  if (mapping.nodeName.toLowerCase().includes(q)) return true;
  if (mapping.screenName.toLowerCase().includes(q)) return true;
  return false;
}

function filterGroups(groups: FrameGroup[], search: string): FrameGroup[] {
  if (search.length === 0) return groups;
  const out: FrameGroup[] = [];
  for (const frame of groups) {
    const filteredNodes: NodeGroup[] = [];
    for (const node of frame.nodes) {
      const filteredLeaves = node.leaves.filter((l) => leafMatchesSearch(l.event, l.mapping, search));
      if (filteredLeaves.length > 0) {
        filteredNodes.push({ ...node, leaves: filteredLeaves });
      }
    }
    if (filteredNodes.length > 0) {
      const totalLeaves = filteredNodes.reduce((sum, n) => sum + n.leaves.length, 0);
      out.push({ ...frame, nodes: filteredNodes, totalLeaves });
    }
  }
  return out;
}

function FieldLine({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginBottom: '4px', minWidth: 0 }}>
      <div style={{ flexShrink: 0, width: '76px', color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: '13px', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {value}
      </div>
    </div>
  );
}

function LeafDetails({
  event,
  mapping,
  onUnmap,
}: {
  event: EventMetadata;
  mapping: EventMapping;
  onUnmap?: () => void;
}): JSX.Element {
  const triggerValue = event.trigger as string | undefined;
  const properties = event.properties ?? [];
  return (
    <div style={{ padding: '6px 8px 10px 32px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {hasValue(event.description) && <FieldLine label="Description" value={event.description} />}
      {hasValue(triggerValue) && <FieldLine label="Trigger" value={triggerValue} />}
      {hasValue(event.category) && <FieldLine label="Category" value={event.category} />}
      {hasValue(event.activity) && <FieldLine label="Activity" value={event.activity} />}
      {hasValue(event.notes) && <FieldLine label="Notes" value={event.notes} />}
      {hasItems(event.tags) && <FieldLine label="Tags" value={(event.tags as string[]).join(', ')} />}
      {hasItems(event.sources) && <FieldLine label="Sources" value={(event.sources as string[]).join(', ')} />}
      <PropertiesAccordion properties={properties} />
      {onUnmap !== undefined && (
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
              e.stopPropagation();
              onUnmap();
            }}
            style={{
              padding: '4px 10px',
              background: 'transparent',
              border: '1px solid rgba(217, 80, 80, 0.45)',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              color: '#d95050',
              lineHeight: 1.2,
            }}
            title={`Unmap from ${mapping.nodeName}`}
          >
            Unmap
          </button>
        </div>
      )}
    </div>
  );
}

function FrameHeader({
  name,
  count,
  onClick,
}: {
  name: string;
  count: number;
  onClick?: () => void;
}): JSX.Element {
  const navigable = onClick !== undefined;
  return (
    <div
      role={navigable ? 'button' : undefined}
      tabIndex={navigable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={navigable
        ? (e: KeyboardEvent): void => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.();
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
        alignItems: 'center',
        gap: '6px',
        padding: '8px 6px',
        cursor: navigable ? 'pointer' : 'default',
        background: 'transparent',
        transition: 'background-color 0.12s ease',
        borderRadius: 3,
        minWidth: 0,
      }}
      title={navigable ? `Go to ${name}` : name}
    >
      <span style={{ fontSize: '13px', flexShrink: 0 }}>📱</span>
      <span
        style={{
          fontWeight: 700,
          fontSize: '13px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: '1 1 auto',
        }}
      >
        {name}
      </span>
      <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
        {count} event{count !== 1 ? 's' : ''}
      </span>
      {navigable && (
        <span aria-hidden="true" style={{ fontSize: '11px', color: '#FE6E12', fontWeight: 600, flexShrink: 0 }}>
          ↗
        </span>
      )}
    </div>
  );
}

function NodeHeader({
  name,
  count,
  onClick,
}: {
  name: string;
  count: number;
  onClick?: () => void;
}): JSX.Element {
  const navigable = onClick !== undefined;
  return (
    <div
      role={navigable ? 'button' : undefined}
      tabIndex={navigable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={navigable
        ? (e: KeyboardEvent): void => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.();
            }
          }
        : undefined}
      onMouseEnter={navigable
        ? (e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
            e.currentTarget.style.background = '#f9fafb';
          }
        : undefined}
      onMouseLeave={navigable
        ? (e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
            e.currentTarget.style.background = 'transparent';
          }
        : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 6px 6px 18px',
        cursor: navigable ? 'pointer' : 'default',
        background: 'transparent',
        transition: 'background-color 0.12s ease',
        borderRadius: 3,
        minWidth: 0,
      }}
      title={navigable ? `Go to ${name}` : name}
    >
      <span style={{ fontSize: '12px', flexShrink: 0 }}>📦</span>
      <span
        style={{
          fontWeight: 600,
          fontSize: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: '1 1 auto',
        }}
      >
        {name}
      </span>
      <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
        {count} event{count !== 1 ? 's' : ''}
      </span>
      {navigable && (
        <span aria-hidden="true" style={{ fontSize: '11px', color: '#FE6E12', fontWeight: 600, flexShrink: 0 }}>
          ↗
        </span>
      )}
    </div>
  );
}

function EventLeafRow({
  event,
  mapping,
  open,
  onToggle,
  onUnmap,
}: {
  event: EventMetadata;
  mapping: EventMapping;
  open: boolean;
  onToggle: () => void;
  onUnmap?: () => void;
}): JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e: KeyboardEvent): void => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 6px 5px 32px',
          cursor: 'pointer',
          minWidth: 0,
          fontSize: '12px',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '10px', color: '#6b7280', flexShrink: 0, transition: 'transform 0.12s ease', transform: open ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: '1 1 auto',
          }}
          title={event.name}
        >
          {event.name}
        </span>
      </div>
      {open && <LeafDetails event={event} mapping={mapping} onUnmap={onUnmap} />}
    </div>
  );
}

function leafKey(frameId: string, nodeId: string, eventName: string, index: number): string {
  return `${frameId}::${nodeId}::${eventName}::${index}`;
}

function Overview({
  events,
  mappings = {},
  onUnmapEvent,
  onFocusNode,
  onNavigateToFrame,
  onGoToAllEvents,
}: Props): JSX.Element {
  const [search, setSearch] = useState('');
  const [openLeaves, setOpenLeaves] = useState<Record<string, boolean>>({});

  useEffect(() => {
    amplitude.getInstance().logEvent('Tab Visited: Overview');
  });

  const allGroups = useMemo(() => buildGroups(events, mappings), [events, mappings]);
  const groups = useMemo(() => filterGroups(allGroups, search), [allGroups, search]);

  const totalEvents = useMemo(() => {
    const names = new Set<string>();
    for (const [name, list] of Object.entries(mappings)) {
      if (list.length > 0) names.add(name);
    }
    return names.size;
  }, [mappings]);
  const totalScreens = allGroups.length;

  const isEmpty = allGroups.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '89%', minHeight: 0 }}>
      <div style={{ flexShrink: 0, padding: '8px 4px 4px 4px' }}>
        <input
          type="text"
          value={search}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>): void => setSearch(e.currentTarget.value)}
          onFocus={(e: JSX.TargetedFocusEvent<HTMLInputElement>): void => {
            e.currentTarget.style.borderColor = '#FE6E12';
          }}
          onBlur={(e: JSX.TargetedFocusEvent<HTMLInputElement>): void => {
            e.currentTarget.style.borderColor = '#e5e7eb';
          }}
          placeholder="Search events, nodes, frames…"
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
        {!isEmpty && (
          <div style={{ fontSize: '11px', color: '#1a1a1a', padding: '8px 4px 4px 4px', minWidth: 0 }}>
            🗂 Total mapped: <strong>{totalEvents}</strong> event{totalEvents !== 1 ? 's' : ''}
            {' '}across <strong>{totalScreens}</strong> screen{totalScreens !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <Container
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0,
          padding: '4px 4px 16px 4px',
        }}
      >
        {isEmpty ? (
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <Text muted>
              No mapped events yet.
              <br />
              Go to All Events to start mapping.
            </Text>
            {onGoToAllEvents !== undefined && (
              <Button onClick={onGoToAllEvents} secondary>
                Go to All Events
              </Button>
            )}
          </div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '16px 4px' }}>
            <Text muted>No mapped events match your search.</Text>
          </div>
        ) : (
          groups.map((frame, frameIdx) => (
            <div
              key={`${frame.screenName}-${frameIdx}`}
              style={{
                marginBottom: '8px',
                borderTop: frameIdx === 0 ? 'none' : '1px solid #e5e7eb',
                paddingTop: frameIdx === 0 ? 0 : '4px',
                minWidth: 0,
              }}
            >
              <FrameHeader
                name={frame.screenName}
                count={frame.totalLeaves}
                onClick={onNavigateToFrame !== undefined && frame.frameId.length > 0
                  ? (): void => onNavigateToFrame(frame.frameId)
                  : undefined}
              />
              {frame.nodes.map((node, nodeIdx) => (
                <div
                  key={`${node.nodeId}-${nodeIdx}`}
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    minWidth: 0,
                  }}
                >
                  <NodeHeader
                    name={node.nodeName}
                    count={node.leaves.length}
                    onClick={onFocusNode !== undefined ? (): void => onFocusNode(node.nodeId) : undefined}
                  />
                  {node.leaves.map((leaf, leafIdx) => {
                    const key = leafKey(frame.frameId, node.nodeId, leaf.event.name, leafIdx);
                    return (
                      <EventLeafRow
                        key={key}
                        event={leaf.event}
                        mapping={leaf.mapping}
                        open={openLeaves[key] ?? false}
                        onToggle={(): void =>
                          setOpenLeaves((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }))
                        }
                        onUnmap={onUnmapEvent !== undefined
                          ? (): void => onUnmapEvent(leaf.event.name, leaf.mapping.nodeId)
                          : undefined}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ))
        )}
      </Container>
    </div>
  );
}

export default Overview;

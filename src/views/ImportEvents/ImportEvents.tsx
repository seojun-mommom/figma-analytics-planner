/** @jsx h */
import { Button, Container, Divider, VerticalSpace } from '@create-figma-plugin/ui';
import { h, JSX } from 'preact';
import { useState, useRef } from 'preact/hooks';

import { parseAmplitudeCsv } from 'src/lib/parser';
import { EventMapping, EventMetadata } from 'src/types/event';
import { PropertiesAccordion } from 'src/views/shared/PropertiesAccordion';

export interface Props {
  onImport: (events: EventMetadata[]) => void;
  mappings?: Record<string, EventMapping[]>;
  onMapEvent?: (event: EventMetadata) => void;
  onUnmapEvent?: (eventName: string, nodeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
  expansion?: Record<string, boolean>;
  onToggleExpansion?: (eventName: string) => void;
  minimized?: Record<string, boolean>;
  onToggleMinimized?: (eventName: string) => void;
}

const FONT_SIZE = '13px';
const LINE_HEIGHT = '1.6';

const cardStyle = {
  border: '1px solid var(--figma-color-border, #e5e5e5)',
  borderRadius: '4px',
  padding: '12px',
  marginBottom: '8px',
  background: 'var(--figma-color-bg, #ffffff)',
  minWidth: 0,
  overflow: 'hidden' as const,
};

const fieldRowStyle = {
  display: 'flex',
  flexDirection: 'row' as const,
  gap: '8px',
  marginBottom: '4px',
  minWidth: 0,
  alignItems: 'baseline' as const,
};

const labelStyle = {
  flexShrink: 0,
  width: '76px',
  color: 'var(--figma-color-text-secondary, #666)',
  fontSize: '11px',
  fontWeight: 500 as const,
};

const valueStyle = {
  flex: '1 1 auto',
  minWidth: 0,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
  overflow: 'hidden' as const,
  textOverflow: 'ellipsis' as const,
  whiteSpace: 'nowrap' as const,
};

const valueWrapStyle = {
  flex: '1 1 auto',
  minWidth: 0,
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
  wordBreak: 'break-word' as const,
};

const chipStyle = {
  display: 'inline-block',
  padding: '2px 6px',
  marginRight: '4px',
  marginBottom: '2px',
  borderRadius: '3px',
  background: 'var(--figma-color-bg-secondary, #f5f5f5)',
  border: '1px solid var(--figma-color-border, #e5e5e5)',
  fontSize: '11px',
  lineHeight: '1.4',
};

function hasValue(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasItems<T>(arr: T[] | null | undefined): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

function FieldRow({ label, value, title }: { label: string; value: string; title?: string }): JSX.Element | null {
  if (!hasValue(value)) return null;
  return (
    <div style={fieldRowStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle} title={title ?? value}>{value}</div>
    </div>
  );
}

function ChipsRow({ label, items }: { label: string; items: string[] | null | undefined }): JSX.Element | null {
  if (!hasItems(items)) return null;
  const safeItems = (items as string[]).filter(hasValue);
  if (safeItems.length === 0) return null;
  return (
    <div style={{ ...fieldRowStyle, alignItems: 'flex-start' }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexWrap: 'wrap' }}>
        {safeItems.map((item, i) => (
          <span key={i} style={chipStyle} title={item}>{item}</span>
        ))}
      </div>
    </div>
  );
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
        maxWidth: '100%',
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

interface EventCardProps {
  event: EventMetadata;
  mappedNodes: EventMapping[];
  onClick?: () => void;
  onUnmap?: (nodeId: string) => void;
  onFocusNode?: (nodeId: string) => void;
  expanded: boolean;
  onToggleExpansion?: () => void;
  minimized: boolean;
  onToggleMinimized?: () => void;
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

function IconToggle({ label, glyph, onClick }: { label: string; glyph: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e: JSX.TargetedMouseEvent<HTMLButtonElement>): void => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        background: 'transparent',
        border: '1px solid var(--figma-color-border, #e5e5e5)',
        borderRadius: '3px',
        cursor: 'pointer',
        padding: '2px 6px',
        fontSize: '11px',
        lineHeight: 1,
        color: 'var(--figma-color-text, #333)',
        flexShrink: 0,
      }}
    >
      {glyph}
    </button>
  );
}

function EventCard({ event, mappedNodes, onClick, onUnmap, onFocusNode, expanded, onToggleExpansion, minimized, onToggleMinimized }: EventCardProps): JSX.Element {
  const sources = event.sources ?? [];
  const tags = event.tags ?? [];
  const properties = event.properties ?? [];
  const isMapped = mappedNodes.length > 0;
  const clickable = onClick !== undefined;

  const cardInteractiveStyle = {
    ...cardStyle,
    cursor: clickable ? 'pointer' as const : 'default' as const,
    transition: 'background-color 0.12s ease, border-color 0.12s ease',
  };

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e: KeyboardEvent): void => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      onMouseEnter={(e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
        if (!clickable) return;
        e.currentTarget.style.background = 'var(--figma-color-bg-hover, rgba(0,0,0,0.03))';
      }}
      onMouseLeave={(e: JSX.TargetedMouseEvent<HTMLDivElement>): void => {
        if (!clickable) return;
        e.currentTarget.style.background = 'var(--figma-color-bg, #ffffff)';
      }}
      style={cardInteractiveStyle}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: '1 1 auto',
            minWidth: 0,
          }}
          title={event.name}
        >
          {event.name}
        </div>
        {isMapped && <MappedBadge mappings={mappedNodes} />}
        {onToggleMinimized !== undefined && isMapped && (
          <IconToggle
            label={minimized ? 'Restore card' : 'Minimize card'}
            glyph={minimized ? '□' : '─'}
            onClick={onToggleMinimized}
          />
        )}
        {onToggleExpansion !== undefined && isMapped && (
          <IconToggle
            label={expanded ? 'Collapse card' : 'Expand card'}
            glyph={expanded ? '▲' : '▼'}
            onClick={onToggleExpansion}
          />
        )}
      </div>

      {hasValue(event.description) && (
        <div style={{ ...fieldRowStyle, alignItems: 'flex-start' }}>
          <div style={labelStyle}>Description</div>
          <div style={valueWrapStyle} title={event.description}>{event.description}</div>
        </div>
      )}

      <FieldRow label="Category" value={event.category ?? ''} />
      <FieldRow label="Activity" value={event.activity ?? ''} />
      <FieldRow label="Visibility" value={event.visibility ?? ''} />

      <ChipsRow label="Tags" items={tags} />
      <ChipsRow label="Sources" items={sources} />

      <PropertiesAccordion properties={properties} />

      {isMapped && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--figma-color-border, #e5e5e5)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--figma-color-text-secondary, #666)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '2px',
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
        </div>
      )}
    </div>
  );
}

function ImportEvents({ onImport, mappings = {}, onMapEvent, onUnmapEvent, onFocusNode, expansion = {}, onToggleExpansion, minimized = {}, onToggleMinimized }: Props): JSX.Element {
  const [parsed, setParsed] = useState<EventMetadata[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [imported, setImported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: JSX.TargetedEvent<HTMLInputElement>): void => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImported(false);
    const reader = new FileReader();
    reader.onload = (ev): void => {
      const text = (ev.target?.result ?? '') as string;
      const result = parseAmplitudeCsv(text);
      setParsed(result.events);
      setWarnings(result.warnings);
    };
    reader.readAsText(file, 'utf-8');
  };

  const onClickImport = (): void => {
    onImport(parsed);
    setImported(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, height: '89%', minWidth: 0, minHeight: 0 }}>
      <Container
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          minWidth: 0,
          minHeight: 0,
          padding: '12px',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a1a', minWidth: 0 }}>
          Import from Amplitude Data CSV
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', minWidth: 0 }}>
          Supports Amplitude Data taxonomy export format.
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0,
            marginTop: '12px',
          }}
        >
          <button
            type="button"
            onClick={(): void => fileInputRef.current?.click()}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              background: '#FE6E12',
              color: '#ffffff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Choose CSV file
          </button>
          {fileName !== '' && (
            <div
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '12px',
                color: '#6b7280',
              }}
              title={fileName}
            >
              {fileName}
            </div>
          )}
        </div>

        {warnings.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            {warnings.map((w, i) => (
              <div
                key={i}
                style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}
              >
                {w}
              </div>
            ))}
          </div>
        )}

        {imported && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#1a1a1a' }}>
            {parsed.length} event{parsed.length !== 1 ? 's' : ''} imported. Switch to &quot;All Events&quot; tab to view.
          </div>
        )}

        {parsed.length > 0 && !imported && (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginTop: '12px' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', marginBottom: '8px' }}>
              {parsed.length} event{parsed.length !== 1 ? 's' : ''} found
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {parsed.map((event, i) => (
                <EventCard
                  key={i}
                  event={event}
                  mappedNodes={mappings[event.name] ?? []}
                  onClick={onMapEvent !== undefined ? (): void => onMapEvent(event) : undefined}
                  onUnmap={onUnmapEvent !== undefined ? (nodeId: string): void => onUnmapEvent(event.name, nodeId) : undefined}
                  onFocusNode={onFocusNode}
                  expanded={expansion[event.name] ?? false}
                  onToggleExpansion={onToggleExpansion !== undefined ? (): void => onToggleExpansion(event.name) : undefined}
                  minimized={minimized[event.name] ?? false}
                  onToggleMinimized={onToggleMinimized !== undefined ? (): void => onToggleMinimized(event.name) : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </Container>

      <Divider />
      <VerticalSpace space="extraSmall" />
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', width: '100%', padding: '0 16px' }}>
        <Button onClick={onClickImport} disabled={parsed.length === 0 || imported}>
          {imported ? 'Imported' : `Import${parsed.length > 0 ? ` ${parsed.length} Events` : ''}`}
        </Button>
      </div>
      <VerticalSpace space="small" />
    </div>
  );
}

export default ImportEvents;

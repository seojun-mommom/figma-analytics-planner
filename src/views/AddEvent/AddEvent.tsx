/** @jsx h */
import { Button, Textbox, DropdownMenu } from '@create-figma-plugin/ui';
import { ComponentChildren, h, JSX } from 'preact';
import { StateUpdater, useCallback, useEffect } from 'preact/hooks';
import amplitude from 'amplitude-js';

import { CaretDown } from 'src/assets/CaretDown';
import { Activity, EventMetadata, EventProperty, SourceSdk, Trigger, Visibility } from 'src/types/event';
import { AMPLITUDE_API_KEY } from 'src/constants';

export interface Props {
  event: EventMetadata;
  setEvent: StateUpdater<EventMetadata>;
  onAddEvent: () => void;
  existingEvents?: EventMetadata[];
}

const noop = (..._: any[]): any => { /* noop */ };

const TRIGGER_OPTIONS = [
  { value: Trigger.ON_CLICK },
  { value: Trigger.ON_HOVER },
  { value: Trigger.ON_LOAD },
];

const ACTIVITY_OPTIONS = [
  { value: Activity.ACTIVE },
  { value: Activity.INACTIVE },
];

const VISIBILITY_OPTIONS = [
  { value: Visibility.VISIBLE },
  { value: Visibility.HIDDEN },
];

const EMPTY_PROPERTY: EventProperty = { name: '', source: 'created' };

// ---------------------------------------------------------------------------
// Shared style tokens
// ---------------------------------------------------------------------------

const FONT_SIZE = '13px';
const LINE_HEIGHT = '1.6';
const BRAND = '#FE6E12';

const S = {
  rootColumn: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    flexGrow: 1,
    height: '89%',
    minHeight: 0,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
  scrollArea: {
    display: 'flex' as const,
    flexGrow: 1,
    flexDirection: 'column' as const,
    overflowY: 'auto' as const,
    minHeight: 0,
    padding: '16px',
  },
  field: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    marginBottom: '16px',
  },
  label: {
    fontSize: FONT_SIZE,
    fontWeight: 600,
    marginBottom: '4px',
    color: 'var(--figma-color-text, #333)',
  },
  optionalNote: {
    fontWeight: 400,
    color: 'var(--figma-color-text-secondary, #888)',
    marginLeft: '4px',
  },
  sectionHeader: {
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    color: 'var(--figma-color-text-secondary, #888)',
    paddingTop: '20px',
    marginTop: '8px',
    marginBottom: '12px',
    borderTop: '1px solid var(--figma-color-border, #e5e5e5)',
  },
  twoColumnRow: {
    display: 'flex' as const,
    flexDirection: 'row' as const,
    gap: '16px',
    marginBottom: '16px',
  },
  twoColumnCell: {
    flex: '1 1 50%' as const,
    minWidth: 0,
  },
  dropdownButton: {
    borderRadius: '3px',
    width: '100%',
    minWidth: '120px',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid var(--figma-color-border, #e5e5e5)',
    display: 'flex' as const,
    flexDirection: 'row-reverse' as const,
  },
  checkboxRow: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '6px',
    cursor: 'pointer' as const,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
};

// ---------------------------------------------------------------------------
// Reusable layout primitives
// ---------------------------------------------------------------------------

function Field({
  label,
  optional = false,
  children,
}: { label: string; optional?: boolean; children: ComponentChildren }): JSX.Element {
  return (
    <div style={S.field}>
      <div style={S.label}>
        {label}
        {optional && <span style={S.optionalNote}>(optional)</span>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: ComponentChildren }): JSX.Element {
  return <div style={S.sectionHeader}>{children}</div>;
}

function ToggleChip({
  label,
  checked,
  onClick,
}: { label: string; checked: boolean; onClick: () => void }): JSX.Element {
  const base = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer' as const,
    fontSize: FONT_SIZE,
    fontWeight: 500,
    lineHeight: '1.4',
    userSelect: 'none' as const,
    transition: 'background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  };
  const selected = {
    background: BRAND,
    color: '#ffffff',
    border: `1px solid ${BRAND}`,
  };
  const unselected = {
    background: '#ffffff',
    color: '#1a1a1a',
    border: '1px solid #e5e7eb',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      style={{ ...base, ...(checked ? selected : unselected) }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '14px',
          height: '14px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '3px',
          background: checked ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
          border: checked ? 'none' : '1px solid var(--figma-color-border-strong, #c4c4c4)',
          fontSize: '11px',
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function AddEvent(props: Props): JSX.Element {
  const { event, setEvent, onAddEvent, existingEvents = [] } = props;

  const trimmedName = event.name.trim();
  const isDuplicateName = trimmedName.length > 0 && existingEvents.some((e) => e.name === trimmedName);

  useEffect(() => {
    amplitude.getInstance().init(AMPLITUDE_API_KEY);
    amplitude.getInstance().logEvent('Tab Visited: Add Event');
  }, []);

  const onChange = useCallback((newState: Partial<EventMetadata>) => {
    setEvent((oldState: EventMetadata): EventMetadata => ({ ...oldState, ...newState }));
  }, [setEvent]);

  const onTagsChange = useCallback((newState: { tagsRaw?: string }) => {
    const raw = newState.tagsRaw ?? '';
    setEvent(old => ({
      ...old,
      tags: raw ? raw.split(',').map(t => t.trim()).filter(Boolean) : [],
    }));
  }, [setEvent]);

  const onToggleSource = useCallback((sdk: SourceSdk) => {
    setEvent(old => {
      const current = old.sources ?? [];
      const next = current.includes(sdk)
        ? current.filter(s => s !== sdk)
        : [...current, sdk];
      return { ...old, sources: next };
    });
  }, [setEvent]);

  const onAddProperty = useCallback(() => {
    setEvent(old => ({
      ...old,
      properties: [...(old.properties ?? []), { ...EMPTY_PROPERTY }],
    }));
  }, [setEvent]);

  const onRemoveProperty = useCallback((index: number) => {
    setEvent(old => ({
      ...old,
      properties: (old.properties ?? []).filter((_, i) => i !== index),
    }));
  }, [setEvent]);

  const onPropertyNameChange = useCallback((index: number, value: string) => {
    setEvent(old => {
      const properties = [...(old.properties ?? [])];
      // Preserve `source` (and any imported metadata) on edit so a user
      // typo-fix on an imported property doesn't downgrade it to 'created'.
      properties[index] = { ...properties[index], name: value };
      return { ...old, properties };
    });
  }, [setEvent]);

  const tagsRaw = event.tags?.join(', ') ?? '';
  const properties = event.properties ?? [];
  const sources = event.sources ?? [];

  return (
    <div style={S.rootColumn}>
      <div style={S.scrollArea}>

        {/* ─── BASICS ─────────────────────────────────────────── */}

        <Field label="Event Trigger">
          <DropdownMenu name="trigger" onChange={onChange} options={TRIGGER_OPTIONS} value={event.trigger}>
            <Button secondary onClick={noop} style={S.dropdownButton}>
              <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                {event.trigger}
                <CaretDown />
              </div>
            </Button>
          </DropdownMenu>
        </Field>

        <Field label="Name">
          <Textbox name="name" onChange={onChange} value={event.name} placeholder="button.clicked" />
          {isDuplicateName && (
            <div
              style={{
                marginTop: '4px',
                fontSize: '11px',
                lineHeight: '1.4',
                color: '#d97706',
              }}
            >
              ⚠️ This event already exists in All Events
            </div>
          )}
        </Field>

        <Field label="Description" optional>
          <Textbox
            name="description"
            onChange={onChange}
            value={event.description}
            placeholder="Ex: “user clicks on the Add to Cart button”"
          />
        </Field>

        <Field label="Note for Developer" optional>
          <Textbox
            name="notes"
            onChange={onChange}
            value={event.notes}
            placeholder="Ex: “fired after server confirmation”"
          />
        </Field>

        {/* ─── TAXONOMY ───────────────────────────────────────── */}

        <SectionHeader>Taxonomy</SectionHeader>

        <Field label="Category" optional>
          <Textbox name="category" onChange={onChange} value={event.category ?? ''} placeholder="Ex: Onboarding" />
        </Field>

        <div style={S.twoColumnRow}>
          <div style={S.twoColumnCell}>
            <div style={S.label}>Activity</div>
            <DropdownMenu name="activity" onChange={onChange} options={ACTIVITY_OPTIONS} value={event.activity ?? Activity.ACTIVE}>
              <Button secondary onClick={noop} style={S.dropdownButton}>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                  {event.activity ?? Activity.ACTIVE}
                  <CaretDown />
                </div>
              </Button>
            </DropdownMenu>
          </div>

          <div style={S.twoColumnCell}>
            <div style={S.label}>Visibility</div>
            <DropdownMenu name="visibility" onChange={onChange} options={VISIBILITY_OPTIONS} value={event.visibility ?? Visibility.VISIBLE}>
              <Button secondary onClick={noop} style={S.dropdownButton}>
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                  {event.visibility ?? Visibility.VISIBLE}
                  <CaretDown />
                </div>
              </Button>
            </DropdownMenu>
          </div>
        </div>

        <Field label="Tags" optional>
          <Textbox
            name="tagsRaw"
            onChange={onTagsChange}
            value={tagsRaw}
            placeholder="growth, paywall (comma-separated)"
          />
        </Field>

        {/* ─── SOURCES ────────────────────────────────────────── */}

        <SectionHeader>Sources</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {[SourceSdk.ANDROID, SourceSdk.IOS].map(sdk => (
            <ToggleChip
              key={sdk}
              label={sdk}
              checked={sources.includes(sdk)}
              onClick={(): void => onToggleSource(sdk)}
            />
          ))}
        </div>

        {/* ─── PROPERTIES ─────────────────────────────────────── */}

        <div style={{ ...S.sectionHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Properties</span>
          <button
            type="button"
            onClick={onAddProperty}
            aria-label="Add property"
            title="Add property"
            style={{
              width: '20px',
              height: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: BRAND,
              fontSize: '18px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            +
          </button>
        </div>

        {properties.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <Textbox
                name={`prop-name-${i}`}
                value={p.name}
                onChange={(s: { [key: string]: string }): void => onPropertyNameChange(i, s[`prop-name-${i}`] ?? '')}
                placeholder="Property name"
              />
            </div>
            <button
              type="button"
              onClick={(): void => onRemoveProperty(i)}
              aria-label="Remove property"
              title="Remove property"
              style={{
                flexShrink: 0,
                width: '24px',
                height: '24px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2.5 4h11M6 4V2.5h4V4M4 4l.667 9.5a1 1 0 001 .92h4.666a1 1 0 001-.92L12 4M6.5 7v5M9.5 7v5"
                  stroke="currentColor"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        ))}

      </div>

      <div style={S.footer}>
        <Button disabled={event.name.length === 0} onClick={onAddEvent}>Add Event</Button>
      </div>
    </div>
  );
}

export default AddEvent;

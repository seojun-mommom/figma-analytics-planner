/** @jsx h */
import { Divider } from '@create-figma-plugin/ui';
import { h, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import amplitude from 'amplitude-js';

import { MommomLogo } from 'src/assets/MommomLogo';

const S = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '0 12px',
    overflowY: 'auto' as const,
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#1a1a1a',
  },
  section: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    padding: '16px 0',
  },
  header: {
    fontWeight: 600,
    fontSize: '13px',
    margin: 0,
  },
  body: {
    fontSize: '13px',
    lineHeight: '1.6',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    paddingLeft: '4px',
  },
  listItem: {
    display: 'flex',
    gap: '6px',
    lineHeight: '1.6',
  },
  listNum: {
    minWidth: '14px',
    color: '#6b7280',
  },
  bullet: {
    display: 'flex',
    gap: '6px',
    lineHeight: '1.6',
  },
  bulletDot: {
    minWidth: '10px',
    color: '#6b7280',
  },
  subList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    paddingLeft: '18px',
    marginTop: '2px',
  },
  subBullet: {
    display: 'flex',
    gap: '6px',
    lineHeight: '1.6',
    color: '#4b5563',
  },
  subBulletDot: {
    minWidth: '10px',
    color: '#9ca3af',
  },
  note: {
    display: 'flex',
    gap: '6px',
    lineHeight: '1.6',
    color: '#6b7280',
  },
  tip: {
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#6b7280',
    margin: 0,
  },
};

interface BulletItem {
  text: string;
  sub?: string[];
}

function Bullet({ item }: { item: BulletItem }): JSX.Element {
  return (
    <div>
      <div style={S.bullet}>
        <span style={S.bulletDot}>·</span>
        <span>{item.text}</span>
      </div>
      {item.sub !== undefined && item.sub.length > 0 && (
        <div style={S.subList}>
          {item.sub.map((s, i) => (
            <div key={i} style={S.subBullet}>
              <span style={S.subBulletDot}>·</span>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BulletList({ items }: { items: BulletItem[] }): JSX.Element {
  return (
    <div style={S.list}>
      {items.map((item, i) => (
        <Bullet key={i} item={item} />
      ))}
    </div>
  );
}

interface NumberedItem {
  text: string;
  sub?: string[];
}

function NumberedList({ items }: { items: NumberedItem[] }): JSX.Element {
  return (
    <div style={S.list}>
      {items.map((step, i) => (
        <div key={i}>
          <div style={S.listItem}>
            <span style={S.listNum}>{i + 1}.</span>
            <span>{step.text}</span>
          </div>
          {step.sub !== undefined && step.sub.length > 0 && (
            <div style={S.subList}>
              {step.sub.map((s, j) => (
                <div key={j} style={S.subBullet}>
                  <span style={S.subBulletDot}>·</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Tutorial(): JSX.Element {
  useEffect(() => {
    amplitude.getInstance().logEvent('Tab Visited: Tutorial');
  });

  return (
    <div style={S.root}>

      {/* Welcome */}
      <div style={{ ...S.section, alignItems: 'center', textAlign: 'center' }}>
        <div style={{ marginTop: '8px' }}>
          <MommomLogo />
        </div>
        <p style={{ ...S.header, fontSize: '13px', margin: '8px 0 0' }}>
          Welcome to Amplitude Event Mapper
        </p>
        <p style={{ ...S.body, margin: '4px 0 0', color: '#6b7280' }}>
          Import Amplitude events, map them to design elements, and visualize event tracking directly on your Figma designs.
        </p>
      </div>

      <Divider />

      {/* Overview */}
      <div style={S.section}>
        <p style={S.header}>🗺 Overview</p>
        <BulletList
          items={[
            { text: 'See all mapped events at a glance' },
            { text: '3-level tree: Screen → Element → Event' },
            { text: 'Click ↗ to jump to that element on canvas' },
            { text: 'Search by event name, node name, or frame name' },
            { text: 'Unmap events directly from here' },
            { text: 'Shows empty state guide when no events are mapped' },
          ]}
        />
      </div>

      <Divider />

      {/* All Events */}
      <div style={S.section}>
        <p style={S.header}>🗂 All Events</p>
        <BulletList
          items={[
            { text: 'Browse and map all events' },
            { text: 'Filter: [All] [Mapped] [Unmapped]' },
            { text: 'Search by event name or description' },
            {
              text: 'Click an event to expand details:',
              sub: ['Description, Trigger, Activity, Sources, Properties'],
            },
            {
              text: 'Map to Element:',
              sub: [
                'Select a layer or frame in your Figma design',
                'Click an event to expand',
                'Click "Map to Element"',
                'An event label appears at the top-right corner of the selected element',
              ],
            },
            { text: 'Unmap: click "Unmap" in the expanded view' },
            {
              text: '⚙️ menu options:',
              sub: [
                'Hide All Labels / Show All Labels',
                'Hide Names (logo icon only on canvas)',
                'Clear All Mappings',
                'Select to Export → check events → click Export',
              ],
            },
          ]}
        />
      </div>

      <Divider />

      {/* Import */}
      <div style={S.section}>
        <p style={S.header}>📥 Import</p>
        <NumberedList
          items={[
            { text: 'Go to Amplitude → Data → Events → Export (CSV)' },
            { text: 'Open Import tab → Choose CSV file' },
            {
              text: 'After upload:',
              sub: [
                'Summary shows Total / New / Duplicate counts',
                'Duplicate events (already in All Events) are hidden by default',
                'Toggle "Show duplicate events" to review',
              ],
            },
            { text: 'Click FAB button (↓) to save new events' },
            { text: 'Saved events appear in All Events (persists after plugin restart)' },
          ]}
        />
      </div>

      <Divider />

      {/* Create Event */}
      <div style={S.section}>
        <p style={S.header}>✏️ Create Event</p>
        <NumberedList
          items={[
            { text: 'Go to Create Event tab' },
            { text: 'Required: Event Name' },
            { text: 'Optional: Description, Category, Activity, Visibility, Tags, Sources, Properties (name only)' },
            {
              text: 'Click "Add Event"',
              sub: [
                'Auto-navigates to All Events',
                'New event highlighted and ready to map',
              ],
            },
          ]}
        />
        <p style={S.tip}>
          Note: Property details (type, required) are recommended to be configured in Amplitude. Export CSV → Import to Amplitude → set there.
        </p>
      </div>

      <Divider />

      {/* Canvas Labels */}
      <div style={S.section}>
        <p style={S.header}>🎨 Canvas Labels</p>
        <BulletList
          items={[
            { text: 'Labels appear at top-right of mapped elements' },
            { text: 'Default (collapsed): logo + event name (truncated)' },
            {
              text: 'Click "Expand on canvas" in All Events',
              sub: ['Shows full details: Trigger, Activity, Properties'],
            },
            {
              text: 'Click a canvas label or mapped element',
              sub: ['All Events auto-searches and focuses that event'],
            },
          ]}
        />
      </div>

      <Divider />

      {/* Export */}
      <div style={S.section}>
        <p style={S.header}>📤 Export</p>
        <BulletList
          items={[
            { text: 'All Events → ⚙️ → Select to Export' },
            { text: 'Check events → click Export (N)' },
            { text: 'Downloads as Amplitude Data import-compatible CSV' },
            { text: 'Go to Amplitude → Data → Events → Import' },
          ]}
        />
      </div>

      <Divider />

      {/* Notes */}
      <div style={{ ...S.section, marginBottom: '8px' }}>
        <p style={S.header}>Notes</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            'Event data is saved in the Figma file (shared with collaborators automatically)',
            'Users with "viewer" permission cannot edit label visibility',
            'Consider duplicating your page: one with labels visible, one without',
          ].map((note, i) => (
            <div key={i} style={S.note}>
              <span>·</span>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default Tutorial;

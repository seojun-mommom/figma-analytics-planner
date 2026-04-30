/** @jsx h */
import { Divider } from '@create-figma-plugin/ui';
import { h, JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import amplitude from 'amplitude-js';

import { MommomLogo } from 'src/assets/mommomLogo';

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
    marginBottom: '2px',
  },
  body: {
    fontSize: '13px',
    lineHeight: '1.6',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
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

function NumberedList({ items }: { items: string[] }): JSX.Element {
  return (
    <div style={S.list}>
      {items.map((step, i) => (
        <div key={i} style={S.listItem}>
          <span style={S.listNum}>{i + 1}.</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }): JSX.Element {
  return (
    <div style={S.list}>
      {items.map((item, i) => (
        <div key={i} style={S.bullet}>
          <span style={S.bulletDot}>·</span>
          <span>{item}</span>
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
          Welcome to Figma Analytics Planner
        </p>
        <p style={{ ...S.body, margin: '4px 0 0', color: '#6b7280' }}>
          This plugin helps designers import Amplitude events, map them to design
          elements, and visualize event tracking directly on your Figma designs.
        </p>
      </div>

      <Divider />

      {/* Import Events */}
      <div style={S.section}>
        <p style={{ ...S.header, margin: 0 }}>Import Events</p>
        <NumberedList
          items={[
            'Go to Amplitude → Data → Events → Export (CSV)',
            'Open the plugin → Select "Import Events" tab',
            'Click "Choose CSV file" and upload the exported file',
            'Your full event list will be loaded into the plugin',
          ]}
        />
      </div>

      <Divider />

      {/* Map Events */}
      <div style={S.section}>
        <p style={{ ...S.header, margin: 0 }}>Map Events to Design Elements</p>
        <NumberedList
          items={[
            'Select a layer or frame in your Figma design',
            'Find the event from the Import Events or All Events list',
            'Click the event to expand its details',
            'Click "Map to Element" button to link it',
            'A visual event label will appear at the top-right corner of the selected element',
          ]}
        />
        <p style={S.tip}>To unmap: expand the event → click &quot;Unmap&quot;.</p>
      </div>

      <Divider />

      {/* Navigate via Canvas */}
      <div style={S.section}>
        <p style={{ ...S.header, margin: 0 }}>Navigate via Canvas</p>
        <BulletList
          items={[
            'Click any event label on the canvas → All Events tab will open and highlight that event',
            'Click a mapped element on canvas → same behavior',
          ]}
        />
      </div>

      <Divider />

      {/* All Events Tab */}
      <div style={S.section}>
        <p style={{ ...S.header, margin: 0 }}>All Events Tab</p>
        <BulletList
          items={[
            'List View: browse all events with search',
            'Screen View: see events grouped by screen/frame',
            'Search by event name or description',
            'Click event name in "MAPPED TO" → canvas jumps to that element',
          ]}
        />
      </div>

      <Divider />

      {/* Canvas Label Controls */}
      <div style={S.section}>
        <p style={{ ...S.header, margin: 0 }}>Canvas Label Controls</p>
        <BulletList
          items={[
            '"Hide All Labels": show/hide all event labels',
            '"Hide Names": show only the logo icon on canvas (reduces visual clutter)',
            'Click label on canvas → expand/collapse via "Expand on canvas" button in All Events list',
          ]}
        />
      </div>

      <Divider />

      {/* Notes */}
      <div style={{ ...S.section, marginBottom: '8px' }}>
        <p style={{ ...S.header, margin: 0 }}>Notes</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {[
            'Event labels are organized into a group called "Amplitude Event Labels"',
            'Figma users with "viewer" permission cannot edit label visibility',
            'Consider duplicating your page — one with labels visible, one without',
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

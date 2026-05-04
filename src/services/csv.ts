import { EventMetadata } from 'src/types/event';

function escapeCell(raw: string): string {
  const escaped = raw.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function downloadCsv(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  if (navigator.msSaveBlob) {
    navigator.msSaveBlob(blob, filename);
    return;
  }
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ---------------------------------------------------------------------------
// Amplitude Taxonomy import CSV (single, unified export format)
// ---------------------------------------------------------------------------
//
// 42 columns matching the canonical Amplitude Data CSV export header (verified
// against a real export from the mom-mom workspace). The first 29 columns
// (0–28) are the indices that lib/parser.ts reads from on import, so the
// format round-trips. Columns 29–41 are advanced property constraints
// (string/number/array bounds, enum, regex, last-seen) — written as blank
// for new exports.
//
// Property-row defaults for new exports (per product spec, applied even when
// the source property carried richer metadata from a prior import):
//   - Property Value Type      → ""        (Amplitude treats blank as `any`)
//   - Property Schema Status   → "PLANNED" (mark new properties as planned)
//   - Property Required        → "FALSE"   (default Optional)
//   - Property Visibility      → "VISIBLE"
//   - Property Is Array        → "FALSE"
//
// Event-row defaults likewise mirror what Amplitude emits for newly created
// events (all hidden flags FALSE, 30-day metrics 0).

const AMPLITUDE_HEADER: readonly string[] = [
  'Action',                              // 0
  'Object Type',                         // 1
  'Object Name',                         // 2
  'Event Display Name',                  // 3
  'Object Owner',                        // 4
  'Object Description',                  // 5
  'Event Category',                      // 6
  'Tags',                                // 7
  'Event Schema Status',                 // 8
  'Event Activity',                      // 9
  'Event Hidden From Dropdowns',         // 10
  'Event Hidden From Persona Results',   // 11
  'Event Hidden From Pathfinder',        // 12
  'Event Hidden From Timeline',          // 13
  'Event Source',                        // 14
  'Event 30 Day Volume',                 // 15
  'Event 30 Day Queries',                // 16
  'Event First Seen',                    // 17
  'Event Last Seen',                     // 18
  'Property Type',                       // 19
  'Property Group Names',                // 20
  'Event Property Name',                 // 21
  'Property Description',                // 22
  'Property Category',                   // 23
  'Property Value Type',                 // 24
  'Property Schema Status',              // 25
  'Property Required',                   // 26
  'Property Visibility',                 // 27
  'Property Is Array',                   // 28
  'String Property Value Min Length',    // 29
  'String Property Value Max Length',    // 30
  'Number Is Integer',                   // 31
  'Number Property Value Min',           // 32
  'Number Property Value Max',           // 33
  'Array Unique Items',                  // 34
  'Array Min Items',                     // 35
  'Array Max Items',                     // 36
  'Enum Values',                         // 37
  'Const Value',                         // 38
  'Property Regex',                      // 39
  'Property First Seen',                 // 40
  'Property Last Seen',                  // 41
];

const COLUMN_COUNT = AMPLITUDE_HEADER.length;

function blankRow(): string[] {
  return new Array<string>(COLUMN_COUNT).fill('');
}

function buildAmplitudeRows(events: EventMetadata[]): string[][] {
  const rows: string[][] = [];
  for (const event of events) {
    const eventRow = blankRow();
    eventRow[1] = 'Event';
    eventRow[2] = event.name;
    eventRow[3] = event.displayName ?? '';
    eventRow[4] = event.owner ?? '';
    eventRow[5] = event.description;
    eventRow[6] = event.category ?? '';
    eventRow[7] = (event.tags ?? []).join(',');
    eventRow[8] = event.schemaStatus ?? '';
    eventRow[9] = event.activity ?? '';
    eventRow[10] = 'FALSE'; // Event Hidden From Dropdowns
    eventRow[11] = 'FALSE'; // Event Hidden From Persona Results
    eventRow[12] = 'FALSE'; // Event Hidden From Pathfinder
    eventRow[13] = 'FALSE'; // Event Hidden From Timeline
    eventRow[15] = '0';     // Event 30 Day Volume
    eventRow[16] = '0';     // Event 30 Day Queries
    eventRow[17] = event.firstSeen ?? '';
    eventRow[18] = event.lastSeen ?? '';
    rows.push(eventRow);

    for (const prop of event.properties ?? []) {
      const propRow = blankRow();
      propRow[19] = 'Event Property';
      propRow[21] = prop.name;
      propRow[24] = '';        // Property Value Type — blank, Amplitude treats as `any`
      propRow[25] = 'PLANNED'; // Property Schema Status — default for new exports
      propRow[26] = 'FALSE';   // Property Required — default Optional
      propRow[27] = 'VISIBLE'; // Property Visibility
      propRow[28] = 'FALSE';   // Property Is Array
      rows.push(propRow);
    }
  }
  return rows;
}

export function exportToCsv(filename: string, events: EventMetadata[]): void {
  if (events.length === 0) return;
  const dataRows = buildAmplitudeRows(events);
  const lines = [AMPLITUDE_HEADER, ...dataRows]
    .map(row => row.map(escapeCell).join(','))
    .join('\n');
  downloadCsv(filename, lines);
}

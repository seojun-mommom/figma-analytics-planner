// Amplitude Data taxonomy CSV parser
//
// Column layout (0-based, fixed positions):
//   0  Action                  — "IGNORE" skips the row
//   1  Object Type             — "Event" | other
//   2  Object Name             → event.name
//   3  Event Display Name      → event.displayName
//   4  Object Owner            → event.owner
//   5  Object Description      → event.description
//   6  Event Category          → event.category
//   7  Tags                    → event.tags  (comma-separated)
//   8  Event Schema Status     → event.schemaStatus
//   9  Event Activity          → event.activity
//  10–16  (other event fields, not used)
//  17  Event First Seen        → event.firstSeen
//  18  Event Last Seen         → event.lastSeen
//  19  Property Type           — "Event Property" triggers property attach
//  20  Property Group Names
//  21  Event Property Name     → property.name
//  22  Property Description    → property.description
//  23  Property Category
//  24  Property Value Type     → property.valueType
//  25  Property Schema Status  → property.schemaStatus
//  26  Property Required       → property.required  ("TRUE"/"FALSE")
//  27  Property Visibility     → property.visibility
//  28  Property Is Array

import { EventMetadata, EventProperty, Trigger } from 'src/types/event';

export interface ParseResult {
  events: EventMetadata[];
  warnings: string[];
}

// Fixed column indices
const COL = {
  action: 0,
  objectType: 1,
  objectName: 2,
  displayName: 3,
  owner: 4,
  description: 5,
  category: 6,
  tags: 7,
  schemaStatus: 8,
  activity: 9,
  firstSeen: 17,
  lastSeen: 18,
  propertyType: 19,
  propertyGroupNames: 20,
  propertyName: 21,
  propertyDescription: 22,
  propertyCategory: 23,
  propertyValueType: 24,
  propertySchemaStatus: 25,
  propertyRequired: 26,
  propertyVisibility: 27,
  propertyIsArray: 28,
} as const;

const MIN_COLS = COL.propertyIsArray + 1; // 29

// ---------------------------------------------------------------------------
// RFC 4180-compliant CSV tokenizer
// ---------------------------------------------------------------------------

export function tokenizeCsv(raw: string): string[][] {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // strip BOM

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { // escaped quote ""
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
        i++;
      } else if (ch === '\r') {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = '';
        if (text[i + 1] === '\n') i++;
        i++;
      } else if (ch === '\n') {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  while (rows.length > 0 && rows[rows.length - 1].every(c => c === '')) {
    rows.pop();
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function get(row: string[], idx: number): string {
  return (row[idx] ?? '').trim();
}

function parseBool(val: string): boolean {
  return /^true$/i.test(val.trim());
}

function parseTags(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function parseAmplitudeCsv(csvText: string): ParseResult {
  const warnings: string[] = [];
  const events: EventMetadata[] = [];

  if (!csvText.trim()) {
    return { events, warnings: ['CSV is empty'] };
  }

  const rows = tokenizeCsv(csvText);
  if (rows.length < 2) {
    return { events, warnings: ['CSV has no data rows'] };
  }

  const [, ...dataRows] = rows; // first row is header — skip it
  let current: EventMetadata | null = null;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    while (row.length < MIN_COLS) row.push('');

    // Rule 1: skip IGNORE rows
    if (get(row, COL.action).toUpperCase() === 'IGNORE') continue;

    const objectType = get(row, COL.objectType);

    // Rule 2: Event row → start new event
    if (objectType === 'Event') {
      const name = get(row, COL.objectName);
      if (!name) {
        warnings.push(`Row ${i + 2}: Event row with empty Object Name skipped`);
        current = null;
        continue;
      }

      current = {
        name,
        trigger: Trigger.ON_CLICK,
        description: get(row, COL.description),
        notes: '',
        displayName: get(row, COL.displayName) || undefined,
        owner: get(row, COL.owner) || undefined,
        category: get(row, COL.category) || undefined,
        tags: parseTags(get(row, COL.tags)),
        schemaStatus: get(row, COL.schemaStatus) || undefined,
        activity: get(row, COL.activity) || undefined,
        firstSeen: get(row, COL.firstSeen) || undefined,
        lastSeen: get(row, COL.lastSeen) || undefined,
        properties: [],
      };
      events.push(current);
      continue;
    }

    // Rule 3: Property Type === "Event Property" → attach to current event
    if (get(row, COL.propertyType) === 'Event Property') {
      if (!current) {
        warnings.push(`Row ${i + 2}: Property row with no preceding event skipped`);
        continue;
      }

      const name = get(row, COL.propertyName);
      if (!name) continue; // empty name — skip silently

      const property: EventProperty = {
        name,
        description: get(row, COL.propertyDescription),
        valueType: get(row, COL.propertyValueType),
        schemaStatus: get(row, COL.propertySchemaStatus),
        required: parseBool(get(row, COL.propertyRequired)),
        visibility: get(row, COL.propertyVisibility),
      };
      current.properties!.push(property);
    }
  }

  if (events.length === 0) warnings.push('No events found in CSV');

  return { events, warnings };
}

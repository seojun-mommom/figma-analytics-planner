import { describe, it, expect } from 'vitest';
import { parseAmplitudeCsv, tokenizeCsv } from './parser';
import { Trigger } from '../types/event';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// Build a CSV row with 30 empty columns, overriding specific indices.
// Values containing commas are automatically quoted so they survive the CSV tokenizer.
function makeRow(overrides: Partial<Record<number, string>> = {}): string {
  const cells = new Array(30).fill('');
  Object.entries(overrides).forEach(([k, v]) => { cells[Number(k)] = v; });
  return cells
    .map((c: string) => (c.includes(',') || c.includes('"')) ? `"${c.replace(/"/g, '""')}"` : c)
    .join(',');
}

// Row with Object Type = Event
function eventRow(overrides: Partial<Record<number, string>> = {}): string {
  return makeRow({ 1: 'Event', ...overrides });
}

// Row with Property Type = Event Property
function propRow(overrides: Partial<Record<number, string>> = {}): string {
  return makeRow({ 19: 'Event Property', ...overrides });
}

const HEADER = makeRow(); // header content doesn't matter — parser skips it

function buildCsv(...dataRows: string[]): string {
  return [HEADER, ...dataRows].join('\n');
}

// ---------------------------------------------------------------------------
// tokenizeCsv
// ---------------------------------------------------------------------------

describe('tokenizeCsv', () => {
  it('splits simple rows', () => {
    expect(tokenizeCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quoted fields containing commas', () => {
    expect(tokenizeCsv('"a,b",c')).toEqual([['a,b', 'c']]);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(tokenizeCsv('"say ""hi""",b')).toEqual([['say "hi"', 'b']]);
  });

  it('handles CRLF line endings', () => {
    expect(tokenizeCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('drops trailing empty rows', () => {
    expect(tokenizeCsv('a,b\n\n')).toEqual([['a', 'b']]);
  });

  it('strips BOM', () => {
    const result = tokenizeCsv('﻿a,b');
    expect(result[0][0]).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// parseAmplitudeCsv — edge cases
// ---------------------------------------------------------------------------

describe('parseAmplitudeCsv', () => {
  describe('edge cases', () => {
    it('returns warning for empty input', () => {
      const r = parseAmplitudeCsv('');
      expect(r.events).toHaveLength(0);
      expect(r.warnings[0]).toBe('CSV is empty');
    });

    it('returns warning when only header row present', () => {
      const r = parseAmplitudeCsv(HEADER);
      expect(r.events).toHaveLength(0);
      expect(r.warnings[0]).toMatch(/no data rows/i);
    });

    it('returns warning when no events found', () => {
      // A non-empty row that is not an Event row (avoids trailing-empty-row stripping)
      const r = parseAmplitudeCsv(buildCsv(makeRow({ 1: 'User' })));
      expect(r.warnings.some(w => /no events found/i.test(w))).toBe(true);
    });

    it('strips BOM and parses correctly', () => {
      const csv = '﻿' + buildCsv(eventRow({ 2: 'BOM Event' }));
      const r = parseAmplitudeCsv(csv);
      expect(r.events[0].name).toBe('BOM Event');
    });

    it('handles CRLF line endings', () => {
      const csv = [HEADER, eventRow({ 2: 'CRLF Event' })].join('\r\n');
      const r = parseAmplitudeCsv(csv);
      expect(r.events[0].name).toBe('CRLF Event');
    });
  });

  // ---------------------------------------------------------------------------
  // IGNORE
  // ---------------------------------------------------------------------------

  describe('IGNORE rows', () => {
    it('skips rows with Action = IGNORE', () => {
      const r = parseAmplitudeCsv(buildCsv(
        makeRow({ 0: 'IGNORE', 1: 'Event', 2: 'Should Be Skipped' })
      ));
      expect(r.events).toHaveLength(0);
    });

    it('skips IGNORE rows case-insensitively', () => {
      const r = parseAmplitudeCsv(buildCsv(
        makeRow({ 0: 'ignore', 1: 'Event', 2: 'Should Be Skipped' }),
        makeRow({ 0: 'Ignore', 1: 'Event', 2: 'Also Skipped' })
      ));
      expect(r.events).toHaveLength(0);
    });

    it('non-IGNORE rows with other Action values are processed normally', () => {
      const r = parseAmplitudeCsv(buildCsv(
        makeRow({ 0: 'INCLUDE', 1: 'Event', 2: 'Included Event' })
      ));
      expect(r.events).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Event rows
  // ---------------------------------------------------------------------------

  describe('Event rows', () => {
    it('parses all event fields from correct column indices', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({
          2: 'button_clicked',
          3: 'Button Clicked',
          4: 'owner@example.com',
          5: 'When the user clicks a button',
          6: 'UI',
          7: 'cta,navigation',
          8: 'LIVE',
          9: 'ACTIVE',
          17: '2024-01-15',
          18: '2024-11-20',
        })
      ));
      expect(r.events).toHaveLength(1);
      const e = r.events[0];
      expect(e.name).toBe('button_clicked');
      expect(e.displayName).toBe('Button Clicked');
      expect(e.owner).toBe('owner@example.com');
      expect(e.description).toBe('When the user clicks a button');
      expect(e.category).toBe('UI');
      expect(e.tags).toEqual(['cta', 'navigation']);
      expect(e.schemaStatus).toBe('LIVE');
      expect(e.activity).toBe('ACTIVE');
      expect(e.firstSeen).toBe('2024-01-15');
      expect(e.lastSeen).toBe('2024-11-20');
    });

    it('sets default trigger to ON_CLICK and empty notes', () => {
      const r = parseAmplitudeCsv(buildCsv(eventRow({ 2: 'e' })));
      expect(r.events[0].trigger).toBe(Trigger.ON_CLICK);
      expect(r.events[0].notes).toBe('');
    });

    it('sets undefined for empty optional string fields', () => {
      const r = parseAmplitudeCsv(buildCsv(eventRow({ 2: 'e' })));
      const e = r.events[0];
      expect(e.displayName).toBeUndefined();
      expect(e.owner).toBeUndefined();
      expect(e.category).toBeUndefined();
      expect(e.schemaStatus).toBeUndefined();
      expect(e.activity).toBeUndefined();
      expect(e.firstSeen).toBeUndefined();
      expect(e.lastSeen).toBeUndefined();
    });

    it('parses tags as a string array split on commas', () => {
      const r = parseAmplitudeCsv(buildCsv(eventRow({ 2: 'e', 7: 'a,b,c' })));
      expect(r.events[0].tags).toEqual(['a', 'b', 'c']);
    });

    it('parses empty tags as empty array', () => {
      const r = parseAmplitudeCsv(buildCsv(eventRow({ 2: 'e' })));
      expect(r.events[0].tags).toEqual([]);
    });

    it('trims whitespace from tag values', () => {
      const r = parseAmplitudeCsv(buildCsv(eventRow({ 2: 'e', 7: ' a , b ' })));
      expect(r.events[0].tags).toEqual(['a', 'b']);
    });

    it('initialises properties as empty array', () => {
      const r = parseAmplitudeCsv(buildCsv(eventRow({ 2: 'e' })));
      expect(r.events[0].properties).toEqual([]);
    });

    it('warns and skips Event row with empty Object Name', () => {
      const r = parseAmplitudeCsv(buildCsv(eventRow())); // col 2 is empty
      expect(r.events).toHaveLength(0);
      expect(r.warnings.some(w => /empty object name/i.test(w))).toBe(true);
    });

    it('parses multiple events in order', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'event_a' }),
        eventRow({ 2: 'event_b' }),
        eventRow({ 2: 'event_c' }),
      ));
      expect(r.events.map(e => e.name)).toEqual(['event_a', 'event_b', 'event_c']);
    });
  });

  // ---------------------------------------------------------------------------
  // Property rows
  // ---------------------------------------------------------------------------

  describe('Property rows', () => {
    it('attaches Event Property to the preceding event with imported metadata', () => {
      // Imported properties keep name + type + required + source='imported'.
      // Other CSV columns (description, schemaStatus, visibility) are dropped.
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'my_event' }),
        propRow({ 21: 'user_id', 22: 'The user ID', 24: 'string', 25: 'LIVE', 26: 'TRUE', 27: 'PUBLIC' }),
      ));
      expect(r.events[0].properties).toHaveLength(1);
      const p = r.events[0].properties![0];
      expect(p.name).toBe('user_id');
      expect(p.type).toBe('string');
      expect(p.required).toBe(true);
      expect(p.source).toBe('imported');
    });

    it('parses required=TRUE as true', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        propRow({ 21: 'p', 26: 'TRUE' }),
      ));
      expect(r.events[0].properties![0].required).toBe(true);
    });

    it('parses required=FALSE as false', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        propRow({ 21: 'p', 26: 'FALSE' }),
      ));
      expect(r.events[0].properties![0].required).toBe(false);
    });

    it('parses empty required as false', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        propRow({ 21: 'p' }),
      ));
      expect(r.events[0].properties![0].required).toBe(false);
    });

    it('leaves type undefined when Property Value Type column is empty', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        propRow({ 21: 'p' }),
      ));
      expect(r.events[0].properties![0].type).toBeUndefined();
    });

    it('skips rows where Property Type is not "Event Property"', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        makeRow({ 19: 'User Property', 21: 'user_level' }),
        makeRow({ 19: 'Group Property', 21: 'plan' }),
      ));
      expect(r.events[0].properties).toHaveLength(0);
    });

    it('emits warning when property row has no preceding event', () => {
      const r = parseAmplitudeCsv(buildCsv(
        propRow({ 21: 'orphan_prop' }),
      ));
      expect(r.warnings.some(w => /no preceding event/i.test(w))).toBe(true);
    });

    it('silently skips property row with empty Event Property Name', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        propRow(), // no col 21
      ));
      expect(r.events[0].properties).toHaveLength(0);
      expect(r.warnings.filter(w => /property/i.test(w))).toHaveLength(0);
    });

    it('attaches multiple properties to the same event', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        propRow({ 21: 'p1' }),
        propRow({ 21: 'p2' }),
        propRow({ 21: 'p3' }),
      ));
      expect(r.events[0].properties!.map(p => p.name)).toEqual(['p1', 'p2', 'p3']);
    });

    it('assigns properties to correct event when interleaved', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'event_a' }),
        propRow({ 21: 'prop_a1' }),
        propRow({ 21: 'prop_a2' }),
        eventRow({ 2: 'event_b' }),
        propRow({ 21: 'prop_b1' }),
      ));
      expect(r.events[0].properties!.map(p => p.name)).toEqual(['prop_a1', 'prop_a2']);
      expect(r.events[1].properties!.map(p => p.name)).toEqual(['prop_b1']);
    });
  });

  // ---------------------------------------------------------------------------
  // Combined scenarios
  // ---------------------------------------------------------------------------

  describe('combined scenarios', () => {
    it('IGNORE row between event and property — property still attaches to preceding event', () => {
      const r = parseAmplitudeCsv(buildCsv(
        eventRow({ 2: 'e' }),
        makeRow({ 0: 'IGNORE', 19: 'Event Property', 21: 'ignored_prop' }),
        propRow({ 21: 'real_prop' }),
      ));
      expect(r.events[0].properties!.map(p => p.name)).toEqual(['real_prop']);
    });

    it('IGNORE event row does not become current event', () => {
      const r = parseAmplitudeCsv(buildCsv(
        makeRow({ 0: 'IGNORE', 1: 'Event', 2: 'ignored_event' }),
        propRow({ 21: 'orphan' }),
      ));
      expect(r.events).toHaveLength(0);
      expect(r.warnings.some(w => /no preceding event/i.test(w))).toBe(true);
    });

    it('handles a realistic multi-event CSV with properties', () => {
      const r = parseAmplitudeCsv(buildCsv(
        makeRow({ 0: 'IGNORE', 1: 'Event', 2: 'Old Event' }),
        eventRow({ 2: 'button_clicked', 5: 'Button clicked', 6: 'UI' }),
        propRow({ 21: 'button_id', 24: 'string', 26: 'TRUE' }),
        propRow({ 21: 'page_url', 24: 'string', 26: 'FALSE' }),
        eventRow({ 2: 'form_submitted', 5: 'Form submitted', 6: 'Conversion' }),
        propRow({ 21: 'form_id', 24: 'string', 26: 'TRUE' }),
      ));

      expect(r.warnings).toHaveLength(0);
      expect(r.events).toHaveLength(2);

      const [btn, form] = r.events;
      expect(btn.name).toBe('button_clicked');
      expect(btn.category).toBe('UI');
      expect(btn.properties).toHaveLength(2);
      expect(btn.properties![0]).toMatchObject({ name: 'button_id' });
      expect(btn.properties![1]).toMatchObject({ name: 'page_url' });

      expect(form.name).toBe('form_submitted');
      expect(form.category).toBe('Conversion');
      expect(form.properties).toHaveLength(1);
      expect(form.properties![0]).toMatchObject({ name: 'form_id' });
    });
  });
});

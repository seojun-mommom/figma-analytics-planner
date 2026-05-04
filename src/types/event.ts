export enum Trigger {
  ON_CLICK = 'On click',
  ON_HOVER = 'On hover',
  ON_LOAD = 'On load',
}

export enum Activity {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

export enum Visibility {
  VISIBLE = 'Visible',
  HIDDEN = 'Hidden',
}

export enum SourceSdk {
  ANDROID = 'Android SDK',
  IOS = 'iOS SDK',
}

// Property origin matters at display time:
//  - 'imported' properties come from a parsed Amplitude CSV and carry the
//    original Value Type / Required flags from the source taxonomy.
//  - 'created' properties were typed by the user in Add Event and only have
//    a name; type & required will be filled in by Amplitude after export.
export interface EventProperty {
  name: string;
  type?: string;
  required?: boolean;
  source: 'imported' | 'created';
}

export interface EventMetadata {
  // Manual entry fields (always present)
  name: string;
  trigger: Trigger;
  description: string;
  notes: string;

  // Manual entry / import shared fields (loose strings so CSV import values pass through unchanged)
  category?: string;
  activity?: string;     // form uses Activity enum values; CSV import keeps raw values like "ACTIVE"
  visibility?: string;   // form uses Visibility enum values
  sources?: SourceSdk[]; // checkbox group
  tags?: string[];

  // Amplitude taxonomy fields (populated from CSV import only)
  displayName?: string;
  owner?: string;
  schemaStatus?: string;
  firstSeen?: string;
  lastSeen?: string;
  properties?: EventProperty[];
}

// Markers put on the nodes of an event label to show which nodes are
// showing the data of an event. Used to load the events back into the "view events" UI.
export enum NodeMarker {
  NAME = 'name',
  TRIGGER = 'trigger',
  DESCRIPTION = 'description',
  NOTES = 'notes',
}

export type PluginData = {
  [key in NodeMarker]: string
};

// Sent from Main to UI on selection change.
// `mappedEvent` is null when nothing is selected, multiple nodes are selected,
// or the selected node has no associated event label.
export interface SelectionInfo {
  selectedName: string | null;
  mappedEvent: EventMetadata | null;
}

// Describes a single event-to-node mapping. screenName is the name of the
// top-level Frame ancestor (page-direct child); frameId is that ancestor's
// node id (used by Tree view to navigate the viewport to the frame);
// breadcrumb is the names from that ancestor down to the node, joined by " > ";
// cardId uniquely identifies the canvas label group attached to this mapping
// (stable across re-renders; stamped on the group + every descendant). May be
// empty for legacy mappings created before cardId was introduced.
export interface EventMapping {
  nodeId: string;
  nodeName: string;
  screenName: string;
  frameId: string;
  breadcrumb: string;
  cardId: string;
}

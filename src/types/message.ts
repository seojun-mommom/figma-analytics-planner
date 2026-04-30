export enum Message {
  ADD_EVENT = 'ADD_EVENT',
  API_KEY = 'API_KEY',
  SECRET_KEY = 'SECRET_KEY',
  EXPORT_CSV = 'EXPORT_CSV',
  CHANGE_TAB = 'CHANGE_TAB',
  NOTIFY_MESSAGE = 'NOTIFY_MESSAGE', // Note(Kelvin): Hack to use figma notify in the UI
  SELECTION_CHANGED = 'SELECTION_CHANGED',         // Main → UI: current selection + mapped event
  REQUEST_SELECTION_STATE = 'REQUEST_SELECTION_STATE', // UI → Main: ask for current selection state
  MAP_EVENT = 'MAP_EVENT',                         // UI → Main: map an event to currently selected node
  EVENT_MAPPED = 'EVENT_MAPPED',                   // Main → UI: confirms a successful event-to-node mapping
  UNMAP_EVENT = 'UNMAP_EVENT',                     // UI → Main: remove a single event-to-node mapping
  EVENT_UNMAPPED = 'EVENT_UNMAPPED',               // Main → UI: confirms a successful unmap so UI state can sync
  TOGGLE_CARD = 'TOGGLE_CARD',                     // UI → Main: toggle a single card's expanded state, keyed by cardId. Payload: { cardId: string; isExpanded: boolean }
  SET_CARD_MINIMIZED = 'SET_CARD_MINIMIZED',       // UI → Main: toggle a card's minimized state on canvas
  SET_LABELS_VISIBLE = 'SET_LABELS_VISIBLE',       // UI → Main: show/hide the entire Amplitude Event Labels group
  TOGGLE_LABEL_NAMES = 'TOGGLE_LABEL_NAMES',       // UI → Main: show/hide event-name text inside every card (logo-only mode)
  UI_RESIZE = 'UI_RESIZE',                         // UI → Main: resize plugin window with optional persistence
  FOCUS_NODE = 'FOCUS_NODE',                       // UI → Main: scroll viewport to a node id and select it
  NAVIGATE_TO_NODE = 'NAVIGATE_TO_NODE',           // UI → Main: scroll viewport to a Frame node id (used by Screen View headers)
}

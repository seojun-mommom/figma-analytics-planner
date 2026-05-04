import { render, Container, Tabs } from '@create-figma-plugin/ui';
import { emit, on } from '@create-figma-plugin/utilities';
import amplitude from 'amplitude-js';

import { h, JSX } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';

import { EventMapping, EventMetadata, SelectionInfo, Trigger } from 'src/types/event';
import { Message } from 'src/types/message';
import { Tab, REGULAR_TAB_SIZE } from 'src/types/tab';
import { AMPLITUDE_API_KEY } from 'src/constants';

import AddEvent from 'src/views/AddEvent/AddEvent';
import AllEvents from 'src/views/AllEvents/AllEvents';
import ImportEvents from 'src/views/ImportEvents/ImportEvents';
import Overview from 'src/views/Overview/Overview';
import Tutorial from 'src/views/Tutorial/Tutorial';

type EventMappings = Record<string, EventMapping[]>;
type ExpansionState = Record<string, boolean>;
type MinimizedState = Record<string, boolean>;

interface UiSize { width: number; height: number; }

type ToastKind = 'success' | 'error';
interface Toast { kind: ToastKind; message: string; }

function ToastView({ toast }: { toast: Toast }): JSX.Element {
  const isSuccess = toast.kind === 'success';
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 16px',
        borderRadius: 4,
        background: isSuccess ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.4,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 200,
        whiteSpace: 'nowrap',
        maxWidth: 'calc(100% - 16px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {isSuccess ? '✅' : '❌'} {toast.message}
    </div>
  );
}

interface Props {
  initialTab?: Tab;
  initialEvents?: EventMetadata[];
  initialMappings?: EventMappings;
  initialNamesVisible?: boolean;
  initialUiSize?: UiSize | null;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 200;
const MINIMIZED_HEIGHT = 32;

const INITIAL_EVENT_INPUT: EventMetadata = { name: '', trigger: Trigger.ON_CLICK, description: '', notes: '' };
const INITIAL_SELECTION: SelectionInfo = { selectedName: null, mappedEvent: null };

const GLOBAL_STYLES = `
  html, body, #create-figma-plugin {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
  }
  input, textarea, select, button {
    font-family: inherit;
  }
`;

function SelectionBanner({ selection }: { selection: SelectionInfo }): JSX.Element | null {
  const { selectedName, mappedEvent } = selection;
  if (selectedName === null) return null;

  const mapped = mappedEvent !== null
    ? {
        background: 'rgba(24, 160, 88, 0.08)',
        border: '1px solid rgba(24, 160, 88, 0.25)',
      }
    : {
        background: 'rgba(254, 110, 18, 0.06)',
        border: '1px solid rgba(254, 110, 18, 0.25)',
      };

  return (
    <div
      style={{
        padding: '8px 10px',
        marginBottom: '8px',
        borderRadius: '4px',
        background: mapped.background,
        border: mapped.border,
        fontSize: '11px',
        lineHeight: '1.5',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: 0 }}>
        <span style={{ color: '#6b7280', flexShrink: 0 }}>
          Selected:
        </span>
        <span
          style={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={selectedName}
        >
          {selectedName}
        </span>
      </div>

      {mappedEvent !== null && (
        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: 0 }}>
            <span style={{ color: '#6b7280', flexShrink: 0 }}>
              Event:
            </span>
            <span
              style={{
                fontWeight: 600,
                color: 'rgb(24, 160, 88)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={mappedEvent.name}
            >
              {mappedEvent.name}
            </span>
            <span style={{ color: '#6b7280', flexShrink: 0 }}>
              · {mappedEvent.trigger}
            </span>
          </div>
          {mappedEvent.description !== '' && (
            <div
              style={{
                color: '#6b7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={mappedEvent.description}
            >
              {mappedEvent.description}
            </div>
          )}
        </div>
      )}

      {mappedEvent === null && (
        <div style={{ marginTop: '2px', color: '#6b7280' }}>
          No event mapped
        </div>
      )}
    </div>
  );
}

function Plugin (props: Props): JSX.Element {
  const {
    initialTab = Tab.OVERVIEW,
    initialEvents = [] as EventMetadata[],
    initialMappings = {} as EventMappings,
    initialNamesVisible = true,
    initialUiSize = null,
  } = props;

  // Window-management state. The plugin renders a custom minimize button
  // (top-right inside the iframe — Figma owns the actual close X) and a
  // resize handle at the bottom-right. We track the current size in state
  // so we can render conditionally on minimize and so we can seed the
  // resize-drag with the right starting dimensions.
  const [size, setSize] = useState<UiSize>(initialUiSize ?? { ...REGULAR_TAB_SIZE });
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [minimizeHovered, setMinimizeHovered] = useState<boolean>(false);
  const sizeRef = useRef<UiSize>(size);
  useEffect(() => { sizeRef.current = size; }, [size]);
  // Captures the size at the moment of minimizing so we can restore it.
  const preMinimizeSizeRef = useRef<UiSize>(size);

  const onMinimizeToggle = useCallback(() => {
    setIsMinimized((prev) => {
      if (prev) {
        const restored = preMinimizeSizeRef.current;
        setSize(restored);
        emit(Message.UI_RESIZE, { width: restored.width, height: restored.height, persist: false });
        return false;
      }
      preMinimizeSizeRef.current = sizeRef.current;
      const collapsed = { width: sizeRef.current.width, height: MINIMIZED_HEIGHT };
      setSize(collapsed);
      emit(Message.UI_RESIZE, { width: collapsed.width, height: collapsed.height, persist: false });
      return true;
    });
  }, []);

  const onResizeMouseDown = useCallback((event: MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = sizeRef.current.width;
    const startH = sizeRef.current.height;

    const onMove = (ev: MouseEvent): void => {
      const w = Math.max(MIN_WIDTH, Math.round(startW + (ev.clientX - startX)));
      const h = Math.max(MIN_HEIGHT, Math.round(startH + (ev.clientY - startY)));
      setSize({ width: w, height: h });
      emit(Message.UI_RESIZE, { width: w, height: h, persist: false });
    };
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      // Persist the final size so the next plugin run reopens at this size.
      emit(Message.UI_RESIZE, { width: sizeRef.current.width, height: sizeRef.current.height, persist: true });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);
  // First-launch routing: when the entry asks for Overview but the page has
  // no events yet, redirect to Import so first-time users see the on-ramp.
  // Explicit entries (Import, Create Event, etc.) are untouched.
  const startTab = (initialTab === Tab.OVERVIEW && initialEvents.length === 0)
    ? Tab.IMPORT_EVENTS
    : initialTab;
  const [tab, setTab] = useState<Tab>(startTab);
  // Keep a ref of the active tab so async listeners (SELECTION_CHANGED) can
  // make tab-aware decisions without becoming dependent on `tab` and tearing
  // down their subscription on every switch.
  const tabRef = useRef<Tab>(startTab);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  const [events, setEvents] = useState<EventMetadata[]>(initialEvents);
  const [mappings, setMappings] = useState<EventMappings>(initialMappings);
  const [expansion, setExpansion] = useState<ExpansionState>({});
  const [minimized, setMinimized] = useState<MinimizedState>({});
  const [eventInput, setEventInput] = useState<EventMetadata>(INITIAL_EVENT_INPUT);
  const [selection, setSelection] = useState<SelectionInfo>(INITIAL_SELECTION);
  // When the user selects a canvas node mapped to an event (or selects the
  // event label itself), we route the event name through here so the All
  // Events list can scroll/expand/highlight that row. Cleared by AllEvents
  // once it has consumed the focus, so a re-selection of the same event
  // re-triggers the effect.
  const [pendingFocusEvent, setPendingFocusEvent] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  // Auto-dismiss toasts. Success: 2s, error: 3s.
  useEffect(() => {
    if (toast === null) return;
    const duration = toast.kind === 'success' ? 2000 : 3000;
    const id = window.setTimeout(() => setToast(null), duration);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    amplitude.getInstance().init(AMPLITUDE_API_KEY);
    amplitude.getInstance().logEvent('Plugin Opened');
  }, []);

  useEffect(() => {
    const unsubscribe = on(Message.SELECTION_CHANGED, (info: SelectionInfo, triggeredByUserSelection?: boolean) => {
      setSelection(info);
      // Only auto-focus the All Events list when the user actively clicked
      // a node on the canvas — not when the banner is being refreshed after
      // a Map/Add/Unmap action (those would otherwise hijack the search box
      // immediately after the user pressed "Map to selection"). Skip the
      // auto-switch entirely when the user is on Overview: clicking ↗ on a
      // frame/node from Overview routes through FOCUS_NODE/NAVIGATE_TO_NODE,
      // which sets the canvas selection — that should move the viewport, not
      // yank them out of Overview.
      if (triggeredByUserSelection === true && info.mappedEvent !== null) {
        if (tabRef.current === Tab.OVERVIEW) return;
        const eventName = info.mappedEvent.name;
        setPendingFocusEvent(eventName);
        setTab((current) => {
          if (current !== Tab.ALL_EVENTS) {
            emit(Message.CHANGE_TAB, current, Tab.ALL_EVENTS);
            return Tab.ALL_EVENTS;
          }
          return current;
        });
      }
    });
    emit(Message.REQUEST_SELECTION_STATE);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = on(Message.EVENT_MAPPED, (payload: { eventName: string; mapping: EventMapping }) => {
      setMappings((prev) => {
        const list = prev[payload.eventName] ?? [];
        if (list.some((m) => m.nodeId === payload.mapping.nodeId)) return prev;
        return { ...prev, [payload.eventName]: [...list, payload.mapping] };
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = on(Message.EVENT_UNMAPPED, (payload: { eventName: string; nodeId: string }) => {
      setMappings((prev) => {
        const list = prev[payload.eventName];
        if (list === undefined) return prev;
        const next = list.filter((m) => m.nodeId !== payload.nodeId);
        const updated = { ...prev };
        if (next.length === 0) {
          delete updated[payload.eventName];
        } else {
          updated[payload.eventName] = next;
        }
        return updated;
      });
    });
    return unsubscribe;
  }, []);

  const onImportEvents = useCallback((newEvents: EventMetadata[]) => {
    setEvents(old => [...old, ...newEvents]);
  }, []);

  const onAddEvent = useCallback(() => {
    const newEvent = { ...eventInput };
    try {
      amplitude.getInstance().logEvent('Add Event button clicked', {
        'has description': newEvent.description !== '',
        'has notes': newEvent.notes !== '',
        'trigger type': newEvent.trigger,
      });
      emit(Message.ADD_EVENT, newEvent);
      setEvents((oldEvents) => [...oldEvents, newEvent]);
      setEventInput(INITIAL_EVENT_INPUT);
      setToast({ kind: 'success', message: 'Event created successfully!' });
      emit(Message.NOTIFY_MESSAGE, 'Event created! Select a Figma element and click Map to Element');
      // Switch to All Events after a 1s delay so the user sees the success
      // toast before the form unmounts; pendingFocusEvent makes the new row
      // auto-select, expand, and highlight.
      window.setTimeout(() => {
        setTab((current) => {
          if (current !== Tab.ALL_EVENTS) {
            emit(Message.CHANGE_TAB, current, Tab.ALL_EVENTS);
            return Tab.ALL_EVENTS;
          }
          return current;
        });
        setPendingFocusEvent(newEvent.name);
      }, 1000);
    } catch (err) {
      setToast({ kind: 'error', message: 'Failed to create event. Please try again.' });
      emit(Message.NOTIFY_MESSAGE, 'Error: Failed to create event');
    }
  }, [eventInput]);

  const onMapEvent = useCallback((event: EventMetadata) => {
    emit(Message.MAP_EVENT, event);
  }, []);

  const onUnmapEvent = useCallback((eventName: string, nodeId: string) => {
    emit(Message.UNMAP_EVENT, { eventName, nodeId });
  }, []);

  // Iterates the current mappings snapshot and emits UNMAP_EVENT for each
  // (eventName, nodeId) pair. EVENT_UNMAPPED replies will trim ui.tsx's
  // mapping state per-entry as Main reports successful removals.
  const onClearAllMappings = useCallback(() => {
    for (const [eventName, list] of Object.entries(mappings)) {
      for (const m of list) {
        emit(Message.UNMAP_EVENT, { eventName, nodeId: m.nodeId });
      }
    }
  }, [mappings]);

  // Removes an event entry from the in-memory list. Only callable from the
  // All Events expanded row when nothing is mapped, so there is no canvas
  // label to clean up. Still emits DELETE_EVENT so Main can drop the entry
  // from the page-scoped unmapped-events store (otherwise it would reappear
  // on next plugin open).
  const onDeleteEvent = useCallback((eventName: string) => {
    emit(Message.DELETE_EVENT, eventName);
    setEvents((prev) => prev.filter((e) => e.name !== eventName));
    setExpansion((prev) => {
      if (!(eventName in prev)) return prev;
      const next = { ...prev };
      delete next[eventName];
      return next;
    });
    setMinimized((prev) => {
      if (!(eventName in prev)) return prev;
      const next = { ...prev };
      delete next[eventName];
      return next;
    });
  }, []);

  const onToggleExpansion = useCallback((eventName: string) => {
    setExpansion((prev) => {
      const next = !(prev[eventName] ?? false);
      const eventMappings = mappings[eventName] ?? [];
      for (const m of eventMappings) {
        // Skip legacy mappings without a cardId — the Main handler can't
        // resolve them, so the emit would be a wasted round-trip.
        if (m.cardId.length === 0) continue;
        emit(Message.TOGGLE_CARD, { cardId: m.cardId, isExpanded: next });
      }
      return { ...prev, [eventName]: next };
    });
    // Expanding/collapsing implicitly restores from minimized.
    setMinimized((prev) => {
      if (!(prev[eventName] ?? false)) return prev;
      return { ...prev, [eventName]: false };
    });
  }, [mappings]);

  const onToggleMinimized = useCallback((eventName: string) => {
    setMinimized((prev) => {
      const next = !(prev[eventName] ?? false);
      emit(Message.SET_CARD_MINIMIZED, { eventName, minimized: next });
      return { ...prev, [eventName]: next };
    });
  }, []);

  const [labelsVisible, setLabelsVisible] = useState<boolean>(true);
  const onToggleLabelsVisible = useCallback(() => {
    setLabelsVisible((prev) => {
      const next = !prev;
      emit(Message.SET_LABELS_VISIBLE, next);
      return next;
    });
  }, []);

  const [namesVisible, setNamesVisible] = useState<boolean>(initialNamesVisible);
  const onToggleNames = useCallback(() => {
    setNamesVisible((prev) => {
      const next = !prev;
      emit(Message.TOGGLE_LABEL_NAMES, next);
      return next;
    });
  }, []);

  const onFocusNode = useCallback((nodeId: string) => {
    emit(Message.FOCUS_NODE, nodeId);
  }, []);

  const onNavigateToFrame = useCallback((frameId: string) => {
    emit(Message.NAVIGATE_TO_NODE, { nodeId: frameId });
  }, []);

  const onTabChange = useCallback(({ tab: newTab }: {tab: Tab}) => {
    if (newTab !== tab) {
      emit(Message.CHANGE_TAB, tab, newTab);
      setTab(newTab);
    }
  }, [tab]);

  const onClearPendingFocus = useCallback(() => {
    setPendingFocusEvent(null);
  }, []);

  const onGoToAllEvents = useCallback(() => {
    setTab((current) => {
      if (current !== Tab.ALL_EVENTS) {
        emit(Message.CHANGE_TAB, current, Tab.ALL_EVENTS);
        return Tab.ALL_EVENTS;
      }
      return current;
    });
  }, []);

  const tabOptions = useMemo(() => {
    return [
      { value: Tab.OVERVIEW, view: <Overview events={events} mappings={mappings} onUnmapEvent={onUnmapEvent} onFocusNode={onFocusNode} onNavigateToFrame={onNavigateToFrame} onGoToAllEvents={onGoToAllEvents} /> },
      { value: Tab.ALL_EVENTS, view: <AllEvents events={events} mappings={mappings} onMapEvent={onMapEvent} onUnmapEvent={onUnmapEvent} onDeleteEvent={onDeleteEvent} labelsVisible={labelsVisible} onToggleLabelsVisible={onToggleLabelsVisible} namesVisible={namesVisible} onToggleNames={onToggleNames} onFocusNode={onFocusNode} onClearAllMappings={onClearAllMappings} expansion={expansion} onToggleExpansion={onToggleExpansion} pendingFocusEvent={pendingFocusEvent} onClearPendingFocus={onClearPendingFocus} /> },
      { value: Tab.IMPORT_EVENTS, view: <ImportEvents onImport={onImportEvents} existingEvents={events} mappings={mappings} onMapEvent={onMapEvent} onUnmapEvent={onUnmapEvent} onFocusNode={onFocusNode} expansion={expansion} onToggleExpansion={onToggleExpansion} minimized={minimized} onToggleMinimized={onToggleMinimized} /> },
      { value: Tab.ADD_EVENT, view: <AddEvent event={eventInput} setEvent={setEventInput} onAddEvent={onAddEvent} existingEvents={events} /> },
      { value: Tab.TUTORIAL, view: <Tutorial /> }
    ];
  }, [eventInput, onAddEvent, events, mappings, onMapEvent, onUnmapEvent, onDeleteEvent, onClearAllMappings, onImportEvents, expansion, onToggleExpansion, minimized, onToggleMinimized, labelsVisible, onToggleLabelsVisible, namesVisible, onToggleNames, onFocusNode, onNavigateToFrame, onGoToAllEvents, pendingFocusEvent, onClearPendingFocus]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <style>{GLOBAL_STYLES}</style>

      {toast !== null && <ToastView toast={toast} />}

      <button
        type="button"
        onClick={onMinimizeToggle}
        onMouseEnter={(): void => setMinimizeHovered(true)}
        onMouseLeave={(): void => setMinimizeHovered(false)}
        title={isMinimized ? 'Restore' : 'Minimize'}
        aria-label={isMinimized ? 'Restore' : 'Minimize'}
        style={{
          position: 'fixed',
          top: 4,
          right: 4,
          width: 22,
          height: 22,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: 3,
          cursor: 'pointer',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 16,
          lineHeight: 1,
          color: minimizeHovered ? '#1a1a1a' : '#6b7280',
          zIndex: 100,
        }}
      >
        {isMinimized ? '+' : '−'}
      </button>

      {!isMinimized && (
        <Container space='medium'>
          <SelectionBanner selection={selection} />
          <Tabs
            name="tab"
            onChange={onTabChange}
            options={tabOptions}
            value={tab}
          />
        </Container>
      )}

      {!isMinimized && (
        <div
          onMouseDown={onResizeMouseDown}
          title="Drag to resize"
          style={{
            position: 'fixed',
            bottom: 0,
            right: 0,
            width: 14,
            height: 14,
            cursor: 'nwse-resize',
            zIndex: 100,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: 'block' }}>
            <path d="M9 14 L14 9 M12 14 L14 12" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

export default render(Plugin);

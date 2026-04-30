import { emit, on } from '@create-figma-plugin/utilities';

import { applyNamesVisibility, createLabel, removeMappingByNodeId, setCardExpansionByCardId, setMinimizedByEventName } from 'src/lib/draw';
import { findLabelsForEvent, buildMappingForNode } from 'src/lib/loader';
import { EventMetadata, PluginData, SelectionInfo, Trigger } from 'src/types/event';
import { Message } from 'src/types/message';

// Looks up the full EventMetadata from the Amplitude Event Labels group by
// matching the label group whose 'eventData' has the given name. Used to
// resolve a leaf node's 'cardEventName' marker into a full event object.
function resolveEventByName(eventName: string): EventMetadata | null {
  const groupId = figma.currentPage.getPluginData('event_group');
  const root = groupId.length > 0 ? figma.getNodeById(groupId) : figma.currentPage.findOne((n) => n.name === 'Amplitude Event Labels');
  if (root === null || root.type !== 'GROUP') return null;
  for (const child of (root as GroupNode).children) {
    const dataStr = child.getPluginData('eventData');
    if (dataStr.length === 0) continue;
    try {
      const ev = JSON.parse(dataStr) as EventMetadata;
      if (ev.name === eventName) return ev;
    } catch {
      // skip
    }
  }
  return null;
}

// Reads an event from a single node's pluginData. Three sources, in priority:
//   1. 'eventData' — full JSON snapshot stored on the label group.
//   2. 'eventMetadata' — legacy NodeMarker → text-node-id map (older cards).
//   3. 'cardEventName' — a defensive marker stamped on every descendant of a
//      card by draw.ts, so even a leaf TextNode resolves cleanly without
//      needing the parent chain.
function readEventFromNode(n: BaseNode): EventMetadata | null {
  const dataStr = n.getPluginData('eventData');
  if (dataStr.length > 0) {
    try {
      return JSON.parse(dataStr) as EventMetadata;
    } catch {
      // fall through to legacy lookup
    }
  }
  const metadataStr = n.getPluginData('eventMetadata');
  if (metadataStr.length > 0) {
    try {
      const data = JSON.parse(metadataStr) as PluginData;
      const [name, trigger, description, notes] = findLabelsForEvent(data);
      if (name.length > 0) {
        return { name, trigger: trigger as Trigger, description, notes };
      }
    } catch {
      // fall through
    }
  }
  const cardEventName = n.getPluginData('cardEventName');
  if (cardEventName.length > 0) {
    return resolveEventByName(cardEventName);
  }
  return null;
}

function findMappedEvent(node: SceneNode): EventMetadata | null {
  // Case 1: walk up from the selected node so clicking on the card frame,
  // bracket, or any inner text still resolves to the event whose data lives
  // on an ancestor (the wrapping label group set up by createLabel).
  let cursor: BaseNode | null = node;
  while (cursor !== null) {
    const fromAncestor = readEventFromNode(cursor);
    if (fromAncestor !== null) return fromAncestor;
    cursor = cursor.parent;
  }

  // Case 2: the selected node IS the original mapped client node. Find the
  // label group that points back to it via clientNodeId.
  const eventGroupId = figma.currentPage.getPluginData('event_group');
  if (eventGroupId.length === 0) return null;
  const eventGroup = figma.getNodeById(eventGroupId);
  if (eventGroup === null || eventGroup.type !== 'GROUP') return null;
  for (const child of (eventGroup as GroupNode).children) {
    if (child.getPluginData('clientNodeId') !== node.id) continue;
    const event = readEventFromNode(child);
    if (event !== null) return event;
  }
  return null;
}

function buildSelectionInfo(): SelectionInfo {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) {
    return { selectedName: null, mappedEvent: null };
  }
  const node = selection[0];
  return {
    selectedName: node.name,
    mappedEvent: findMappedEvent(node),
  };
}

// `triggeredByUserSelection` distinguishes a real Figma selectionchange
// (user clicked a node on the canvas) from a programmatic refresh after
// ADD_EVENT / MAP_EVENT / UNMAP_EVENT — both need to update the selection
// banner, but only the first should auto-focus the All Events list.
function emitSelection(triggeredByUserSelection: boolean = false): void {
  emit(Message.SELECTION_CHANGED, buildSelectionInfo(), triggeredByUserSelection);
}

export function attachHandlers(): void {
  on(Message.ADD_EVENT, (event: EventMetadata) => {
    if (figma.currentPage.selection.length === 0) {
      figma.notify('Please select an element');
    } else if (figma.currentPage.selection.length > 1) {
      figma.notify('Please group multiple elements into a single frame');
    } else {
      const node = figma.currentPage.selection[0];
      createLabel(event, node).then(
        (cardId) => {
          figma.notify(`✔️ Event '${event.name}' added!`);
          emit(Message.EVENT_MAPPED, { eventName: event.name, mapping: buildMappingForNode(node, cardId) });
          emitSelection(); // selection's mapped event may have changed
        },
        () => figma.notify(`✗ Issue creating event: '${event.name}'`)
      );
    }
  });

  on(Message.TOGGLE_CARD, (payload: { cardId: string; isExpanded: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    setCardExpansionByCardId(payload.cardId, payload.isExpanded);
  });

  on(Message.SET_CARD_MINIMIZED, (payload: { eventName: string; minimized: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    setMinimizedByEventName(payload.eventName, payload.minimized);
  });

  on(Message.SET_LABELS_VISIBLE, (visible: boolean) => {
    const group = figma.currentPage.findOne((n) => n.name === 'Amplitude Event Labels') as GroupNode | null;
    if (group === null) {
      figma.notify('No event labels found on this page');
      return;
    }
    group.visible = visible;
  });

  on(Message.TOGGLE_LABEL_NAMES, (visible: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    applyNamesVisibility(visible);
  });

  on(Message.MAP_EVENT, (event: EventMetadata) => {
    if (figma.currentPage.selection.length === 0) {
      figma.notify('Please select a Figma element first');
      return;
    }
    if (figma.currentPage.selection.length > 1) {
      figma.notify('Please select a single element');
      return;
    }
    const node = figma.currentPage.selection[0];
    createLabel(event, node).then(
      (cardId) => {
        figma.notify(`✔️ Mapped to ${node.name}`);
        emit(Message.EVENT_MAPPED, { eventName: event.name, mapping: buildMappingForNode(node, cardId) });
        emitSelection();
      },
      () => figma.notify(`✗ Issue mapping event: '${event.name}'`)
    );
  });

  on(Message.UNMAP_EVENT, (payload: { eventName: string; nodeId: string }) => {
    const removed = removeMappingByNodeId(payload.nodeId);
    if (removed) {
      figma.notify('Event unmapped');
    }
    // Always emit so UI state stays in sync, even if the canvas card was
    // already missing (e.g. user deleted it manually before clicking Unmap).
    emit(Message.EVENT_UNMAPPED, { eventName: payload.eventName, nodeId: payload.nodeId });
    emitSelection();
  });

  on(Message.FOCUS_NODE, (nodeId: string) => {
    const node = figma.getNodeById(nodeId);
    if (node === null) {
      figma.notify('Node not found');
      return;
    }
    if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
      return;
    }
    const sceneNode = node as SceneNode;
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
    figma.currentPage.selection = [sceneNode];
  });

  on(Message.NAVIGATE_TO_NODE, (payload: { nodeId: string }) => {
    const node = figma.getNodeById(payload.nodeId);
    if (node === null) {
      figma.notify('Frame not found');
      return;
    }
    if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
      return;
    }
    const sceneNode = node as SceneNode;
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
    figma.currentPage.selection = [sceneNode];
  });

  on(Message.API_KEY, (apiKey: string) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    figma.clientStorage.setAsync('API_KEY', apiKey);
  });

  on(Message.SECRET_KEY, (secretKey: string) => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    figma.clientStorage.setAsync('SECRET_KEY', secretKey);
  });

  // CHANGE_TAB no longer auto-resizes — the user can size the plugin freely
  // (via the resize handle / minimize button) and that size should survive
  // tab switches. The message is still emitted by ui.tsx for analytics
  // purposes; main is intentionally a no-op listener.

  on(Message.UI_RESIZE, (payload: { width: number; height: number; persist?: boolean }) => {
    const w = Math.max(1, Math.round(payload.width));
    const h = Math.max(1, Math.round(payload.height));
    figma.ui.resize(w, h);
    if (payload.persist === true) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      figma.clientStorage.setAsync('uiSize', { width: w, height: h });
    }
  });

  on(Message.NOTIFY_MESSAGE, (message: string, durationSeconds: number | undefined = undefined) => {
    figma.notify(message, { timeout: durationSeconds });
  });

  on(Message.REQUEST_SELECTION_STATE, () => {
    emitSelection();
  });

  figma.on('selectionchange', () => emitSelection(true));
}

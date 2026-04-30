import { EventMapping, EventMetadata, NodeMarker, PluginData } from 'src/types/event';

export type EventMappings = Record<string, EventMapping[]>;

export interface InitialData {
  initialApiKey: string;
  initialSecretKey: string;
  initialEvents: EventMetadata[];
  initialMappings: EventMappings;
  initialNamesVisible: boolean;
  initialUiSize: { width: number; height: number } | null;
}

// Walks up the parent chain to find the top-level Frame (the page-direct
// child). Returns the ancestor itself; falls back to the node when it is
// already at the page root or has no parent.
export function findScreenNode(node: BaseNode): BaseNode {
  let current: BaseNode = node;
  while (current.parent !== null && current.parent.type !== 'PAGE') {
    current = current.parent;
  }
  return current;
}

export function findScreenName(node: BaseNode): string {
  return findScreenNode(node).name;
}

// Builds a breadcrumb of ancestor names from (just below the screen frame)
// down to the node, joined with " > ". For a node that is itself the screen
// frame, returns its own name.
export function buildBreadcrumb(node: BaseNode): string {
  const names: string[] = [];
  let current: BaseNode | null = node;
  while (current !== null && current.parent !== null && current.parent.type !== 'PAGE') {
    names.unshift(current.name);
    current = current.parent;
  }
  if (names.length === 0) return node.name;
  return names.join(' > ');
}

export function buildMappingForNode(node: BaseNode, cardId: string): EventMapping {
  const screen = findScreenNode(node);
  return {
    nodeId: node.id,
    nodeName: node.name,
    screenName: screen.name,
    frameId: screen.id,
    breadcrumb: buildBreadcrumb(node),
    cardId,
  };
}

const MARKERS = [NodeMarker.NAME, NodeMarker.TRIGGER, NodeMarker.DESCRIPTION, NodeMarker.NOTES];

export function findLabelsForEvent(pluginData: PluginData): string[] {
  return MARKERS.map((marker): string => {
    const markedNode = figma.getNodeById(pluginData[marker]);

    if (markedNode !== null && 'characters' in markedNode) {
      return markedNode.characters;
    }
    return '';
  });
}

export interface LoadedEvents {
  events: EventMetadata[];
  mappings: EventMappings;
}

export function loadEvents(): LoadedEvents {
  const events: EventMetadata[] = [];
  const mappings: EventMappings = {};
  const eventGroup = figma.getNodeById(figma.currentPage.getPluginData('event_group')) as GroupNode | null;
  eventGroup?.children.forEach((child) => {
    try {
      // Prefer the full EventMetadata JSON snapshot when present (newer cards
      // store this so minimized cards can drop their hidden text nodes). Fall
      // back to NodeMarker → text-node lookups for legacy cards.
      let event: EventMetadata | null = null;
      const eventDataStr = child.getPluginData('eventData');
      if (eventDataStr.length > 0) {
        try {
          event = JSON.parse(eventDataStr) as EventMetadata;
        } catch {
          event = null;
        }
      }

      if (event === null) {
        const potentialPluginData = child.getPluginData('eventMetadata');
        if (potentialPluginData.length === 0) return;
        const pluginData = JSON.parse(potentialPluginData) as PluginData;
        const [name, trigger, description, notes] = findLabelsForEvent(pluginData);
        event = {
          name,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          trigger: trigger as any,
          description,
          notes,
        };
      }

      events.push(event);

      const clientNodeId = child.getPluginData('clientNodeId');
      if (clientNodeId.length > 0) {
        const clientNode = figma.getNodeById(clientNodeId);
        if (clientNode !== null) {
          // cardId is empty for legacy cards created before the cardId
          // migration. The UI will simply skip emitting TOGGLE_CARD for
          // those — the user gets a no-op until the card is re-created.
          const cardId = child.getPluginData('cardId');
          const list = mappings[event.name] ?? [];
          list.push(buildMappingForNode(clientNode, cardId));
          mappings[event.name] = list;
        }
      }
    } catch (err) {
      return null;
    }
  });

  return { events, mappings };
}

export async function loadInitialData(): Promise<InitialData> {
  const initialApiKey: string = (await figma.clientStorage.getAsync('API_KEY')) as string;
  const initialSecretKey: string = (await figma.clientStorage.getAsync('SECRET_KEY')) as string;
  const { events, mappings } = loadEvents();
  const namesHidden = figma.currentPage.getPluginData('namesHidden') === 'true';
  const storedSize = await figma.clientStorage.getAsync('uiSize');
  const initialUiSize = (typeof storedSize === 'object'
    && storedSize !== null
    && typeof (storedSize as { width: unknown }).width === 'number'
    && typeof (storedSize as { height: unknown }).height === 'number')
    ? storedSize as { width: number; height: number }
    : null;
  return {
    initialApiKey,
    initialSecretKey,
    initialEvents: events,
    initialMappings: mappings,
    initialNamesVisible: !namesHidden,
    initialUiSize,
  };
}

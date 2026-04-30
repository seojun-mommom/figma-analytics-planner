import { COLORS } from 'src/lib/color';
import { EventMetadata, EventProperty, NodeMarker } from 'src/types/event';

const PADDING_HORIZONTAL = 10;
const PADDING_VERTICAL = 6;
// All visible inter-section gaps inside the card use this same value to keep
// the layout tight. createDetailFrame uses DETAIL_INNER_GAP for label↔value.
const SECTION_GAP = 4;
const DETAIL_INNER_GAP = 2;
const PROPERTIES_GAP = 2;
const LABEL_FONT_SIZE = 10;
const VALUE_FONT_SIZE = 12;
const REQUIRED_PAINT: readonly SolidPaint[] = [{
  blendMode: 'NORMAL',
  color: { r: 217 / 255, g: 80 / 255, b: 80 / 255 },
  opacity: 1,
  type: 'SOLID',
  visible: true,
}];

// Card dimensions. Cards have a fixed width on canvas — collapsed cards use
// ellipsis on the name when it overflows, expanded cards keep the same width
// and grow vertically. CARD_HEIGHT_COLLAPSED is a conservative estimate used
// only to seed the vertical-stacking placement when a node has multiple
// mappings; actual card heights are read back from the canvas.
const CARD_WIDTH = 240;
const CARD_WIDTH_MINIMIZED = 220;
const CARD_HEIGHT_COLLAPSED = 32;
const CARD_HEIGHT_EXPANDED = 420;
const CARD_CORNER_RADIUS = 6;
const CARD_STROKE_REGULAR = 1;
const CARD_STROKE_LEFT_ACCENT = 3;

const LOGO_SIZE = 14;
const MOMMOM_LOGO_SVG = `<svg width="130" height="130" viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg">
<path d="M121.32 66.3459C110.954 40.7814 88.4211 40.776 79.8959 18.1565C70.3105 -7.27613 30.3842 -4.9001 20.5474 18.4843C14.3772 33.1527 7.34946 46.1576 6.32906 65.2708C4.6085 97.4998 28.0776 124.286 59.8919 129.178C94.7538 134.539 137.186 105.475 121.32 66.3459Z" fill="url(#paint0_linear_4684_2169)"/>
<path d="M38.5986 87.1858C8.80869 72.3691 29.6095 42.7054 45.9482 61.8388C48.2307 64.5116 49.5219 65.685 53.6848 65.1251C62.4623 63.9443 71.5965 70.1217 66.5899 80.8152C63.0674 88.3389 47.7694 90.5872 38.5986 87.1858Z" fill="#FFAB86" fill-opacity="0.6"/>
<path d="M49.1748 34.5413C48.8996 33.8786 49.7477 33.3278 50.2793 33.824C57.769 40.8397 64.1823 36.8248 67.2021 34.0017C67.7296 33.5088 68.5869 34.0732 68.3003 34.7253C66.729 38.301 63.0535 40.8127 58.7725 40.8127C54.4199 40.8116 50.6993 38.2135 49.1748 34.5413Z" fill="#3C2D25"/>
<path d="M50.6982 21.573C51.7289 21.5732 52.5645 23.5049 52.5645 25.8831C52.5641 28.2606 51.7288 30.1865 50.6982 30.1868C49.6675 30.1868 48.8323 28.2608 48.832 25.8831C48.832 23.5047 49.6673 21.573 50.6982 21.573Z" fill="#3C2D25"/>
<path d="M66.2056 21.573C67.2355 21.5756 68.0718 23.5064 68.0718 25.8831C68.0715 28.2592 67.2353 30.1841 66.2056 30.1868C65.175 30.1868 64.3397 28.2608 64.3394 25.8831C64.3394 23.5047 65.1748 21.573 66.2056 21.573Z" fill="#3C2D25"/>
<defs>
<linearGradient id="paint0_linear_4684_2169" x1="65.4936" y1="48.4758" x2="65.4936" y2="129.817" gradientUnits="userSpaceOnUse">
<stop stop-color="#FF773D"/>
<stop offset="1" stop-color="#E1561B"/>
</linearGradient>
</defs>
</svg>`;

function createLogo(): FrameNode {
  const node = figma.createNodeFromSvg(MOMMOM_LOGO_SVG);
  node.name = 'logo';
  node.rescale(LOGO_SIZE / node.width);
  return node;
}

function createTextNode(str: string): TextNode {
  const text = figma.createText();
  text.fontName = { family: 'Inter', style: 'Regular' };
  text.insertCharacters(0, str);
  text.textAutoResize = 'HEIGHT';
  return text;
}

function createDetailFrame(title: string, data: string): FrameNode {
  const container = figma.createFrame();
  const titleTextNode = createTextNode(title.toUpperCase());
  const dataTextNode = createTextNode(data);
  titleTextNode.fontSize = LABEL_FONT_SIZE;
  titleTextNode.fills = COLORS.GRAY;
  dataTextNode.fontSize = VALUE_FONT_SIZE;

  container.layoutMode = 'VERTICAL';
  container.name = `${title} group`;
  container.itemSpacing = DETAIL_INNER_GAP;

  // Lets content stretch to fill parent container
  container.layoutAlign = 'STRETCH';
  titleTextNode.layoutAlign = 'STRETCH';
  dataTextNode.layoutAlign = 'STRETCH';

  container.appendChild(titleTextNode);
  container.appendChild(dataTextNode);
  return container;
}

// Renders a single property as one TextNode like "age  any  required".
// Using one node (not a horizontal frame of three) avoids truncation on
// narrow cards: the text wraps as one block via textAutoResize='HEIGHT'.
// Color differentiation for type and required is applied via setRangeFills.
function createPropertyLine(prop: EventProperty): TextNode {
  const namePart = prop.name;
  const typePart = prop.valueType !== '' ? `  ${prop.valueType}` : '';
  const reqPart = prop.required ? '  required' : '';
  const fullText = namePart + typePart + reqPart;

  const node = createTextNode(fullText);
  node.fontSize = VALUE_FONT_SIZE;
  node.layoutAlign = 'STRETCH';

  if (typePart !== '') {
    const start = namePart.length;
    const end = start + typePart.length;
    node.setRangeFills(start, end, [...COLORS.GRAY]);
  }
  if (reqPart !== '') {
    const start = namePart.length + typePart.length;
    const end = fullText.length;
    node.setRangeFills(start, end, [...REQUIRED_PAINT]);
  }

  return node;
}

// Renders a "PROPERTIES" section: small uppercase label followed by every
// property tightly packed (PROPERTIES_GAP between rows). The card height
// grows with the property count — there is no cap or "+N more" indicator.
function createPropertiesSection(properties: EventProperty[]): FrameNode {
  const section = figma.createFrame();
  section.layoutMode = 'VERTICAL';
  section.layoutAlign = 'STRETCH';
  section.itemSpacing = DETAIL_INNER_GAP;

  const label = createTextNode('PROPERTIES');
  label.fontSize = LABEL_FONT_SIZE;
  label.fills = COLORS.GRAY;
  label.layoutAlign = 'STRETCH';
  section.appendChild(label);

  const rows = figma.createFrame();
  rows.layoutMode = 'VERTICAL';
  rows.layoutAlign = 'STRETCH';
  rows.itemSpacing = PROPERTIES_GAP;
  section.appendChild(rows);

  for (const prop of properties) {
    rows.appendChild(createPropertyLine(prop));
  }

  return section;
}

// Stamps every node in the card subtree with both 'cardEventName' and
// 'cardId' pluginData. handlers.ts uses cardEventName as a robust fallback
// when walking up from a deep child selection; cardId is the lookup key
// for TOGGLE_CARD (so the UI can target a specific card across the page
// without knowing which Figma node holds it). The cardId is read from the
// group itself — createLabel is responsible for setting it before the
// first call to this function. Called whenever the card content is
// (re)created so freshly-built descendants inherit both stamps.
function tagCardWithEventName(group: GroupNode, eventName: string): void {
  const cardId = group.getPluginData('cardId');
  group.setPluginData('cardEventName', eventName);
  const tagRecursive = (node: SceneNode): void => {
    node.setPluginData('cardEventName', eventName);
    if (cardId.length > 0) {
      node.setPluginData('cardId', cardId);
    }
    if ('children' in node) {
      for (const child of node.children) {
        tagRecursive(child);
      }
    }
  };
  for (const child of group.children) {
    tagRecursive(child);
  }
}

function addToAmplitudeGroup(newLabel: GroupNode): void {
  let groupedLabels = figma.currentPage.findOne(n => n.name === 'Amplitude Event Labels') as (GroupNode | null);
  if (groupedLabels === null) {
    groupedLabels = figma.group([newLabel], figma.currentPage);
    groupedLabels.name = 'Amplitude Event Labels';
    groupedLabels.locked = true;
    groupedLabels.expanded = false;
    figma.currentPage.setPluginData('event_group', groupedLabels.id);
  } else {
    groupedLabels.appendChild(newLabel);
  }
}

interface Placement { x: number; y: number; }
interface Rect { x: number; y: number; width: number; height: number; }

const CARD_GAP = 8;

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width + CARD_GAP
    && a.x + a.width + CARD_GAP > b.x
    && a.y < b.y + b.height + CARD_GAP
    && a.y + a.height + CARD_GAP > b.y;
}

function getExistingCardBounds(): Rect[] {
  const group = figma.currentPage.findOne((n) => n.name === 'Amplitude Event Labels') as GroupNode | null;
  if (group === null) return [];
  const bounds: Rect[] = [];
  for (const child of group.children) {
    if ('width' in child && 'height' in child) {
      bounds.push({
        x: child.absoluteTransform[0][2],
        y: child.absoluteTransform[1][2],
        width: child.width,
        height: child.height,
      });
    }
  }
  return bounds;
}

// Returns the lowest y >= baseY where a CARD_WIDTH × CARD_HEIGHT_COLLAPSED
// rect at column x does not overlap any existing card.
function findVerticalSlot(x: number, baseY: number, existing: Rect[]): number {
  let y = baseY;
  while (true) {
    const candidate: Rect = { x, y, width: CARD_WIDTH, height: CARD_HEIGHT_COLLAPSED };
    const collides = existing.some((b) => rectsOverlap(candidate, b));
    if (!collides) return y;
    y += CARD_HEIGHT_COLLAPSED + CARD_GAP;
  }
}

// Anchor the card to the right edge of the mapped node, top-aligned with the
// node. Multiple mappings on (or near) the same anchor stack downward via
// findVerticalSlot. The card itself never overlaps the node since it sits to
// the right of node.x + node.width.
function computePlacement(clientNode: SceneNode): Placement {
  const x = clientNode.absoluteTransform[0][2] + clientNode.width;
  const baseY = clientNode.absoluteTransform[1][2];
  const y = findVerticalSlot(x, baseY, getExistingCardBounds());
  return { x, y };
}

// Builds the card's header row: logo + event name. The row stretches to the
// fixed parent width (CARD_WIDTH - 2 × PADDING_HORIZONTAL); the logo holds
// its natural size and the name fills the remainder via layoutGrow.
// Truncation/multiline behavior on the name is set later by drawCollapsedCard
// or drawExpandedCard, which is the only place that knows the current state.
function buildHeaderRow(eventName: string): { row: FrameNode; nameNode: TextNode } {
  const row = figma.createFrame();
  row.layoutMode = 'HORIZONTAL';
  row.primaryAxisSizingMode = 'FIXED';
  row.counterAxisSizingMode = 'AUTO';
  row.layoutAlign = 'STRETCH';
  row.counterAxisAlignItems = 'CENTER';
  row.itemSpacing = 6;

  const logo = createLogo();
  logo.layoutGrow = 0;
  row.appendChild(logo);

  const nameNode = createTextNode(eventName);
  nameNode.fontSize = 14;
  // Width is driven by layoutGrow (fills remaining row space); height grows
  // when the name wraps. drawCollapsedCard then turns wrapping off via
  // textTruncation='ENDING' + maxLines=1; drawExpandedCard re-enables wrap.
  nameNode.textAutoResize = 'HEIGHT';
  nameNode.layoutGrow = 1;
  nameNode.setPluginData(NodeMarker.NAME, NodeMarker.NAME);
  row.appendChild(nameNode);

  return { row, nameNode };
}

// Padding for the minimized "pill" — height should hug the event name text.
const MINIMIZED_PADDING_VERTICAL = 8;
const MINIMIZED_PADDING_HORIZONTAL = 12;
// Tight padding for the "logo only" / "Hide Names" mode so the card hugs the
// logo glyph at the corner of the mapped node.
const LOGO_ONLY_PADDING = 4;

// Builds a logo-only card body. Used when the user has globally hidden names
// via the All Events toggle: the card collapses to just the brand mark at
// the corner of the mapped node.
function buildLogoOnlyContent(container: FrameNode): {[key: string]: string} {
  container.appendChild(createLogo());
  return {};
}

// Builds a minimized "pill" — only the event name is rendered. We don't append
// the other text nodes here (Trigger/Description/Notes); their data is
// preserved via the 'eventData' JSON pluginData on the group, which the loader
// reads first. The pill's height = name text height + 2×MINIMIZED_PADDING_VERTICAL.
function buildMinimizedCardContent(
  container: FrameNode,
  event: EventMetadata
): {[key: string]: string} {
  const pluginData: {[key: string]: string} = {};
  const { row, nameNode } = buildHeaderRow(event.name);
  pluginData[NodeMarker.NAME] = nameNode.id;
  container.appendChild(row);
  return pluginData;
}

// Collapsed body: just the event name in the header row, single line with
// trailing-ellipsis truncation when the name overflows the fixed card width.
// Description/Trigger/etc. are not rendered; consumers (selection banner,
// loader) read the full event from the group's 'eventData' JSON pluginData.
function drawCollapsedCard(container: FrameNode, event: EventMetadata): {[key: string]: string} {
  const pluginData: {[key: string]: string} = {};
  const { row, nameNode } = buildHeaderRow(event.name);
  nameNode.textTruncation = 'ENDING';
  nameNode.maxLines = 1;
  pluginData[NodeMarker.NAME] = nameNode.id;
  container.appendChild(row);
  return pluginData;
}

// Expanded body: populated fields render in the order
// name → Trigger → Activity → Properties (capped at MAX_PROPERTIES_VISIBLE) →
// Description. The pluginData map only carries NAME (and DESCRIPTION/TRIGGER
// when their detail frames are present) — full field recovery is handled
// from 'eventData' JSON in handlers.ts and loader.ts.
function drawExpandedCard(container: FrameNode, event: EventMetadata): {[key: string]: string} {
  const pluginData: {[key: string]: string} = {};

  const { row, nameNode } = buildHeaderRow(event.name);
  // Show the full name, wrapping across as many lines as needed.
  nameNode.textTruncation = 'DISABLED';
  nameNode.maxLines = null;
  pluginData[NodeMarker.NAME] = nameNode.id;
  container.appendChild(row);

  const trigger = createDetailFrame('Trigger', event.trigger);
  pluginData[NodeMarker.TRIGGER] = trigger.children[1].id;
  container.appendChild(trigger);

  if (event.activity !== undefined && event.activity !== '') {
    container.appendChild(createDetailFrame('Activity', event.activity));
  }

  if (event.properties !== undefined && event.properties.length > 0) {
    container.appendChild(createPropertiesSection(event.properties));
  }

  if (event.description !== '') {
    const description = createDetailFrame('Description', event.description);
    pluginData[NodeMarker.DESCRIPTION] = description.children[1].id;
    container.appendChild(description);
  }

  return pluginData;
}

/**
 * Creates event label and adds it to the page.
 * @param event event that label represents
 * @param clientNode associated Figma node that event is attached to
 * @returns the unique cardId stamped on the new card (and every descendant).
 *   Callers attach this id to the EventMapping so the UI can later target
 *   this specific card via TOGGLE_CARD.
 */
export async function createLabel(event: EventMetadata, clientNode: SceneNode): Promise<string> {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const container = figma.createFrame();
  container.name = 'Label';
  container.layoutMode = 'VERTICAL';
  // Card width is fixed in both collapsed and expanded states; only the
  // height grows when expanded. Header-row name uses ellipsis when collapsed
  // and wraps when expanded — see drawCollapsedCard / drawExpandedCard.
  container.counterAxisSizingMode = 'FIXED';
  container.primaryAxisSizingMode = 'AUTO';
  container.horizontalPadding = PADDING_HORIZONTAL;
  container.verticalPadding = PADDING_VERTICAL;
  container.itemSpacing = SECTION_GAP;
  container.cornerRadius = CARD_CORNER_RADIUS;
  container.fills = COLORS.WHITE;

  const placement = computePlacement(clientNode);
  container.x = placement.x;
  container.y = placement.y;

  // Brand-colored 1px border with a 3px left accent strip ("Option A" style)
  // for ownership signaling on the canvas.
  container.strokes = COLORS.BRAND;
  container.strokeAlign = 'INSIDE';
  container.strokeTopWeight = CARD_STROKE_REGULAR;
  container.strokeRightWeight = CARD_STROKE_REGULAR;
  container.strokeBottomWeight = CARD_STROKE_REGULAR;
  container.strokeLeftWeight = CARD_STROKE_LEFT_ACCENT;

  container.resize(CARD_WIDTH, container.height);
  const pluginData = drawCollapsedCard(container, event);

  const group = figma.group([container], figma.currentPage);
  group.name = `${event.name}`;
  addToAmplitudeGroup(group);

  // Per spec: cardId = eventName + "_" + Date.now(). Stamped on the group
  // *before* tagCardWithEventName so the helper can fan it out to every
  // descendant in the same recursion. Used by TOGGLE_CARD to find the card
  // group via figma.currentPage.findAll without a clientNodeId round-trip.
  const cardId = `${event.name}_${Date.now()}`;
  group.setPluginData('cardId', cardId);

  // Store label with event data and associated client node id
  group.setPluginData('eventMetadata', JSON.stringify(pluginData));
  group.setPluginData('eventData', JSON.stringify(event));
  group.setPluginData('clientNodeId', clientNode.id);
  group.setPluginData('isExpanded', 'false');

  // If the user has globally hidden names, the freshly drawn full-collapsed
  // body needs to be re-rendered as logo-only so the new card matches every
  // other card on the page. renderCardFromState re-stamps cardEventName too.
  if (figma.currentPage.getPluginData('namesHidden') === 'true') {
    await renderCardFromState(group);
  } else {
    tagCardWithEventName(group, event.name);
  }

  return cardId;
}

// Rebuilds a card's visible content from its current pluginData state.
// Honors both isMinimized and isExpanded flags. The card group must have been
// created via createLabel (i.e. has 'eventData' plugin data).
async function renderCardFromState(group: GroupNode): Promise<void> {
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

  const eventDataStr = group.getPluginData('eventData');
  if (eventDataStr.length === 0) return;

  let event: EventMetadata;
  try {
    event = JSON.parse(eventDataStr) as EventMetadata;
  } catch {
    return;
  }

  const container = group.children.find((c) => c.type === 'FRAME') as FrameNode | undefined;
  if (container === undefined) return;

  for (const child of [...container.children]) {
    child.remove();
  }

  const namesHidden = figma.currentPage.getPluginData('namesHidden') === 'true';
  const isMinimized = group.getPluginData('isMinimized') === 'true';
  const isExpanded = group.getPluginData('isExpanded') === 'true';

  let pluginData: {[key: string]: string};
  if (namesHidden) {
    // Logo-only mode wins over isMinimized/isExpanded: the user has globally
    // chosen to hide names, so collapse every card to just the brand mark.
    container.verticalPadding = LOGO_ONLY_PADDING;
    container.horizontalPadding = LOGO_ONLY_PADDING;
    container.itemSpacing = 0;
    container.counterAxisSizingMode = 'AUTO';
    container.primaryAxisSizingMode = 'AUTO';
    pluginData = buildLogoOnlyContent(container);
  } else if (isMinimized) {
    container.verticalPadding = MINIMIZED_PADDING_VERTICAL;
    container.horizontalPadding = MINIMIZED_PADDING_HORIZONTAL;
    container.itemSpacing = 0;
    pluginData = buildMinimizedCardContent(container, event);
    container.resize(CARD_WIDTH_MINIMIZED, container.height);
  } else {
    container.verticalPadding = PADDING_VERTICAL;
    container.horizontalPadding = PADDING_HORIZONTAL;
    container.itemSpacing = SECTION_GAP;
    container.counterAxisSizingMode = 'FIXED';
    container.primaryAxisSizingMode = 'AUTO';
    container.resize(CARD_WIDTH, container.height);
    pluginData = isExpanded
      ? drawExpandedCard(container, event)
      : drawCollapsedCard(container, event);
  }

  group.setPluginData('eventMetadata', JSON.stringify(pluginData));
  // Re-stamp cardEventName on every fresh child so canvas selection of any
  // inner node still resolves to this event.
  tagCardWithEventName(group, event.name);
}

export async function setCardExpansion(group: GroupNode, isExpanded: boolean): Promise<void> {
  group.setPluginData('isExpanded', isExpanded ? 'true' : 'false');
  // Expanding/collapsing implicitly restores from minimized state.
  if (group.getPluginData('isMinimized') === 'true') {
    group.setPluginData('isMinimized', 'false');
  }
  await renderCardFromState(group);
}

export async function minimizeCard(group: GroupNode): Promise<void> {
  group.setPluginData('isMinimized', 'true');
  await renderCardFromState(group);
}

export async function restoreCard(group: GroupNode): Promise<void> {
  group.setPluginData('isMinimized', 'false');
  await renderCardFromState(group);
}

function findEventGroups(eventName: string): GroupNode[] {
  const groupedLabels = figma.currentPage.findOne((n) => n.name === 'Amplitude Event Labels') as GroupNode | null;
  if (groupedLabels === null) return [];
  const matches: GroupNode[] = [];
  for (const child of groupedLabels.children) {
    if (child.type === 'GROUP' && child.name === eventName) {
      matches.push(child);
    }
  }
  return matches;
}

function findGroupByClientNodeId(nodeId: string): GroupNode | null {
  const groupedLabels = figma.currentPage.findOne((n) => n.name === 'Amplitude Event Labels') as GroupNode | null;
  if (groupedLabels === null) return null;
  for (const child of groupedLabels.children) {
    if (child.type === 'GROUP' && child.getPluginData('clientNodeId') === nodeId) {
      return child;
    }
  }
  return null;
}

export async function setCardExpansionByNodeId(nodeId: string, isExpanded: boolean): Promise<void> {
  const group = findGroupByClientNodeId(nodeId);
  if (group !== null) await setCardExpansion(group, isExpanded);
}

// Locates a card group by the cardId stamped on its pluginData. Per the
// TOGGLE_CARD spec, scans the whole page via findAll — the matched set
// contains the group itself (which carries cardId) plus every descendant
// (also carrying cardId via tagCardWithEventName); we pick the GROUP entry.
function findGroupByCardId(cardId: string): GroupNode | null {
  if (cardId.length === 0) return null;
  const matches = figma.currentPage.findAll((n) => n.getPluginData('cardId') === cardId);
  for (const match of matches) {
    if (match.type === 'GROUP') return match;
  }
  return null;
}

export async function setCardExpansionByCardId(cardId: string, isExpanded: boolean): Promise<void> {
  const group = findGroupByCardId(cardId);
  if (group !== null) await setCardExpansion(group, isExpanded);
}

export async function setMinimizedByEventName(eventName: string, isMinimized: boolean): Promise<void> {
  for (const group of findEventGroups(eventName)) {
    if (isMinimized) {
      await minimizeCard(group);
    } else {
      await restoreCard(group);
    }
  }
}

// Persists the "names hidden" flag on the current page and re-renders every
// card so they switch to logo-only or back to their normal state. Called by
// the TOGGLE_LABEL_NAMES message handler.
export async function applyNamesVisibility(visible: boolean): Promise<void> {
  figma.currentPage.setPluginData('namesHidden', visible ? '' : 'true');
  const group = figma.currentPage.findOne((n) => n.name === 'Amplitude Event Labels') as GroupNode | null;
  if (group === null) return;
  for (const child of group.children) {
    if (child.type === 'GROUP') {
      await renderCardFromState(child);
    }
  }
}

// Removes the event label group whose clientNodeId matches the given nodeId.
// Returns true when a matching group was found and removed, false otherwise.
export function removeMappingByNodeId(nodeId: string): boolean {
  const group = findGroupByClientNodeId(nodeId);
  if (group === null) return false;
  group.remove();
  return true;
}

export { CARD_WIDTH, CARD_WIDTH_MINIMIZED, CARD_HEIGHT_COLLAPSED, CARD_HEIGHT_EXPANDED };

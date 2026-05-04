import { showUI } from '@create-figma-plugin/utilities';

import { Tab, REGULAR_TAB_SIZE } from 'src/types/tab';
import { loadInitialData } from 'src/lib/loader';
import { attachHandlers } from 'src/lib/handlers';

export default async function (): Promise<void> {
  attachHandlers();
  const initialData = await loadInitialData();
  const size = initialData.initialUiSize ?? REGULAR_TAB_SIZE;
  showUI(size, { ...initialData, initialTab: Tab.OVERVIEW, initialUiSize: size });
}

export enum Tab {
  ADD_EVENT = 'Create Event',
  ALL_EVENTS = 'All Events',
  OVERVIEW = 'Overview',
  IMPORT_EVENTS = 'Import',
  SETTINGS = 'Settings',
  TUTORIAL = 'Tutorial',
}
interface UIOption {
  width: number,
  height: number
}

export const REGULAR_TAB_SIZE: UIOption = { width: 460, height: 480 };
export const TUTORIAL_TAB_SIZE: UIOption = { width: 460, height: 555 };

export const TAB_OPTIONS: { [key in Tab]: UIOption} = {
  [Tab.ADD_EVENT]: REGULAR_TAB_SIZE,
  [Tab.ALL_EVENTS]: REGULAR_TAB_SIZE,
  [Tab.OVERVIEW]: REGULAR_TAB_SIZE,
  [Tab.IMPORT_EVENTS]: REGULAR_TAB_SIZE,
  [Tab.SETTINGS]: REGULAR_TAB_SIZE,
  [Tab.TUTORIAL]: TUTORIAL_TAB_SIZE,
};

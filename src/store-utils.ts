import { Store } from '@tauri-apps/plugin-store';

let storePromise: Promise<Store> | null = null;

export const getSettingsStore = async (): Promise<Store> => {
  if (!storePromise) {
    storePromise = (async () => {
      try {
        const store = await Store.load('settings.json');
        return store;
      } catch (e) {
        console.warn('Failed to load settings.json, creating new store:', e);
        // @ts-ignore
        const store = new Store('settings.json');
        await store.save();
        return store;
      }
    })();
  }
  return storePromise;
};

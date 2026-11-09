import { ipcMain } from 'electron';
import Store from 'electron-store';

type FlatUserStore = Record<string, string>;

export function cfgStore(): void {

  const stores = {
    stat: new Store<FlatUserStore>({ name: 'x-stats' }),
    item: new Store<FlatUserStore>({ name: 'net-items' })
  };

  // Dynamically register standard CRUD operations for both stores
  Object.entries(stores).forEach(([prefix, store]) => {
    ipcMain.handle(`${prefix}-store-get`, (_, key: string) => store.get(key) ?? null);
    ipcMain.on(`${prefix}-store-set`, (_, key: string, value: string) => store.set(key, value));
    ipcMain.on(`${prefix}-store-delete`, (_, key: string) => store.delete(key));
    ipcMain.on(`${prefix}-store-clear`, () => store.clear());

    // Optimized metadata handlers using native electron-store properties
    ipcMain.handle(`${prefix}-store-get-all`, () => store.store);
    ipcMain.handle(`${prefix}-store-get-keys`, () => Object.keys(store.store));
    ipcMain.handle(`${prefix}-store-get-values`, () => Object.values(store.store));
    ipcMain.handle(`${prefix}-store-get-size`, () => store.size);
  });
}


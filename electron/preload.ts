import {
    contextBridge,
    ipcRenderer,
    IpcRendererEvent
 } from 'electron';

import type { UdpPkt} from './configUDP'

export interface UsbDeviceInfo {
    deviceId: string;
    vendorId: number;
    productId: number;
    productName: string;
    manufacturerName: string;
    serialNumber?: string;
}

// generic interface for the store API
interface StoreApi {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): void;
    delete(key: string): void;
    clear(): void;
    getAll(): Promise<Record<string, string>>;
    getKeys(): Promise<string[]>;
    getValues(): Promise<string[]>;
    getSize(): Promise<number>;
}

// File system API
const fsApi = {
    selectAndSaveBg: (): Promise<string | null> => ipcRenderer.invoke('select-and-save-bg'),
    getSavedBg: (): Promise<string | null> => ipcRenderer.invoke('get-saved-bg')
};

// factory function to eliminate duplication
const createStoreApi = (prefix: string): StoreApi => ({
    get: (key) => ipcRenderer.invoke(`${prefix}-get`, key),
    set: (key, value) => ipcRenderer.send(`${prefix}-set`, key, value),
    delete: (key) => ipcRenderer.send(`${prefix}-delete`, key),
    clear: () => ipcRenderer.send(`${prefix}-clear`),
    getAll: () => ipcRenderer.invoke(`${prefix}-get-all`),
    getKeys: () => ipcRenderer.invoke(`${prefix}-get-keys`),
    getValues: () => ipcRenderer.invoke(`${prefix}-get-values`),
    getSize: () => ipcRenderer.invoke(`${prefix}-get-size`),
});

// USB
const usbApi = {
    onUsbDevicesAvailable: (callback: (devices: UsbDeviceInfo[]) => void): (() => void) => {
        const listener = (_event: IpcRendererEvent, devices: UsbDeviceInfo[]) => {
            callback(Array.isArray(devices) ? devices : []);
        };
        ipcRenderer.on('usb-devices-available', listener);
        return (): void => {
            ipcRenderer.removeListener('usb-devices-available', listener);
        };
    },
    selectUsbDevice: (deviceId: string) => {
        ipcRenderer.send('usb-device-selected', deviceId);
    },
    cancelUsbDevice: () => {
        ipcRenderer.send('usb-device-cancelled');
    },
};

// UDP
const udpApi = {
    send: (pkt: UdpPkt) => {
        ipcRenderer.send('udp-packet-out', pkt);
    },
    onMsg: (callback: (udpPkt: UdpPkt) => void): (() => void) => {
        const listener = (_event: IpcRendererEvent, udpPkt: UdpPkt) => {
            callback(udpPkt);
        }
        ipcRenderer.on('udp-packet-in', listener);
        return (): void => {
            ipcRenderer.removeListener('udp-packet-in', listener);
        };
    },
    close: (msg: string) => {
        ipcRenderer.send('udp-close', msg);
    },
};

// Item store
const itemStoreApi = createStoreApi('item-store');

// Stat store
const statStoreApi = createStoreApi('stat-store');

// export types so the frontend can read it
export type ElectronUSB = typeof usbApi;
export type ElectronUDP = typeof udpApi;
export type ElectronStatStore = typeof statStoreApi;
export type ElectronItemStore = typeof itemStoreApi;
export type ElectronFS = typeof fsApi;

// Publish API
contextBridge.exposeInMainWorld('electronUSB', usbApi);
contextBridge.exposeInMainWorld('electronUDP', udpApi);
contextBridge.exposeInMainWorld('electronStatStore', statStoreApi);
contextBridge.exposeInMainWorld('electronItemStore', itemStoreApi);
contextBridge.exposeInMainWorld('electronFS', fsApi);


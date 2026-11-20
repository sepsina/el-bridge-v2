import { ipcMain, WebContents } from 'electron';
import type { UsbDeviceInfo } from './preload';

let selectDeviceCallback: ((deviceId: string) => void) | null = null;
let ipcRegistered = false;
let selectListener: ((...args: any[]) => void) | null = null;

function resolveSelection(deviceId: string): void {
    if(selectDeviceCallback) {
        selectDeviceCallback(deviceId); // '' cancels navigator.usb.requestDevice()
        selectDeviceCallback = null;
    }
}

export function cfgUSB(contents: WebContents): void {

    // remove a previously registered listener to avoid stacking
    if(selectListener) {
        contents.session.removeListener('select-usb-device', selectListener as any);
    }

    selectListener = (event: Electron.Event, details: Electron.SelectUsbDeviceDetails, callback: (deviceId?: string) => void) => {
        event.preventDefault();
        resolveSelection('');
        selectDeviceCallback = callback;

        if(contents.isDestroyed()) return;

        const devices: UsbDeviceInfo[] = details.deviceList.map((d) => ({
            deviceId: d.deviceId,
            vendorId: d.vendorId,
            productId: d.productId,
            productName: d.productName ?? 'Unknown Device',
            manufacturerName: d.manufacturerName ?? '',
            serialNumber: d.serialNumber,
        }));
        contents.send('usb-devices-available', devices);
    };

    contents.session.on('select-usb-device', selectListener as any);
    contents.once('destroyed', () => resolveSelection(''));

    // grant only WebUSB-related permissions
    contents.session.setPermissionCheckHandler((_wc, permission) => permission === 'usb');
    contents.session.setDevicePermissionHandler((details) => details.deviceType === 'usb');

     // register global IPC listeners only once
    if(ipcRegistered) return;
    ipcRegistered = true;

    ipcMain.on('usb-device-selected', (_event, deviceId: string) => resolveSelection(deviceId));
    ipcMain.on('usb-device-cancelled', () => resolveSelection(''));

}

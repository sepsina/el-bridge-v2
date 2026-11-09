import { ipcMain, WebContents } from 'electron';

let selectDeviceCallback: any = null;

export function cfgUSB(contents: WebContents): void {

    // intercept the USB device selection request
    contents.session.on('select-usb-device', (event, details, callback) => {
        event.preventDefault();
        selectDeviceCallback = callback; // store callback to resolve user selection
        contents.send('usb-devices-available', details.deviceList);
    });

    // grant necessary WebUSB permissions
    contents.session.setPermissionCheckHandler(() => true);
    contents.session.setDevicePermissionHandler(() => true);

    // receive the user's selection from the custom UI picker
    ipcMain.on('usb-device-selected', (event, device_id) => {
        if(selectDeviceCallback) {
            selectDeviceCallback(device_id); // resolves navigator.usb.requestDevice()
            selectDeviceCallback = null;
        }
    });

    // cancel selection if the picker UI is closed or cancelled
    ipcMain.on('usb-device-cancelled', () => {
        if(selectDeviceCallback) {
            selectDeviceCallback(''); // cancels navigator.usb.requestDevice()
            selectDeviceCallback = null;
        }
    });
}

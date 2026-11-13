import {
    Component,
    OnInit,
    signal,
    computed,
    inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { form, FormField } from '@angular/forms/signals';

import * as gIF from '../gIF';

interface usb_t {
    id: string;
    name: string;
    pid: string;
    vid: string;
    mfg: string;
}

const USB_DUMMY: usb_t = {
    id: '0',
    name: '---',
    pid: '----',
    vid: '----',
    mfg: '---'
};

interface UsbFormModel {
    selectedDeviceIndex: string;
}

@Component({
    selector: 'app-get-usb',
    standalone: true,
    imports: [
        CommonModule,
        FormField,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './sel-usb.html',
    styleUrls: ['./sel-usb.scss'],
    host: {
        '[attr.id]': 'hostID',
    }
})
export class SelUSB implements OnInit {

    readonly hostID = 'get-usb-dlg';

    private readonly dialogRef = inject(DialogRef<string | undefined>);
    private readonly dlgData = inject(DIALOG_DATA);

    readonly usbList = signal<usb_t[]>([USB_DUMMY]);

    private readonly formModel = signal<UsbFormModel>({
        selectedDeviceIndex: '0'
    });

    readonly usbForm = form(this.formModel);

    readonly selectedUsb = computed<usb_t>(() => {
        const index = parseInt(this.formModel().selectedDeviceIndex, 10);
        const devs = this.usbList();
        return devs[index] ?? USB_DUMMY;
    });

    readonly usb_desc = computed<gIF.descVal_t[]>(() => {
        const sel = this.selectedUsb();
        if(sel.id === '0') {
            return [
                { key: 'pid:', value: '----' },
                { key: 'vid:', value: '----' },
                { key: 'mfg:', value: '----' }
            ];
        }
        return [
            { key: 'pid:', value: `0x${sel.pid}` },
            { key: 'vid:', value: `0x${sel.vid}` },
            { key: 'mfg:', value: sel.mfg }
        ];
    });

    ngOnInit(): void {

        const dlgList: Electron.USBDevice[] = this.dlgData.devices ?? [];

        const devs: usb_t[] = dlgList.map((dev) => ({
            id: dev.deviceId,
            name: dev.productName || 'Unknown Device',
            pid: dev.productId.toString(16).padStart(4, '0'),
            vid: dev.vendorId.toString(16).padStart(4, '0'),
            mfg: dev.manufacturerName || '---'
        }));

        this.usbList.set([USB_DUMMY, ...devs]);
        this.formModel.set({ selectedDeviceIndex: '0' });
    }

    select(): void {
        const selectedId = this.selectedUsb().id;
        this.dialogRef.close(selectedId === '0' ? undefined : selectedId);
    }

    close(): void {
        this.dialogRef.close();
    }
}

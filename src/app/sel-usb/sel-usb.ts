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

// Import the native Signal Forms package introduced in Angular 22
import { form, FormField } from '@angular/forms/signals';

//import { StorageService } from '../services/storage.service';
//import { UtilsService } from '../services/utils.service';
//import * as gConst from '../gConst';
import * as gIF from '../gIF';

interface usb_t {
    id: string;
    name: string;
    pid: string;
    vid: string;
    mfg: string;
}

const usb_dummy: usb_t = {
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

    // Services
    //private readonly storage = inject(StorageService);
    //private readonly utils = inject(UtilsService);
    private readonly dialogRef = inject(DialogRef<string | undefined>);
    private readonly dlgData = inject(DIALOG_DATA);

    // List of loaded items tracked inside a plain signal
    readonly usb_devs = signal<usb_t[]>([usb_dummy]);

    // 1. Define the base Form Data state using a standard writable signal
    private readonly formModel = signal<UsbFormModel>({
        selectedDeviceIndex: '0'
    });

    // 2. Initialize the hierarchical FieldTree form tracking structure
    readonly usbForm = form(this.formModel);

    // 3. Extract selections reactively using the derived form signal value
    readonly sel_usb = computed<usb_t>(() => {
        const index = parseInt(this.formModel().selectedDeviceIndex, 10);
        const devs = this.usb_devs();
        return devs[index] ?? usb_dummy;
    });

    // 4. Descriptions automatically compute as form field states change
    readonly usb_desc = computed<gIF.descVal_t[]>(() => {
        const currentUsb = this.sel_usb();
        if (currentUsb.id === '0') {
            return [
                { key: 'pid:', value: '0x----' },
                { key: 'vid:', value: '0x----' },
                { key: 'mfg:', value: '---' }
            ];
        }
        return [
            { key: 'pid:', value: `0x${currentUsb.pid}` },
            { key: 'vid:', value: `0x${currentUsb.vid}` },
            { key: 'mfg:', value: currentUsb.mfg }
        ];
    });

    ngOnInit(): void {
        /*
        if(!this.dlgData?.devices || !Array.isArray(this.dlgData.devices)) {
            return;
        }
        */
        const mappedDevices: usb_t[] = this.dlgData.devices.map((dev: any) => ({
            id: dev.deviceId,
            name: dev.productName || 'Unknown Device',
            pid: (dev.productId ?? 0).toString(16).padStart(4, '0'),
            vid: (dev.vendorId ?? 0).toString(16).padStart(4, '0'),
            mfg: dev.manufacturerName || '---'
        }));

        this.usb_devs.set([usb_dummy, ...mappedDevices]);
        this.formModel.set({ selectedDeviceIndex: '0' });
    }

    select(): void {
        const selectedId = this.sel_usb().id;
        this.dialogRef.close(selectedId === '0' ? undefined : selectedId);
    }

    close(): void {
        this.dialogRef.close();
    }
}

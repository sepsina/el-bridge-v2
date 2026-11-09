import {
    Component,
    inject,
    ChangeDetectionStrategy,
    Inject
} from '@angular/core';

import {
    DialogRef,
    DIALOG_DATA
} from '@angular/cdk/dialog';

import { StorageService } from '../services/storage.service';
import { UsbService } from '../services/usb.service';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop';

import * as gConst from '../gConst';
import * as gIF from '../gIF'

const OFF = 0;
const ON = 1;
const TOGGLE = 2;

@Component({
    selector: 'app-ssr',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './ssr.html',
    styleUrls: ['./ssr.scss'],
    host: {
        '[attr.id]': 'hostID',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SSR  {

    hostID = 'ssr-dlg';

    selItem: gIF.netItem_t;

    //rxBuf = new Uint8Array(1024);
    txBuf = new Uint8Array(1024);
    rwBuf = new gIF.rwBuf_t();

    storage = inject(StorageService);
    usb = inject(UsbService);
    dialogRef = inject(DialogRef);
    dlgData = inject(DIALOG_DATA);

    constructor() {
        this.selItem = this.dlgData.item;
        this.rwBuf.wrBuf = new DataView(this.txBuf.buffer);
    }

    /***********************************************************************************************
     * @fn          close
     *
     * @brief
     *
     */
    close() {
        this.dialogRef.close();
    }

    /***********************************************************************************************
     * @fn          setActuatorOn
     *
     * @brief
     *
     */
    setActuatorOn(){
        this.setActuator(ON);
    }

    /***********************************************************************************************
     * @fn          setActuatorOff
     *
     * @brief
     *
     */
    setActuatorOff(){
        this.setActuator(OFF);
    }

    /***********************************************************************************************
     * @fn          toggleActuator
     *
     * @brief
     *
     */
    toggleActuator(){
        this.setActuator(TOGGLE);
    }

    /***********************************************************************************************
     * @fn          setActuator
     *
     * @brief
     *
     */
    setActuator(state: number){

        this.rwBuf.wrIdx = 0;
        let rnd = Math.random() * 0xFFFFFFFF;

        this.rwBuf.write_uint8(gConst.USB_MSG_EP_CMD);
        for(let i = 0; i < gConst.HOPS_MAX; i++){
            this.rwBuf.write_uint8(this.selItem.hops[i]);
        }
        this.rwBuf.write_uint32_LE(Math.floor(rnd));
        this.rwBuf.write_uint8(this.selItem.endPoint);
        this.rwBuf.write_uint8(1); // cmd_len
        this.rwBuf.write_uint8(state);

        const len = this.rwBuf.wrIdx;
        const frame = this.txBuf.slice(0, len);
        this.usb.addOutFrame(frame);
    }

}

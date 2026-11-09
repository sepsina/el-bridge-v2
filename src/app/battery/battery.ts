import {
    Component,
    OnInit,
    HostBinding,
    inject,
    signal,
    effect,
    ChangeDetectionStrategy
} from '@angular/core';

import {
    DialogRef,
    DIALOG_DATA
} from '@angular/cdk/dialog';

import { UtilsService } from '../services/utils.service';
import { StorageService } from '../services/storage.service';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle} from '@angular/cdk/drag-drop';

import * as gConst from '../gConst';
import * as gIF from '../gIF'

interface dataRow_t {
    id: number;
    label: string;
    value: string;
    color: string;
}

@Component({
    selector: 'app-battery',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './battery.html',
    styleUrls: ['./battery.scss'],
    host: {
        '[attr.id]': 'hostID',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Battery implements OnInit {

    hostID = 'battery-dlg';

    netItem: gIF.netItem_t;

    dataRows = signal<Array<dataRow_t>>([]);
    title = signal('');

    battery_event = effect(()=>{
        const battEvt = this.storage.battEvent();
        setTimeout(()=>{
            this.batteryEvent(battEvt);
        }, 0);
    });

    utils = inject(UtilsService);
    storage = inject(StorageService);
    dialogRef = inject(DialogRef);
    dlgData = inject(DIALOG_DATA);



    constructor() {
        this.netItem = this.dlgData.item as gIF.netItem_t;
        // ---
    }

    /***********************************************************************************************
     * @fn          ngOnInit
     *
     * @brief
     *
     */
    ngOnInit(): void {

        this.title.set(this.netItem.name);
        this.parseBattery(this.netItem.battery);
        /*
        let partDesc: gIF.part_t = this.dlgData.partsMap.get(this.netItem.partNum);
        if(partDesc) {
            const tmp = [];
            tmp.push(`node: ${partDesc.devName}`);
            tmp.push(`part: ${partDesc.part}`);
            //tmp.push(`S/N: ${this.utils.extToHex(attr.extAddr)}`);
            tmp.push(`url: ${partDesc.url}`);
            this.recs.set(tmp);
        }
        */
    }

    /***********************************************************************************************
     * @fn          batteryEvent
     *
     * @brief
     *
     */
    batteryEvent(battEvt: gIF.battEvent_t): void {
        if(battEvt.addr == this.netItem.addr){
            this.parseBattery(battEvt.battery);
        }
    }

    /***********************************************************************************************
     * @fn          parseBattery
     *
     * @brief
     *
     *
    parseBattery_x(battery: gIF.battery_t): void {

        const tmp = [];

        let v_bat = battery.v_bat! / 1024.0 * 5.0;
        tmp.push(`voltage: ${v_bat.toFixed(2)} V`);
        if(battery.rep_size == gIF.eBattRepSize.E_BATT_REP_SIZE_FULL){
            const i_chg = battery.i_chg!;
            const i_bat = (battery.i_bat!) / 1024.0 * (i_chg * 1.25); // * 1.25 for nPM1304
            tmp.push(`i_bat: ${i_bat.toFixed(2)} mA`);

            const chg_mode = (battery.i_bat_status! & 0b00001100) >> 2;
            switch(chg_mode){
                case 0b01: {
                    tmp.push(`chager mode: dischaging`);
                    break;
                }
                case 0b10: {
                    tmp.push(`chager mode: no battery current`);
                    break;
                }
                case 0b11: {
                    tmp.push(`chager mode: charging`);
                    break;
                }
            }

            const chg_scaling = battery.i_bat_status! & 0b00000011;
            switch(chg_scaling){
                case 0b00: {
                    tmp.push(`current scaling: 10%`);
                    break;
                }
                case 0b01: {
                    tmp.push(`current scaling: 50%`);
                    break;
                }
                case 0b11: {
                    tmp.push(`current scaling: 100%`);
                    break;
                }
            }

            const chg_status = battery.chg_status!;
            if(chg_status & 0b00000010){
                tmp.push(`charging status: completed`);
            }
            if(chg_status & 0b00000100){
                tmp.push(`charging status: trickle charge`);
            }
            if(chg_status & 0b00001000){
                tmp.push(`charging status: constant current`);
            }
            if(chg_status & 0b00010000){
                tmp.push(`charging status: constant voltage`);
            }
            if(chg_status & 0b00100000){
                tmp.push(`charging status: battery re-charge`);
            }
            if(chg_status & 0b01000000){
                tmp.push(`charging status: stopped - die temperature high`);
            }
            if(chg_status & 0b10000000){
                tmp.push(`charging status: supplement mode active`);
            }

            const ntc_status = battery.ntc_status!;
            if(ntc_status == 0){
                tmp.push(`battery temp: normal`);
            }
            if(ntc_status & 0b00000001){
                tmp.push(`battery temp: cold`);
            }
            if(ntc_status & 0b00000010){
                tmp.push(`battery temp: cool`);
            }
            if(ntc_status & 0b00000100){
                tmp.push(`battery temp: warm`);
            }
            if(ntc_status & 0b00001000){
                tmp.push(`battery temp: hot`);
            }
        }
        this.recs.set(tmp);
    }
    */
    /***********************************************************************************************
     * @fn          parseBattery
     *
     * @brief
     *
     */
    parseBattery(battery: gIF.battery_t): void {

        let rows: Array<dataRow_t> = [];
        let i = 0;

        let v_bat = battery.v_bat! / 1023.0 * 5.0;
        rows.push({
            id: i++,
            label: 'v_bat:',
            value: `${v_bat.toFixed(2)} V`,
            color: 'red'
        });
        if(battery.rep_size > gConst.SHORT_BAT_REPORT){
            const i_chg = battery.i_chg!;
            const i_bat = (battery.i_bat!) / 1023.0 * (i_chg * 1.25 * 4);
            rows.push({
                id: i++,
                label: 'i_bat:',
                value: `${i_bat.toFixed(2)} mA`,
                color: 'orange'
            });
            const chg_mode = (battery.i_bat_status! & 0b00001100) >> 2;
            switch(chg_mode){
                case 0b01: {
                    rows.push({
                        id: i++,
                        label: 'chager mode:',
                        value: 'dischaging',
                        color: 'blue'
                    });
                    break;
                }
                case 0b10: {
                    rows.push({
                        id: i++,
                        label: 'chager mode:',
                        value: 'no battery current',
                        color: 'blue'
                    });
                    break;
                }
                case 0b11: {
                    rows.push({
                        id: i++,
                        label: 'chager mode:',
                        value: 'charging',
                        color: 'blue'
                    });
                    break;
                }
            }
            const chg_scaling = battery.i_bat_status! & 0b00000011;
            switch(chg_scaling){
                case 0b00: {
                    rows.push({
                        id: i++,
                        label: 'current scaling:',
                        value: '10%',
                        color: 'gray'
                    });
                    break;
                }
                case 0b01: {
                    rows.push({
                        id: i++,
                        label: 'current scaling:',
                        value: '50%',
                        color: 'gray'
                    });
                    break;
                }
                case 0b11: {
                    rows.push({
                        id: i++,
                        label: 'current scaling:',
                        value: '100%',
                        color: 'gray'
                    });
                    break;
                }
            }
            const chg_status = battery.chg_status!;
            if(chg_status & 0b10){
                rows.push({
                    id: i++,
                    label: 'charging status:',
                    value: 'completed',
                    color: 'green'
                });
            }
            if(chg_status & 0b100){
                rows.push({
                    id: i++,
                    label: 'charging status:',
                    value: 'trickle charge',
                    color: 'green'
                });
            }
            if(chg_status & 0b1000){
                rows.push({
                    id: i++,
                    label: 'charging status:',
                    value: 'constant current',
                    color: 'green'
                });
            }
            if(chg_status & 0b10000){
                rows.push({
                    id: i++,
                    label: 'charging status:',
                    value: 'constant voltage',
                    color: 'green'
                });
            }
            if(chg_status & 0b100000){
                rows.push({
                    id: i++,
                    label: 'charging status:',
                    value: 'battery re-charge',
                    color: 'green'
                });
            }
            if(chg_status & 0b1000000){
                rows.push({
                    id: i++,
                    label: 'charging status:',
                    value: 'stopped - die temperature high',
                    color: 'red'
                });
            }
            if(chg_status & 0b10000000){
                rows.push({
                    id: i++,
                    label: 'charging status:',
                    value: 'supplement mode active',
                    color: 'red'
                });
            }
            const ntc_status = battery.ntc_status!;
            if(ntc_status == 0){
                rows.push({
                    id: i++,
                    label: 'battery temp:',
                    value: 'normal',
                    color: 'gray'
                });
            }
            if(ntc_status & 0b1){
                rows.push({
                    id: i++,
                    label: 'battery temp:',
                    value: 'cold',
                    color: 'blue'
                });
            }
            if(ntc_status & 0b10){
                rows.push({
                    id: i++,
                    label: 'battery temp:',
                    value: 'cool',
                    color: 'blue'
                });
            }
            if(ntc_status & 0b100){
                rows.push({
                    id: i++,
                    label: 'battery temp:',
                    value: 'warm',
                    color: 'orange'
                });
            }
            if(ntc_status & 0b1000){
                rows.push({
                    id: i++,
                    label: 'battery temp:',
                    value: 'hot',
                    color: 'red'
                });
            }
        }
        this.dataRows.set(rows);
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

}

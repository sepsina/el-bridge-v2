import {
    Component,
    AfterViewInit,
    signal,
    inject,
    effect,
    untracked
} from '@angular/core';

import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { StorageService } from '../services/storage.service';
import { UtilsService } from '../services/utils.service';

import { CommonModule } from '@angular/common';
import { form, FormField, disabled, min, max, debounce, required } from '@angular/forms/signals';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';

import * as gConst from '../gConst';
import * as gIF from '../gIF';

interface StatFormData {
    statSelIdx: string;
    setPoint: number;
    usedSelIdx: string;
    freeSelIdx: string;
}

@Component({
    selector: 'app-stats',
    standalone: true,
    imports: [
        CommonModule,
        FormField,
        CdkDrag,
        CdkDragHandle
    ],
    templateUrl: './x-stat.html',
    styleUrls: ['./x-stat.scss'],
    host: {
        '[attr.id]': 'hostID',
    }
})
export class EditStats implements AfterViewInit {

    hostID = 'x-stat-dlg';
    minSetPoint = 5;
    maxSetPoint = 50;
    validStat = true;

    formDataModel = signal<StatFormData>({
        statSelIdx: '0',
        setPoint: 20,
        usedSelIdx: '0',
        freeSelIdx: '0'
    });

      // 2. Configure the declarative rules within the form builder callback
    statForm = form(this.formDataModel, (schemaPath) => {
        debounce(schemaPath.setPoint, 'blur');
        disabled(schemaPath.setPoint, {
            when: () => !this.validStat
        });
        required(schemaPath.setPoint);
        min(schemaPath.setPoint, this.minSetPoint);
        max(schemaPath.setPoint, this.maxSetPoint);
    });

    thermostatDesc = signal<gIF.descVal_t[]>([]);
    usedDesc = signal<gIF.descVal_t[]>([]);
    freeDesc = signal<gIF.descVal_t[]>([]);

    thermostats = signal<gIF.thermostat_t[]>([]);
    on_off_all: gIF.on_off_actuator_t[] = [];
    on_off_used = signal<gIF.on_off_actuator_t[]>([]);
    on_off_free = signal<gIF.on_off_actuator_t[]>([]);

    selThermostat = {} as gIF.thermostat_t;
    selUsed = {} as gIF.on_off_actuator_t;
    selFree = {} as gIF.on_off_actuator_t;

    storage = inject(StorageService);
    utils = inject(UtilsService);
    dialogRef = inject(DialogRef);
    dlgData = inject(DIALOG_DATA);

    formDataChanged = effect(() => {

        let idx = 0;
        const formData = this.formDataModel();

        untracked(() => {
            // A. React when Thermostat select changes
            idx = parseInt(formData.statSelIdx);
            const currentThermostat = this.thermostats()[idx];
            if(currentThermostat && (currentThermostat !== this.selThermostat)) {
                this.selThermostat = currentThermostat;
                this.setThermostat(this.selThermostat);
                this.setThermostatDesc(this.selThermostat);
            }

            // B. React when Used Actuator select changes
            idx = parseInt(formData.usedSelIdx);
            const currentUsed = this.on_off_used()[idx];
            if(currentUsed && currentUsed !== this.selUsed) {
                this.selUsed = currentUsed;
                this.setUsedDesc(this.selUsed);
            }

            // C. React when Free Actuator select changes
            idx = parseInt(formData.freeSelIdx);
            const currentFree = this.on_off_free()[idx];
            if(currentFree && currentFree !== this.selFree) {
                this.selFree = currentFree;
                this.setFreeDesc(this.selFree);
            }

            // D. React when Target Temperature Set Point input changes
            const isOK = !isNaN(formData.setPoint)
                         && formData.setPoint >= this.minSetPoint
                         && formData.setPoint <= this.maxSetPoint
                         && this.validStat;
            if(isOK) {
                this.selThermostat.setPoint = formData.setPoint;
                this.storage.storeThermostat(this.selThermostat);
            }
            else if(this.validStat) {
                this.formDataModel.update(s => ({
                    ...s,
                    setPoint: this.selThermostat.setPoint
                }));
            }
        });
    });

    constructor() {
        // ---
    }

    /***********************************************************************************************
     * fn          ngAfterViewInit
     *
     */
    ngAfterViewInit() {

        const netItems = Array.from(this.storage.itemMap().values());
        const t_stats: gIF.thermostat_t[] = [];

        for(const item of netItems) {
            if(item.group === gIF.eGroup_t.E_GROUP_TEMPERATURE) {
                const key = this.storage.thermostatKey(item.addr, item.endPoint);
                const nvThermostat = this.storage.nvThermostatsMap.get(key);

                const thermostat: gIF.thermostat_t = {
                    name: item.name,
                    partNum: item.partNum,
                    addr: item.addr,
                    endPoint: item.endPoint,
                    hysteresis: gConst.THERMOSTAT_HYSTERESIS,
                    setPoint: nvThermostat ? nvThermostat.setPoint : 20.0,
                    prevSetPoint: nvThermostat ? nvThermostat.prevSetPoint : 0,
                    workPoint: nvThermostat ? nvThermostat.workPoint : 20.0,
                    actuators: nvThermostat ? [...nvThermostat.actuators] : []
                };

                t_stats.push(thermostat);

                // TEST: Add some dummy actuators if none are found in the storage
                for(let i = 1; i < 4; i++) {
                    const on_off_actuator: gIF.on_off_actuator_t = {
                    valid: true,
                    name: `item_${i}`,
                    partNum: i * 10,
                    addr: i * 1000,
                    endPoint: i * 2
                    };
                    this.on_off_all.push(on_off_actuator);
                }
                // END TEST
            }

            if(item.group === gIF.eGroup_t.E_GROUP_ON_OFF) {
                if(item.type === gIF.eType_t.E_TYPE_ACUATOR){
                    const on_off_actuator: gIF.on_off_actuator_t = {
                        valid: true,
                        name: item.name,
                        partNum: item.partNum,
                        addr: item.addr,
                        endPoint: item.endPoint
                    };
                    this.on_off_all.push(on_off_actuator);
                }
            }
        }

        this.storage.delAllThermostat();

        if(t_stats.length > 0) {
            this.validStat = true;
            this.thermostats.set(t_stats);
            for(const stat of t_stats) {
                this.storage.storeThermostat(stat);
            }
        }
        else {
            this.validStat = false;
            this.thermostats.set([gConst.invalidStat]);
            this.on_off_all = [];
        }

        this.formDataModel.update(state => ({
            ...state,
            statSelIdx: '0',
            setPoint: this.thermostats()[0].setPoint,
        }));
    }

    /***********************************************************************************************
     * fn          setThermostat
     *
     */
    setThermostat(thermostat: gIF.thermostat_t) {

        const used_actuators: gIF.on_off_actuator_t[] = [];

        const targetedKeys = new Set(
            thermostat.actuators.map(a => `${a.addr}_${a.endPoint}`)
        );
        const free_actuators = this.on_off_all.filter(actuator => {
            const key = `${actuator.addr}_${actuator.endPoint}`;
            if(targetedKeys.has(key)) {
                used_actuators.push(actuator);
                return false;
            }
            return true;
        });

        this.on_off_used.set(used_actuators.length === 0 ? [gConst.dummyOnOff] : used_actuators);
        this.on_off_free.set(free_actuators.length === 0 ? [gConst.dummyOnOff] : free_actuators);

        this.formDataModel.update(state => ({
            ...state,
            usedSelIdx: '0',
            freeSelIdx: '0'
        }));
    }

    /***********************************************************************************************
     * fn          setThermostatDesc
     *
     */
    setThermostatDesc(thermostat: gIF.thermostat_t) {

        const desc_vals: gIF.descVal_t[] = [];

        if(thermostat && this.validStat) {
            desc_vals.push({ key: 'Part Num:', value: `${thermostat.partNum}` });
            desc_vals.push({ key: 'Short Addr:', value: `${this.utils.hexWord(thermostat.addr)}` });
            desc_vals.push({ key: 'Endpoint:', value: `${thermostat.endPoint}` });

        }
        this.thermostatDesc.set(desc_vals);
    }

    /***********************************************************************************************
     * fn          setUsedDesc
     *
     */
    setUsedDesc(actuator: gIF.on_off_actuator_t) {

        const desc_vals: gIF.descVal_t[] = [];

        if(actuator && actuator.valid) {
            desc_vals.push({ key: 'Part Num:', value: `${actuator.partNum}` });
            desc_vals.push({ key: 'Short Addr:', value: `${this.utils.hexWord(actuator.addr)}` });
            desc_vals.push({ key: 'Endpoint:', value: `${actuator.endPoint}` });
        }

        this.usedDesc.set(desc_vals);
    }

    /***********************************************************************************************
     * fn          setFreeDesc
     *
     */
    setFreeDesc(actuator: gIF.on_off_actuator_t) {

        const desc_vals: gIF.descVal_t[] = [];

        if(actuator && actuator.valid) {
            desc_vals.push({ key: 'Part Num:', value: `${actuator.partNum}` });
            desc_vals.push({ key: 'Short Addr:', value: `${this.utils.hexWord(actuator.addr)}` });
            desc_vals.push({ key: 'Endpoint:', value: `${actuator.endPoint}` });
        }

        this.freeDesc.set(desc_vals);
    }

    /***********************************************************************************************
     * fn          addActuator
     *
     */
    addActuator(){

        if(!this.validStat || !this.selFree || !this.selFree.valid) {
            return;
        };
        this.selThermostat.actuators.push({
            name: this.selFree.name,
            addr: this.selFree.addr,
            endPoint: this.selFree.endPoint
        });
        this.storage.storeThermostat(this.selThermostat);
        this.setThermostat(this.selThermostat);
    }

    /***********************************************************************************************
     * fn          delActuator
     *
     */
    delActuator() {

        if(!this.validStat || !this.selUsed || !this.selUsed.valid) {
            return;
        };
        const idx = this.selThermostat.actuators.findIndex(
            act => act.addr === this.selUsed.addr && act.endPoint === this.selUsed.endPoint
        );
        if(idx > -1) {
            this.selThermostat.actuators.splice(idx, 1);
            this.storage.storeThermostat(this.selThermostat);
            this.setThermostat(this.selThermostat);
        }
    }

    /***********************************************************************************************
     * fn          saveActuators
     *
     *
    saveActuators(thermostat: gIF.thermostat_t, used: gIF.on_off_actuator_t[]) {
        this.storage.storeThermostat(thermostat);
    }
    */
    /***********************************************************************************************
     * fn          close
     *
     */
    close() {
        this.dialogRef.close();
    }
}

import { Injectable, Service, effect, inject, signal} from '@angular/core';
import { StorageService } from './storage.service';
//import { webusb } from 'usb';
import { UtilsService } from './utils.service';

import * as gConst from '../gConst';
import * as gIF from '../gIF';

const vID = 0x1915;
//const pID = 0x1067;
const options: USBDeviceRequestOptions = {
    filters: [{vendorId: vID/*, productId: pID*/}]
};
/*
@Injectable({
    providedIn: 'root',
})
*/
@Service()
export class UsbService {

    usb_device = {} as USBDevice;
    valid_dev_flag = signal(false);

    rxBuf = new Uint8Array(1024);
    txBuf = new Uint8Array(1024);
    rwBuf = new gIF.rwBuf_t();

    outFrames: Uint8Array[] = [];
    usbReadTmo: any;

    storage = inject(StorageService);
    utils = inject(UtilsService);

    trash = 1;

    constructor() {
        setTimeout(() => {
            this.sendFrame();
        }, 100);

        this.rwBuf.wrBuf = new DataView(this.txBuf.buffer);

        navigator.usb.ondisconnect = (event: USBConnectionEvent)=>{
            console.warn(event);
            this.storage.itemMap.update((map)=>{
                for(let [key, val] of map) {
                    val.isValid = false;
                }
                return new Map(map);
            });
            this.valid_dev_flag.set(false);

            const msg = `device disconnected -> ${event.device.productName}`;
            this.utils.sendMsg(msg, 'red');
        };
    }

    /***********************************************************************************************
     * fn          initApp
     *
     * brief
     *
     */
    initApp() {

        this.storage.readAllKeys();

        setTimeout(()=>{
            this.cleanAgedItems();
        }, 60000);
    }

    /***********************************************************************************************
     * fn          request_device
     *
     * brief
     *
     */
    async requestDevice() {

        try {
            let device = await navigator.usb.requestDevice({filters: [{vendorId: vID}]});
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);

            this.usb_device = device;
            this.valid_dev_flag.set(true);

            const msg = `device connected -> ${device.productName}`;
            this.utils.sendMsg(msg, 'red');

            clearTimeout(this.usbReadTmo);
            this.usbReadTmo = setTimeout(()=>{
                this.usbRead();
            }, 100);
        }
        catch(err) {
            console.error(err);
        }
    }

    /***********************************************************************************************
     * fn          closeDevice
     *
     * brief
     *
     */
    async closeDevice() {

        this.storage.itemMap.update((map)=>{
            for(let [key, val] of map) {
                val.isValid = false;
            }
            return new Map(map);
        });

        if(this.valid_dev_flag() == true){
            this.valid_dev_flag.set(false);
            try {
                await this.usb_device.releaseInterface(0);
                await this.usb_device.close();
            }
            catch(err) {
                console.error(err);
            }

            const msg = `device closed -> ${this.usb_device.productName}`;
            this.utils.sendMsg(msg, 'red');
        }
    }

    /***********************************************************************************************
     * fn          usbRead
     *
     * brief
     *
     */
    async usbRead() {

        let tmo = 100;

        if(this.valid_dev_flag() == true){
            try {
                const usbMsg = await this.usb_device.transferIn(1, 64);
                console.log(usbMsg);
                if(usbMsg.status == 'ok'){
                    this.processMsg(usbMsg);
                }
                else {
                    tmo = 1000;
                }
            }
            catch(err) {
                tmo = 1000;
                console.error(err);
            }
        }

        this.usbReadTmo = setTimeout(()=>{
            this.usbRead();
        }, tmo);
    }

    /***********************************************************************************************
     * fn          processMsg
     *
     * brief
     *
     */
    processMsg(usbMsg: USBInTransferResult) {

        let i = 0;
        let j = 0;
        let hop_addr = 0;
        this.rwBuf.rdBuf = usbMsg.data!;
        this.rwBuf.rdIdx = 0;

        const msgType = this.rwBuf.read_uint8();
        switch(msgType){
            case gConst.USB_MSG_ITEM_REPORT: {
                const devRep = {} as gIF.deviceReport_t;
                devRep.hops = [];
                for(i = 0; i < gConst.HOPS_MAX; i++){
                    devRep.hops[i] = this.rwBuf.read_uint8();
                }
                devRep.partNum = this.rwBuf.read_uint16_LE();
                devRep.addr = this.rwBuf.read_uint8();
                const dataLen = this.rwBuf.read_uint8();
                devRep.data = [];
                for(i = 0; i < dataLen; i++){
                    devRep.data.push(this.rwBuf.read_uint8());
                }

                this.parseDeviceReport(devRep);

                const msg = `report -> partNum: ${this.partNumToName(devRep.partNum)}, addr: ${devRep.addr}`;
                this.utils.sendMsg(msg, 'blue', 7);
            }
            break;
        }
    }

    /***********************************************************************************************
     * fn          parseDeviceReport
     *
     */
    parseDeviceReport(devRep: gIF.deviceReport_t): void {

        const devProps = this.getProps(devRep) as gIF.epProps_t[];
        if(devProps.length === 0) {
            return;
        }
        const now = Math.round(Date.now() / 1000);
        const nextMap = new Map(this.storage.itemMap());
        let mapWasMutated = false;
        const historyUpdates: gIF.netItem_t[] = [];

        for(const props of devProps) {
            if(!props.isVisible) {
                continue;
            }
            const key = this.storage.itemKey({
                partNum: devRep.partNum,
                addr: devRep.addr,
                endPoint: props.endPoint
            });
            const mapItem = nextMap.get(key) as gIF.netItem_t | undefined;
            if(mapItem) {
                // Create a shallow copy to trigger Angular's change detection
                const updatedItem: gIF.netItem_t = {
                    ...mapItem,
                    frame_rnd: props.frame_rnd,
                    timestamp: now,
                    isValid: true,
                    formatedVal: props.formatedVal,
                    battery: props.battery?.rep_size ? { ...props.battery } : mapItem.battery
                };
                if(props.hasHistory) {
                    //this.dataHistory(now, props.value, updatedItem);
                    this.dataHistory(now, props.value, updatedItem, historyUpdates); // 2. Pass collection
                }
                nextMap.set(key, updatedItem);
                mapWasMutated = true;
            }
            else {
                const nvProps = this.storage.nvPropsMap.get(key) as gIF.nvProps_t | undefined;
                const item: gIF.netItem_t = {
                    partNum: devRep.partNum,
                    addr: devRep.addr,
                    endPoint: props.endPoint,
                    frame_rnd: props.frame_rnd,
                    drag: false,
                    isSel: false,
                    timestamp: now,
                    group: props.group,
                    type: props.type,
                    isValid: true,
                    hops: [...devRep.hops.slice(0, gConst.HOPS_MAX)],
                    formatedVal: props.formatedVal,
                    timestamps: props.hasHistory ? [now] : [],
                    vals: props.hasHistory ? [props.value] : [],
                    pos: nvProps?.pos ?? { x: 0, y: 0 },
                    name: nvProps?.name ?? 'no name',
                    style: nvProps?.style ?? gConst.NG_STYLE,
                    valCorr: nvProps?.valCorr ?? { units: props.units, offset: 0 },
                    battery: props.battery?.rep_size ? { ...props.battery } : {
                        rep_size: 0,
                        v_bat: undefined,
                        i_bat: undefined,
                        i_chg: undefined,
                        i_bat_status: undefined,
                        ntc_status: undefined,
                        die_status: undefined,
                        chg_status: undefined,
                        chg_err: undefined
                    }
                };
                if(props.hasHistory) {
                    this.dataHistory(now, props.value, item, historyUpdates); // 2. Pass collection
                }
                nextMap.set(key, item);
                mapWasMutated = true;
            }
        }
        if(mapWasMutated) {
            this.storage.itemMap.set(nextMap);
        }
        if(historyUpdates.length > 0) {
            this.storage.chartData.set(historyUpdates);
        }
    }

    /***********************************************************************************************
     * fn          getProps
     *
     * brief
     *
     */
    getProps(devRep: gIF.deviceReport_t) {

        let props: gIF.epProps_t[] = [];
        const item_vals = new Uint8Array(devRep.data);
        this.rwBuf.rdBuf = new DataView(item_vals.buffer);
        this.rwBuf.rdIdx = 0;

        let mapItem: gIF.netItem_t;
        let key: string;
        let nvProps: gIF.nvProps_t;
        let formatedVal = '';
        let units: number;

        switch(devRep.partNum) {
            case gConst.SHT40_018: {
                let t_props = {} as gIF.epProps_t;
                t_props.valid = true;
                t_props.frame_rnd = this.rwBuf.read_uint32_LE();
                t_props.endPoint = this.rwBuf.read_uint8();
                this.check_frame_rnd(devRep, t_props);
                if(t_props.valid == true){
                    let temp = this.rwBuf.read_uint16_LE();
                    temp = -45.0 + 175.0 * temp / 65535.0;
                    let corrTemp = temp;
                    units = gConst.DEG_C;
                    key = this.storage.itemKey({
                        partNum: devRep.partNum,
                        addr: devRep.addr,
                        endPoint: t_props.endPoint
                    });

                    formatedVal = `${corrTemp.toFixed(1)} °C`;
                    nvProps = this.storage.nvPropsMap.get(key);
                    if(nvProps){
                        units = nvProps.valCorr.units;
                        corrTemp = this.corrVal(temp, nvProps.valCorr);
                        formatedVal = `${corrTemp.toFixed(1)} °C`;
                        if(units === gConst.DEG_F){
                            formatedVal = `${corrTemp.toFixed(1)} °F`;
                        }
                    }

                    t_props.isVisible = true;
                    t_props.group = gIF.eGroup_t.E_GROUP_TEMPERATURE;
                    t_props.type = gIF.eType_t.E_TYPE_SENSOR;
                    t_props.hasHistory = true;
                    t_props.formatedVal = formatedVal;
                    t_props.units = units;
                    t_props.value = temp;

                    let rh_props = {} as gIF.epProps_t;
                    rh_props.valid = true;
                    rh_props.frame_rnd = t_props.frame_rnd;
                    rh_props.endPoint = this.rwBuf.read_uint8();
                    let rh = this.rwBuf.read_uint16_LE();
                    rh = -6.0 + 125.0 * rh / 65535;
                    let corrRH = rh;
                    key = this.storage.itemKey({
                        partNum: devRep.partNum,
                        addr: devRep.addr,
                        endPoint: rh_props.endPoint
                    });
                    nvProps = this.storage.nvPropsMap.get(key);
                    if(nvProps) {
                        corrRH = this.corrVal(rh, nvProps.valCorr);
                    }
                    rh_props.isVisible = true;
                    rh_props.group = gIF.eGroup_t.E_GROUP_HUMIDITY;
                    rh_props.type = gIF.eType_t.E_TYPE_SENSOR;
                    rh_props.hasHistory = true;
                    rh_props.formatedVal = `${corrRH.toFixed(0)} %rh`;
                    rh_props.units = gConst.RH_UNIT;
                    rh_props.value = rh;

                    let battery = {} as gIF.battery_t;
                    battery.rep_size = this.rwBuf.read_uint8();
                    battery.v_bat = this.rwBuf.read_uint16_LE();
                    if(battery.rep_size > gConst.SHORT_BAT_REPORT){
                        battery.i_bat = this.rwBuf.read_uint16_LE();
                        battery.i_chg = this.rwBuf.read_uint8();
                        battery.i_bat_status = this.rwBuf.read_uint8();
                        battery.ntc_status = this.rwBuf.read_uint8();
                        battery.die_status = this.rwBuf.read_uint8();
                        battery.chg_status = this.rwBuf.read_uint8();
                        battery.chg_err = this.rwBuf.read_uint8();
                    }
                    t_props.battery = { ...battery };
                    props.push(t_props);
                    rh_props.battery = { ...battery };
                    props.push(rh_props);

                    const tempEvent = {} as gIF.tempEvent_t;
                    tempEvent.temp = corrTemp;
                    tempEvent.addr = devRep.addr;
                    tempEvent.endPoint = t_props.endPoint;
                    this.storage.tempEvent.set(tempEvent);

                    const battEvent = {} as gIF.battEvent_t;
                    battEvent.addr = devRep.addr;
                    battEvent.battery = { ...battery };
                    this.storage.battEvent.set(battEvent);
                }
                break;
            }

            case gConst.SSR_009: {
                let ssr_props = {} as gIF.epProps_t;
                ssr_props.valid = true;
                ssr_props.frame_rnd = this.rwBuf.read_uint32_LE();
                ssr_props.endPoint = this.rwBuf.read_uint8();
                this.check_frame_rnd(devRep, ssr_props);
                if(ssr_props.valid == true){
                    let state = this.rwBuf.read_uint8();

                    ssr_props.isVisible = true;
                    ssr_props.group = gIF.eGroup_t.E_GROUP_ON_OFF;
                    ssr_props.type = gIF.eType_t.E_TYPE_ACUATOR;
                    ssr_props.hasHistory = true;
                    ssr_props.formatedVal = !!state ? 'on' : 'off';

                    ssr_props.battery = {
                        rep_size: 0,
                        v_bat: 0,
                        i_bat: 0,
                        i_chg: 0,
                        i_bat_status: 0,
                        ntc_status: 0,
                        die_status: 0,
                        chg_status: 0,
                        chg_err: 0
                    };

                    ssr_props.units = gConst.NO_UNIT;
                    ssr_props.value = state;

                    props.push(ssr_props);
                }
                break;
            }
            /*
            case gConst.ENS_015_AQ: {
                let aq = this.rwBuf.read_uint16_LE();
                itemProps.isVisible = true;
                itemProps.group = gIF.eGroup_t.E_GROUP_AIR_QUALITY;
                itemProps.type = gIF.eType_t.E_TYPE_SENSOR;
                itemProps.hasHistory = true;
                itemProps.formatedVal = `aq - ${aq.toFixed(0)}`;
                itemProps.units = gConst.NO_UNIT;
                itemProps.value = aq;
                break;
            }
            */
            case gConst.PB_023: {
                let pb_props = {} as gIF.epProps_t;
                pb_props.valid = true;
                pb_props.frame_rnd = this.rwBuf.read_uint32_LE();
                pb_props.endPoint = this.rwBuf.read_uint8();
                this.check_frame_rnd(devRep, pb_props);
                if(pb_props.valid == true){
                    let trig = this.rwBuf.read_uint8();
                    let battery = {} as gIF.battery_t;
                    battery.rep_size = this.rwBuf.read_uint8();
                    battery.v_bat = this.rwBuf.read_uint16_LE();
                    if(battery.rep_size > gConst.SHORT_BAT_REPORT){
                        battery.i_bat = this.rwBuf.read_uint16_LE();
                        battery.i_chg = this.rwBuf.read_uint8();
                        battery.i_bat_status = this.rwBuf.read_uint8();
                        battery.ntc_status = this.rwBuf.read_uint8();
                        battery.die_status = this.rwBuf.read_uint8();
                        battery.chg_status = this.rwBuf.read_uint8();
                        battery.chg_err = this.rwBuf.read_uint8();
                    }
                    pb_props.isVisible = true;
                    pb_props.group = gIF.eGroup_t.E_GROUP_ON_OFF;
                    pb_props.type = gIF.eType_t.E_TYPE_SWITCH;
                    pb_props.hasHistory = false;
                    pb_props.formatedVal = `sw`;
                    pb_props.battery = { ...battery };
                    pb_props.units = gConst.NO_UNIT;
                    pb_props.value = trig;

                    props.push(pb_props);

                    if(trig){
                        const pbEvent = {} as gIF.pbEvent_t;
                        pbEvent.trig = trig;
                        pbEvent.addr = devRep.addr;
                        pbEvent.endPoint = pb_props.endPoint;
                        this.storage.pbEvent.set(pbEvent);
                    }
                    const battEvent = {} as gIF.battEvent_t;
                    battEvent.addr = devRep.addr;
                    battEvent.battery = { ...battery };
                    this.storage.battEvent.set(battEvent);
                }
                break;
            }

            default: {
                console.log(`unsuported part: ${devRep.partNum}`);
                break;
            }
        }
        return props;
    }

    /***********************************************************************************************
     * fn          check_frame_rnd
     *
     * brief
     *
     */
    private check_frame_rnd(devRep: gIF.deviceReport_t, ep_props: gIF.epProps_t) {

        let mapItem: gIF.netItem_t;
        let key: string;

        key = this.storage.itemKey({
            partNum: devRep.partNum,
            addr: devRep.addr,
            endPoint: ep_props.endPoint
        });
        mapItem = this.storage.itemMap().get(key);
        if(mapItem){
            if(mapItem.frame_rnd == ep_props.frame_rnd){
                ep_props.valid = false
            }
        }
    }

    /***********************************************************************************************
     * fn          corrVal
     *
     * brief
     *
     */
    private corrVal(val: number, corr: gIF.valCorr_t) {

        let corrVal = val + corr.offset;

        switch(corr.units) {
            case gConst.DEG_F: {
                corrVal = (corrVal * 9.0) / 5.0 + 32.0;
                break;
            }
        }
        return corrVal;
    }

     /***********************************************************************************************
     * fn          dataHistory
     *
     * brief
     *
     */
    private dataHistory(timestamp: number, val: number, item: gIF.netItem_t, batchArray: gIF.netItem_t[]) {

        let len = item.timestamps.length;
        if(len > 0){
            let last = item.timestamps[len - 1];
            if((timestamp - last) > 59){
                item.timestamps.push(timestamp);
                item.vals.push(val);
                len++;
                if(len > gConst.HIST_LEN) {
                    item.timestamps.shift();
                    item.vals.shift();
                }
                //this.storage.chartData.set(item);
                batchArray.push(item); // 3. Push to array instead of setting signal
            }
        }
        else {
            item.timestamps.push(timestamp);
            item.vals.push(val);
            batchArray.push(item); // 3. Push to array instead of setting signal
        }
    }

    /***********************************************************************************************
     * fn          cleanAgedItems
     *
     * brief
     *
     */
    private cleanAgedItems() {

        let diff: number;
        let now = Math.round(Date.now() / 1000);
        for(let [key, val] of this.storage.itemMap()) {
            diff = now - val.timestamp;
            if(diff > gConst.ITEM_TTL) {
                this.storage.itemMap.update((map)=>{
                    map.delete(key);
                    return new Map(map);
                });
            }
            if(diff > gConst.ITEM_VALID_TTL) {
                val.isValid = false;
            }
        }
        setTimeout(()=>{
            this.cleanAgedItems();
        }, 60000); // 60 seconds
    }

    /***********************************************************************************************
     * fn          addOutFrame
     *
     * brief
     *
     */
    addOutFrame(frame: Uint8Array) {
        this.outFrames.push(frame);
    }

    /***********************************************************************************************
     * fn          sendFrame
     *
     * brief
     *
     */
    async sendFrame() {

        if(this.outFrames.length && this.valid_dev_flag()){
            try {
                const frame = this.outFrames.shift()!;
                const res = await this.usb_device?.transferOut(1, frame as BufferSource);
                console.log(res);
            }
            catch(err) {
                console.error(err);
            }
        }
        setTimeout(() => {
            this.sendFrame();
        }, 100);
    }


    /***********************************************************************************************
     * fn          sendFrame
     *
     * brief
     *
     */
    partNumToName(partNum: number): string {

        switch(partNum) {
            case gConst.SHT40_018: {
                return 'SHT40-018';
            }
            case gConst.SSR_009: {
                return 'SSR-009';
            }
            case gConst.PB_023: {
                return 'PB-023';
            }
            default: {
                return 'unknown';
            }
        }
    }
}

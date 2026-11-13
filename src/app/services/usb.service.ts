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

@Service()
export class UsbService {

    private usb_device?: USBDevice;
    valid_dev_flag = signal(false);

    rxBuf = new Uint8Array(1024);
    txBuf = new Uint8Array(1024);
    rwBuf = new gIF.rwBuf_t();

    outFrames: Uint8Array[] = [];

    private isReading = false;
    usbReadTmo: any;

    storage = inject(StorageService);
    utils = inject(UtilsService);

    trash = 0;

    constructor() {
        setTimeout(() => {
            this.sendFrame();
        }, 100);

        this.rwBuf.wrBuf = new DataView(this.txBuf.buffer);

        navigator.usb.ondisconnect = (event: USBConnectionEvent)=>{
            console.warn(event);
            this.storage.itemMap.update((map)=>{
                for(let [, val] of map) {
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
            // 1. Clean up any existing stale timer before connecting a new device
            if(this.usbReadTmo) {
                clearTimeout(this.usbReadTmo);
                this.usbReadTmo = undefined;
            }

            // 2. Request the device via WebUSB
            const device = await navigator.usb.requestDevice({ filters: [{ vendorId: vID }] });

            // 3. Ensure clean connection state
            if(!device.opened) {
                await device.open();
            }

            if(device.configuration === null) {
                await device.selectConfiguration(1);
            }

            // Check if interface 0 is already claimed, claim if not
            // (WebUSB doesn't have a direct 'isClaimed' property, so we handle it cleanly)
            try {
                await device.claimInterface(0);
            }
            catch(claimErr) {
                console.warn('Interface 0 might already be claimed:', claimErr);
            }

            // 4. Assign device and update state signals
            this.usb_device = device;
            this.valid_dev_flag.set(true);

            const msg = `Device connected -> ${device.productName || 'Unknown Device'}`;
            this.utils.sendMsg(msg, 'green'); // Changed to 'green' or success color

            // 5. Start the read loop
            this.usbReadTmo = setTimeout(() => {
                this.usbRead();
            }, 100);

        }
        catch(err: any) {
            if(err.name === 'NotFoundError') {
                console.log('User cancelled the device selection prompt.');
            }
            else {
                console.error('Failed to request/connect USB device:', err);
                this.utils.sendMsg('Failed to connect USB device', 'red');
            }

            this.valid_dev_flag.set(false);
        }
    }

    /***********************************************************************************************
     * fn          closeDevice
     *
     * brief
     *
     */
    async closeDevice() {

        // 1. Immediately stop any pending read loops or timers
        if(this.usbReadTmo) {
            clearTimeout(this.usbReadTmo);
            this.usbReadTmo = undefined;
        }

        // 2. Mark all items as invalid in the storage map
        this.storage.itemMap.update((map) => {
            for(const [, val] of map) {
                val.isValid = false;
            }
            return new Map(map);
        });

        // 3. Close the USB device if active
        if(this.valid_dev_flag() && this.usb_device) {
            this.valid_dev_flag.set(false);

            // Cache the name before closing the connection
            const productName = this.usb_device.productName || 'Unknown Device';

            try {
                if(this.usb_device.opened) {
                    await this.usb_device.releaseInterface(0);
                    await this.usb_device.close();
                }
            }
            catch (err) {
                console.error('Error during USB device closure:', err);
            }
            finally {
                this.usb_device = undefined; // Clear the stale device reference
            }

            // Use a neutral/status color (e.g., 'orange' or 'info') instead of 'red' for a normal close
            this.utils.sendMsg(`Device closed -> ${productName}`, 'orange');
        }
    }

    /***********************************************************************************************
     * fn          usbRead
     *
     * brief
     *
     */
    async usbRead() {

        if(this.isReading || !this.valid_dev_flag() || !this.usb_device) {
            this.scheduleNextRead(1000);
            return;
        }

        this.isReading = true;
        let tmo = 100;

        try {
            const usbMsg = await this.usb_device.transferIn(1, 64);

            if(usbMsg.status === 'ok') {
                this.processMsg(usbMsg);
            }
            else {
                tmo = 1000; // Back off on non-ok status
            }
        }
        catch(err: any) {
            console.error('USB Read Error:', err);
            tmo = 1000; // Back off on error
        }
        finally {
            this.isReading = false;
            this.scheduleNextRead(tmo);
        }
    }

    /***********************************************************************************************
     * fn          scheduleNextRead
     *
     */
    private scheduleNextRead(delay: number) {

        if(this.usbReadTmo) {
            clearTimeout(this.usbReadTmo);
        }
        this.usbReadTmo = setTimeout(() => this.usbRead(), delay);
}

    /***********************************************************************************************
     * fn          processMsg
     *
     * brief
     *
     */
    processMsg(usbMsg: USBInTransferResult) {

        this.rwBuf.rdBuf = usbMsg.data!;
        this.rwBuf.rdIdx = 0;

        const msgType = this.rwBuf.read_uint8();
        switch(msgType){
            case gConst.USB_MSG_ITEM_REPORT: {
                const devRep: gIF.deviceReport_t = {
                    hops: Array.from({ length: gConst.HOPS_MAX }, () => this.rwBuf.read_uint8()),
                    partNum: this.rwBuf.read_uint16_LE(),
                    addr: this.rwBuf.read_uint8(),
                    data: (() => {
                        const dataLen = this.rwBuf.read_uint8();
                        return Array.from({ length: dataLen }, () => this.rwBuf.read_uint8());
                    })()
                };

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

        const devProps = this.getProps(devRep);
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
            const mapItem = nextMap.get(key);
            if(mapItem) {
                const updatedItem: gIF.netItem_t = {
                    ...mapItem,
                    frame_rnd: props.frame_rnd,
                    timestamp: now,
                    isValid: true,
                    formatedVal: props.formatedVal,
                    battery: props.battery?.rep_size ? { ...props.battery } : mapItem.battery
                };
                if(props.hasHistory) {
                    this.dataHistory(now, props.value, updatedItem, historyUpdates);
                }
                nextMap.set(key, updatedItem);
                mapWasMutated = true;
            }
            else {
                const nvProps = this.storage.nvPropsMap.get(key);
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
                        v_bat: undefined
                    }
                };
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

        const props: gIF.epProps_t[] = [];
        const item_vals = new Uint8Array(devRep.data);
        this.rwBuf.rdBuf = new DataView(item_vals.buffer, item_vals.byteOffset, item_vals.byteLength);
        this.rwBuf.rdIdx = 0;

        const rnd = this.rwBuf.read_uint32_LE();
        const ep = this.rwBuf.read_uint8();

        const frameValid = this.check_frame(devRep, ep, rnd);

        if(frameValid == false) {
            console.log(`frame already processed`);
            return props;
        }

        const emptyBattery: gIF.battery_t = {
            rep_size: gIF.eBattRepSize.E_BATT_REP_SIZE_ZERO,
            v_bat: undefined
        };

        switch(devRep.partNum) {
            case gConst.SHT40_018: {
                const t_adc = this.rwBuf.read_uint16_LE();
                const rh_ep = this.rwBuf.read_uint8();
                const rh_adc = this.rwBuf.read_uint16_LE();
                const battery = this.readBattery();

                const { temp, t_corr, units, t_unit } = this.processTemperature(devRep, ep, t_adc);
                const { rh, rh_corr } = this.processHumidity(devRep, rh_ep, rh_adc);

                props.push({
                    valid: true,
                    frame_rnd: rnd,
                    endPoint: ep,
                    isVisible: true,
                    group: gIF.eGroup_t.E_GROUP_TEMPERATURE,
                    type: gIF.eType_t.E_TYPE_SENSOR,
                    hasHistory: true,
                    formatedVal: `${t_corr.toFixed(1)} ${t_unit}`,
                    units: units,
                    value: temp,
                    battery: battery
                });

                props.push({
                    valid: true,
                    frame_rnd: rnd,
                    endPoint: rh_ep,
                    isVisible: true,
                    group: gIF.eGroup_t.E_GROUP_HUMIDITY,
                    type: gIF.eType_t.E_TYPE_SENSOR,
                    hasHistory: true,
                    formatedVal: `${rh_corr.toFixed(0)} %rh`,
                    units: gConst.RH_UNIT,
                    value: rh,
                    battery: battery
                });

                this.storage.tempEvent.set({
                    temp: t_corr,
                    addr: devRep.addr,
                    endPoint: ep
                });

                this.storage.battEvent.set({
                    addr: devRep.addr,
                    battery: battery
                });
                break;
            }

            case gConst.SSR_009: {
                const state = this.rwBuf.read_uint8();
                props.push({
                    valid: true,
                    frame_rnd: rnd,
                    endPoint: ep,
                    isVisible: true,
                    group: gIF.eGroup_t.E_GROUP_ON_OFF,
                    type: gIF.eType_t.E_TYPE_ACTUATOR,
                    hasHistory: true,
                    formatedVal: state ? 'on' : 'off',
                    units: gConst.NO_UNIT,
                    value: state,
                    battery: emptyBattery
                });

                break;
            }

            case gConst.ENS_015_AQ: {
                const aq = this.rwBuf.read_uint8();
                props.push({
                    valid: true,
                    frame_rnd: rnd,
                    endPoint: ep,
                    isVisible: true,
                    group: gIF.eGroup_t.E_GROUP_AIR_QUALITY,
                    type: gIF.eType_t.E_TYPE_SENSOR,
                    hasHistory: true,
                    formatedVal: `aq - ${aq.toFixed(0)}`,
                    units: gConst.NO_UNIT,
                    value: aq,
                    battery: emptyBattery
                });
                break;
            }

            case gConst.PB_023: {
                const trig = this.rwBuf.read_uint8();
                const battery = this.readBattery();

                props.push({
                    valid: true,
                    frame_rnd: rnd,
                    endPoint: ep,
                    isVisible: true,
                    group: gIF.eGroup_t.E_GROUP_ON_OFF,
                    type: gIF.eType_t.E_TYPE_SWITCH,
                    hasHistory: false,
                    formatedVal: 'sw',
                    units: gConst.NO_UNIT,
                    value: trig,
                    battery: battery
                });

                if(trig){
                    this.storage.pbEvent.set({
                        trig: trig,
                        addr: devRep.addr,
                        endPoint: ep
                    });
                }

                this.storage.battEvent.set({
                    addr: devRep.addr,
                    battery: battery
                });
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
     * fn          check_frame
     *
     */
    private check_frame(devRep: gIF.deviceReport_t, ep: number, rnd: number): boolean {

        const key = this.storage.itemKey({
            partNum: devRep.partNum,
            addr: devRep.addr,
            endPoint: ep
        });

        const mapItem = this.storage.itemMap().get(key);

        if(mapItem && mapItem.frame_rnd === rnd) {
            return false;
        }
        return true;
    }

    /***********************************************************************************************
     * fn          processTemperature
     *
     */
    private processTemperature(devRep: gIF.deviceReport_t, ep: number, t_adc: number) {

        const temp = parseFloat((-45.0 + (175.0 * t_adc) / 65535.0).toFixed(1));
        let t_corr = temp;
        let units = gConst.DEG_C;

        const key = this.storage.itemKey({
            partNum: devRep.partNum,
            addr: devRep.addr,
            endPoint: ep
        });

        const nvProps = this.storage.nvPropsMap.get(key);
            if(nvProps) {
                units = nvProps.valCorr.units;
                t_corr = this.corrVal(temp, nvProps.valCorr);
            }

            const t_unit = units === gConst.DEG_F ? '°F' : '°C';

            return { temp, t_corr, units, t_unit };
    }

    /***********************************************************************************************
     * fn          processHumidity
     *
     */
    private processHumidity(devRep: gIF.deviceReport_t, rh_ep: number, rh_adc: number) {

        const rh = parseFloat((-6.0 + (125.0 * rh_adc) / 65535.0).toFixed(0));
        let rh_corr = rh;

        const key = this.storage.itemKey({
            partNum: devRep.partNum,
            addr: devRep.addr,
            endPoint: rh_ep
        });

        const nvProps = this.storage.nvPropsMap.get(key);
        if(nvProps) {
            rh_corr = this.corrVal(rh, nvProps.valCorr);
        }

        return { rh, rh_corr };
    }

    /***********************************************************************************************
     * fn          readBattery
     *
     */
    private readBattery(): gIF.battery_t {

        const rep_size = this.rwBuf.read_uint8();
        const battery: gIF.battery_t = {
            rep_size,
            v_bat: this.rwBuf.read_uint16_LE()
        };

        if(rep_size > gConst.SHORT_BAT_REPORT) {
            battery.i_bat = this.rwBuf.read_uint16_LE();
            battery.i_chg = this.rwBuf.read_uint8();
            battery.i_bat_status = this.rwBuf.read_uint8();
            battery.ntc_status = this.rwBuf.read_uint8();
            battery.die_status = this.rwBuf.read_uint8();
            battery.chg_status = this.rwBuf.read_uint8();
            battery.chg_err = this.rwBuf.read_uint8();
        }

        return battery;
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
    private dataHistory(timestamp: number,
                        val: number,
                        item: gIF.netItem_t,
                        batchArray: gIF.netItem_t[]) {

        const timestamps = item.timestamps;
        const len = timestamps.length;

        // Check if we need to filter by time difference (only if items already exist)
        if(len > 0 && (timestamp - timestamps[len - 1]) <= 59) {
            return; // Skip if interval is too short
        }

        // Insert new data points
        timestamps.push(timestamp);
        item.vals.push(val);

        // Maintain maximum history length
        if(timestamps.length > gConst.HIST_LEN) {
            timestamps.shift();
            item.vals.shift();
        }

        // Queue for batch processing
        batchArray.push(item);
    }

    /***********************************************************************************************
     * fn          cleanAgedItems
     *
     * brief
     *
     */
    private cleanAgedItems() {

        const now = Math.floor(Date.now() / 1000);
        const keysToDelete: string[] = [];
        const keysToInvalidate: string[] = [];

        for(const [key, val] of this.storage.itemMap()) {
            const diff = now - val.timestamp;
            if(diff > gConst.ITEM_TTL) {
                keysToDelete.push(key);
                window.electronItemStore.delete(key);
                this.storage.nvPropsMap.delete(key);
            }
            else if(diff > gConst.ITEM_VALID_TTL && val.isValid) {
                keysToInvalidate.push(key);
            }
        }
        if(keysToDelete.length > 0|| keysToInvalidate.length > 0) {
            this.storage.itemMap.update((map) => {
                const newMap = new Map(map);
                for(const key of keysToDelete) {
                    newMap.delete(key);
                }
                for(const key of keysToInvalidate) {
                    const mapItem = newMap.get(key);
                    if(mapItem) {
                        newMap.set(key, {
                            ...mapItem,
                            isValid: false
                        });
                    }
                }
                return newMap;
            });
        }

        setTimeout(() => this.cleanAgedItems(), 60000);
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
     * fn          partNumToName
     *
     * brief
     *
     */
    partNumToName(partNum: number): string {
        return gConst.PART_NAMES[partNum] ?? 'unknown';
    }
}

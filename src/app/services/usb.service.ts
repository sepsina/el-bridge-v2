import { Service, inject, signal, computed, effect, untracked, OnDestroy } from '@angular/core';
import { StorageService } from './storage.service';
import { UtilsService } from './utils.service';

import * as gConst from '../gConst';
import * as gIF from '../gIF';

const vID = 0x1915;
//const pID = 0x1067;
const options: USBDeviceRequestOptions = {
    filters: [{vendorId: vID/*, productId: pID*/}]
};

const READ_POLL_MS = 100;     // normal polling interval
const READ_BACKOFF_MS = 1000; // delay after an error or unexpected status
const HIST_MIN_INTERVAL_S = 9; // minimum seconds between history samples

@Service()
export class UsbService implements OnDestroy {

    // single source of truth: the device handle drives the derived state
    private usb_device = signal<USBDevice | undefined>(undefined);
    readonly valid_dev_flag = computed(() => this.usb_device() !== undefined);
    readonly deviceName = computed(() => this.usb_device()?.productName || '');

    //rxBuf = new Uint8Array(1024);
    txBuf = new Uint8Array(1024);
    rwBuf = new gIF.rwBuf_t();

    outFrames: Uint8Array[] = [];

    private isReading = false;
    private readGen = 0;
    private destroyed = false;
    private txFailCount = 0;

    private sending = false;
    private closing = false;
    private connecting = false;

    private usbReadTmo: ReturnType<typeof setTimeout> | undefined;
    private sendTmo: ReturnType<typeof setTimeout> | undefined;
    private cleanTmo: ReturnType<typeof setTimeout> | undefined;

    storage = inject(StorageService);
    utils = inject(UtilsService);

    constructor() {

        this.rwBuf.wrBuf = new DataView(this.txBuf.buffer);

        navigator.usb.addEventListener('disconnect', this.onDisconnect);
        window.addEventListener('beforeunload', this.onUnload);

        effect(() => {
            const dev = this.usb_device();
            untracked(() => {
                if(this.usbReadTmo) {
                    clearTimeout(this.usbReadTmo);
                    this.usbReadTmo = undefined;
                }
                if(this.sendTmo) {
                    clearTimeout(this.sendTmo);
                    this.sendTmo = undefined;
                }
                this.outFrames.length = 0;
                this.txFailCount = 0;
                this.isReading = false;
                this.sending = false;

                if(dev && !this.destroyed) {
                    this.usbReadTmo = setTimeout(() => void this.usbRead(), READ_POLL_MS);
                }
            });
        });
    }

    /***********************************************************************************************
     * fn          initApp
     *
     */
    initApp() {

        this.storage.readAllKeys();

        if(this.cleanTmo) {
            clearTimeout(this.cleanTmo);
        }
        this.cleanTmo = setTimeout(() => {
            this.cleanAgedItems();
        }, 60000);
    }

    /***********************************************************************************************
     * fn          onUnload
     *
     */
    private onUnload = () => {
        this.usb_device()?.close().catch(() => {});
    };

    /***********************************************************************************************
     * fn          ngOnDestroy
     *
     */
    ngOnDestroy() {

        this.destroyed = true;
        this.readGen++;

        navigator.usb.removeEventListener('disconnect', this.onDisconnect);
        window.removeEventListener('beforeunload', this.onUnload);

        clearTimeout(this.sendTmo);
        clearTimeout(this.cleanTmo);
        clearTimeout(this.usbReadTmo);

        this.usb_device()?.close().catch(() => {});
    }

    /***********************************************************************************************
     * fn          onDisconnect
     *
     */
    private onDisconnect = (event: USBConnectionEvent) => {

        if(event.device !== this.usb_device()) {
            return;
        }

        this.readGen++; // invalidate in-flight reads
        this.invalidateItems();
        this.usb_device.set(undefined); // effect resets timers/buffers; valid_dev_flag follows

        // release the stale handle; the device is already gone, so ignore errors
        if(event.device.opened) {
            event.device.close().catch(() => {});
        }

        const msg = `USB device disconnected: ${event.device.productName}`;
        this.utils.sendMsg(msg, 'red');
    };

    /***********************************************************************************************
     * fn          pickDevice
     *
     * brief       show the device picker, returns undefined on cancel or failure
     *
     */
    private async pickDevice(): Promise<USBDevice | undefined> {

        try {
            return await navigator.usb.requestDevice(options);
        }
        catch(err: unknown) {
            if(err instanceof DOMException && err.name === 'NotFoundError') {
                console.log('User cancelled the device selection prompt.');
            }
            else {
                console.error('Failed to request USB device:', err);
                this.utils.sendMsg('Failed to connect USB device', 'red');
            }
            return undefined;
        }
    }

    /***********************************************************************************************
     * fn          requestDevice
     *
     * brief
     *
     */
    async requestDevice() {

        if(this.connecting) {
            return;
        }
        this.connecting = true;

        try {
            if(this.valid_dev_flag()) {
                await this.closeDevice();
            }

            const device = await this.pickDevice();
            if(!device) {
                return; // cancelled or failed, finally resets connecting
            }

            try {
                if(!device.opened) {
                    await device.open();
                }
                if(device.configuration === null) {
                    await device.selectConfiguration(1);
                }
                const iface = device.configuration?.interfaces.find(i => i.interfaceNumber === 0);
                if(!iface) {
                    throw new Error('USB interface 0 not found on device');
                }
                if(!iface.claimed) {
                    await device.claimInterface(0);
                }
                if(!device.opened) {
                    throw new Error('USB device disconnected during setup');
                }
                this.readGen++;
                this.isReading = false;
                this.usb_device.set(device);

                this.utils.sendMsg(`Device connected -> ${device.productName || 'Unknown Device'}`, 'green');
            }
            catch(err: unknown) {
                if(device.opened) {
                    await device.close().catch(() => {});
                }
                console.error('Failed to set up USB device:', err);
                this.utils.sendMsg('Failed to connect USB device', 'red');
            }
        }
        finally {
            this.connecting = false;
        }
    }

    /***********************************************************************************************
     * fn          closeDevice
     *
     * brief
     *
     */
    async closeDevice() {

        const dev = this.usb_device();

        if(!dev || this.closing) {
            return;
        }
        this.closing = true;
        this.readGen++; // invalidate in-flight reads

        if(this.usbReadTmo) {
            clearTimeout(this.usbReadTmo);
            this.usbReadTmo = undefined;
        }
        this.invalidateItems();

        const productName = dev.productName || 'Unknown Device';
        let closed = false;
        let closeFailed = false;

        try {
            if(dev.opened) {
                try {
                    await dev.releaseInterface(0);
                }
                catch(err) {
                    console.warn('releaseInterface failed:', err);
                }
                try {
                    await dev.close();
                }
                catch(err) {
                    if(err instanceof DOMException && err.name === 'NotFoundError') {
                        // device unplugged during close: effectively closed
                        console.warn('close: device already gone');
                    }
                    else {
                        console.warn('close failed, retrying once:', err);
                        await dev.close(); // throws to outer catch if it fails again
                    }
                }
            }
            closed = true;
        }
        catch (err) {
            closeFailed = true;
            console.error('Error during USB device closure:', err);
        }
        finally {
            this.closing = false;
            if(this.usb_device() === dev) {
                this.usb_device.set(undefined);
            }
            else {
                closed = false; // already handled by onDisconnect
                closeFailed = false;
            }
        }
        if(closed) {
            this.utils.sendMsg(`Device closed -> ${productName}`, 'orange');
        }
        else if(closeFailed) {
            this.utils.sendMsg(`Failed to close device -> ${productName}. Unplug and reconnect it.`, 'red');
        }
    }

    /***********************************************************************************************
     * fn          usbRead
     *
     * brief
     *
     */
    async usbRead() {

        const dev = this.usb_device();

        if(!dev || this.closing || this.isReading){
            return;
        }

        this.isReading = true;
        const gen = this.readGen;
        let tmo = READ_POLL_MS;

        try {
            // Request a 64-byte read from endpoint 1
            const usbMsg = await dev.transferIn(1, 64);

            if(gen === this.readGen) {
                switch(usbMsg.status) {
                    case 'ok':
                        this.processMsg(usbMsg);
                        break;

                    case 'stall': {
                        console.warn('USB read stalled, clearing halt');
                        let cleared = true;
                        await dev.clearHalt('in', 1).catch((haltErr: unknown) => {
                            cleared = false;
                            console.warn('clearHalt failed:', haltErr);
                        });
                        // clearHalt is async: the device may have changed meanwhile
                        if(gen === this.readGen) {
                            tmo = cleared ? READ_POLL_MS : READ_BACKOFF_MS;
                        }
                        break;
                    }

                    case 'babble':
                        console.warn('USB read babble: device sent more data than requested');
                        tmo = READ_BACKOFF_MS;
                        break;

                    default:
                        console.warn(`USB read unexpected status: ${String(usbMsg.status)}`);
                        tmo = READ_BACKOFF_MS; // Back off on unknown status
                        break;
                }
            }
        }
        catch(err: unknown) {
            if(gen === this.readGen) {
                if(err instanceof DOMException) {
                    switch(err.name) {
                        case 'NotFoundError':
                        case 'NetworkError':
                        case 'InvalidStateError':
                            console.warn(`USB read failed (${err.name}):`, err.message);
                            void this.closeDevice();
                            break;
                        case 'AbortError':
                            break; // read aborted by close, nothing to do
                        default:
                            console.error('USB read error:', err);
                            break;
                    }
                }
                else {
                    console.error('Unexpected USB read error:', err);
                }
            }
            tmo = READ_BACKOFF_MS; // Back off on error
        }
        finally {
            if(gen === this.readGen) {
                this.isReading = false;
                this.scheduleNextRead(tmo);
            }
        }
    }

    /***********************************************************************************************
     * fn          scheduleNextRead
     *
     */
    private scheduleNextRead(delay: number) {

        if(this.usbReadTmo) {
            clearTimeout(this.usbReadTmo);
            this.usbReadTmo = undefined;
        }
        if(this.valid_dev_flag()){
            if(!this.destroyed){
                this.usbReadTmo = setTimeout(() => void this.usbRead(), delay);
            }
        }
    }

    /***********************************************************************************************
     * fn          addOutFrame
     *
     * brief
     *
     */
    addOutFrame(frame: Uint8Array) {

        if(!this.usb_device() || this.destroyed) {
            return; // no device: drop the frame
        }

        this.outFrames.push(frame);
        this.kickSend();
    }

    /***********************************************************************************************
     * fn          kickSend
     *
     * brief       start the send loop if it is not already running
     *
     */
    private kickSend() {

        if(this.sending || this.sendTmo) {
            return;
        }

        this.sendTmo = setTimeout(() => {
            this.sendTmo = undefined;
            void this.sendFrame();
        }, 0);
    }

    /***********************************************************************************************
     * fn          sendFrame
     *
     * brief
     *
     */
    async sendFrame() {

        const dev = this.usb_device();

        if(!dev || this.destroyed || this.closing || this.sending || !this.outFrames.length) {
            return;
        }
        this.sending = true;

        const frame = this.outFrames[0];
        try {
            const res = await dev.transferOut(1, frame as BufferSource);
            if(res.status !== 'ok') {
                throw new Error(`transferOut status: ${res.status}`);
            }
            if(this.usb_device() === dev) {
                if(this.outFrames[0] === frame) {
                    this.outFrames.shift();
                }
                this.txFailCount = 0;
            }
        }
        catch(err) {
            console.error(err);
            if(this.usb_device() === dev) {
                if(err instanceof DOMException &&
                   (err.name === 'NotFoundError' || err.name === 'NetworkError')) {
                    // device is gone: stop retrying and close
                    void this.closeDevice();
                }
                else if(++this.txFailCount >= 3) {
                    this.outFrames.shift();
                    this.txFailCount = 0;
                    this.utils.sendMsg('USB frame dropped after 3 failed attempts', 'red');
                }
            }
        }
        finally {
            if(this.usb_device() === dev) {
                this.sending = false;
            }
        }

        // continue only while frames remain (retry delay on failure)
         if(!this.destroyed){
            if(this.usb_device() === dev){
                if(this.outFrames.length){
                    this.sendTmo = setTimeout(() => {
                        this.sendTmo = undefined;
                        void this.sendFrame();
                    }, this.txFailCount ? 100 : 0);
                }
            }
        }
    }

    /***********************************************************************************************
     * fn          processMsg
     *
     * brief
     *
     */
    processMsg(usbMsg: USBInTransferResult) {

        if(!usbMsg.data) {
            return;
        }

        try {
            this.rwBuf.rdBuf = usbMsg.data;
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
        catch(err) {
            console.error('Malformed USB message:', err);
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
                    timestamps: [...mapItem.timestamps],
                    vals: [...mapItem.vals],
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

                const { t_C, t_corr, units, t_unit } = this.calcTemperature(devRep, ep, t_adc);
                const rh = this.calcHumidity(rh_adc);

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
                    value: t_C,
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
                    formatedVal: `${rh.toFixed(0)} %rh`,
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
                console.log(`unsupported part: ${devRep.partNum}`);
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
     * fn          calcTemperature
     *
     * brief       convert SHT40 ADC value to degrees C and the user selected unit (no offset applied)
     *
     */
    private calcTemperature(devRep: gIF.deviceReport_t, ep: number, t_adc: number) {

        const t_C = parseFloat((-45.0 + (175.0 * t_adc) / 65535.0).toFixed(1));

        const key = this.storage.itemKey({
            partNum: devRep.partNum,
            addr: devRep.addr,
            endPoint: ep
        });

        const units = this.storage.nvPropsMap.get(key)?.valCorr.units ?? gConst.DEG_C;
        const isF = units === gConst.DEG_F;

        const t_corr = isF ? (t_C * 9.0) / 5.0 + 32.0 : t_C;
        const t_unit = isF ? '°F' : '°C';

        return { t_C, t_corr, units, t_unit };
    }

    /***********************************************************************************************
     * fn          calcHumidity
     *
     */
    private calcHumidity(rh_adc: number) {

        const rh = parseFloat((-6.0 + (125.0 * rh_adc) / 65535.0).toFixed(0));

        return rh;
    }

    /***********************************************************************************************
     * fn          readBattery
     *
     */
    private readBattery(): gIF.battery_t {

        const rep_size = this.rwBuf.read_uint8();
        if(rep_size === gIF.eBattRepSize.E_BATT_REP_SIZE_ZERO) {
            return { rep_size, v_bat: undefined };
        }
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
     * fn          dataHistory
     *
     * brief
     *
     */
    private dataHistory(timestamp: number,
                        val: number,
                        item: gIF.netItem_t,
                        batchArray: gIF.netItem_t[]) {

        const { timestamps, vals } = item;
        const len = timestamps.length;

        // skip if the last sample is too recent
        if(len > 0 && (timestamp - timestamps[len - 1]) <= HIST_MIN_INTERVAL_S) {
            return;
        }

        timestamps.push(timestamp);
        vals.push(val);

        // drop the oldest samples in one step if the history is too long
        const excess = timestamps.length - gConst.HIST_LEN;
        if(excess > 0) {
            timestamps.splice(0, excess);
            vals.splice(0, excess);
        }

        batchArray.push(item);
    }

    /***********************************************************************************************
     * fn          cleanAgedItems
     *
     * brief
     *
     */
    private cleanAgedItems() {

        if(this.destroyed) {
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const keysToDelete: string[] = [];
        const keysToInvalidate: string[] = [];

        for(const [key, val] of this.storage.itemMap()) {
            const diff = now - val.timestamp;
            if(diff > gConst.ITEM_TTL) {
                keysToDelete.push(key);
                window.electronItemStore?.delete(key);
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

        this.cleanTmo = setTimeout(() => this.cleanAgedItems(), 60000);
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

        /***********************************************************************************************
     * fn          invalidateItems
     *
     */
    private invalidateItems() {
        this.storage.itemMap.update((map) => {
            const newMap = new Map(map);
            for(const [key, val] of newMap) {
                newMap.set(key, { ...val, isValid: false });
            }
            return newMap;
        });
    }
}

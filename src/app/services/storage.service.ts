import { Service, signal } from '@angular/core';
//import * as gConst from './gConst';
import * as gIF from '../gIF';
import * as gConst from '../gConst';

const ITEM = 'item';
const THERMOSTAT = 'thermostat';

@Service()
export class StorageService {

    /*
    scrolls = signal<gIF.scroll_t[]>([
        gConst.dumyScroll
    ]);
    */
    itemMap = signal(new Map());

    nvPropsMap = new Map();

    chartData = signal<gIF.netItem_t[]>([]);
    tempEvent = signal({} as gIF.tempEvent_t);
    pbEvent = signal({} as gIF.pbEvent_t);
    battEvent = signal({} as gIF.battEvent_t);

    nvThermostatsMap = new Map();

    txBuf = new Uint8Array(1024);
    rwBuf = new gIF.rwBuf_t();

    constructor() {
        setTimeout(()=>{
            this.init();
        }, 100);
        this.rwBuf.wrBuf = new DataView(this.txBuf.buffer);
    }

    async init() {
        //---
    }

    /***********************************************************************************************
     * fn          readAllKeys
     *
     */
    async readAllKeys() {

        const itemKeys = await window.electronItemStore.getKeys();
        for(const key of itemKeys) {
            const val = await window.electronItemStore.get(key);
            if(val) {
                this.nvPropsMap.set(key, JSON.parse(val));
            }
        }
        const statKeys = await window.electronStatStore.getKeys();
        for(const key of statKeys) {
            const val = await window.electronStatStore.get(key);
            if(val) {
                this.nvThermostatsMap.set(key, JSON.parse(val));
            }
        };
    }

    /***********************************************************************************************
     * fn          setItemName
     *
     */
    setItemName(name: string, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;
        let nvProps = {} as gIF.nvProps_t;

        nvProps.name = name;
        nvProps.pos = item.pos;
        nvProps.style = item.style;
        nvProps.valCorr = item.valCorr;

        window.electronItemStore.set(key, JSON.stringify(nvProps));

        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map)=>{
            const newMap = new Map(map);
            const mapItem = newMap.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    name: name
                });
            }
            return newMap;
        });
    }

    /***********************************************************************************************
     * fn          setItemStyle
     *
     */
    setItemStyle(style: gIF.ngStyle_t, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;
        let nvProps = {} as gIF.nvProps_t;

        nvProps.name = item.name;
        nvProps.pos = item.pos;
        nvProps.style = style;
        nvProps.valCorr = item.valCorr;

        window.electronItemStore.set(key, JSON.stringify(nvProps));
        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map)=>{
            const newMap = new Map(map);
            const mapItem = newMap.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    style: { ...style }
                });
            }
            return newMap;
        });
    }

    /***********************************************************************************************
     * fn          setItemCorr
     *
     */
    setItemCorr(valCorr: gIF.valCorr_t, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;
        let nvProps = {} as gIF.nvProps_t;

        nvProps.name = item.name;
        nvProps.pos = item.pos;
        nvProps.style = item.style;
        nvProps.valCorr = valCorr;

        window.electronItemStore.set(key, JSON.stringify(nvProps));
        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map)=>{
            const newMap = new Map(map);
            const mapItem = newMap.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    valCorr: { ...valCorr }
                });
            }
            return newMap;
        });
    }

    /***********************************************************************************************
     * fn          setItemPos
     *
     */
    setItemPos(pos: gIF.nsPos_t, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;
        let nvProps = {} as gIF.nvProps_t;

        nvProps.name = item.name;
        nvProps.pos = pos;
        nvProps.style = item.style;
        nvProps.valCorr = item.valCorr;

        window.electronItemStore.set(key, JSON.stringify(nvProps));
        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map)=>{
            const newMap = new Map(map);
            const mapItem = newMap.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    pos: { ...pos },
                    drag: false
                });
            }
            return newMap;
        });
    }

    /***********************************************************************************************
     * fn          delStoredItem
     *
     */
    delStoredItem(item: gIF.netItem_t) {

        const key = this.itemKey(item);

        window.electronItemStore.delete(key);

        this.nvPropsMap.delete(key);

        this.itemMap.update((map)=>{
            const newMap = new Map(map);
            newMap.delete(key);
            return newMap;
        });


    }

    /***********************************************************************************************
     * fn          itemKey
     *
     */
    itemKey(params: any) {

        this.rwBuf.wrIdx = 0;

        this.rwBuf.write_uint16_LE(params.partNum);
        this.rwBuf.write_uint8(params.addr);
        this.rwBuf.write_uint8(params.endPoint);
        const len = this.rwBuf.wrIdx;

        let key = Array.from(
            this.txBuf.subarray(0, len),
            (byte) => byte.toString(16)
        );

        return `${ITEM}-${key.join('')}`;
    }

    /***********************************************************************************************
     * fn          setScrolls
     *
     *
    setScrolls(scrolls: gIF.scroll_t[]) {
        localStorage.setItem('scrolls', JSON.stringify(scrolls));
    }
    */
    /***********************************************************************************************
     * fn          getScrolls
     *
     * brief
     *
     *
    getScrolls(): string {
        return (localStorage.getItem('scrolls') || '');
    }
    */
    /***********************************************************************************************
     * fn          thermostatKey
     *
     */
    thermostatKey(addr: number, endPoint: number) {

        this.rwBuf.wrIdx = 0;

        this.rwBuf.write_uint8(addr);
        this.rwBuf.write_uint8(endPoint);
        const len = this.rwBuf.wrIdx;
        let key: string[] = [];
        for (let i = 0; i < len; i++) {
            key[i] = this.txBuf[i].toString(16);
        }
        return `${THERMOSTAT}-${key.join('')}`;
    }

    /***********************************************************************************************
     * fn          delThermostat
     *
     */
    delThermostat(thermostat: gIF.thermostat_t) {

        const key = this.thermostatKey(thermostat.addr, thermostat.endPoint);
        window.electronStatStore.delete(key);
        return key;
    }

    /***********************************************************************************************
     * fn          delAllThermostat
     *
     */
    delAllThermostat() {

        window.electronStatStore.clear();
        this.nvThermostatsMap.clear();
    }

    /***********************************************************************************************
     * fn          storeThermostat
     *
     */
    storeThermostat(thermostat: gIF.thermostat_t) {

        const key = this.thermostatKey(thermostat.addr, thermostat.endPoint);
        window.electronStatStore.set(key, JSON.stringify(thermostat));
        this.nvThermostatsMap.set(key, thermostat);
    }

}

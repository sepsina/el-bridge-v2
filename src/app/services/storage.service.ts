import { Service, signal } from '@angular/core';

import * as gIF from '../gIF';

const ITEM = 'item';
const XSTAT = 'xstat';

@Service()
export class StorageService {

    itemMap = signal(new Map<string, gIF.netItem_t>());

    nvPropsMap = new Map<string, gIF.nvProps_t>();

    chartData = signal<gIF.netItem_t[]>([]);
    tempEvent = signal({} as gIF.tempEvent_t);
    pbEvent = signal({} as gIF.pbEvent_t);
    battEvent = signal({} as gIF.battEvent_t);

    nvXstatsMap = new Map<string, gIF.xstat_t>();

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
        const itemLoads = itemKeys.map(async (key) => {
            try {
                const val = await window.electronItemStore.get(key);
                if(val) {
                    this.nvPropsMap.set(key, JSON.parse(val));
                }
            }
            catch (err) {
                console.error(`readAllKeys: failed to load item key "${key}"`, err);
            }
        });
        const statKeys = await window.electronStatStore.getKeys();
        const statLoads = statKeys.map(async (key) => {
            try {
                const val = await window.electronStatStore.get(key);
                if(val) {
                    this.nvXstatsMap.set(key, JSON.parse(val));
                }
            }
            catch (err) {
                console.error(`readAllKeys: failed to load stat key "${key}"`, err);
            }
        });

        await Promise.all([...itemLoads, ...statLoads]);
    }

    /***********************************************************************************************
     * fn          setItemName
     *
     */
    setItemName(newName: string, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;

        const nvProps: gIF.nvProps_t = {
            name: newName,
            pos: item.pos,
            style: item.style,
            valCorr: item.valCorr,
        };

        window.electronItemStore.set(key, JSON.stringify(nvProps));
        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map) => {
            const newMap = new Map(map);
            const mapItem = map.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    name: newName
                });
            }
            return newMap;
        });
    }

    /***********************************************************************************************
     * fn          setItemStyle
     *
     */
    setItemStyle(newStyle: gIF.ngStyle_t, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;

        const nvProps: gIF.nvProps_t = {
            name: item.name,
            pos: item.pos,
            style: newStyle,
            valCorr: item.valCorr
        };
        window.electronItemStore.set(key, JSON.stringify(nvProps));
        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map) => {
            const newMap = new Map(map);
            const mapItem = map.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    style: newStyle
                });
            }
            return newMap;
        });
    }

    /***********************************************************************************************
     * fn          setItemCorr
     *
     */
    setItemCorr(newCorr: gIF.valCorr_t, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;

        const nvProps: gIF.nvProps_t = {
            name: item.name,
            pos: item.pos,
            style: item.style,
            valCorr: newCorr
        };

        window.electronItemStore.set(key, JSON.stringify(nvProps));
        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map) => {
            const newMap = new Map(map);
            const mapItem = map.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    valCorr: newCorr
                });
            }
            return newMap;
        });
    }

    /***********************************************************************************************
     * fn          setItemPos
     *
     */
    setItemPos(newPos: gIF.nsPos_t, keyVal: gIF.keyVal_t) {

        const key = keyVal.key;
        const item = keyVal.value;

        const nvProps: gIF.nvProps_t = {
            name: item.name,
            pos: newPos,
            style: item.style,
            valCorr: item.valCorr
        };

        window.electronItemStore.set(key, JSON.stringify(nvProps));
        this.nvPropsMap.set(key, nvProps);

        this.itemMap.update((map) => {
            const newMap = new Map(map);
            const mapItem = map.get(key);
            if(mapItem) {
                newMap.set(key, {
                    ...mapItem,
                    pos: newPos,
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

        const key = Array.from(
            this.txBuf.subarray(0, len),
            (byte) => byte.toString(16)
        );

        return `${ITEM}-${key.join('')}`;
    }

    /***********************************************************************************************
     * fn          xstatKey
     *
     */
    xstatKey(addr: number, endPoint: number) {

        this.rwBuf.wrIdx = 0;

        this.rwBuf.write_uint8(addr);
        this.rwBuf.write_uint8(endPoint);
        const len = this.rwBuf.wrIdx;

        const key = Array.from(
            this.txBuf.subarray(0, len),
            (byte) => byte.toString(16).padStart(2, '0')
        );

        return `${XSTAT}-${key.join('')}`;
    }

    /***********************************************************************************************
     * fn          delXstat
     *
     */
    delXstat(xstat: gIF.xstat_t) {

        const key = this.xstatKey(xstat.addr, xstat.endPoint);

        window.electronStatStore.delete(key);

        return key;
    }

    /***********************************************************************************************
     * fn          delAllXstat
     *
     */
    delAllXstat() {

        window.electronStatStore.clear();

        this.nvXstatsMap.clear();
    }

    /***********************************************************************************************
     * fn          storeXstat
     *
     */
    storeXstat(xstat: gIF.xstat_t) {

        const key = this.xstatKey(xstat.addr, xstat.endPoint);

        window.electronStatStore.set(key, JSON.stringify(xstat));

        this.nvXstatsMap.set(key, xstat);
    }

}

import { Injectable, Service, signal } from '@angular/core';
import * as gIF from '../gIF';
/*
@Injectable({
    providedIn: 'root',
})
*/
@Service()
export class UtilsService {

    msgLogs = signal<gIF.msgLogs_t[]>([]);

    constructor() {
        // ---
    }

    public timeStamp() {
        const now = new Date();
        const hours = now.getHours().toString(10).padStart(2, '0');
        const minutes = now.getMinutes().toString(10).padStart(2, '0');
        const seconds = now.getSeconds().toString(10).padStart(2, '0');
        return `<${hours}:${minutes}:${seconds}>`;
    }

    public secToTime(sec: number) {
        const hours = (Math.floor(sec / 3600)).toString(10).padStart(2, '0');
        sec %= 3600;
        const minutes = (Math.floor(sec / 60)).toString(10).padStart(2, '0');
        const seconds = (sec % 60).toString(10).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    public extToHex(extAddr: number) {
        //let buf = window.nw.Buffer.alloc(8);
        let buf = new Uint8Array(8);
        let bufView = new DataView(buf.buffer);
        bufView.setFloat64(0, extAddr, false);
        let extHex: string[] = [];
        for (let i = 0; i < 8; i++) {
            extHex[i] = bufView.getUint8(i).toString(16).padStart(2, '0').toUpperCase();
        }
        return extHex.join(':');
    }

    /***********************************************************************************************
     * @fn          hexToRGB
     *
     * @brief
     *
     */
    public hexToRGB(hex: string, alpha: number) {

        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        return `rgba(${r},${g},${b},${alpha})`;
    }

    public sendMsg(msg: string, color: string = 'black', id: number = 1000){
        const log = `${this.timeStamp()} ${msg}`;
        console.log(log);
        const msgLog: gIF.msgLogs_t = {
            text: log,
            color: color,
            id: id
        };
        const logs  = [...this.msgLogs()];
        const last_idx = logs.length - 1;
        const last = logs.slice(-1)[0];
        if(logs.length && (last.id === id) && (id === 7)){
            logs[last_idx] = msgLog;
        }
        else {
            while(logs.length >= 20) {
                logs.shift();
            }
            logs.push(msgLog);
        }
        this.msgLogs.set(logs);
    }

    /**
    * Converts a numeric value to a 4-character uppercase Hex string (e.g., 0x2A1F)
    */
    public hexWord(value: number): string {
        if(value === undefined || value === null) {
            return '0x0000';
        }

        return '0x' + value.toString(16).toUpperCase().padStart(4, '0');
    }

}


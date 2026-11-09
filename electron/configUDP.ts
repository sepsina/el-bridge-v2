import {
    ipcMain,
    WebContents,
    IpcMainEvent
} from 'electron';

import dgram from 'dgram';

export interface UdpPkt {
    payload: Uint8Array;
    address: string;
    port: number;
}

const UDP_PORT = 22802;
let udpSocket = {} as dgram.Socket;

export function cfgUDP(web_contents: WebContents): void {

    udpSocket = dgram.createSocket('udp4');

    udpSocket.on('error', (err) => {
        console.error(`udp error:\n${err.stack}`);
        udpSocket.close();
    });

    udpSocket.on('message', (udp_msg: Uint8Array, rem_info: dgram.RemoteInfo) => {
        // just forward to renderer
        const udpPkt: UdpPkt = {
            payload: udp_msg,
            address: rem_info.address,
            port: rem_info.port
        }
        web_contents.send('udp-packet-in', udpPkt);
    });

    udpSocket.bind(UDP_PORT);

    udpSocket.on('listening', () => {
        udpSocket.setBroadcast(true);
        const address = udpSocket.address();
        console.log(`server listening ${address.address}:${address.port}`);
    });

    ipcMain.on("udp-packet-out", (_event: IpcMainEvent, udp_pkt: UdpPkt)=>{
        udpSocket.send(
            udp_pkt.payload,
            udp_pkt.port,
            udp_pkt.address,
            (error: Error | null) => {
                if(error) {
                    console.error(`[UDP Transmit Error]: ${error.message}`);
                }
            }
        );
    });

    ipcMain.on("udp-close", (_event: IpcMainEvent, msg: string)=>{
        udpSocket.close();
        console.log(`close msg: ${msg}`);
    });
}

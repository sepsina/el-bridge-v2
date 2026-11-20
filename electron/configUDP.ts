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
let udpSocket: dgram.Socket | null = null;
let ipcRegistered = false;

function closeSocket(): void {
    if(udpSocket) {
        try {
            udpSocket.close();
        }
        catch {
            // already closed
        }
        udpSocket = null;
    }
}

export function cfgUDP(web_contents: WebContents): void {
    closeSocket(); // avoid leaking a previous socket

    const socket = dgram.createSocket('udp4');
    udpSocket = socket;

    //udpSocket = dgram.createSocket('udp4');

    udpSocket.on('error', (err) => {
        console.error(`udp error:\n${err.stack}`);
        closeSocket();
    });

    udpSocket.on('message', (udp_msg: Uint8Array, rem_info: dgram.RemoteInfo) => {
        if(web_contents.isDestroyed()) return;
        // just forward to renderer
        const udpPkt: UdpPkt = {
            payload: udp_msg,
            address: rem_info.address,
            port: rem_info.port
        }
        web_contents.send('udp-packet-in', udpPkt);
    });

    socket.on('listening', () => {
        socket.setBroadcast(true);
        const address = socket.address();
        console.log(`server listening ${address.address}:${address.port}`);
    });

    udpSocket.bind(UDP_PORT);

    web_contents.once('destroyed', closeSocket);

    // register global IPC listeners only once
    if(ipcRegistered) return;
    ipcRegistered = true;

    ipcMain.on("udp-packet-out", (_event: IpcMainEvent, udp_pkt: UdpPkt)=>{
        if(!udpSocket) return;
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
        closeSocket();
        console.log(`close msg: ${msg}`);
    });
}

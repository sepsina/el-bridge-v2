import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { cfgUSB } from './configUSB';
import { cfgUDP } from './configUDP';
import { cfgStore } from './configStore';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    cfgUSB(mainWindow.webContents);
    cfgUDP(mainWindow.webContents);
    cfgStore();

    // Check if we are running in development mode
    const isDev = !app.isPackaged;

    if(isDev){
        mainWindow.loadURL('http://localhost:4200');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../el-bridge-v2/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});


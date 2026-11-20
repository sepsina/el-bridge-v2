import { app, ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface BgConfig {
    bgPath: string;
}

let ipcRegistered = false;

const getConfigPath = (): string => path.join(app.getPath('userData'), 'bg-config.json');

async function getImageAsDataUrl(filePath: string): Promise<string | null> {
    try {
        const ext: string = path.extname(filePath).slice(1).toLowerCase();
        const mimeType: string = ext === 'jpg' ? 'jpeg' : ext;
        const base64: string = await fs.promises.readFile(filePath, { encoding: 'base64' });

        return `data:image/${mimeType};base64,${base64}`;
    }
    catch {
        return null; // missing or unreadable file
    }
}

async function readConfig(): Promise<BgConfig | null> {
    try {
        const config = JSON.parse(await fs.promises.readFile(getConfigPath(), 'utf-8'));
        return typeof config?.bgPath === 'string' ? config as BgConfig : null;
    }
    catch {
        return null; // missing or corrupted config
    }
}

export function cfgFS() {

    // register global IPC handlers only once
    if(ipcRegistered) return;
    ipcRegistered = true;

    // 1. Pick, clean up old file, copy new image, and save config
    ipcMain.handle('select-and-save-bg', async (event): Promise<string | null> => {

        const win = BrowserWindow.fromWebContents(event.sender);
        const options: Electron.OpenDialogOptions = {
            properties: ['openFile'],
            filters: [{
                name: 'Images',
                extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
            }]
        };

        const result = win
            ? await dialog.showOpenDialog(win, options)
            : await dialog.showOpenDialog(options);

        if(result.canceled || result.filePaths.length === 0) {
            return null;
        }

        try {
            const oldBgPath = (await readConfig())?.bgPath ?? null;

            const sourcePath: string = result.filePaths[0];
            const ext: string = path.extname(sourcePath).toLowerCase();
            const destPath: string = path.join(app.getPath('userData'), `custom-background${ext}`);

            await fs.promises.copyFile(sourcePath, destPath);
            await fs.promises.writeFile(getConfigPath(), JSON.stringify({ bgPath: destPath }, null, 2));

            // Remove the old file only if it is a different file from the new one
            if(oldBgPath && oldBgPath !== destPath) {
                await fs.promises.unlink(oldBgPath).catch(() => { /* already gone */ });
            }

            return await getImageAsDataUrl(destPath);
        }
        catch(err) {
            console.error(`[select-and-save-bg] ${(err as Error).message}`);
            return null;
        }
    });

    // 2. Load saved background on startup
    ipcMain.handle('get-saved-bg', async (): Promise<string | null> => {
        const config = await readConfig();
        return config ? getImageAsDataUrl(config.bgPath) : null;
    });
}

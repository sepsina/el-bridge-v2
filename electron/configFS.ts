import { app, ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface BgConfig {
  bgPath: string;
}

const userDataPath: string = app.getPath('userData');
const configPath: string = path.join(userDataPath, 'bg-config.json');

function getImageAsDataUrl(filePath: string): string | null {

    if (!fs.existsSync(filePath)) return null;

    const ext: string = path.extname(filePath).slice(1).toLowerCase();
    const mimeType: string = ext === 'jpg' ? 'jpeg' : ext;
    const base64: string = fs.readFileSync(filePath, { encoding: 'base64' });

    return `data:image/${mimeType};base64,${base64}`;
}

export function cfgFS() {

    // 1. Pick, clean up old file, copy new image, and save config
    ipcMain.handle('select-and-save-bg', async (): Promise<string | null> => {

        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{
                name: 'Images',
                extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp']
            }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        // Read old config before overwriting it
        let oldBgPath: string | null = null;
        if(fs.existsSync(configPath)) {
            try {
                const oldConfig: BgConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                oldBgPath = oldConfig.bgPath ?? null;
            }
            catch {
                // Ignore corrupted config read errors
            }
        }

        const sourcePath: string = result.filePaths[0];
        const ext: string = path.extname(sourcePath);
        const destPath: string = path.join(userDataPath, `custom-background${ext}`);

        fs.copyFileSync(sourcePath, destPath);
        fs.writeFileSync(configPath, JSON.stringify({ bgPath: destPath }, null, 2));

        // Remove the old file only if it is a different file from the new one
        if(oldBgPath && oldBgPath !== destPath && fs.existsSync(oldBgPath)) {
            fs.unlinkSync(oldBgPath);
        }

        return getImageAsDataUrl(destPath);
    });

    // 2. Load saved background on startup
    ipcMain.handle('get-saved-bg', (): string | null => {

        if (!fs.existsSync(configPath)) return null;

        try {
            const config: BgConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return getImageAsDataUrl(config.bgPath);
        }
        catch {
            return null;
        }
    });
}

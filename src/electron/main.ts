import { app, BrowserWindow, ipcMain, systemPreferences, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { SystemAudioCapture } from './audioCapture';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let systemAudioCapture: SystemAudioCapture | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false, // Disabled for security when using contextBridge
            contextIsolation: true, // Required for contextBridge API
        },
    });

    // Load the app.
    // In DETACHED DEV MODE, we load the Vite dev server URL.
    // In PROD, we load the index.html from dist.
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:5999/#/native-audio');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'), { hash: 'native-audio' });
    }

    // Menu will be set globally via Menu.setApplicationMenu
    // mainWindow.setMenuBarVisibility(false); // REMOVED to allow native menu

    // Handle close to minimize to tray
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
            return false;
        }
    });
};

app.on('ready', () => {
    // Ask for permissions if needed (macOS mostly, but good practice)
    if (process.platform === 'darwin') {
        systemPreferences.askForMediaAccess('microphone');
    }

    createWindow();

    // Create Tray
    const iconPath = path.join(__dirname, 'icon.png');
    // Fallback for dev environment if not copied to dist
    const iconPathDev = path.join(__dirname, '../../src/electron/icon.png');

    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
        icon = nativeImage.createFromPath(iconPathDev);
    }

    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Abrir ULTRA Assistant', click: () => mainWindow?.show() },
        { type: 'separator' },
        {
            label: 'Sair', click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('ULTRA IA Assistant');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow?.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow?.show();
        }
    });



    // Create Native Application Menu
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'Arquivo',
            submenu: [
                { role: 'quit', label: 'Sair' }
            ]
        },
        {
            label: 'Editar',
            submenu: [
                { role: 'undo', label: 'Desfazer' },
                { role: 'redo', label: 'Refazer' },
                { type: 'separator' },
                { role: 'cut', label: 'Cortar' },
                { role: 'copy', label: 'Copiar' },
                { role: 'paste', label: 'Colar' },
                { role: 'delete', label: 'Excluir' },
                { type: 'separator' },
                { role: 'selectAll', label: 'Selecionar Tudo' }
            ]
        },
        {
            label: 'Exibir',
            submenu: [
                { role: 'reload', label: 'Recarregar' },
                { role: 'forceReload', label: 'Forçar Recarregamento' },
                { role: 'toggleDevTools', label: 'Ferramentas de Desenvolvedor' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Resetar Zoom' },
                { role: 'zoomIn', label: 'Aumentar Zoom' },
                { role: 'zoomOut', label: 'Diminuir Zoom' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Tela Cheia' }
            ]
        },
        {
            label: 'Janela',
            submenu: [
                { role: 'minimize', label: 'Minimizar' },
                { role: 'zoom', label: 'Zoom' },
                { role: 'close', label: 'Fechar' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Setup IPC handlers associated with menu actions if needed
    setupAudioCaptureHandlers();

    // Setup Backend Spawning for PROD would go here
    // For now, in Detached Mode, we assume Backend is running on port 8000
    console.log("Electron ready. Waiting for Frontend on http://localhost:5999");
});

/**
 * Setup IPC handlers for system audio capture
 */
function setupAudioCaptureHandlers() {
    // Start system audio capture
    ipcMain.handle('audio-capture:start', async (event, options) => {
        try {
            if (systemAudioCapture && systemAudioCapture.isActive()) {
                return { success: true, message: 'Already capturing' };
            }

            // Create new capture instance
            systemAudioCapture = new SystemAudioCapture({
                sampleRate: options?.sampleRate || 16000,
                channels: options?.channels || 1,
                format: options?.format || 'pcm',
                onData: (chunk: Buffer) => {
                    // Send audio data to renderer
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('audio-capture:data', chunk);
                    }
                },
                onError: (error: Error) => {
                    console.error('System audio capture error:', error);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('audio-capture:error', error.message);
                    }
                },
            });

            await systemAudioCapture.start();
            return { success: true, message: 'System audio capture started' };
        } catch (error: any) {
            console.error('Failed to start system audio capture:', error);
            const errorMessage = error.message || String(error);

            // Provide more helpful error message for missing loopback device
            let userFriendlyMessage = errorMessage;
            if (errorMessage.includes('loopback') || errorMessage.includes('Stereo Mix')) {
                userFriendlyMessage =
                    'Dispositivo de loopback nao encontrado.\n\n' +
                    'Para capturar audio do sistema, voce precisa:\n' +
                    '1. Ativar "Stereo Mix" nas configuracoes do Windows:\n' +
                    '   Configuracoes > Sistema > Som > Gravação\n' +
                    '   Clique com botao direito > Mostrar dispositivos desabilitados\n' +
                    '   Ative "Stereo Mix"\n\n' +
                    'OU\n\n' +
                    '2. Instalar VB-Audio Cable (gratuito):\n' +
                    '   https://vb-audio.com/Cable/\n\n' +
                    'Erro original: ' + errorMessage;
            }

            return { success: false, error: userFriendlyMessage };
        }
    });

    // Stop system audio capture
    ipcMain.handle('audio-capture:stop', async () => {
        try {
            if (systemAudioCapture) {
                systemAudioCapture.stop();
                systemAudioCapture = null;
                return { success: true, message: 'System audio capture stopped' };
            }
            return { success: true, message: 'Not capturing' };
        } catch (error: any) {
            console.error('Failed to stop system audio capture:', error);
            return { success: false, error: error.message };
        }
    });

    // Check if capturing
    ipcMain.handle('audio-capture:status', async () => {
        return {
            isCapturing: systemAudioCapture ? systemAudioCapture.isActive() : false,
        };
    });

    // Test audio capture - verify data flow
    ipcMain.handle('audio-capture:test', async () => {
        if (!systemAudioCapture || !systemAudioCapture.isActive()) {
            return { success: false, error: 'Audio capture is not active' };
        }

        // Return current status
        return {
            success: true,
            isActive: systemAudioCapture.isActive(),
            message: 'Audio capture is active. Check console for data flow.'
        };
    });

    // List available audio devices
    ipcMain.handle('audio-capture:list-devices', async () => {
        try {
            console.log('Listing audio devices...');
            const { SystemAudioCapture } = await import('./audioCapture');
            const ffmpegPath = await SystemAudioCapture.findFFmpeg();

            console.log('FFmpeg path:', ffmpegPath);

            if (!ffmpegPath) {
                console.error('FFmpeg not found');
                return { success: false, error: 'FFmpeg not found. Please install FFmpeg and add it to PATH.' };
            }

            console.log('Calling listDirectShowDevices...');
            const devices = await SystemAudioCapture.listDirectShowDevices(ffmpegPath);
            console.log('Found devices:', devices.length, devices);

            return { success: true, devices };
        } catch (error: any) {
            console.error('Failed to list audio devices:', error);
            console.error('Error stack:', error.stack);
            return { success: false, error: error.message || 'Unknown error' };
        }
    });
}

// Cleanup on app quit
app.on('before-quit', () => {
    if (systemAudioCapture) {
        systemAudioCapture.stop();
        systemAudioCapture = null;
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

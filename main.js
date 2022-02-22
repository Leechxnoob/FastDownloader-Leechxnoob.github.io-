const {app, BrowserWindow, ipcMain, dialog} = require('electron');
const {autoUpdater} = require('electron-updater');

const console = require('console');

const Store = require('electron-store');
Store.initRenderer();

let win = null;

function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 600,
        minWidth: 900,
        minHeight: 600,
        center: true,
        autoHideMenuBar: true,
        icon: __dirname + "/app/assets/ico/icon_64x64.png",
        webPreferences: {
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            nodeIntegrationInSubFrames: true,
            enableRemoteModule: true,
            contextIsolation: false //required flag
        }
    });

    win.loadFile('app/index.html');

    win.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    if (win === null) createWindow();
});

app.whenReady().then(createWindow);

ipcMain.on('app_version', (event) => {
    event.sender.send('app_version', {version: app.getVersion()});
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.on("open_file_dialog", (event) => {
    dialog.showOpenDialog({
        properties: ['openDirectory']
    }).then(function (files) {
        if (!files.canceled)
            win.webContents.send('selected_file', files.filePaths);
    });
});

autoUpdater.on('update-available', () => {
    win.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update_downloaded');
});
const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const url = require('url');

// 获取应用根目录
function getAppPath() {
  // 在打包后的应用中，__dirname 指向 app.asar/electron/
  // 所以需要向上一级到 app.asar/，然后进入 dist/public/
  return path.join(__dirname, '..', 'dist', 'public');
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Urban Tarot',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    // macOS 特定设置
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a12',
  });

  // 加载打包后的前端文件
  const indexPath = path.join(getAppPath(), 'index.html');
  mainWindow.loadFile(indexPath);

  // 开发时可以打开开发者工具
  // mainWindow.webContents.openDevTools();
}

// 注册自定义协议来处理本地文件
function setupProtocol() {
  protocol.handle('file', (request) => {
    const requestUrl = request.url;
    let filePath = '';
    
    try {
      // 解析 file:// URL
      const parsedUrl = new URL(requestUrl);
      filePath = decodeURIComponent(parsedUrl.pathname);
      
      // Windows 路径处理
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }
    } catch (e) {
      filePath = decodeURIComponent(requestUrl.replace('file://', ''));
    }
    
    return net.fetch(url.pathToFileURL(filePath).toString());
  });
}

// 当 Electron 完成初始化时创建窗口
app.whenReady().then(() => {
  setupProtocol();
  createWindow();

  // macOS 上点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

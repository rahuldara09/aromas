const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  const win = new BrowserWindow({
    width: 300,
    height: 200,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(() => {
  // Start your printer server directly in the main process
  // This avoids the "spawn node ENOENT" error in packaged apps
  try {
    require("./server.js");
    console.log("Printer server started successfully");
  } catch (err) {
    console.error("Failed to start printer server:", err);
  }

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

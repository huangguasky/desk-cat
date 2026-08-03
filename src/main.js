const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createDragState, positionFromDrag } = require('./drag-state');

const WINDOW_SIZE = 200;
const EDGE_MARGIN = 18;

let petWindow = null;
let tray = null;
let alwaysOnTop = true;
let saveTimer = null;
let dragState = null;
let dragStats = { received: 0, begins: 0, moves: 0, ends: 0, lastPointer: null };
let rendererMessages = [];

const isDiagnosticRun = Boolean(process.env.DESK_PET_DRAG_TEST_PATH || process.env.DESK_PET_CAPTURE_PATH);

if (!isDiagnosticRun && !app.requestSingleInstanceLock()) {
  app.quit();
}

function preferencesPath() {
  return path.join(app.getPath('userData'), 'pet-preferences.json');
}

function readPreferences() {
  try {
    return JSON.parse(fs.readFileSync(preferencesPath(), 'utf8'));
  } catch {
    return {};
  }
}

function savePreferencesNow() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const { x, y } = petWindow.getBounds();
  const data = { x, y, alwaysOnTop };
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(preferencesPath(), JSON.stringify(data, null, 2));
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(savePreferencesNow, 180);
}

function defaultPosition() {
  const point = screen.getCursorScreenPoint();
  const { workArea } = screen.getDisplayNearestPoint(point);
  return {
    x: workArea.x + workArea.width - WINDOW_SIZE - EDGE_MARGIN,
    y: workArea.y + workArea.height - WINDOW_SIZE - EDGE_MARGIN,
  };
}

function safePosition(saved) {
  if (!Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return defaultPosition();
  const candidate = { x: saved.x, y: saved.y, width: WINDOW_SIZE, height: WINDOW_SIZE };
  const display = screen.getDisplayMatching(candidate);
  const { workArea } = display;
  return {
    x: Math.min(Math.max(saved.x, workArea.x), workArea.x + workArea.width - WINDOW_SIZE),
    y: Math.min(Math.max(saved.y, workArea.y), workArea.y + workArea.height - WINDOW_SIZE),
  };
}

function applyAlwaysOnTop(enabled) {
  alwaysOnTop = Boolean(enabled);
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setAlwaysOnTop(alwaysOnTop, alwaysOnTop ? 'floating' : 'normal');
  petWindow.webContents.send('pet:always-on-top', alwaysOnTop);
  scheduleSave();
  refreshTrayMenu();
}

function sendCommand(command) {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:command', command);
}

function returnToCorner() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const point = defaultPosition();
  petWindow.setPosition(point.x, point.y, true);
  sendCommand('idle');
  scheduleSave();
}

function menuTemplate(includeExit = true) {
  const template = [
    {
      label: '保持置顶',
      type: 'checkbox',
      checked: alwaysOnTop,
      click: (item) => applyAlwaysOnTop(item.checked),
    },
    { label: '回到桌面右下角', click: returnToCorner },
  ];
  if (includeExit) {
    template.push({ type: 'separator' }, { label: '退出桌面猫咪', click: () => app.quit() });
  }
  return template;
}

function refreshTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate(true)));
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icons', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') icon.setTemplateImage(false);
  tray = new Tray(icon);
  tray.setToolTip('Mikan Desk Cat');
  refreshTrayMenu();
}

async function runDragDiagnostic(outputPath) {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setIgnoreMouseEvents(true);
  const initial = petWindow.getBounds();
  const devtools = petWindow.webContents.debugger;
  devtools.attach('1.3');
  try {
    const evaluation = await devtools.sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const target = document.querySelector('#pet');
        const emit = (type, screenX, screenY, buttons) => target.dispatchEvent(new PointerEvent(type, {
          bubbles: true, button: 0, buttons, pointerId: 7, pointerType: 'mouse', screenX, screenY,
        }));
        emit('pointerdown', ${initial.x + 160}, ${initial.y + 160}, 1);
        emit('pointermove', ${initial.x + 220}, ${initial.y + 200}, 1);
        emit('pointerup', ${initial.x + 220}, ${initial.y + 200}, 0);
        emit('pointermove', ${initial.x + 226}, ${initial.y + 204}, 0);
        return {
          deskPet: typeof window.deskPet,
          spriteClass: document.querySelector('#sprite')?.className,
        };
      })()`,
      returnByValue: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 220));
    const actual = petWindow.getBounds();
    await devtools.sendCommand('Runtime.evaluate', {
      expression: `(() => {
        const target = document.querySelector('#pet');
        const emit = (type, screenX, screenY, buttons) => target.dispatchEvent(new PointerEvent(type, {
          bubbles: true, button: 0, buttons, pointerId: 9, pointerType: 'mouse', screenX, screenY,
        }));
        emit('pointerdown', ${initial.x + 120}, ${initial.y + 120}, 1);
        emit('pointermove', ${initial.x + 122}, ${initial.y + 121}, 1);
        emit('pointerup', ${initial.x + 122}, ${initial.y + 121}, 0);
      })()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 320));
    const clickPoseResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').className`, returnByValue: true,
    });
    await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#pet').dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, button: 0, buttons: 0, pointerId: 10, pointerType: 'mouse',
        screenX: ${initial.x + 128}, screenY: ${initial.y + 124},
      }))`,
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    const poseAfterMoveResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').className`, returnByValue: true,
    });
    await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#pet').dispatchEvent(new MouseEvent('mouseleave'))`,
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    const poseAfterLeaveResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').className`, returnByValue: true,
    });
    const clickPose = clickPoseResult.result.value;
    const poseAfterMove = poseAfterMoveResult.result.value;
    const poseAfterLeave = poseAfterLeaveResult.result.value;
    const clickMovePassed = clickPose === poseAfterMove && clickPose === poseAfterLeave && !clickPose.includes('pose-idle');

    sendCommand('sleep');
    await new Promise((resolve) => setTimeout(resolve, 60));
    const sleepPoseResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').className`, returnByValue: true,
    });
    await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#pet').dispatchEvent(new MouseEvent('mouseenter'))`,
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    const wakePoseResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').className`, returnByValue: true,
    });
    const firstWakeUrlResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').src`, returnByValue: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 2_100));
    const idleAfterWakeResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').className`, returnByValue: true,
    });
    const sleepPose = sleepPoseResult.result.value;
    const wakePose = wakePoseResult.result.value;
    const idleAfterWake = idleAfterWakeResult.result.value;
    const sleepWakePassed = sleepPose.includes('pose-sleep')
      && wakePose === 'sprite pose-wakeScratch'
      && idleAfterWake === 'sprite pose-idle';

    sendCommand('sleep');
    await new Promise((resolve) => setTimeout(resolve, 60));
    await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#pet').dispatchEvent(new MouseEvent('mouseenter'))`,
    });
    await new Promise((resolve) => setTimeout(resolve, 60));
    const secondWakeUrlResult = await devtools.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('#sprite').src`, returnByValue: true,
    });
    const firstWakeUrl = firstWakeUrlResult.result.value;
    const secondWakeUrl = secondWakeUrlResult.result.value;
    const wakeReplayPassed = firstWakeUrl.includes('wake-scratch.gif?play=')
      && secondWakeUrl.includes('wake-scratch.gif?play=')
      && firstWakeUrl !== secondWakeUrl;
    const result = {
      initial: { x: initial.x, y: initial.y },
      actual: { x: actual.x, y: actual.y },
      movedBy: { x: actual.x - initial.x, y: actual.y - initial.y },
      passed: (actual.x !== initial.x || actual.y !== initial.y)
        && clickMovePassed
        && sleepWakePassed
        && wakeReplayPassed,
      events: dragStats,
      evaluation,
      clickMoveTest: { clickPose, poseAfterMove, poseAfterLeave, passed: clickMovePassed },
      sleepWakeTest: { sleepPose, wakePose, idleAfterWake, passed: sleepWakePassed },
      oneShotReplayTest: {
        firstWakeUrl,
        secondWakeUrl,
        wakeReplayPassed,
      },
      rendererMessages,
    };
    fs.writeFileSync(path.resolve(outputPath), JSON.stringify(result, null, 2));
  } finally {
    if (devtools.isAttached()) devtools.detach();
    app.quit();
  }
}

function createWindow() {
  const preferences = readPreferences();
  alwaysOnTop = preferences.alwaysOnTop !== false;
  const position = safePosition(preferences);

  petWindow = new BrowserWindow({
    ...position,
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    minWidth: WINDOW_SIZE,
    minHeight: WINDOW_SIZE,
    maxWidth: WINDOW_SIZE,
    maxHeight: WINDOW_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop,
    skipTaskbar: true,
    focusable: true,
    acceptFirstMouse: true,
    hiddenInMissionControl: true,
    show: false,
    type: process.platform === 'darwin' ? 'panel' : 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  petWindow.setAlwaysOnTop(alwaysOnTop, alwaysOnTop ? 'floating' : 'normal');
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.webContents.on('console-message', (details) => {
    rendererMessages.push(details.message);
  });
  petWindow.loadFile(path.join(__dirname, 'index.html'));
  petWindow.once('ready-to-show', () => {
    petWindow.showInactive();
    const dragTestPath = process.env.DESK_PET_DRAG_TEST_PATH;
    const capturePath = process.env.DESK_PET_CAPTURE_PATH;
    if (dragTestPath) {
      setTimeout(() => runDragDiagnostic(dragTestPath), 500);
    } else if (capturePath) {
      const capturePose = process.env.DESK_PET_CAPTURE_POSE;
      if (capturePose) sendCommand(capturePose);
      setTimeout(async () => {
        if (!petWindow || petWindow.isDestroyed()) return;
        const image = await petWindow.capturePage();
        fs.writeFileSync(path.resolve(capturePath), image.toPNG());
        app.quit();
      }, 700);
    }
  });
  petWindow.on('moved', scheduleSave);
  petWindow.on('closed', () => {
    dragState = null;
    petWindow = null;
  });
}

function isPetSender(event) {
  return Boolean(petWindow) && !petWindow.isDestroyed() && event.sender.id === petWindow.webContents.id;
}

ipcMain.on('pet:drag-begin', (event, pointer) => {
  dragStats.received += 1;
  if (!isPetSender(event)) return;
  dragStats.begins += 1;
  dragStats.lastPointer = pointer;
  const { x, y } = petWindow.getBounds();
  dragState = createDragState(pointer, { x, y });
});

ipcMain.on('pet:drag-move', (event, pointer) => {
  if (!isPetSender(event)) return;
  dragStats.moves += 1;
  dragStats.lastPointer = pointer;
  const position = positionFromDrag(dragState, pointer);
  if (!position) return;
  petWindow.setPosition(position.x, position.y);
});

ipcMain.on('pet:drag-end', (event) => {
  if (!isPetSender(event)) return;
  dragStats.ends += 1;
  dragState = null;
  scheduleSave();
});

ipcMain.on('pet:context-menu', (event) => {
  if (!isPetSender(event)) return;
  Menu.buildFromTemplate(menuTemplate(true)).popup({ window: petWindow });
});

app.on('second-instance', () => {
  if (petWindow && !petWindow.isDestroyed()) petWindow.showInactive();
});

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createWindow();
  createTray();
});

app.on('before-quit', () => {
  clearTimeout(saveTimer);
  savePreferencesNow();
});

app.on('window-all-closed', () => app.quit());

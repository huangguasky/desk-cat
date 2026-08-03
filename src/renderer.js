const {
  randomAmbientPose,
  randomSleepPose,
  isSleepPose,
  actionForPointerEnter,
  actionForLeftClick,
} = window.PetState;

const SLEEP_AFTER_MS = 90_000;
const DRAG_THRESHOLD_PX = 6;
const TEMPORARY_POSE_MS = 1_650;
const WAKE_SCRATCH_MS = 2_050;
const EAT_TREAT_MS = 2_050;
const AMBIENT_MIN_MS = 18_000;
const AMBIENT_MAX_MS = 32_000;

const POSE_IMAGES = Object.freeze({
  idle: 'idle.gif',
  surprised: 'surprised.gif',
  affection: 'affection.gif',
  carried: 'carried.gif',
  stalking: 'stalking.gif',
  grooming: 'grooming.gif',
  sleepRug: 'sleep-rug.gif',
  sleepBox: 'sleep-box.gif',
  sleepTower: 'sleep-tower.gif',
  wakeScratch: 'wake-scratch.gif',
  eatTreat: 'eat-treat.gif',
});
const RESTART_ON_PLAY = new Set(['wakeScratch']);

const pet = document.querySelector('#pet');
const sprite = document.querySelector('#sprite');
const zzz = document.querySelector('#zzz');
const sparkles = document.querySelector('#sparkles');

let previewDrag = null;
const bridge = window.deskPet ?? {
  beginDrag(x, y) {
    const rect = pet.getBoundingClientRect();
    previewDrag = { pointerX: x, pointerY: y, left: rect.left, top: rect.top };
    pet.style.left = `${rect.left}px`;
    pet.style.top = `${rect.top}px`;
  },
  dragTo(x, y) {
    if (!previewDrag) return;
    pet.style.left = `${previewDrag.left + x - previewDrag.pointerX}px`;
    pet.style.top = `${previewDrag.top + y - previewDrag.pointerY}px`;
  },
  endDrag() {
    previewDrag = null;
  },
  showContextMenu() {},
  onCommand() { return () => {}; },
};

if (!window.deskPet) document.documentElement.classList.add('browser-preview');

let currentPose = 'idle';
let poseToken = 0;
let sleepTimer = null;
let ambientTimer = null;
let sleepStartedAt = null;
let pointerStart = null;
let dragging = false;
let hoverBlockedUntilLeave = false;
let playbackSequence = 0;

function clearIdleTimers() {
  clearTimeout(sleepTimer);
  clearTimeout(ambientTimer);
  sleepTimer = null;
  ambientTimer = null;
}

function invalidateTemporaryPose() {
  ++poseToken;
}

function setPose(pose) {
  currentPose = pose;
  if (!isSleepPose(pose)) sleepStartedAt = null;
  if (pose !== 'affection') sparkles.classList.remove('is-visible');
  sprite.className = `sprite pose-${pose}`;
  const replay = RESTART_ON_PLAY.has(pose) ? `?play=${++playbackSequence}` : '';
  sprite.src = `../assets/generated/gifs/${POSE_IMAGES[pose]}${replay}`;
  zzz.classList.toggle('is-visible', isSleepPose(pose));
  sprite.alt = isSleepPose(pose) ? '正在睡觉的白色虎斑猫' : '一只白色虎斑猫';
}

function temporaryPose(pose, duration = TEMPORARY_POSE_MS) {
  const token = ++poseToken;
  setPose(pose);
  if (pose === 'affection') {
    sparkles.classList.remove('is-visible');
    void sparkles.offsetWidth;
    sparkles.classList.add('is-visible');
  }
  window.setTimeout(() => {
    if (poseToken !== token || dragging || currentPose !== pose) return;
    setPose('idle');
  }, duration);
}

function durationForPose(pose) {
  if (pose === 'eatTreat') return EAT_TREAT_MS;
  if (pose === 'affection') return 1_200;
  if (pose === 'stalking') return 1_150;
  if (pose === 'grooming') return 1_100;
  if (pose === 'surprised') return 1_000;
  return TEMPORARY_POSE_MS;
}

function armSleepTimer() {
  clearTimeout(sleepTimer);
  if (dragging || isSleepPose(currentPose)) {
    sleepTimer = null;
    return;
  }
  sleepTimer = window.setTimeout(sleepNow, SLEEP_AFTER_MS);
}

function armAmbientTimer() {
  clearTimeout(ambientTimer);
  if (dragging || isSleepPose(currentPose)) {
    ambientTimer = null;
    return;
  }
  const delay = AMBIENT_MIN_MS + Math.floor(Math.random() * (AMBIENT_MAX_MS - AMBIENT_MIN_MS + 1));
  ambientTimer = window.setTimeout(() => {
    ambientTimer = null;
    if (!dragging && !pointerStart && currentPose === 'idle') {
      const pose = randomAmbientPose();
      temporaryPose(pose, durationForPose(pose));
    }
    armAmbientTimer();
  }, delay);
}

function noteActivity() {
  if (dragging || isSleepPose(currentPose)) return;
  armSleepTimer();
  armAmbientTimer();
}

function sleepNow() {
  if (dragging) return false;
  clearIdleTimers();
  invalidateTemporaryPose();
  sleepStartedAt = Date.now();
  setPose(randomSleepPose());
  return true;
}

function playWakeScratch() {
  if (!isSleepPose(currentPose) || dragging) return false;
  clearIdleTimers();
  temporaryPose('wakeScratch', WAKE_SCRATCH_MS);
  noteActivity();
  return true;
}

function beginPotentialDrag(event) {
  if (event.button !== 0 || pointerStart) return;
  clearIdleTimers();
  pointerStart = {
    x: event.screenX,
    y: event.screenY,
    id: event.pointerId,
    pose: currentPose,
  };
  try {
    pet.setPointerCapture(event.pointerId);
  } catch {
    // Some synthetic/test pointers cannot be captured; native mouse input still can.
  }
}

function movePotentialDrag(event) {
  if (!pointerStart || event.pointerId !== pointerStart.id) return;

  const dx = event.screenX - pointerStart.x;
  const dy = event.screenY - pointerStart.y;
  if (!dragging && Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
    dragging = true;
    hoverBlockedUntilLeave = true;
    clearIdleTimers();
    invalidateTemporaryPose();
    setPose('carried');
    bridge.beginDrag(pointerStart.x, pointerStart.y);
    document.body.classList.add('is-dragging');
  }
  if (dragging) bridge.dragTo(event.screenX, event.screenY);
}

function releasePointerCapture(pointerId) {
  try {
    if (pet.hasPointerCapture(pointerId)) pet.releasePointerCapture(pointerId);
  } catch {
    // Ignore unsupported pointer capture in browser previews and synthetic tests.
  }
}

function finishPointer(event) {
  if (!pointerStart || event.pointerId !== pointerStart.id) return;
  const start = pointerStart;
  const wasDragging = dragging;
  const wasCancelled = event.type === 'pointercancel';

  pointerStart = null;
  dragging = false;
  document.body.classList.remove('is-dragging');
  releasePointerCapture(event.pointerId);

  if (wasDragging) {
    bridge.endDrag();
    invalidateTemporaryPose();
    setPose('idle');
    noteActivity();
    return;
  }

  if (wasCancelled) {
    noteActivity();
    return;
  }

  const action = start.pose === currentPose ? actionForLeftClick(currentPose) : null;
  if (action === 'wakeScratch') {
    playWakeScratch();
    return;
  }
  if (action) {
    noteActivity();
    temporaryPose(action, durationForPose(action));
    return;
  }

  noteActivity();
}

pet.addEventListener('pointerdown', beginPotentialDrag);
pet.addEventListener('pointermove', movePotentialDrag);
pet.addEventListener('pointerup', finishPointer);
pet.addEventListener('pointercancel', finishPointer);

pet.addEventListener('mouseenter', () => {
  if (hoverBlockedUntilLeave) return;
  const action = actionForPointerEnter(currentPose, sleepStartedAt);
  if (action === 'wakeScratch') {
    playWakeScratch();
    return;
  }
  if (!action) return;
  noteActivity();
  temporaryPose(action, durationForPose(action));
});

pet.addEventListener('mouseleave', () => {
  if (!dragging && !pointerStart) hoverBlockedUntilLeave = false;
});

pet.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  bridge.showContextMenu();
});

bridge.onCommand((command) => {
  if (dragging) return;
  if (command === 'sleep') sleepNow();
  else if (command === 'idle') {
    clearIdleTimers();
    invalidateTemporaryPose();
    setPose('idle');
    noteActivity();
  }
  // Pose commands are retained only for the packaged asset-capture diagnostic.
  else if (['surprised', 'affection', 'grooming', 'stalking', 'eatTreat', 'wakeScratch'].includes(command)) {
    clearIdleTimers();
    temporaryPose(command, durationForPose(command));
    noteActivity();
  }
});

armSleepTimer();
armAmbientTimer();

(function initPetState(globalScope) {
const POSES = Object.freeze({
  idle: 0,
  surprised: 1,
  affection: 2,
  carried: 3,
  stalking: 4,
  grooming: 5,
  sleepRug: 6,
  sleepBox: 7,
  sleepTower: 8,
  wakeScratch: 9,
  eatTreat: 10,
});

const CLICK_POSES = Object.freeze([
  'affection',
  'stalking',
  'eatTreat',
  'grooming',
  'surprised',
]);

const HOVER_POSES = Object.freeze(['affection', 'stalking']);
const AMBIENT_POSES = Object.freeze(['surprised', 'grooming']);

const SLEEP_POSES = Object.freeze(['sleepRug', 'sleepBox', 'sleepTower']);
const RECENT_SLEEP_MS = 30_000;

function pick(items, random = Math.random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
  return items[Math.floor(normalized * items.length)];
}

function randomClickPose(random = Math.random) {
  return pick(CLICK_POSES, random);
}

function randomSleepPose(random = Math.random) {
  return pick(SLEEP_POSES, random);
}

function randomHoverPose(random = Math.random) {
  return pick(HOVER_POSES, random);
}

function randomAmbientPose(random = Math.random) {
  return pick(AMBIENT_POSES, random);
}

function isSleepPose(pose) {
  return SLEEP_POSES.includes(pose);
}

function canStartClickPose(pose) {
  return pose === 'idle';
}

function isRecentSleep(startedAt, now = Date.now()) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return false;
  const elapsed = now - startedAt;
  return elapsed >= 0 && elapsed < RECENT_SLEEP_MS;
}

function actionForPointerEnter(pose, sleepStartedAt, now = Date.now(), random = Math.random) {
  if (pose === 'idle') return randomHoverPose(random);
  if (isSleepPose(pose) && isRecentSleep(sleepStartedAt, now)) return 'wakeScratch';
  return null;
}

function actionForLeftClick(pose, random = Math.random) {
  if (pose === 'idle') return randomClickPose(random);
  if (isSleepPose(pose)) return 'wakeScratch';
  return null;
}

const PetState = {
  POSES,
  CLICK_POSES,
  HOVER_POSES,
  AMBIENT_POSES,
  SLEEP_POSES,
  RECENT_SLEEP_MS,
  randomClickPose,
  randomSleepPose,
  randomHoverPose,
  randomAmbientPose,
  isSleepPose,
  canStartClickPose,
  isRecentSleep,
  actionForPointerEnter,
  actionForLeftClick,
};

if (typeof module !== 'undefined' && module.exports) module.exports = PetState;
if (globalScope) globalScope.PetState = PetState;
})(typeof window !== 'undefined' ? window : globalThis);

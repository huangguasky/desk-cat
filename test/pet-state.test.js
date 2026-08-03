const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  POSES,
  CLICK_POSES,
  HOVER_POSES,
  AMBIENT_POSES,
  SLEEP_POSES,
  randomClickPose,
  randomSleepPose,
  randomHoverPose,
  randomAmbientPose,
  isSleepPose,
  canStartClickPose,
  RECENT_SLEEP_MS,
  isRecentSleep,
  actionForPointerEnter,
  actionForLeftClick,
} = require('../src/pet-state');
const { createDragState, positionFromDrag } = require('../src/drag-state');

test('the pet has eleven unique pose slots', () => {
  assert.equal(Object.keys(POSES).length, 11);
  assert.equal(new Set(Object.values(POSES)).size, 11);
});

test('left click can select every interactive pose', () => {
  const samples = [0, 0.2, 0.4, 0.6, 0.999999].map((value) => randomClickPose(() => value));
  assert.deepEqual(samples, CLICK_POSES);
});

test('hover and ambient actions use only their requested pose groups', () => {
  assert.deepEqual([randomHoverPose(() => 0), randomHoverPose(() => 0.999999)], HOVER_POSES);
  assert.deepEqual([randomAmbientPose(() => 0), randomAmbientPose(() => 0.999999)], AMBIENT_POSES);
});

test('sleep chooses only the three requested sleeping places', () => {
  assert.equal(randomSleepPose(() => 0), 'sleepRug');
  assert.equal(randomSleepPose(() => 0.5), 'sleepBox');
  assert.equal(randomSleepPose(() => 0.999999), 'sleepTower');
  assert.ok(SLEEP_POSES.every(isSleepPose));
  assert.equal(isSleepPose('idle'), false);
});

test('out-of-range random values are safely clamped', () => {
  assert.equal(randomClickPose(() => -4), CLICK_POSES[0]);
  assert.equal(randomClickPose(() => 99), CLICK_POSES.at(-1));
  assert.equal(randomSleepPose(() => Number.NaN), SLEEP_POSES[0]);
});

test('left click animations can start only while the pet is idle', () => {
  assert.equal(canStartClickPose('idle'), true);
  assert.equal(canStartClickPose('affection'), false);
  assert.equal(canStartClickPose('carried'), false);
  assert.equal(canStartClickPose('sleepTower'), false);
  assert.equal(canStartClickPose('wakeScratch'), false);
  assert.equal(canStartClickPose('eatTreat'), false);
});

test('recent sleep lasts thirty seconds', () => {
  const startedAt = 1_000;
  assert.equal(isRecentSleep(startedAt, startedAt), true);
  assert.equal(isRecentSleep(startedAt, startedAt + RECENT_SLEEP_MS - 1), true);
  assert.equal(isRecentSleep(startedAt, startedAt + RECENT_SLEEP_MS), false);
  assert.equal(isRecentSleep(null, startedAt), false);
});

test('pointer enter acts only from idle or recent sleep', () => {
  const now = 50_000;
  assert.equal(actionForPointerEnter('idle', null, now, () => 0), 'affection');
  assert.equal(actionForPointerEnter('idle', null, now, () => 0.999999), 'stalking');
  assert.equal(actionForPointerEnter('sleepBox', now - 1_000, now, () => 0), 'wakeScratch');
  assert.equal(actionForPointerEnter('sleepBox', now - RECENT_SLEEP_MS, now, () => 0), null);
  assert.equal(actionForPointerEnter('wakeScratch', null, now, () => 0), null);
  assert.equal(actionForPointerEnter('grooming', null, now, () => 0), null);
  assert.equal(actionForPointerEnter('carried', null, now, () => 0), null);
});

test('recent-sleep hover resolves to one wake action and never an idle action', () => {
  const now = 80_000;
  for (const sleepPose of SLEEP_POSES) {
    assert.equal(actionForPointerEnter(sleepPose, now - 2_000, now, () => 0), 'wakeScratch');
    assert.equal(actionForPointerEnter(sleepPose, now - 2_000, now, () => 0.999999), 'wakeScratch');
  }
});

test('left click acts only from idle or sleep', () => {
  assert.equal(actionForLeftClick('idle', () => 0), 'affection');
  assert.equal(actionForLeftClick('idle', () => 0.2), 'stalking');
  assert.equal(actionForLeftClick('idle', () => 0.4), 'eatTreat');
  assert.equal(actionForLeftClick('idle', () => 0.6), 'grooming');
  assert.equal(actionForLeftClick('idle', () => 0.999999), 'surprised');
  for (const sleepPose of SLEEP_POSES) assert.equal(actionForLeftClick(sleepPose), 'wakeScratch');
  assert.equal(actionForLeftClick('affection'), null);
  assert.equal(actionForLeftClick('wakeScratch'), null);
  assert.equal(actionForLeftClick('carried'), null);
});

test('drag position follows the pointer without an asynchronous renderer lookup', () => {
  const state = createDragState({ x: 800, y: 500 }, { x: 620, y: 340 });
  assert.deepEqual(positionFromDrag(state, { x: 845, y: 472 }), { x: 665, y: 312 });
  assert.equal(positionFromDrag(null, { x: 1, y: 2 }), null);
});

test('eat-treat is an infinitely looping GIF', () => {
  const gifPath = path.join(__dirname, '..', 'assets', 'generated', 'gifs', 'eat-treat.gif');
  const gif = fs.readFileSync(gifPath);
  const loopExtension = Buffer.from('21ff0b4e45545343415045322e300301000000', 'hex');
  assert.notEqual(gif.indexOf(loopExtension), -1);
});

function isFinitePoint(point) {
  return Boolean(point) && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function createDragState(pointer, windowPosition) {
  if (!isFinitePoint(pointer) || !isFinitePoint(windowPosition)) return null;
  return {
    pointerX: pointer.x,
    pointerY: pointer.y,
    windowX: windowPosition.x,
    windowY: windowPosition.y,
  };
}

function positionFromDrag(state, pointer) {
  if (!state || !isFinitePoint(pointer)) return null;
  return {
    x: Math.round(state.windowX + pointer.x - state.pointerX),
    y: Math.round(state.windowY + pointer.y - state.pointerY),
  };
}

module.exports = { createDragState, positionFromDrag };

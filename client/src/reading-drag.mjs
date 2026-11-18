import { canPlaceAt, clampPlacement } from './reading-layout.mjs';

const finitePoint = point => !!point && Number.isFinite(point.x) && Number.isFinite(point.z);

/** Pointer previews stay separate from the reading model until a gesture ends. */
export function createCardDrag(id, event, point, origin) {
  const placed = origin ? { x: origin.x, z: origin.z } : null;
  return {
    id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
    started: false, fromDeck: !origin, point: placed ?? { x: point.x, z: point.z },
    offsetX: origin ? origin.x - point.x : 0, offsetZ: origin ? origin.z - point.z : 0,
    lastValid: placed, valid: false,
  };
}

/** Apply the same bounded target to preview and release. Once a card reaches
 * the playing area it holds its last valid position when the pointer leaves. */
export function updateCardDrag(drag, event, point, insideCanvas) {
  if (!drag || drag.pointerId !== event.pointerId) return false;
  drag.started ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7;
  const target = finitePoint(point) ? { x: point.x + drag.offsetX, z: point.z + drag.offsetZ } : null;
  drag.valid = !!insideCanvas && canPlaceAt(target);
  if (drag.valid) {
    drag.point = clampPlacement(target);
    drag.lastValid = drag.point;
  } else if (drag.lastValid) drag.point = drag.lastValid;
  // A card still leaving the fan may follow the pointer until its first valid
  // table position; interruption never turns this preview into a new draw.
  else if (target) drag.point = target;
  return true;
}

/** Incidental interruption settles an existing card. Escape cancels it;
 * releasing outside the accepted area still rejects the drop. */
export function finishCardDrag(drag, reason, pointerId = drag?.pointerId) {
  if (!drag || drag.pointerId !== pointerId) return { handled: false, action: null, invalidDrop: false };
  const target = reason === 'release' && drag.valid ? drag.point
    : reason === 'interrupt' && !drag.fromDeck ? drag.lastValid : null;
  return {
    handled: true,
    action: drag.started && target ? { type: drag.fromDeck ? 'draw' : 'move', id: drag.id, ...target } : null,
    invalidDrop: reason === 'release' && drag.started && !drag.valid,
  };
}

export function finishViewDrag(drag, currentView, reason) {
  return { ...(reason === 'cancel' ? drag.startView : currentView) };
}

/** ResizeObserver also reports its initial observation and unchanged layouts. */
export function viewportChanged(previous, next) {
  return !previous || previous.width !== next.width || previous.height !== next.height;
}

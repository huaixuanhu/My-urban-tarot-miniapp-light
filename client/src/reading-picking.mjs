import * as THREE from 'three';
import { CARD_WIDTH, CARD_LENGTH } from './motion.mjs';

// Stable, unexpanded card planes own picking. This works from every allowed
// camera angle without a screen-aligned bounding box swallowing blank table.
export function pickFan(ray, candidates) {
  let best = null, score = Infinity;
  const rotation = new THREE.Quaternion(), normal = new THREE.Vector3();
  const center = new THREE.Vector3(), hit = new THREE.Vector3(), local = new THREE.Vector3();
  const plane = new THREE.Plane();
  for (const { id, pose } of candidates) {
    rotation.setFromEuler(new THREE.Euler(pose.rx, pose.ry, pose.rz, 'XYZ'));
    center.set(pose.x, pose.y, pose.z);
    normal.set(0, 1, 0).applyQuaternion(rotation);
    plane.setFromNormalAndCoplanarPoint(normal, center);
    if (!ray.intersectPlane(plane, hit)) continue;
    local.copy(hit).sub(center).applyQuaternion(rotation.invert());
    if (Math.abs(local.x) > CARD_WIDTH / 2 + 0.06 || Math.abs(local.z) > CARD_LENGTH / 2 + 0.06) continue;
    const distance = Math.abs(hit.x - center.x);
    if (distance < score) { score = distance; best = id; }
  }
  return best;
}

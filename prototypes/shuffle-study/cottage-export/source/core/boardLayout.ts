/** One placement for the visible board, its walking clearance, and its entrance. */
export const MATH_BOARD = {
  position: { x: 1.5, z: -3.35 },
  heading: .48,
  approach: { x: 2.03, z: -2.33 },
};

// Include the frame and wheeled feet, then let navigation add its normal person margin.
const halfWidth = .84, halfDepth = .31;
const extentX = Math.cos(MATH_BOARD.heading) * halfWidth + Math.sin(MATH_BOARD.heading) * halfDepth;
const extentZ = Math.sin(MATH_BOARD.heading) * halfWidth + Math.cos(MATH_BOARD.heading) * halfDepth;
export const MATH_BOARD_OBSTACLE = {
  minX: MATH_BOARD.position.x - extentX,
  maxX: MATH_BOARD.position.x + extentX,
  minZ: MATH_BOARD.position.z - extentZ,
  maxZ: MATH_BOARD.position.z + extentZ,
};

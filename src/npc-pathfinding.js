// NPC pathfinding — waypoint graph from road intersections, A* path calculation
//
// Builds a graph of nodes at road intersections and endpoints.
// NPCs find the shortest path via A* then walk along the waypoint list.
// Sidewalk offset keeps NPCs on the edge of roads, not in the middle.

// ========== ROAD DATA (mirrored from roads.js — static) ==========
const MAIN_ROADS = [
  { x: 0, z: 0, w: 8, d: 440, label: 'Main Street' },
  { x: 0, z: 180, w: 440, d: 8, label: 'Coast Road' },
  { x: 150, z: 40, w: 8, d: 360, label: 'East Blvd' },
  { x: -150, z: 30, w: 8, d: 360, label: 'West Ave' },
  { x: 0, z: 50, w: 440, d: 8, label: 'Cross Street' },
  { x: 0, z: -80, w: 400, d: 8, label: 'Industrial Rd' },
];

const SECONDARY_ROADS = [
  { x: -40, z: 20, w: 5, d: 60 },
  { x: 40, z: 20, w: 5, d: 60 },
  { x: 0, z: -10, w: 80, d: 5 },
  { x: -30, z: 100, w: 5, d: 60 },
  { x: 50, z: 120, w: 5, d: 50 },
  { x: 20, z: 140, w: 80, d: 5 },
  { x: 130, z: 170, w: 60, d: 5 },
  { x: 110, z: 150, w: 5, d: 50 },
  { x: 130, z: -20, w: 5, d: 60 },
  { x: 170, z: -40, w: 5, d: 50 },
  { x: 150, z: 0, w: 60, d: 5 },
  { x: 170, z: 60, w: 5, d: 50 },
  { x: 190, z: 80, w: 5, d: 40 },
  { x: -140, z: 140, w: 60, d: 5 },
  { x: -120, z: 120, w: 5, d: 50 },
  { x: -40, z: -100, w: 5, d: 50 },
  { x: 50, z: -100, w: 5, d: 50 },
  { x: 20, z: -120, w: 80, d: 5 },
  { x: -80, z: 210, w: 60, d: 5 },
  { x: -60, z: 195, w: 5, d: 40 },
  { x: -120, z: -60, w: 5, d: 50 },
  { x: -150, z: -40, w: 40, d: 5 },
];

const ALLEYS = [
  { x: -20, z: 10, w: 2.5, d: 30 },
  { x: 25, z: 30, w: 30, d: 2.5 },
  { x: 10, z: 110, w: 2.5, d: 40 },
  { x: -15, z: 130, w: 35, d: 2.5 },
  { x: 140, z: 160, w: 30, d: 2.5 },
  { x: 160, z: -30, w: 2.5, d: 30 },
  { x: 180, z: 70, w: 2.5, d: 25 },
  { x: -130, z: 130, w: 2.5, d: 35 },
  { x: -155, z: 110, w: 25, d: 2.5 },
  { x: 30, z: -110, w: 2.5, d: 30 },
  { x: -90, z: 205, w: 2.5, d: 25 },
  { x: -135, z: -70, w: 2.5, d: 25 },
];

const ALL_ROADS = [...MAIN_ROADS, ...SECONDARY_ROADS, ...ALLEYS];

// Sidewalk offset from road center (NPCs walk on the right side)
const SIDEWALK_OFFSET = 2.5;

// ========== GRAPH CONSTRUCTION ==========

// A waypoint node: { id, x, z, edges: [{ nodeId, cost }] }
const nodes = [];
const nodeMap = new Map(); // 'x,z' → node id

let graphBuilt = false;

// Snap tolerance for merging nearby nodes
const SNAP_DIST = 4;

function getNodeKey(x, z) {
  // Quantize to reduce floating-point duplication
  return `${Math.round(x)},${Math.round(z)}`;
}

function findOrCreateNode(x, z) {
  // Check if a node already exists within SNAP_DIST
  for (const node of nodes) {
    const dx = node.x - x;
    const dz = node.z - z;
    if (dx * dx + dz * dz < SNAP_DIST * SNAP_DIST) {
      return node.id;
    }
  }

  const id = nodes.length;
  const node = { id, x, z, edges: [] };
  nodes.push(node);
  nodeMap.set(getNodeKey(x, z), id);
  return id;
}

function addEdge(a, b) {
  if (a === b) return;
  const na = nodes[a];
  const nb = nodes[b];
  const dx = na.x - nb.x;
  const dz = na.z - nb.z;
  const cost = Math.sqrt(dx * dx + dz * dz);

  if (!na.edges.find(e => e.nodeId === b)) {
    na.edges.push({ nodeId: b, cost });
  }
  if (!nb.edges.find(e => e.nodeId === a)) {
    nb.edges.push({ nodeId: a, cost });
  }
}

// Get road axis and extents
function getRoadSegment(road) {
  const isHorizontal = road.w > road.d;
  if (isHorizontal) {
    const halfLen = road.w / 2;
    return {
      horizontal: true,
      startX: road.x - halfLen, endX: road.x + halfLen,
      startZ: road.z, endZ: road.z,
      centerLine: road.z,
      halfWidth: road.d / 2,
    };
  } else {
    const halfLen = road.d / 2;
    return {
      horizontal: false,
      startX: road.x, endX: road.x,
      startZ: road.z - halfLen, endZ: road.z + halfLen,
      centerLine: road.x,
      halfWidth: road.w / 2,
    };
  }
}

// Check if two road segments intersect
function roadsIntersect(seg1, seg2) {
  if (seg1.horizontal === seg2.horizontal) {
    // Parallel roads — check for overlap on same axis
    if (seg1.horizontal) {
      // Both horizontal — check if close in Z and overlap in X
      if (Math.abs(seg1.centerLine - seg2.centerLine) > seg1.halfWidth + seg2.halfWidth + SNAP_DIST) return null;
      const overlapStart = Math.max(seg1.startX, seg2.startX);
      const overlapEnd = Math.min(seg1.endX, seg2.endX);
      if (overlapStart > overlapEnd) return null;
      // Return midpoint of overlap
      return { x: (overlapStart + overlapEnd) / 2, z: (seg1.centerLine + seg2.centerLine) / 2 };
    } else {
      if (Math.abs(seg1.centerLine - seg2.centerLine) > seg1.halfWidth + seg2.halfWidth + SNAP_DIST) return null;
      const overlapStart = Math.max(seg1.startZ, seg2.startZ);
      const overlapEnd = Math.min(seg1.endZ, seg2.endZ);
      if (overlapStart > overlapEnd) return null;
      return { x: (seg1.centerLine + seg2.centerLine) / 2, z: (overlapStart + overlapEnd) / 2 };
    }
  }

  // Perpendicular — one horizontal, one vertical
  const h = seg1.horizontal ? seg1 : seg2;
  const v = seg1.horizontal ? seg2 : seg1;

  // Check if vertical road's X is within horizontal road's X range
  if (v.centerLine < h.startX - v.halfWidth - SNAP_DIST || v.centerLine > h.endX + v.halfWidth + SNAP_DIST) return null;
  // Check if horizontal road's Z is within vertical road's Z range
  if (h.centerLine < v.startZ - h.halfWidth - SNAP_DIST || h.centerLine > v.endZ + h.halfWidth + SNAP_DIST) return null;

  return { x: v.centerLine, z: h.centerLine };
}

export function buildGraph() {
  if (graphBuilt) return;
  graphBuilt = true;

  const segments = ALL_ROADS.map(r => ({ road: r, seg: getRoadSegment(r) }));

  // Create endpoint nodes for each road
  for (const { road, seg } of segments) {
    if (seg.horizontal) {
      const n1 = findOrCreateNode(seg.startX, seg.centerLine);
      const n2 = findOrCreateNode(seg.endX, seg.centerLine);
      // We'll add intermediate intersection nodes below, then connect linearly
    } else {
      const n1 = findOrCreateNode(seg.centerLine, seg.startZ);
      const n2 = findOrCreateNode(seg.centerLine, seg.endZ);
    }
  }

  // Find all intersections between pairs of roads
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const pt = roadsIntersect(segments[i].seg, segments[j].seg);
      if (pt) {
        findOrCreateNode(pt.x, pt.z);
      }
    }
  }

  // For each road, find all nodes that lie on/near it, sort them, and connect sequentially
  for (const { road, seg } of segments) {
    const onRoad = [];

    for (const node of nodes) {
      if (seg.horizontal) {
        if (Math.abs(node.z - seg.centerLine) <= seg.halfWidth + SNAP_DIST &&
            node.x >= seg.startX - SNAP_DIST && node.x <= seg.endX + SNAP_DIST) {
          onRoad.push(node);
        }
      } else {
        if (Math.abs(node.x - seg.centerLine) <= seg.halfWidth + SNAP_DIST &&
            node.z >= seg.startZ - SNAP_DIST && node.z <= seg.endZ + SNAP_DIST) {
          onRoad.push(node);
        }
      }
    }

    // Sort by position along the road
    if (seg.horizontal) {
      onRoad.sort((a, b) => a.x - b.x);
    } else {
      onRoad.sort((a, b) => a.z - b.z);
    }

    // Connect sequential nodes
    for (let i = 0; i < onRoad.length - 1; i++) {
      addEdge(onRoad[i].id, onRoad[i + 1].id);
    }
  }
}

// ========== A* PATHFINDING ==========

function heuristic(a, b) {
  const dx = nodes[a].x - nodes[b].x;
  const dz = nodes[a].z - nodes[b].z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Find the nearest graph node to a world position
function nearestNode(x, z) {
  let bestId = 0;
  let bestDist = Infinity;
  for (const node of nodes) {
    const dx = node.x - x;
    const dz = node.z - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id;
    }
  }
  return bestId;
}

/**
 * Find shortest path between two world positions using A*.
 * Returns an array of { x, z } waypoints (including start/end world positions).
 */
export function findPath(startX, startZ, endX, endZ) {
  buildGraph();

  const startNode = nearestNode(startX, startZ);
  const endNode = nearestNode(endX, endZ);

  if (startNode === endNode) {
    return [{ x: endX, z: endZ }];
  }

  // A* search
  const openSet = new Set([startNode]);
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(startNode, 0);
  fScore.set(startNode, heuristic(startNode, endNode));

  while (openSet.size > 0) {
    // Pick node with lowest fScore
    let current = -1;
    let currentF = Infinity;
    for (const n of openSet) {
      const f = fScore.get(n) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        current = n;
      }
    }

    if (current === endNode) {
      // Reconstruct path
      const path = [];
      let c = current;
      while (cameFrom.has(c)) {
        path.push({ x: nodes[c].x, z: nodes[c].z });
        c = cameFrom.get(c);
      }
      path.reverse();
      // Add actual destination (may differ slightly from nearest node)
      path.push({ x: endX, z: endZ });
      return path;
    }

    openSet.delete(current);

    for (const edge of nodes[current].edges) {
      const neighbor = edge.nodeId;
      const tentG = (gScore.get(current) ?? Infinity) + edge.cost;
      if (tentG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentG);
        fScore.set(neighbor, tentG + heuristic(neighbor, endNode));
        openSet.add(neighbor);
      }
    }
  }

  // No path found — walk directly
  return [{ x: endX, z: endZ }];
}

/**
 * Apply sidewalk offset to a path — shift waypoints slightly to the right
 * side of the road to simulate walking on sidewalks.
 */
export function applySidewalkOffset(path) {
  if (path.length < 2) return path;

  const result = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    // Determine direction of travel
    let dx, dz;
    if (i < path.length - 1) {
      dx = path[i + 1].x - p.x;
      dz = path[i + 1].z - p.z;
    } else {
      dx = p.x - path[i - 1].x;
      dz = p.z - path[i - 1].z;
    }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) {
      result.push({ x: p.x, z: p.z });
      continue;
    }

    // Right-side perpendicular (rotate direction 90 degrees clockwise)
    const perpX = dz / len;
    const perpZ = -dx / len;

    result.push({
      x: p.x + perpX * SIDEWALK_OFFSET,
      z: p.z + perpZ * SIDEWALK_OFFSET,
    });
  }
  return result;
}

// Get the graph node count (for debugging)
export function getNodeCount() {
  return nodes.length;
}

// Get all nodes (for debugging / visualization)
export function getNodes() {
  return nodes;
}

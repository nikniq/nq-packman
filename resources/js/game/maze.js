// Mazes, in tile coordinates. Entities live on tile centres: an entity at
// (x, y) = (13, 23) sits exactly in the middle of column 13, row 23.
//
//   #  stall (wall)   .  satay stick (dot)   o  durian (power pellet)
//   -  den door       (space) open floor without a dot
//
// Every level gets its own maze. Mazes are generated from a seed, so the
// same level looks the same for every player (the leaderboard stays fair)
// while no two levels look alike. The generator lays corridors on a lattice
// three tiles apart (walls come out two tiles thick), mirrors the left half
// onto the right, guarantees every corridor is part of a loop (no dead
// ends, which is what keeps the chase fair), and fixes the den, the tunnel
// and the player's start in the same place on every maze so the chase AI
// can rely on them.

export const COLS = 28;
export const ROWS = 31;
export const TUNNEL_ROW = 14;

export const UP = { x: 0, y: -1 };
export const LEFT = { x: -1, y: 0 };
export const DOWN = { x: 0, y: 1 };
export const RIGHT = { x: 1, y: 0 };

// Tie-break order for rivals choosing between equally good turns.
export const DIRECTIONS = [UP, LEFT, DOWN, RIGHT];

// Key points, in tile coordinates. Half values sit between two columns.
export const HOUSE_X = 13.5;
export const HOUSE_Y = 14;
export const DOOR_Y = 11; // the corridor row just above the den door
export const PAC_START = { x: 13.5, y: 23 };
export const FRUIT_POS = { x: 13.5, y: 17 };

// The corridor lattice. Columns are for the left half; the right half is
// the mirror image (col -> COLS - 1 - col). Rows include the den ring (11
// and 17), the tunnel (14) and the start row (23).
const LATTICE_COLS = [1, 4, 7, 10];
const LATTICE_ROWS = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29];
const MIRROR_COL = 17; // mirror of lattice column 10
// The den occupies cols 10-17, rows 12-16; lattice points inside it are
// removed and the tunnel row only exists outside it.
const DEN = { left: 10, right: 17, top: 12, bottom: 16 };
// Rows where a corridor may cross the centre between col 10 and col 17.
const CROSSING_ROWS = [2, 5, 8, 11, 17, 20, 23, 26, 29];
const FORCED_CROSSINGS = [DOOR_Y, FRUIT_POS.y, PAC_START.y];
// No snacks right around the den or in the tunnel mouths, as in any
// respectable night market: the stall holders keep that lane clear.
const QUIET = { left: 9, right: 18, top: 10, bottom: 18 };
const TUNNEL_CLEAR = 5;
const PELLET_ROWS = [5, 23];

export function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
}

// Mulberry32: tiny, fast and good enough to shuffle corridors.
export function seededRandom(seed) {
    let state = hashSeed(seed);

    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashSeed(seed) {
    if (typeof seed === 'number') {
        return seed >>> 0;
    }
    let hash = 2166136261;
    for (const char of String(seed)) {
        hash ^= char.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function mirror(col) {
    return COLS - 1 - col;
}

function nodeKey(col, row) {
    return `${col},${row}`;
}

function isDenNode(col, row) {
    return col >= DEN.left && col <= DEN.right && row >= DEN.top - 1 && row <= DEN.bottom + 1 && row !== DOOR_Y && row !== FRUIT_POS.y;
}

// Build the half-maze graph: nodes are lattice points, edges are candidate
// corridors. Centre crossings are edges from column 10 to its own mirror.
function buildLattice() {
    const nodes = [];
    const byKey = new Map();
    for (const row of LATTICE_ROWS) {
        for (const col of LATTICE_COLS) {
            if (isDenNode(col, row)) {
                continue;
            }
            const node = { col, row, edges: [] };
            nodes.push(node);
            byKey.set(nodeKey(col, row), node);
        }
    }
    const edges = [];
    const link = (a, b, kind) => {
        const edge = { a, b, kind, open: false };
        a.edges.push(edge);
        if (b !== a) {
            b.edges.push(edge);
        }
        edges.push(edge);
    };
    for (const node of nodes) {
        const right = byKey.get(nodeKey(node.col + 3, node.row));
        const down = byKey.get(nodeKey(node.col, node.row + 3));
        if (right) {
            link(node, right, 'h');
        }
        if (down) {
            link(node, down, 'v');
        }
        if (node.col === 10 && CROSSING_ROWS.includes(node.row)) {
            link(node, node, 'c');
        }
    }

    return { nodes, edges, byKey };
}

function other(edge, node) {
    return edge.a === node ? edge.b : edge.a;
}

export function generateMaze(seed) {
    const random = seededRandom(seed);
    const { nodes, edges, byKey } = buildLattice();
    const shuffled = (list) => {
        const copy = [...list];
        for (let index = copy.length - 1; index > 0; index -= 1) {
            const swap = Math.floor(random() * (index + 1));
            [copy[index], copy[swap]] = [copy[swap], copy[index]];
        }

        return copy;
    };

    // Forced corridors: the tunnel along row 14 out to the left edge, and the
    // crossings that the den ring, the snack spot and the start need.
    for (const edge of edges) {
        if (edge.kind === 'h' && edge.a.row === TUNNEL_ROW) {
            edge.open = true;
        }
        if (edge.kind === 'c' && FORCED_CROSSINGS.includes(edge.a.row)) {
            edge.open = true;
        }
    }
    // The den ring: row 11 and row 17 from col 7 to the crossing, joined by
    // col 7 so the ring can always be circled.
    for (const [col, row, kind] of [[7, 11, 'h'], [7, 17, 'h'], [7, 11, 'v'], [7, 14, 'v']]) {
        const node = byKey.get(nodeKey(col, row));
        const edge = node?.edges.find((candidate) => candidate.kind === kind && candidate.a === node);
        if (edge) {
            edge.open = true;
        }
    }

    // Randomised spanning tree over the rest (Kruskal with union-find) so
    // every lattice point is reachable.
    const parent = new Map(nodes.map((node) => [node, node]));
    const find = (node) => {
        while (parent.get(node) !== node) {
            parent.set(node, parent.get(parent.get(node)));
            node = parent.get(node);
        }

        return node;
    };
    const union = (a, b) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA === rootB) {
            return false;
        }
        parent.set(rootA, rootB);

        return true;
    };
    edges.filter((edge) => edge.open && edge.kind !== 'c').forEach((edge) => union(edge.a, edge.b));
    for (const edge of shuffled(edges)) {
        if (!edge.open && edge.kind !== 'c' && union(edge.a, edge.b)) {
            edge.open = true;
        }
    }

    // No dead ends: any node with a single corridor gets a second one.
    const degree = (node) => node.edges.filter((edge) => edge.open).length + (node.col === 1 && node.row === TUNNEL_ROW ? 1 : 0);
    let changed = true;
    while (changed) {
        changed = false;
        for (const node of shuffled(nodes)) {
            if (degree(node) <= 1) {
                const closed = shuffled(node.edges.filter((edge) => !edge.open));
                if (closed.length > 0) {
                    closed[0].open = true;
                    changed = true;
                }
            }
        }
    }

    // A few extra loops so the maze is not a bare tree with patches.
    for (const edge of shuffled(edges.filter((edge) => !edge.open))) {
        if (random() < 0.28) {
            edge.open = true;
        }
    }

    return mapFromLattice(edges, seed);
}

function mapFromLattice(edges, seed) {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill('#'));
    const carve = (col, row) => {
        grid[row][col] = '.';
        grid[row][mirror(col)] = '.';
    };
    for (const edge of edges) {
        if (!edge.open) {
            continue;
        }
        if (edge.kind === 'c') {
            for (let col = 10; col <= MIRROR_COL; col += 1) {
                carve(col, edge.a.row);
            }
        } else if (edge.kind === 'h') {
            for (let col = edge.a.col; col <= edge.b.col; col += 1) {
                carve(col, edge.a.row);
            }
        } else {
            for (let row = edge.a.row; row <= edge.b.row; row += 1) {
                carve(edge.a.col, row);
            }
        }
    }

    // The tunnel runs off both edges.
    for (let col = 0; col <= TUNNEL_CLEAR; col += 1) {
        grid[TUNNEL_ROW][col] = ' ';
        grid[TUNNEL_ROW][mirror(col)] = ' ';
    }

    // The den.
    for (let row = DEN.top; row <= DEN.bottom; row += 1) {
        for (let col = DEN.left; col <= DEN.right; col += 1) {
            const wall = row === DEN.top || row === DEN.bottom || col === DEN.left || col === DEN.right;
            grid[row][col] = wall ? '#' : ' ';
        }
    }
    grid[DEN.top][13] = '-';
    grid[DEN.top][14] = '-';

    // Quiet lane around the den: open floor, no snacks.
    for (let row = QUIET.top; row <= QUIET.bottom; row += 1) {
        for (let col = QUIET.left; col <= QUIET.right; col += 1) {
            if (grid[row][col] === '.') {
                grid[row][col] = ' ';
            }
        }
    }

    // Durians in the four far corners of the lattice.
    for (const row of PELLET_ROWS) {
        if (grid[row][1] === '.') {
            grid[row][1] = 'o';
            grid[row][mirror(1)] = 'o';
        }
    }

    const map = grid.map((row) => row.join(''));

    return new Maze(map, seed);
}

export class Maze {
    constructor(map, seed = 'fixed') {
        this.map = map;
        this.seed = seed;
        this.dotCount = map.join('').split('').filter((tile) => tile === '.' || tile === 'o').length;
    }

    tileAt(col, row) {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
            return ' ';
        }

        return this.map[row][col];
    }

    // The tunnel row continues one tile past each edge so entities can wrap.
    isWall(col, row) {
        if (row < 0 || row >= ROWS) {
            return true;
        }
        if (col < 0 || col >= COLS) {
            return row !== TUNNEL_ROW;
        }
        const tile = this.map[row][col];

        return tile === '#' || tile === '-';
    }

    isOpen(col, row) {
        return !this.isWall(col, row) && col >= 0 && col < COLS;
    }

    // Open tiles, as {x, y}, optionally filtered.
    openTiles(filter = () => true) {
        const tiles = [];
        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                if (this.isOpen(col, row) && filter(col, row)) {
                    tiles.push({ x: col, y: row });
                }
            }
        }

        return tiles;
    }

    // Breadth-first distances over open tiles, for sanity checks and tests.
    reachableFrom(col, row) {
        const seen = new Set([nodeKey(col, row)]);
        const queue = [{ x: col, y: row }];
        while (queue.length > 0) {
            const tile = queue.shift();
            for (const dir of DIRECTIONS) {
                let x = tile.x + dir.x;
                const y = tile.y + dir.y;
                if (x < 0) {
                    x = COLS - 1;
                } else if (x >= COLS) {
                    x = 0;
                }
                const key = nodeKey(x, y);
                if (!seen.has(key) && this.isOpen(x, y)) {
                    seen.add(key);
                    queue.push({ x, y });
                }
            }
        }

        return seen;
    }
}

// The maze for a level of the given run. Classic runs share mazes across
// players; a daily run mixes the date in so every day is a new course.
export function mazeForLevel(level, run = 'classic') {
    return generateMaze(`${run}:${level}`);
}

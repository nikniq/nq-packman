// The maze, in tile coordinates. Entities live on tile centres: an entity at
// (x, y) = (13, 23) sits exactly in the middle of column 13, row 23.
//
//   #  wall          .  dot           o  power pellet
//   -  ghost door    (space) open floor without a dot

export const COLS = 28;
export const ROWS = 31;
export const TUNNEL_ROW = 14;

export const MAP = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '     #.##### ## #####.#     ',
    '     #.##          ##.#     ',
    '     #.## ###--### ##.#     ',
    '######.## #      # ##.######',
    '      .   #      #   .      ',
    '######.## #      # ##.######',
    '     #.## ######## ##.#     ',
    '     #.##          ##.#     ',
    '     #.## ######## ##.#     ',
    '######.## ######## ##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################',
];

export const UP = { x: 0, y: -1 };
export const LEFT = { x: -1, y: 0 };
export const DOWN = { x: 0, y: 1 };
export const RIGHT = { x: 1, y: 0 };

// Tie-break order for ghosts choosing between equally good turns.
export const DIRECTIONS = [UP, LEFT, DOWN, RIGHT];

// Key points, in tile coordinates. Half values sit between two columns.
export const HOUSE_X = 13.5;
export const HOUSE_Y = 14;
export const DOOR_Y = 11; // the row just above the ghost door
export const PAC_START = { x: 13.5, y: 23 };
export const FRUIT_POS = { x: 13.5, y: 17 };

export function tileAt(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) {
        return ' ';
    }

    return MAP[row][col];
}

// The tunnel row continues one tile past each edge so entities can wrap.
export function isWall(col, row) {
    if (row < 0 || row >= ROWS) {
        return true;
    }
    if (col < 0 || col >= COLS) {
        return row !== TUNNEL_ROW;
    }
    const tile = MAP[row][col];

    return tile === '#' || tile === '-';
}

export function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
}

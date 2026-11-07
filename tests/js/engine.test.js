import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Game, POWER_UPS, powerUpForLevel } from '../../resources/js/game/engine.js';
import {
    COLS,
    DIRECTIONS,
    DOOR_Y,
    DOWN,
    FRUIT_POS,
    LEFT,
    PAC_START,
    RIGHT,
    ROWS,
    TUNNEL_ROW,
    UP,
    generateMaze,
    mazeForLevel,
} from '../../resources/js/game/maze.js';

const STEP = 1 / 120;

// Small deterministic generator so failures are reproducible.
function seededRandom(seed) {
    let state = seed;

    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;

        return state / 4294967296;
    };
}

function newGame(seed = 1, run = 'classic') {
    const events = [];
    const game = new Game({ onEvent: (name) => events.push(name), random: seededRandom(seed), run });
    game.start(run);

    return { game, events };
}

function run(game, seconds, eachStep = () => {}) {
    for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
        game.update(STEP);
        eachStep();
    }
}

function parkGhosts(game) {
    game.ghosts.forEach((ghost) => (ghost.state = 'house'));
}

function assertOnOpenFloor(game, entity, label) {
    assert.ok(Number.isFinite(entity.x) && Number.isFinite(entity.y), `${label} has a finite position`);
    assert.ok(!game.isWall(Math.round(entity.x), Math.round(entity.y)), `${label} is inside a wall at ${entity.x},${entity.y}`);
}

// A tile next to the cat's start that it can walk into, and the direction.
function firstOpenNeighbour(game) {
    const x = Math.floor(PAC_START.x);
    for (const dir of [LEFT, RIGHT, UP, DOWN]) {
        if (!game.isWall(x + dir.x, PAC_START.y + dir.y)) {
            return dir;
        }
    }
    throw new Error('start tile is boxed in');
}

// ---- mazes -------------------------------------------------------------

test('generated mazes are mirrored, fully connected, loop-only and keep the fixed points open', () => {
    for (const seed of ['classic:1', 'classic:2', 'classic:7', '2026-01-01:1', 'x:12']) {
        const maze = generateMaze(seed);
        assert.equal(maze.map.length, ROWS);
        for (const row of maze.map) {
            assert.equal(row.length, COLS);
            assert.equal(row, row.split('').reverse().join('').replace(/-/g, '-'), `row is symmetric (${seed})`);
        }
        // Fixed points.
        assert.ok(maze.isOpen(13, PAC_START.y) && maze.isOpen(14, PAC_START.y), 'start row open');
        assert.ok(maze.isOpen(13, DOOR_Y) && maze.isOpen(14, DOOR_Y), 'door row open');
        assert.ok(maze.isOpen(13, FRUIT_POS.y) && maze.isOpen(14, FRUIT_POS.y), 'snack row open');
        assert.ok(maze.isOpen(0, TUNNEL_ROW) && maze.isOpen(COLS - 1, TUNNEL_ROW), 'tunnel open');
        assert.equal(maze.tileAt(13, 12), '-');
        // Everything reachable from the start except the den interior.
        const reachable = maze.reachableFrom(13, PAC_START.y);
        const open = maze.openTiles();
        assert.equal(open.length - reachable.size, 18, `only the den is unreachable (${seed})`);
        // No dead ends outside the den.
        for (const tile of open) {
            if (reachable.has(`${tile.x},${tile.y}`)) {
                const exits = DIRECTIONS.filter((dir) => !maze.isWall(tile.x + dir.x, tile.y + dir.y)).length;
                assert.ok(exits >= 2, `dead end at ${tile.x},${tile.y} (${seed})`);
            }
        }
        assert.ok(maze.dotCount > 200 && maze.dotCount < 320, `plausible snack count ${maze.dotCount}`);
        assert.equal(maze.map.join('').split('o').length - 1, 4, 'four durians');
    }
});

test('the same level gives the same maze for everyone, different levels and runs differ', () => {
    assert.deepEqual(mazeForLevel(3).map, mazeForLevel(3).map);
    assert.notDeepEqual(mazeForLevel(1).map, mazeForLevel(2).map);
    assert.notDeepEqual(mazeForLevel(1).map, mazeForLevel(1, '2026-03-04').map);
    assert.deepEqual(mazeForLevel(1, '2026-03-04').map, mazeForLevel(1, '2026-03-04').map);
});

// ---- play ---------------------------------------------------------------

test('the game waits on READY with the full maze of snacks', () => {
    const { game } = newGame();

    assert.equal(game.dotsLeft, game.maze.dotCount);
    assert.equal(game.state, 'ready');
    run(game, 2.1);
    assert.equal(game.state, 'playing');
});

test('the cat eats snacks and scores as it moves', () => {
    const { game, events } = newGame();
    parkGhosts(game);
    game.steer(firstOpenNeighbour(game));
    run(game, 3, () => parkGhosts(game));

    assert.ok(game.score >= 10, 'score increased');
    assert.ok(game.dotsLeft < game.maze.dotCount, 'snacks were eaten');
    assert.ok(events.includes('dot'));
});

test('the cat stops at walls instead of passing through', () => {
    const { game } = newGame();
    parkGhosts(game);
    const dir = firstOpenNeighbour(game);
    game.steer(dir);
    run(game, 6, () => parkGhosts(game));

    assertOnOpenFloor(game, game.pac, 'the cat');
    assert.equal(game.pac.moving, false);
    assert.ok(game.isWall(game.pac.x + dir.x, game.pac.y + dir.y), 'blocked by a wall ahead');
});

test('entities wrap through the tunnel', () => {
    const { game } = newGame();
    run(game, 2.1);
    parkGhosts(game);
    Object.assign(game.pac, { x: 2, y: TUNNEL_ROW, dir: LEFT, want: LEFT });
    let wrapped = false;
    run(game, 1.5, () => {
        parkGhosts(game);
        wrapped = wrapped || game.pac.x > 20;
    });

    assert.ok(wrapped, 'the cat came out of the right-hand side');
});

test('all four rivals leave the den and never enter a wall, on several levels', () => {
    const { game } = newGame(7);
    const random = seededRandom(99);
    const left = new Set();
    let steps = 0;

    for (let life = 0; life < 400 && left.size < 4; life += 1) {
        run(game, 1, () => {
            steps += 1;
            if (steps % 40 === 0) {
                game.steer(DIRECTIONS[Math.floor(random() * 4)]);
            }
            if (game.state === 'gameOver') {
                game.start();
            }
            assertOnOpenFloor(game, game.pac, 'the cat');
            for (const ghost of game.ghosts) {
                if (ghost.state === 'active' || ghost.state === 'eyes') {
                    left.add(ghost.name);
                    assertOnOpenFloor(game, ghost, ghost.name);
                }
                assert.ok(ghost.x >= -1 && ghost.x <= COLS && ghost.y >= 0 && ghost.y < ROWS, `${ghost.name} in bounds`);
            }
        });
    }

    assert.deepEqual([...left].sort(), ['bolt', 'dozy', 'misty', 'scar']);
});

test('a durian frightens rivals and eaten rivals return to the den', () => {
    const { game, events } = newGame(3);
    run(game, 2.1);
    const scar = game.ghosts[0];
    // A straight stretch of the start row, with Scar right in front.
    Object.assign(game.pac, { x: 9, y: PAC_START.y, dir: RIGHT, want: RIGHT });
    Object.assign(scar, { x: 12, y: PAC_START.y, dir: RIGHT, state: 'active' }); // fright reverses it towards the cat
    game.startFright();

    assert.ok(scar.frightened);
    run(game, 1.5);
    assert.ok(events.includes('eatGhost'), 'rival was eaten');
    assert.ok(game.score >= 200, 'rival points were added on top of any snacks');
    assert.equal(scar.frightened, false);

    let cameHome = false;
    run(game, 12, () => {
        cameHome = cameHome || scar.state === 'leaving';
        game.pac.x = 1;
        game.pac.y = 2;
    });
    assert.ok(cameHome, 'eyes made it back into the den');
});

test('touching a rival costs a life and three deaths end the game', () => {
    const { game, events } = newGame();
    run(game, 2.1);

    for (let death = 1; death <= 3; death += 1) {
        const scar = game.ghosts[0];
        Object.assign(scar, { x: game.pac.x, y: game.pac.y, state: 'active', frightened: false });
        run(game, 0.1);
        assert.equal(game.state, 'dying');
        run(game, 1.7);
        if (death < 3) {
            assert.equal(game.lives, 3 - death);
            run(game, 2.1);
        }
    }

    assert.equal(game.state, 'gameOver');
    assert.ok(events.includes('gameOver'));
});

test('clearing the last snack advances to a new market with a different maze', () => {
    const { game } = newGame();
    run(game, 2.1);
    parkGhosts(game);
    const firstMap = game.maze.map;
    const dir = firstOpenNeighbour(game);
    const target = { x: Math.floor(PAC_START.x) + dir.x, y: PAC_START.y + dir.y };
    // Leave only the snack the cat is about to reach.
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            if (!(row === target.y && col === target.x)) {
                game.dots[row][col] = '';
            }
        }
    }
    game.dots[target.y][target.x] = '.';
    game.dotsLeft = 1;
    game.steer(dir);
    run(game, 0.5);

    assert.equal(game.state, 'levelClear');
    run(game, 2.3);
    assert.equal(game.level, 2);
    assert.equal(game.dotsLeft, game.maze.dotCount);
    assert.notDeepEqual(game.maze.map, firstMap);
    assert.equal(game.state, 'ready');
});

test('a bonus snack appears part-way through the level and awards points', () => {
    const { game, events } = newGame();
    run(game, 2.1);
    parkGhosts(game);
    game.dotsEaten = game.fruitAt[0] - 1;
    game.steer(firstOpenNeighbour(game));
    run(game, 0.3, () => parkGhosts(game));

    assert.ok(game.fruit, 'snack spawned');
    const before = game.score;
    Object.assign(game.pac, { x: 12, y: FRUIT_POS.y, dir: RIGHT, want: RIGHT });
    run(game, 0.4, () => parkGhosts(game));

    assert.equal(game.fruit, null);
    assert.ok(game.score >= before + 100);
    assert.ok(events.includes('fruit'));
});

test('an extra life is awarded once at 10,000 points', () => {
    const { game } = newGame();
    game.addScore(9990);
    assert.equal(game.lives, 3);
    game.addScore(10);
    assert.equal(game.lives, 4);
    game.addScore(10000);
    assert.equal(game.lives, 4);
    assert.equal(game.highScore, 20000);
});

test('scar speeds up and ignores scatter once few snacks remain', () => {
    const { game } = newGame();
    run(game, 2.1);
    const [scar, ...others] = game.ghosts;
    others.forEach((ghost) => (ghost.state = 'active'));
    const normalSpeed = game.ghostSpeed(scar);

    assert.equal(game.mode, 'scatter');
    assert.deepEqual(game.ghostTarget(scar), scar.corner);

    game.dotsLeft = 20;
    assert.ok(game.ghostSpeed(scar) > normalSpeed, 'faster at 20 snacks');
    const firstBoost = game.ghostSpeed(scar);
    game.dotsLeft = 10;
    assert.ok(game.ghostSpeed(scar) > firstBoost, 'faster again at 10 snacks');
    assert.deepEqual(game.ghostTarget(scar), { x: Math.round(game.pac.x), y: Math.round(game.pac.y) });
    assert.equal(game.ghostSpeed(others[0]), normalSpeed, 'other rivals are unaffected');
});

test('a new high score is only flagged when the previous best is beaten', () => {
    const game = new Game({ highScore: 500 });
    game.start();
    game.addScore(500);
    assert.equal(game.isNewHighScore, false);
    game.addScore(10);
    assert.equal(game.isNewHighScore, true);
    assert.equal(game.highScore, 510);
});

// ---- power-ups -----------------------------------------------------------

test('a power-up appears once a third of the snacks are gone, away from the cat, and each level offers a different one', () => {
    const { game } = newGame();
    run(game, 2.1);
    parkGhosts(game);
    game.dotsEaten = game.powerUpAt - 1;
    game.steer(firstOpenNeighbour(game));
    run(game, 0.3, () => parkGhosts(game));

    assert.ok(game.powerUp, 'power-up spawned');
    assert.equal(game.powerUp.kind, 'freeze');
    assert.ok(game.maze.isOpen(game.powerUp.x, game.powerUp.y));
    assert.ok((game.powerUp.x - game.pac.x) ** 2 + (game.powerUp.y - game.pac.y) ** 2 > 64, 'not next to the cat');
    assert.deepEqual([1, 2, 3, 4, 5].map(powerUpForLevel), ['freeze', 'magnet', 'decoy', 'phase', 'freeze']);
});

test('FREEZE stops the rivals, then they move again', () => {
    const { game, events } = newGame();
    run(game, 2.1);
    const scar = game.ghosts[0];
    Object.assign(scar, { x: 1, y: 2, dir: RIGHT, state: 'active' });
    game.activatePowerUp({ kind: 'freeze', x: 0, y: 0 });

    assert.ok(events.includes('powerUp'));
    const frozenAt = { x: scar.x, y: scar.y };
    run(game, 1, () => Object.assign(game.pac, { x: 13.5, y: PAC_START.y }));
    assert.deepEqual({ x: scar.x, y: scar.y }, frozenAt, 'rival did not move while frozen');
    run(game, POWER_UPS.freeze.seconds, () => Object.assign(game.pac, { x: 13.5, y: PAC_START.y }));
    assert.equal(game.effects.freeze, undefined);
    assert.ok(scar.x !== frozenAt.x || scar.y !== frozenAt.y, 'rival moved after the freeze');
});

test('MAGNET pulls in nearby snacks without the cat moving', () => {
    const { game } = newGame();
    run(game, 2.1);
    parkGhosts(game);
    const before = game.dotsLeft;
    game.activatePowerUp({ kind: 'magnet', x: 0, y: 0 });
    game.steer({ x: 0, y: 0 });
    game.pac.dir = { x: 0, y: 0 };
    run(game, 1, () => parkGhosts(game));

    assert.ok(game.dotsLeft < before - 3, `snacks were pulled in (${before} -> ${game.dotsLeft})`);
});

test("DECOY takes the cat's place as the rivals' target while it lasts", () => {
    const { game } = newGame();
    run(game, 2.1);
    game.modeIndex = 1; // chase
    const scar = game.ghosts[0];
    scar.state = 'active';
    game.activatePowerUp({ kind: 'decoy', x: 0, y: 0 });
    const decoyPos = { x: Math.round(game.decoy.x), y: Math.round(game.decoy.y) };
    Object.assign(game.pac, { x: 1, y: 2 });

    assert.deepEqual(game.ghostTarget(scar), decoyPos);
    run(game, POWER_UPS.decoy.seconds + 0.1, () => {
        parkGhosts(game);
        Object.assign(game.pac, { x: 1, y: 2 });
    });
    scar.state = 'active';
    assert.equal(game.decoy, null);
    assert.deepEqual(game.ghostTarget(scar), { x: 1, y: 2 });
});

test('PHASE lets the cat slip through one stall into open floor, once', () => {
    const { game, events } = newGame();
    run(game, 2.1);
    parkGhosts(game);
    // Find a spot on the start row where a wall is above and open floor lies 3 tiles up.
    let spot = null;
    for (let col = 1; col < COLS - 1 && !spot; col += 1) {
        const row = PAC_START.y;
        if (game.maze.isOpen(col, row) && game.isWall(col, row - 1) && game.isWall(col, row - 2) && game.maze.isOpen(col, row - 3)) {
            spot = { x: col, y: row };
        }
    }
    assert.ok(spot, 'maze has a two-thick wall above the start row');
    Object.assign(game.pac, { x: spot.x, y: spot.y, dir: UP, want: UP });
    game.activatePowerUp({ kind: 'phase', x: 0, y: 0 });
    run(game, 0.2, () => parkGhosts(game));

    assert.ok(events.includes('phase'));
    assert.ok(game.pac.y <= spot.y - 3, `cat zipped through (${game.pac.y})`);
    assertOnOpenFloor(game, game.pac, 'the cat');
    assert.equal(game.effects.phase, undefined, 'the charge is spent');
});

// ---- player two ------------------------------------------------------------

test('player two can take over a rival and steer it', () => {
    const { game, events } = newGame();
    run(game, 2.1);

    const taken = game.cycleHumanGhost();
    assert.equal(taken, game.ghosts[0]);
    assert.ok(events.includes('player2'));
    // On the top corridor, heading right; player two asks for left (a reverse).
    Object.assign(taken, { x: 5, y: 2, dir: RIGHT, state: 'active' });
    game.steerGhost(LEFT);
    assert.deepEqual(taken.dir, LEFT);
    run(game, 0.3, () => Object.assign(game.pac, { x: 13.5, y: PAC_START.y }));
    assert.ok(taken.x < 5, 'moved left under player two');

    game.cycleHumanGhost();
    game.cycleHumanGhost();
    game.cycleHumanGhost();
    assert.equal(game.cycleHumanGhost(), null, 'cycling past the last rival hands control back');
});

test('player two keeps the same rival across a lost life', () => {
    const { game } = newGame();
    run(game, 2.1);
    game.cycleHumanGhost();
    game.cycleHumanGhost();
    assert.equal(game.humanGhost.name, 'misty');
    Object.assign(game.ghosts[0], { x: game.pac.x, y: game.pac.y, state: 'active', frightened: false });
    run(game, 1.8);

    assert.equal(game.state, 'ready');
    assert.equal(game.humanGhost, game.ghosts[1]);
});

// ---- daily run -------------------------------------------------------------

test('a daily run is seeded by its date: same date, same course and chase', () => {
    const { game: first } = newGame(1, '2026-05-05');
    const { game: second } = newGame(1, '2026-05-05');
    const { game: other } = newGame(1, '2026-05-06');

    assert.ok(first.isDaily);
    assert.deepEqual(first.maze.map, second.maze.map);
    assert.notDeepEqual(first.maze.map, other.maze.map);
    assert.notDeepEqual(first.maze.map, mazeForLevel(1).map);
});

test('direction constants are distinct unit vectors', () => {
    assert.deepEqual([UP, LEFT, DOWN, RIGHT].map((dir) => Math.abs(dir.x) + Math.abs(dir.y)), [1, 1, 1, 1]);
});

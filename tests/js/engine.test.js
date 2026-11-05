import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Game } from '../../resources/js/game/engine.js';
import { COLS, DIRECTIONS, DOWN, LEFT, RIGHT, ROWS, UP, isWall } from '../../resources/js/game/maze.js';

const STEP = 1 / 120;

// Small deterministic generator so failures are reproducible.
function seededRandom(seed) {
    let state = seed;

    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;

        return state / 4294967296;
    };
}

function newGame(seed = 1) {
    const events = [];
    const game = new Game({ onEvent: (name) => events.push(name), random: seededRandom(seed) });
    game.start();

    return { game, events };
}

function run(game, seconds, eachStep = () => {}) {
    for (let elapsed = 0; elapsed < seconds; elapsed += STEP) {
        game.update(STEP);
        eachStep();
    }
}

function assertOnOpenFloor(entity, label) {
    assert.ok(Number.isFinite(entity.x) && Number.isFinite(entity.y), `${label} has a finite position`);
    assert.ok(!isWall(Math.round(entity.x), Math.round(entity.y)), `${label} is inside a wall at ${entity.x},${entity.y}`);
}

test('the maze starts with 244 dots and the game waits on READY', () => {
    const { game } = newGame();

    assert.equal(game.dotsLeft, 244);
    assert.equal(game.state, 'ready');
    run(game, 2.1);
    assert.equal(game.state, 'playing');
});

test('pac-man eats dots and scores as it moves', () => {
    const { game, events } = newGame();
    game.steer(LEFT);
    run(game, 3);

    assert.ok(game.score >= 10, 'score increased');
    assert.ok(game.dotsLeft < 244, 'dots were eaten');
    assert.ok(events.includes('dot'));
});

test('pac-man stops at walls instead of passing through', () => {
    const { game } = newGame();
    game.ghosts.forEach((ghost) => (ghost.state = 'house'));
    game.steer(LEFT);
    run(game, 6, () => game.ghosts.forEach((ghost) => (ghost.state = 'house')));

    assert.equal(game.pac.x, 6);
    assert.equal(game.pac.y, 23);
    assert.equal(game.pac.moving, false);
});

test('entities wrap through the tunnel', () => {
    const { game } = newGame();
    run(game, 2.1);
    game.ghosts.forEach((ghost) => (ghost.state = 'house'));
    Object.assign(game.pac, { x: 2, y: 14, dir: LEFT, want: LEFT });
    let wrapped = false;
    run(game, 1.5, () => {
        game.ghosts.forEach((ghost) => (ghost.state = 'house'));
        wrapped = wrapped || game.pac.x > 20;
    });

    assert.ok(wrapped, 'pac-man came out of the right-hand side');
});

test('all four ghosts leave the house and never enter a wall', () => {
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
            assertOnOpenFloor(game.pac, 'pac-man');
            for (const ghost of game.ghosts) {
                if (ghost.state === 'active' || ghost.state === 'eyes') {
                    left.add(ghost.name);
                    assertOnOpenFloor(ghost, ghost.name);
                }
                assert.ok(ghost.x >= -1 && ghost.x <= COLS && ghost.y >= 0 && ghost.y < ROWS, `${ghost.name} in bounds`);
            }
        });
    }

    assert.equal(left.size, 4);
});

test('a power pellet frightens ghosts and eaten ghosts return home', () => {
    const { game, events } = newGame(3);
    run(game, 2.1);
    const blinky = game.ghosts[0];
    // Put Blinky right in front of a frightened chase.
    Object.assign(game.pac, { x: 6, y: 5, dir: RIGHT, want: RIGHT });
    Object.assign(blinky, { x: 9, y: 5, dir: RIGHT, state: 'active' }); // fright reverses it towards Pac-Man
    game.startFright();

    assert.ok(blinky.frightened);
    run(game, 1.5);
    assert.ok(events.includes('eatGhost'), 'ghost was eaten');
    assert.ok(game.score >= 200, 'ghost points were added on top of any dots');
    assert.equal(blinky.frightened, false);

    let cameHome = false;
    run(game, 12, () => {
        cameHome = cameHome || blinky.state === 'leaving';
        game.pac.x = 1;
        game.pac.y = 29;
    });
    assert.ok(cameHome, 'eyes made it back into the house');
});

test('touching a ghost costs a life and three deaths end the game', () => {
    const { game, events } = newGame();
    run(game, 2.1);

    for (let death = 1; death <= 3; death += 1) {
        const blinky = game.ghosts[0];
        Object.assign(blinky, { x: game.pac.x, y: game.pac.y, state: 'active', frightened: false });
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

test('clearing the last dot advances to the next level with a full maze', () => {
    const { game } = newGame();
    run(game, 2.1);
    game.ghosts.forEach((ghost) => (ghost.state = 'house'));
    // Leave only the dot Pac-Man is about to reach.
    for (let row = 0; row < ROWS; row += 1) {
        for (let col = 0; col < COLS; col += 1) {
            if (!(row === 23 && col === 12)) {
                game.dots[row][col] = '';
            }
        }
    }
    game.dotsLeft = 1;
    game.steer(LEFT);
    run(game, 0.5);

    assert.equal(game.state, 'levelClear');
    run(game, 2.3);
    assert.equal(game.level, 2);
    assert.equal(game.dotsLeft, 244);
    assert.equal(game.state, 'ready');
});

test('fruit appears after 70 dots and awards points', () => {
    const { game, events } = newGame();
    run(game, 2.1);
    game.ghosts.forEach((ghost) => (ghost.state = 'house'));
    game.dotsEaten = 69;
    game.steer(LEFT);
    run(game, 0.3);

    assert.ok(game.fruit, 'fruit spawned');
    const before = game.score;
    Object.assign(game.pac, { x: 12, y: 17, dir: RIGHT, want: RIGHT });
    run(game, 0.4, () => game.ghosts.forEach((ghost) => (ghost.state = 'house')));

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

test('blinky speeds up and ignores scatter once few dots remain', () => {
    const { game } = newGame();
    run(game, 2.1);
    const [blinky, ...others] = game.ghosts;
    others.forEach((ghost) => (ghost.state = 'active'));
    const normalSpeed = game.ghostSpeed(blinky);

    assert.equal(game.mode, 'scatter');
    assert.deepEqual(game.ghostTarget(blinky), blinky.corner);

    game.dotsLeft = 20;
    assert.ok(game.ghostSpeed(blinky) > normalSpeed, 'faster at 20 dots');
    const firstBoost = game.ghostSpeed(blinky);
    game.dotsLeft = 10;
    assert.ok(game.ghostSpeed(blinky) > firstBoost, 'faster again at 10 dots');
    assert.deepEqual(game.ghostTarget(blinky), { x: Math.round(game.pac.x), y: Math.round(game.pac.y) });
    assert.equal(game.ghostSpeed(others[0]), normalSpeed, 'other ghosts are unaffected');
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

test('direction constants are distinct unit vectors', () => {
    assert.deepEqual([UP, LEFT, DOWN, RIGHT].map((dir) => Math.abs(dir.x) + Math.abs(dir.y)), [1, 1, 1, 1]);
});

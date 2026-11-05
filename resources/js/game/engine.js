// Game rules, with no DOM or canvas in sight so it can run under node --test.
// The renderer reads this object's public fields; main.js feeds it input and
// listens for events (for sound and the HUD).

import {
    COLS,
    DIRECTIONS,
    DOOR_Y,
    FRUIT_POS,
    HOUSE_X,
    HOUSE_Y,
    LEFT,
    MAP,
    PAC_START,
    ROWS,
    TUNNEL_ROW,
    UP,
    isOpposite,
    isWall,
} from './maze.js';

const EPSILON = 1e-6;

// Speeds are in tiles per second.
const PAC_SPEED = 7.6;
const GHOST_SPEED = 7.1;
const FRIGHT_SPEED = 4.4;
const TUNNEL_SPEED = 3.8;
const EYES_SPEED = 15;
const HOUSE_SPEED = 3.5;

// Alternating scatter / chase durations in seconds; the final chase never ends.
const MODE_SCHEDULE = [7, 20, 7, 20, 5, 20, 5, Infinity];

const GHOST_POINTS = [200, 400, 800, 1600];
const FRUITS = [
    { name: 'cherry', points: 100 },
    { name: 'strawberry', points: 300 },
    { name: 'orange', points: 500 },
    { name: 'apple', points: 700 },
    { name: 'melon', points: 1000 },
    { name: 'galaxian', points: 2000 },
    { name: 'bell', points: 3000 },
    { name: 'key', points: 5000 },
];
const FRUIT_DOT_COUNTS = [70, 170];
const FRUIT_SECONDS = 9.5;
const EXTRA_LIFE_SCORE = 10000;
const COLLISION_DISTANCE = 0.7;
// Blinky turns into "Cruise Elroy" near the end of a level: faster, and he
// keeps chasing even while the others scatter.
const ELROY_DOTS = 20;
const ELROY_BOOST = [1.05, 1.1];

const GHOST_SETUP = [
    { name: 'blinky', x: HOUSE_X, y: DOOR_Y, corner: { x: 25, y: -3 }, inHouse: false },
    { name: 'pinky', x: HOUSE_X, y: HOUSE_Y, corner: { x: 2, y: -3 }, inHouse: true },
    { name: 'inky', x: HOUSE_X - 2, y: HOUSE_Y, corner: { x: 27, y: 31 }, inHouse: true },
    { name: 'clyde', x: HOUSE_X + 2, y: HOUSE_Y, corner: { x: 0, y: 31 }, inHouse: true },
];

function isAtCentre(entity) {
    return Math.abs(entity.x - Math.round(entity.x)) < EPSILON && Math.abs(entity.y - Math.round(entity.y)) < EPSILON;
}

function squaredDistance(ax, ay, bx, by) {
    return (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
}

export function fruitForLevel(level) {
    return FRUITS[Math.min(level, FRUITS.length) - 1];
}

export class Game {
    constructor({ onEvent = () => {}, random = Math.random, highScore = 0 } = {}) {
        this.onEvent = onEvent;
        this.random = random;
        this.highScore = highScore;
        this.state = 'title';
        this.stateTime = 0;
        this.clock = 0;
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.popups = [];
        this.resetMaze();
        this.resetActors(false);
    }

    // ---- lifecycle -------------------------------------------------------

    start() {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.extraLifeGiven = false;
        this.startingHighScore = this.highScore;
        this.resetMaze();
        this.resetActors(false);
        this.setState('ready');
        this.onEvent('start');
    }

    setState(state) {
        this.state = state;
        this.stateTime = 0;
    }

    resetMaze() {
        this.dots = MAP.map((row) => row.split('').map((tile) => (tile === '.' || tile === 'o' ? tile : '')));
        this.dotsLeft = this.dots.flat().filter(Boolean).length;
        this.dotsEaten = 0;
        this.fruit = null;
    }

    resetActors(afterDeath) {
        this.pac = { x: PAC_START.x, y: PAC_START.y, dir: LEFT, want: LEFT, moving: false };
        // After a death the house empties faster so the player is not left
        // alone with Blinky for long.
        const releaseAt = afterDeath || this.level > 2 ? [0, 0, 8, 16] : [0, 0, 30, 60];
        this.ghosts = GHOST_SETUP.map((setup, index) => ({
            name: setup.name,
            x: setup.x,
            y: setup.y,
            homeX: setup.x,
            corner: setup.corner,
            dir: setup.inHouse ? UP : LEFT,
            state: setup.inHouse ? 'house' : 'active',
            frightened: false,
            releaseAt: releaseAt[index],
        }));
        this.releaseCounter = 0;
        this.sinceLastDot = 0;
        this.modeIndex = 0;
        this.modeTime = 0;
        this.frightTime = 0;
        this.ghostCombo = 0;
        this.popups = [];
        this.fruit = null;
    }

    get mode() {
        return this.modeIndex % 2 === 0 ? 'scatter' : 'chase';
    }

    get speedFactor() {
        return Math.min(1.3, 1 + (this.level - 1) * 0.05);
    }

    get isNewHighScore() {
        return this.score > 0 && this.score > (this.startingHighScore ?? 0);
    }

    isElroy(ghost) {
        return ghost.name === 'blinky' && this.dotsLeft <= ELROY_DOTS && !this.ghosts.some((other) => other.state === 'house');
    }

    get frightDuration() {
        return Math.max(1.5, 7 - (this.level - 1) * 0.75);
    }

    // ---- input -----------------------------------------------------------

    steer(direction) {
        this.pac.want = direction;
    }

    // ---- main update -----------------------------------------------------

    update(dt) {
        this.clock += dt;
        this.stateTime += dt;
        this.popups = this.popups.filter((popup) => (popup.ttl -= dt) > 0);

        switch (this.state) {
            case 'ready':
                if (this.stateTime >= 2) {
                    this.setState('playing');
                }
                break;
            case 'playing':
                this.updatePlaying(dt);
                break;
            case 'eatPause':
                if (this.stateTime >= 0.5) {
                    this.setState('playing');
                }
                break;
            case 'dying':
                if (this.stateTime >= 1.6) {
                    this.afterDeath();
                }
                break;
            case 'levelClear':
                if (this.stateTime >= 2.2) {
                    this.level += 1;
                    this.resetMaze();
                    this.resetActors(false);
                    this.setState('ready');
                    this.onEvent('level', this.level);
                }
                break;
            default:
                break;
        }
    }

    updatePlaying(dt) {
        this.updateTimers(dt);
        this.movePac(dt);
        this.eatAtPac();
        if (this.state !== 'playing') {
            return;
        }
        this.checkCollisions();
        if (this.state !== 'playing') {
            return;
        }
        this.ghosts.forEach((ghost) => this.moveGhost(ghost, dt));
        this.checkCollisions();
    }

    updateTimers(dt) {
        if (this.frightTime > 0) {
            this.frightTime -= dt;
            if (this.frightTime <= 0) {
                this.frightTime = 0;
                this.ghostCombo = 0;
                this.ghosts.forEach((ghost) => (ghost.frightened = false));
                this.onEvent('frightEnd');
            }
        } else {
            this.modeTime += dt;
            if (this.modeTime >= MODE_SCHEDULE[this.modeIndex]) {
                this.modeTime = 0;
                this.modeIndex += 1;
                this.reverseGhosts();
            }
        }

        if (this.fruit && (this.fruit.ttl -= dt) <= 0) {
            this.fruit = null;
        }

        // A waiting ghost leaves once enough dots are eaten, or when the
        // player stops eating for a few seconds.
        this.sinceLastDot += dt;
        const waiting = this.ghosts.find((ghost) => ghost.state === 'house');
        if (waiting && (this.releaseCounter >= waiting.releaseAt || this.sinceLastDot >= 4)) {
            waiting.state = 'leaving';
            this.sinceLastDot = 0;
        }
    }

    // ---- movement --------------------------------------------------------

    // Move an entity along the grid. `decide` runs each time it reaches a
    // tile centre and may change entity.dir (or clear it to stop).
    advance(entity, distance, decide) {
        for (let guard = 0; distance > EPSILON && guard < 8; guard += 1) {
            if (isAtCentre(entity)) {
                entity.x = Math.round(entity.x);
                entity.y = Math.round(entity.y);
                if (entity.x <= -1 && entity.dir.x < 0) {
                    entity.x = COLS;
                } else if (entity.x >= COLS && entity.dir.x > 0) {
                    entity.x = -1;
                }
                decide(entity);
                if (!entity.dir || isWall(entity.x + entity.dir.x, entity.y + entity.dir.y)) {
                    entity.moving = false;

                    return;
                }
            }
            entity.moving = true;
            const horizontal = entity.dir.x !== 0;
            const along = horizontal ? entity.x : entity.y;
            const sign = entity.dir.x + entity.dir.y;
            const next = sign > 0 ? Math.floor(along + EPSILON) + 1 : Math.ceil(along - EPSILON) - 1;
            const step = Math.min(distance, Math.abs(next - along));
            entity.x += entity.dir.x * step;
            entity.y += entity.dir.y * step;
            distance -= step;
        }
        if (isAtCentre(entity)) {
            entity.x = Math.round(entity.x);
            entity.y = Math.round(entity.y);
        }
    }

    movePac(dt) {
        const pac = this.pac;
        // Reversing is allowed anywhere; other turns wait for a tile centre.
        if (isOpposite(pac.want, pac.dir)) {
            pac.dir = pac.want;
        }
        this.advance(pac, PAC_SPEED * this.speedFactor * dt, () => {
            if (!isWall(pac.x + pac.want.x, pac.y + pac.want.y)) {
                pac.dir = pac.want;
            }
        });
    }

    moveGhost(ghost, dt) {
        switch (ghost.state) {
            case 'house':
                ghost.y = HOUSE_Y + 0.4 * Math.sin(this.clock * 6 + ghost.homeX);
                break;
            case 'leaving':
                if (this.glide(ghost, HOUSE_X, DOOR_Y, HOUSE_SPEED * dt)) {
                    ghost.state = 'active';
                    ghost.dir = LEFT;
                }
                break;
            case 'entering':
                if (this.glide(ghost, HOUSE_X, HOUSE_Y, EYES_SPEED * 0.6 * dt)) {
                    ghost.state = 'leaving';
                }
                break;
            default:
                this.advance(ghost, this.ghostSpeed(ghost) * dt, () => this.chooseGhostDirection(ghost));
                break;
        }
    }

    // Scripted movement through the door: line up horizontally, then travel
    // vertically. Returns true on arrival.
    glide(ghost, targetX, targetY, distance) {
        if (Math.abs(ghost.x - targetX) > EPSILON) {
            const step = Math.min(distance, Math.abs(targetX - ghost.x));
            ghost.dir = targetX > ghost.x ? { x: 1, y: 0 } : LEFT;
            ghost.x += Math.sign(targetX - ghost.x) * step;

            return false;
        }
        ghost.x = targetX;
        const step = Math.min(distance, Math.abs(targetY - ghost.y));
        ghost.dir = targetY > ghost.y ? { x: 0, y: 1 } : UP;
        ghost.y += Math.sign(targetY - ghost.y) * step;

        return Math.abs(ghost.y - targetY) <= EPSILON;
    }

    ghostSpeed(ghost) {
        if (ghost.state === 'eyes') {
            return EYES_SPEED;
        }
        if (Math.round(ghost.y) === TUNNEL_ROW && (ghost.x < 5.5 || ghost.x > COLS - 6.5)) {
            return TUNNEL_SPEED;
        }
        if (ghost.frightened) {
            return FRIGHT_SPEED;
        }

        if (this.isElroy(ghost)) {
            return GHOST_SPEED * this.speedFactor * ELROY_BOOST[this.dotsLeft <= ELROY_DOTS / 2 ? 1 : 0];
        }

        return GHOST_SPEED * this.speedFactor;
    }

    chooseGhostDirection(ghost) {
        if (ghost.state === 'eyes' && ghost.y === DOOR_Y && (ghost.x === 13 || ghost.x === 14)) {
            ghost.state = 'entering';
            ghost.dir = null;

            return;
        }

        const options = DIRECTIONS.filter(
            (dir) => !isOpposite(dir, ghost.dir) && !isWall(ghost.x + dir.x, ghost.y + dir.y),
        );
        if (options.length === 0) {
            ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };

            return;
        }
        if (ghost.frightened) {
            ghost.dir = options[Math.floor(this.random() * options.length)];

            return;
        }

        const target = this.ghostTarget(ghost);
        let best = options[0];
        let bestDistance = Infinity;
        for (const dir of options) {
            const distance = squaredDistance(ghost.x + dir.x, ghost.y + dir.y, target.x, target.y);
            if (distance < bestDistance) {
                best = dir;
                bestDistance = distance;
            }
        }
        ghost.dir = best;
    }

    // Each ghost has its own idea of where the player is going.
    ghostTarget(ghost) {
        if (ghost.state === 'eyes') {
            return { x: 13, y: DOOR_Y };
        }
        if (this.mode === 'scatter' && !this.isElroy(ghost)) {
            return ghost.corner;
        }

        const pac = this.pac;
        const px = Math.round(pac.x);
        const py = Math.round(pac.y);
        switch (ghost.name) {
            case 'pinky':
                return { x: px + pac.dir.x * 4, y: py + pac.dir.y * 4 };
            case 'inky': {
                const blinky = this.ghosts[0];
                const aheadX = px + pac.dir.x * 2;
                const aheadY = py + pac.dir.y * 2;

                return { x: aheadX * 2 - Math.round(blinky.x), y: aheadY * 2 - Math.round(blinky.y) };
            }
            case 'clyde':
                return squaredDistance(ghost.x, ghost.y, px, py) > 64 ? { x: px, y: py } : ghost.corner;
            default:
                return { x: px, y: py };
        }
    }

    reverseGhosts() {
        this.ghosts
            .filter((ghost) => ghost.state === 'active' && ghost.dir)
            .forEach((ghost) => (ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y }));
    }

    // ---- eating and collisions -------------------------------------------

    eatAtPac() {
        const pac = this.pac;
        const col = Math.round(pac.x);
        const row = Math.round(pac.y);
        const dot = row >= 0 && row < ROWS && col >= 0 && col < COLS ? this.dots[row][col] : '';

        if (dot) {
            this.dots[row][col] = '';
            this.dotsLeft -= 1;
            this.dotsEaten += 1;
            this.releaseCounter += 1;
            this.sinceLastDot = 0;
            if (dot === 'o') {
                this.addScore(50);
                this.startFright();
            } else {
                this.addScore(10);
                this.onEvent('dot');
            }
            if (FRUIT_DOT_COUNTS.includes(this.dotsEaten)) {
                this.fruit = { ...fruitForLevel(this.level), ttl: FRUIT_SECONDS };
            }
            if (this.dotsLeft === 0) {
                this.setState('levelClear');
                this.onEvent('levelClear');

                return;
            }
        }

        if (this.fruit && squaredDistance(pac.x, pac.y, FRUIT_POS.x, FRUIT_POS.y) < 0.5) {
            this.addScore(this.fruit.points);
            this.popups.push({ x: FRUIT_POS.x, y: FRUIT_POS.y, text: String(this.fruit.points), ttl: 1.5 });
            this.fruit = null;
            this.onEvent('fruit');
        }
    }

    startFright() {
        this.frightTime = this.frightDuration;
        this.ghostCombo = 0;
        this.reverseGhosts();
        this.ghosts
            .filter((ghost) => ghost.state !== 'eyes' && ghost.state !== 'entering')
            .forEach((ghost) => (ghost.frightened = true));
        this.onEvent('power');
    }

    checkCollisions() {
        const pac = this.pac;
        for (const ghost of this.ghosts) {
            if (ghost.state !== 'active') {
                continue;
            }
            if (squaredDistance(pac.x, pac.y, ghost.x, ghost.y) > COLLISION_DISTANCE * COLLISION_DISTANCE) {
                continue;
            }
            if (ghost.frightened) {
                const points = GHOST_POINTS[Math.min(this.ghostCombo, GHOST_POINTS.length - 1)];
                this.ghostCombo += 1;
                ghost.frightened = false;
                ghost.state = 'eyes';
                this.addScore(points);
                this.popups.push({ x: ghost.x, y: ghost.y, text: String(points), ttl: 0.9 });
                this.setState('eatPause');
                this.onEvent('eatGhost');
            } else {
                this.setState('dying');
                this.onEvent('death');
            }

            return;
        }
    }

    addScore(points) {
        this.score += points;
        if (!this.extraLifeGiven && this.score >= EXTRA_LIFE_SCORE) {
            this.extraLifeGiven = true;
            this.lives += 1;
            this.onEvent('extraLife');
        }
        if (this.score > this.highScore) {
            this.highScore = this.score;
        }
    }

    afterDeath() {
        this.lives -= 1;
        if (this.lives <= 0) {
            this.setState('gameOver');
            this.onEvent('gameOver');

            return;
        }
        this.resetActors(true);
        this.setState('ready');
    }
}

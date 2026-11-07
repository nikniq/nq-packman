// Game rules, with no DOM or canvas in sight so it can run under node --test.
// The renderer reads this object's public fields; main.js feeds it input and
// listens for events (for sound and the HUD).
//
// Night Market Run: a street cat (the player) races through a hawker night
// market eating every satay stick while four rival cats give chase. A
// durian turns the tables for a few seconds. Each level is a new market.

import {
    COLS,
    DIRECTIONS,
    DOOR_Y,
    FRUIT_POS,
    HOUSE_X,
    HOUSE_Y,
    LEFT,
    PAC_START,
    ROWS,
    TUNNEL_ROW,
    UP,
    isOpposite,
    mazeForLevel,
    seededRandom,
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
// The bonus snack of each level, in order; the last repeats.
const FRUITS = [
    { name: 'kayaToast', points: 100 },
    { name: 'satay', points: 300 },
    { name: 'otah', points: 500 },
    { name: 'laksa', points: 700 },
    { name: 'chilliCrab', points: 1000 },
    { name: 'bakKwa', points: 2000 },
    { name: 'mooncake', points: 3000 },
    { name: 'lantern', points: 5000 },
];
const FRUIT_DOT_FRACTIONS = [0.28, 0.68];
const FRUIT_SECONDS = 9.5;
const EXTRA_LIFE_SCORE = 10000;
const COLLISION_DISTANCE = 0.7;
// Scar gets hungry near the end of a level: faster, and he keeps chasing
// even while the others scatter.
const HUNGRY_DOTS = 20;
const HUNGRY_BOOST = [1.05, 1.1];

// Power-ups: one appears per level, somewhere quiet, once a third of the
// snacks are gone. Each is a different way out of a tight spot.
export const POWER_UPS = {
    freeze: { label: 'FREEZE', seconds: 3 },
    phase: { label: 'PHASE', seconds: 10 },
    decoy: { label: 'DECOY', seconds: 6 },
    magnet: { label: 'MAGNET', seconds: 8 },
};
const POWER_UP_ORDER = ['freeze', 'magnet', 'decoy', 'phase'];
const POWER_UP_SPAWN_FRACTION = 0.33;
const POWER_UP_SECONDS = 12;
const POWER_UP_POINTS = 150;
const MAGNET_RADIUS = 2;
const PHASE_REACH = 3;

// The four rivals: who they are and where they lurk when scattering.
export const GHOST_SETUP = [
    { name: 'scar', x: HOUSE_X, y: DOOR_Y, corner: { x: 25, y: -3 }, inHouse: false },
    { name: 'misty', x: HOUSE_X, y: HOUSE_Y, corner: { x: 2, y: -3 }, inHouse: true },
    { name: 'bolt', x: HOUSE_X - 2, y: HOUSE_Y, corner: { x: 27, y: 31 }, inHouse: true },
    { name: 'dozy', x: HOUSE_X + 2, y: HOUSE_Y, corner: { x: 0, y: 31 }, inHouse: true },
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

export function powerUpForLevel(level) {
    return POWER_UP_ORDER[(level - 1) % POWER_UP_ORDER.length];
}

export class Game {
    // `run` names the course: 'classic' plays the shared mazes, anything
    // else (a date, for the daily run) seeds its own mazes and chase.
    constructor({ onEvent = () => {}, random = null, highScore = 0, run = 'classic' } = {}) {
        this.onEvent = onEvent;
        this.highScore = highScore;
        this.run = run;
        this.random = random ?? seededRandom(`${run}:chase`);
        this.state = 'title';
        this.stateTime = 0;
        this.clock = 0;
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.popups = [];
        this.humanGhost = null;
        this.resetMaze();
        this.resetActors(false);
    }

    // ---- lifecycle -------------------------------------------------------

    start(run = this.run) {
        this.run = run;
        this.random = seededRandom(`${run}:chase`);
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

    get isDaily() {
        return this.run !== 'classic';
    }

    resetMaze() {
        this.maze = mazeForLevel(this.level, this.run);
        this.dots = this.maze.map.map((row) => row.split('').map((tile) => (tile === '.' || tile === 'o' ? tile : '')));
        this.dotsLeft = this.maze.dotCount;
        this.dotsEaten = 0;
        this.fruit = null;
        this.fruitAt = FRUIT_DOT_FRACTIONS.map((fraction) => Math.round(this.dotsLeft * fraction));
        this.powerUp = null;
        this.powerUpSpawned = false;
        this.powerUpAt = Math.round(this.dotsLeft * POWER_UP_SPAWN_FRACTION);
        this.effects = {};
        this.decoy = null;
        this.phaseCharge = false;
    }

    resetActors(afterDeath) {
        this.pac = { x: PAC_START.x, y: PAC_START.y, dir: LEFT, want: LEFT, moving: false };
        // After a death the den empties faster so the player is not left
        // alone with Scar for long.
        const releaseAt = afterDeath || this.level > 2 ? [0, 0, 8, 16] : [0, 0, 30, 60];
        this.ghosts = GHOST_SETUP.map((setup, index) => ({
            name: setup.name,
            x: setup.x,
            y: setup.y,
            homeX: setup.x,
            corner: setup.corner,
            dir: setup.inHouse ? UP : LEFT,
            want: null,
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
        this.effects = {};
        this.decoy = null;
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
        return ghost.name === 'scar' && this.dotsLeft <= HUNGRY_DOTS && !this.ghosts.some((other) => other.state === 'house');
    }

    get frightDuration() {
        return Math.max(1.5, 7 - (this.level - 1) * 0.75);
    }

    isWall(col, row) {
        return this.maze.isWall(col, row);
    }

    // ---- input -----------------------------------------------------------

    steer(direction) {
        this.pac.want = direction;
    }

    // Player two steers whichever rival they have taken over.
    steerGhost(direction) {
        const ghost = this.humanGhost;
        if (!ghost) {
            return;
        }
        ghost.want = direction;
        if (ghost.state === 'active' && ghost.dir && isOpposite(direction, ghost.dir)) {
            ghost.dir = direction;
        }
    }

    // Hand player two the next rival (Tab), or none after the last.
    cycleHumanGhost() {
        const index = this.humanGhost ? this.ghosts.indexOf(this.humanGhost) + 1 : 0;
        this.humanGhost = index < this.ghosts.length ? this.ghosts[index] : null;
        this.onEvent('player2', this.humanGhost?.name ?? null);

        return this.humanGhost;
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
                    this.humanGhost = this.humanGhost ? this.ghosts[GHOST_SETUP.findIndex((setup) => setup.name === this.humanGhost.name)] : null;
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
        if (!this.effects.freeze) {
            this.ghosts.forEach((ghost) => this.moveGhost(ghost, dt));
        }
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
        if (this.powerUp && (this.powerUp.ttl -= dt) <= 0) {
            this.powerUp = null;
        }
        for (const name of Object.keys(this.effects)) {
            if ((this.effects[name] -= dt) <= 0) {
                delete this.effects[name];
                if (name === 'decoy') {
                    this.decoy = null;
                }
                this.onEvent('effectEnd', name);
            }
        }
        if (this.effects.magnet) {
            this.magnetise();
        }

        // A waiting rival leaves once enough snacks are eaten, or when the
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
                if (!entity.dir || this.isWall(entity.x + entity.dir.x, entity.y + entity.dir.y)) {
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
            if (!this.isWall(pac.x + pac.want.x, pac.y + pac.want.y)) {
                pac.dir = pac.want;
            } else if (this.effects.phase && this.phaseThrough(pac.want)) {
                pac.dir = pac.want;
            }
        });
    }

    // With PHASE active the cat slips through one stall: if open floor lies
    // within a few tiles in the wanted direction, jump straight to it.
    phaseThrough(direction) {
        const pac = this.pac;
        for (let reach = 2; reach <= PHASE_REACH + 1; reach += 1) {
            const col = pac.x + direction.x * reach;
            const row = pac.y + direction.y * reach;
            if (col < 1 || col >= COLS - 1 || row < 1 || row >= ROWS - 1) {
                return false;
            }
            if (this.maze.isOpen(col, row) && this.maze.tileAt(col, row) !== '-' && !this.insideDen(col, row)) {
                this.popups.push({ x: pac.x, y: pac.y, text: 'ZIP', ttl: 0.6 });
                pac.x = col;
                pac.y = row;
                delete this.effects.phase;
                this.onEvent('phase');

                return true;
            }
        }

        return false;
    }

    insideDen(col, row) {
        return col > 10 && col < 17 && row > 12 && row < 16;
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
            return GHOST_SPEED * this.speedFactor * HUNGRY_BOOST[this.dotsLeft <= HUNGRY_DOTS / 2 ? 1 : 0];
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
            (dir) => !isOpposite(dir, ghost.dir) && !this.isWall(ghost.x + dir.x, ghost.y + dir.y),
        );
        if (options.length === 0) {
            ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };

            return;
        }
        if (ghost === this.humanGhost && ghost.state === 'active') {
            // Player two: take the wanted turn when it is open, otherwise
            // carry straight on, and only turn at a fork when forced.
            if (ghost.want && options.includes(ghost.want)) {
                ghost.dir = ghost.want;
            } else if (!options.includes(ghost.dir)) {
                ghost.dir = options[0];
            }

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

    // Each rival has its own idea of where the player is going. A decoy
    // takes the player's place in every calculation while it lasts.
    ghostTarget(ghost) {
        if (ghost.state === 'eyes') {
            return { x: 13, y: DOOR_Y };
        }
        if (this.mode === 'scatter' && !this.isElroy(ghost)) {
            return ghost.corner;
        }

        const pac = this.decoy ?? this.pac;
        const px = Math.round(pac.x);
        const py = Math.round(pac.y);
        switch (ghost.name) {
            case 'misty':
                return { x: px + pac.dir.x * 4, y: py + pac.dir.y * 4 };
            case 'bolt': {
                const scar = this.ghosts[0];
                const aheadX = px + pac.dir.x * 2;
                const aheadY = py + pac.dir.y * 2;

                return { x: aheadX * 2 - Math.round(scar.x), y: aheadY * 2 - Math.round(scar.y) };
            }
            case 'dozy':
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

    eatDot(col, row) {
        const dot = row >= 0 && row < ROWS && col >= 0 && col < COLS ? this.dots[row][col] : '';
        if (!dot) {
            return false;
        }
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
        if (this.fruitAt.includes(this.dotsEaten)) {
            this.fruit = { ...fruitForLevel(this.level), ttl: FRUIT_SECONDS };
        }
        if (!this.powerUpSpawned && this.dotsEaten >= this.powerUpAt) {
            this.spawnPowerUp();
        }
        if (this.dotsLeft === 0) {
            this.setState('levelClear');
            this.onEvent('levelClear');
        }

        return true;
    }

    eatAtPac() {
        const pac = this.pac;
        this.eatDot(Math.round(pac.x), Math.round(pac.y));
        if (this.state !== 'playing') {
            return;
        }

        if (this.fruit && squaredDistance(pac.x, pac.y, FRUIT_POS.x, FRUIT_POS.y) < 0.5) {
            this.addScore(this.fruit.points);
            this.popups.push({ x: FRUIT_POS.x, y: FRUIT_POS.y, text: String(this.fruit.points), ttl: 1.5 });
            this.fruit = null;
            this.onEvent('fruit');
        }

        if (this.powerUp && squaredDistance(pac.x, pac.y, this.powerUp.x, this.powerUp.y) < 0.5) {
            this.activatePowerUp(this.powerUp);
        }
    }

    // MAGNET pulls in every snack within reach, one tile per tick so the
    // score ticks up visibly instead of jumping.
    magnetise() {
        const col = Math.round(this.pac.x);
        const row = Math.round(this.pac.y);
        for (let dy = -MAGNET_RADIUS; dy <= MAGNET_RADIUS; dy += 1) {
            for (let dx = -MAGNET_RADIUS; dx <= MAGNET_RADIUS; dx += 1) {
                if (dx * dx + dy * dy <= MAGNET_RADIUS * MAGNET_RADIUS && this.eatDot(col + dx, row + dy)) {
                    return;
                }
            }
        }
    }

    // ---- power-ups ---------------------------------------------------------

    spawnPowerUp() {
        this.powerUpSpawned = true;
        const pac = this.pac;
        const spots = this.maze.openTiles(
            (col, row) => row !== TUNNEL_ROW && !this.insideDen(col, row) && squaredDistance(col, row, pac.x, pac.y) > 64,
        );
        if (spots.length === 0) {
            return;
        }
        const spot = spots[Math.floor(this.random() * spots.length)];
        this.powerUp = { kind: powerUpForLevel(this.level), x: spot.x, y: spot.y, ttl: POWER_UP_SECONDS };
    }

    activatePowerUp({ kind, x, y }) {
        this.powerUp = null;
        this.addScore(POWER_UP_POINTS);
        this.effects[kind] = POWER_UPS[kind].seconds;
        this.popups.push({ x, y, text: POWER_UPS[kind].label, ttl: 1.2 });
        if (kind === 'decoy') {
            this.decoy = { x: this.pac.x, y: this.pac.y, dir: this.pac.dir };
        }
        this.onEvent('powerUp', kind);
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
        const humanName = this.humanGhost?.name;
        this.resetActors(true);
        this.humanGhost = humanName ? this.ghosts.find((ghost) => ghost.name === humanName) : null;
        this.setState('ready');
    }
}

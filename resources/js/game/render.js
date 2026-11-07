// Canvas drawing. Everything is drawn in tile units with the origin on the
// centre of tile (0, 0), so an entity's x/y can be used directly.
//
// The look: a night market after dark. Stalls (walls) glow in a neon colour
// that changes with each level, satay sticks line the lanes, durians sit in
// the corners, and the cats are cats: round heads, pointed ears, whiskers.

import { COLS, FRUIT_POS, LEFT, ROWS, UP } from './maze.js';

const FONT = "'Press Start 2P', ui-monospace, monospace";
export const BACKGROUND = '#07040f';
const WALL_FLASH_COLOR = '#f4f4ff';
// One neon per level; wraps round.
export const WALL_COLORS = ['#ff7a1a', '#19e6f0', '#ff3fa4', '#8cff4a', '#ffd23f', '#b38bff'];
const STICK_COLOR = '#e8c48a';
const STICK_TIP = '#8a4b1f';
const DURIAN_COLOR = '#b8d94a';
const DURIAN_SHADE = '#7fa32a';
export const CAT_COLOR = '#fff1c9';
const CAT_EAR = '#ff9f43';
const FRIGHT_COLOR = '#5a7bff';
const FRIGHT_FLASH = '#f4f4ff';
export const GHOST_COLORS = { scar: '#ff3b3b', misty: '#c89bff', bolt: '#19e6f0', dozy: '#8fd96b' };
const FREEZE_COLOR = '#9fe8ff';
const TEXT_COLOR = '#f4f4ff';
const POPUP_COLOR = '#19e6f0';

function disc(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function stroke(ctx, color, width, points, close = false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    if (close) {
        ctx.closePath();
    }
    ctx.stroke();
}

function polygon(ctx, color, points) {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
}

// Draws a bonus snack centred on the origin, about 1.5 tiles across. Shared
// by the maze and the snack shelf in the HUD.
export function drawFruit(ctx, name) {
    switch (name) {
        case 'kayaToast':
            polygon(ctx, '#d9a066', [[-0.6, -0.5], [0.6, -0.5], [0.6, 0.5], [-0.6, 0.5]]);
            polygon(ctx, '#f3d9a4', [[-0.48, -0.38], [0.48, -0.38], [0.48, 0.38], [-0.48, 0.38]]);
            polygon(ctx, '#7cc242', [[-0.48, -0.08], [0.48, -0.08], [0.48, 0.1], [-0.48, 0.1]]);
            break;
        case 'satay':
            for (const [x, tilt] of [[-0.3, -0.25], [0, 0], [0.3, 0.25]]) {
                stroke(ctx, '#e8c48a', 0.08, [[x + tilt * 0.5, 0.7], [x - tilt * 0.5, -0.6]]);
                for (const y of [-0.45, -0.15, 0.15]) {
                    disc(ctx, x - tilt * (y / 1.3) * 0.5, y, 0.14, '#b5542a');
                }
            }
            break;
        case 'otah':
            polygon(ctx, '#3f9b3a', [[-0.72, 0], [-0.35, -0.42], [0.35, -0.42], [0.72, 0], [0.35, 0.42], [-0.35, 0.42]]);
            polygon(ctx, '#e8743b', [[-0.4, -0.18], [0.4, -0.18], [0.4, 0.18], [-0.4, 0.18]]);
            stroke(ctx, '#c7a24a', 0.06, [[-0.5, -0.5], [-0.5, 0.5]]);
            stroke(ctx, '#c7a24a', 0.06, [[0.5, -0.5], [0.5, 0.5]]);
            break;
        case 'laksa':
            disc(ctx, 0, 0.12, 0.62, '#f4f4ff');
            disc(ctx, 0, 0.08, 0.5, '#e8502a');
            for (const x of [-0.3, -0.1, 0.1, 0.3]) {
                stroke(ctx, '#ffd98a', 0.07, [[x, -0.2], [x + 0.05, 0.3]]);
            }
            disc(ctx, 0.18, -0.02, 0.12, '#ffb3ae');
            stroke(ctx, '#e8c48a', 0.08, [[-0.45, -0.6], [0.3, -0.05]]);
            break;
        case 'chilliCrab':
            disc(ctx, 0, 0.05, 0.42, '#ff3b1c');
            disc(ctx, -0.55, -0.3, 0.17, '#ff3b1c');
            disc(ctx, 0.55, -0.3, 0.17, '#ff3b1c');
            for (const side of [-1, 1]) {
                stroke(ctx, '#ff3b1c', 0.08, [[side * 0.35, 0.1], [side * 0.65, 0.35]]);
                stroke(ctx, '#ff3b1c', 0.08, [[side * 0.4, 0.3], [side * 0.6, 0.6]]);
                stroke(ctx, '#ff3b1c', 0.08, [[side * 0.3, -0.2], [side * 0.5, -0.28]]);
                disc(ctx, side * 0.15, -0.18, 0.07, '#1a1a1a');
            }
            break;
        case 'bakKwa':
            polygon(ctx, '#b3261e', [[-0.6, -0.55], [0.6, -0.55], [0.6, 0.55], [-0.6, 0.55]]);
            polygon(ctx, '#e34a2a', [[-0.5, -0.45], [0.5, -0.45], [0.5, 0.45], [-0.5, 0.45]]);
            stroke(ctx, '#ff9a6a', 0.06, [[-0.4, -0.3], [0.1, -0.3]]);
            stroke(ctx, '#ff9a6a', 0.06, [[-0.2, 0.1], [0.35, 0.1]]);
            break;
        case 'mooncake':
            disc(ctx, 0, 0, 0.62, '#c98a3c');
            disc(ctx, 0, 0, 0.5, '#e8b25c');
            stroke(ctx, '#a66a28', 0.06, [[0, -0.36], [0.34, 0], [0, 0.36], [-0.34, 0]], true);
            disc(ctx, 0, 0, 0.12, '#a66a28');
            break;
        case 'lantern':
            stroke(ctx, '#ffd23f', 0.08, [[0, -0.7], [0, -0.5]]);
            polygon(ctx, '#ff3b3b', [[-0.5, -0.3], [0.5, -0.3], [0.6, 0.1], [0.5, 0.45], [-0.5, 0.45], [-0.6, 0.1]]);
            stroke(ctx, '#ffd23f', 0.06, [[-0.5, -0.3], [0.5, -0.3]]);
            stroke(ctx, '#ffd23f', 0.06, [[-0.5, 0.45], [0.5, 0.45]]);
            stroke(ctx, '#ff9a6a', 0.05, [[-0.2, -0.3], [-0.26, 0.45]]);
            stroke(ctx, '#ff9a6a', 0.05, [[0.2, -0.3], [0.26, 0.45]]);
            stroke(ctx, '#ffd23f', 0.1, [[0, 0.45], [0, 0.75]]);
            break;
        default:
            disc(ctx, 0, 0, 0.5, '#ff3b3b');
            break;
    }
}

// A power-up icon centred on the origin, about a tile across.
export function drawPowerUp(ctx, kind, clock = 0) {
    const pulse = 0.5 + 0.5 * Math.sin(clock * 6);
    disc(ctx, 0, 0, 0.62 + pulse * 0.06, 'rgba(244, 244, 255, 0.12)');
    switch (kind) {
        case 'freeze':
            for (let spoke = 0; spoke < 3; spoke += 1) {
                const angle = (spoke * Math.PI) / 3;
                stroke(ctx, FREEZE_COLOR, 0.1, [
                    [Math.cos(angle) * 0.5, Math.sin(angle) * 0.5],
                    [-Math.cos(angle) * 0.5, -Math.sin(angle) * 0.5],
                ]);
            }
            disc(ctx, 0, 0, 0.12, '#f4f4ff');
            break;
        case 'phase':
            ctx.strokeStyle = '#d8a6ff';
            ctx.lineWidth = 0.12;
            ctx.setLineDash([0.25, 0.18]);
            ctx.beginPath();
            ctx.arc(0, 0, 0.42, clock * 2, clock * 2 + Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            disc(ctx, 0, 0, 0.14, '#d8a6ff');
            break;
        case 'decoy':
            drawCatHead(ctx, 0, 0, 0.42, 'rgba(244, 244, 255, 0.35)', 'rgba(244, 244, 255, 0.5)', LEFT, 0.1);
            break;
        case 'magnet':
            ctx.strokeStyle = '#ff3b3b';
            ctx.lineWidth = 0.18;
            ctx.lineCap = 'butt';
            ctx.beginPath();
            ctx.arc(0, -0.05, 0.36, Math.PI, 0);
            ctx.stroke();
            stroke(ctx, '#ff3b3b', 0.18, [[-0.36, -0.05], [-0.36, 0.3]]);
            stroke(ctx, '#ff3b3b', 0.18, [[0.36, -0.05], [0.36, 0.3]]);
            stroke(ctx, '#f4f4ff', 0.18, [[-0.36, 0.2], [-0.36, 0.4]]);
            stroke(ctx, '#f4f4ff', 0.18, [[0.36, 0.2], [0.36, 0.4]]);
            break;
        default:
            break;
    }
}

// The player's head: disc, two ears on top, eyes, and a mouth wedge that
// opens towards `dir`. `mouth` is the half-angle of the wedge as a
// fraction of pi.
export function drawCatHead(ctx, x, y, radius, color, earColor, dir, mouth) {
    const angle = Math.atan2(dir.y, dir.x);
    ctx.save();
    ctx.translate(x, y);
    polygon(ctx, earColor, [[-radius * 0.95, -radius * 0.2], [-radius * 0.7, -radius * 1.3], [-radius * 0.15, -radius * 0.85]]);
    polygon(ctx, earColor, [[radius * 0.95, -radius * 0.2], [radius * 0.7, -radius * 1.3], [radius * 0.15, -radius * 0.85]]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, angle + mouth * Math.PI, angle - mouth * Math.PI + Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    // Eyes sit away from the mouth; a stripe between the ears.
    const eyeY = dir.y < 0 ? radius * 0.2 : -radius * 0.3;
    for (const side of [-1, 1]) {
        if (dir.x !== 0 && Math.sign(side) === Math.sign(dir.x) && mouth > 0.12) {
            continue;
        }
        disc(ctx, side * radius * 0.32, eyeY, radius * 0.12, '#1a1a1a');
    }
    stroke(ctx, earColor, radius * 0.12, [[-radius * 0.2, -radius * 0.75], [radius * 0.2, -radius * 0.75]]);
    ctx.restore();
}

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tile = 16;
        this.walls = null;
        this.wallsFlash = null;
        this.wallsFor = null;
    }

    // Call whenever the canvas backing size changes. `tile` is in device pixels.
    resize(tile) {
        this.tile = tile;
        this.canvas.width = COLS * tile;
        this.canvas.height = ROWS * tile;
        this.wallsFor = null;
    }

    ensureWalls(game) {
        const key = `${game.maze.seed}:${game.level}`;
        if (this.wallsFor === key) {
            return;
        }
        this.wallsFor = key;
        const color = WALL_COLORS[(game.level - 1) % WALL_COLORS.length];
        this.walls = this.buildWalls(game.maze, color);
        this.wallsFlash = this.buildWalls(game.maze, WALL_FLASH_COLOR);
    }

    // Walls are drawn once as a hollow outline. A layer is "the wall tiles
    // minus everything within `inset` of open floor"; subtracting a deeper
    // layer from a shallower one leaves a rounded ring of even thickness.
    buildWalls(maze, color) {
        const tile = this.tile;
        const map = maze.map;
        const layer = (inset) => {
            const canvas = document.createElement('canvas');
            canvas.width = COLS * tile;
            canvas.height = ROWS * tile;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            for (let row = 0; row < ROWS; row += 1) {
                for (let col = 0; col < COLS; col += 1) {
                    if (map[row][col] === '#') {
                        ctx.fillRect(col * tile, row * tile, tile, tile);
                    }
                }
            }
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineJoin = 'round';
            ctx.lineWidth = inset * tile * 2;
            for (let row = -1; row <= ROWS; row += 1) {
                for (let col = -1; col <= COLS; col += 1) {
                    const outside = row < 0 || row >= ROWS || col < 0 || col >= COLS;
                    if (outside || map[row][col] !== '#') {
                        ctx.fillRect(col * tile, row * tile, tile, tile);
                        ctx.strokeRect(col * tile, row * tile, tile, tile);
                    }
                }
            }

            return canvas;
        };

        const ring = layer(0.3);
        const ctx = ring.getContext('2d');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(layer(0.3 + Math.max(0.1, 1.6 / tile)), 0, 0);
        // A soft inner glow so the stalls read as lit signs.
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.1;
        ctx.drawImage(layer(0.3 + Math.max(0.1, 1.6 / tile)), 0, 0);

        return ring;
    }

    draw(game, paused) {
        const { ctx, tile } = this;
        this.ensureWalls(game);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = BACKGROUND;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const flashing = game.state === 'levelClear' && Math.floor(game.stateTime * 5) % 2 === 1;
        ctx.drawImage(flashing ? this.wallsFlash : this.walls, 0, 0);

        ctx.setTransform(tile, 0, 0, tile, tile / 2, tile / 2);
        this.drawDoor();
        this.drawDots(game);
        if (game.fruit) {
            this.drawFruit(game.fruit.name, FRUIT_POS.x, FRUIT_POS.y);
        }
        if (game.powerUp) {
            ctx.save();
            ctx.translate(game.powerUp.x, game.powerUp.y);
            drawPowerUp(ctx, game.powerUp.kind, game.clock);
            ctx.restore();
        }
        if (game.decoy) {
            ctx.save();
            ctx.globalAlpha = 0.45 + 0.2 * Math.sin(game.clock * 10);
            drawCatHead(ctx, game.decoy.x, game.decoy.y, 0.72, CAT_COLOR, CAT_EAR, game.decoy.dir, 0.1);
            ctx.restore();
        }

        const showGhosts = game.state !== 'levelClear' && !(game.state === 'dying' && game.stateTime > 0.5);
        if (game.state !== 'gameOver' && game.state !== 'title') {
            this.drawPac(game);
        }
        if (showGhosts && game.state !== 'gameOver') {
            // On the title screen only the rivals waiting in the den are
            // shown, which keeps the title text clear.
            game.ghosts
                .filter((ghost) => game.state !== 'title' || ghost.state === 'house')
                .forEach((ghost) => this.drawGhost(game, ghost));
        }

        game.popups.forEach((popup) => this.text(popup.text, popup.x, popup.y, 0.5, POPUP_COLOR));
        this.drawMessages(game, paused);
    }

    drawDoor() {
        const { ctx } = this;
        ctx.fillStyle = '#ffb1f5';
        ctx.fillRect(12.5, 11.9, 2, 0.2);
    }

    // Satay sticks lie diagonally in the lane; durians pulse.
    drawDots(game) {
        const { ctx } = this;
        const pelletVisible = game.state === 'title' || Math.floor(game.clock * 4) % 2 === 0;
        const magnet = game.effects.magnet ? { x: game.pac.x, y: game.pac.y } : null;
        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                const dot = game.dots[row][col];
                if (dot === '.') {
                    const near = magnet && (col - magnet.x) ** 2 + (row - magnet.y) ** 2 <= 9;
                    ctx.save();
                    ctx.translate(col, row);
                    ctx.rotate(-Math.PI / 4);
                    ctx.fillStyle = near ? '#fff1c9' : STICK_COLOR;
                    ctx.fillRect(-0.22, -0.045, 0.44, 0.09);
                    ctx.fillStyle = STICK_TIP;
                    ctx.fillRect(-0.06, -0.08, 0.2, 0.16);
                    ctx.restore();
                } else if (dot === 'o' && pelletVisible) {
                    this.drawDurian(col, row);
                }
            }
        }
    }

    drawDurian(x, y) {
        const { ctx } = this;
        const spikes = 9;
        ctx.fillStyle = DURIAN_COLOR;
        ctx.beginPath();
        for (let spike = 0; spike < spikes * 2; spike += 1) {
            const angle = (spike * Math.PI) / spikes;
            const radius = spike % 2 === 0 ? 0.5 : 0.34;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;
            if (spike === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fill();
        disc(ctx, x, y, 0.2, DURIAN_SHADE);
    }

    drawPac(game) {
        const { ctx } = this;
        const pac = game.pac;
        let mouth = 0.22;
        let dir = pac.dir || LEFT;

        if (game.state === 'dying') {
            // Hold still for a beat, then spin away and shrink.
            const progress = Math.min(1, Math.max(0, (game.stateTime - 0.5) / 0.9));
            if (progress >= 1) {
                return;
            }
            ctx.save();
            ctx.translate(pac.x, pac.y);
            ctx.rotate(progress * Math.PI * 4);
            ctx.scale(1 - progress, 1 - progress);
            drawCatHead(ctx, 0, 0, 0.72, CAT_COLOR, CAT_EAR, UP, 0.22 + progress * 0.5);
            ctx.restore();

            return;
        } else if (game.state === 'ready') {
            mouth = 0.04;
        } else if (pac.moving && game.state === 'playing') {
            mouth = 0.02 + 0.24 * Math.abs(Math.sin(game.clock * 16));
        }

        if (game.effects.magnet) {
            ctx.strokeStyle = 'rgba(255, 59, 59, 0.6)';
            ctx.lineWidth = 0.08;
            ctx.beginPath();
            ctx.arc(pac.x, pac.y, 2 + 0.15 * Math.sin(game.clock * 8), 0, Math.PI * 2);
            ctx.stroke();
        }
        if (game.effects.phase) {
            ctx.save();
            ctx.globalAlpha = 0.5 + 0.3 * Math.sin(game.clock * 12);
            disc(ctx, pac.x, pac.y, 0.95, 'rgba(216, 166, 255, 0.35)');
            ctx.restore();
        }

        drawCatHead(ctx, pac.x, pac.y, 0.72, CAT_COLOR, CAT_EAR, dir, mouth);
    }

    // A rival: round head, pointed ears, almond eyes with slit pupils and
    // whiskers. Frightened, it goes pale blue with wide eyes and a wobbly
    // mouth; eaten, only its eyes race home.
    drawGhost(game, ghost) {
        const { ctx } = this;
        const dir = ghost.dir || UP;
        const eyesOnly = ghost.state === 'eyes' || ghost.state === 'entering';
        const frightened = ghost.frightened && !eyesOnly;
        // Flash white during the last two seconds of fright as a warning.
        const flashing = frightened && game.frightTime < 2 && Math.floor(game.frightTime * 5) % 2 === 0;
        const frozen = Boolean(game.effects.freeze) && ghost.state === 'active';

        ctx.save();
        ctx.translate(ghost.x, ghost.y);

        if (!eyesOnly) {
            const radius = 0.74;
            const color = frightened ? (flashing ? FRIGHT_FLASH : FRIGHT_COLOR) : GHOST_COLORS[ghost.name];
            const twitch = frightened ? 0 : Math.floor(game.clock * 6 + ghost.homeX) % 2 === 0 ? 0.06 : 0;
            polygon(ctx, color, [[-radius * 0.9, -radius * 0.3], [-radius * 0.7, -radius * 1.35 - twitch], [-radius * 0.2, -radius * 0.85]]);
            polygon(ctx, color, [[radius * 0.9, -radius * 0.3], [radius * 0.7, -radius * 1.35 - twitch], [radius * 0.2, -radius * 0.85]]);
            disc(ctx, 0, 0, radius, color);
            // Whiskers.
            const whisker = frightened ? 'rgba(244,244,255,0.7)' : 'rgba(7,4,15,0.55)';
            for (const side of [-1, 1]) {
                stroke(ctx, whisker, 0.05, [[side * 0.25, 0.22], [side * 1.0, 0.1]]);
                stroke(ctx, whisker, 0.05, [[side * 0.25, 0.3], [side * 1.0, 0.4]]);
            }
            if (frozen) {
                ctx.strokeStyle = FREEZE_COLOR;
                ctx.lineWidth = 0.1;
                ctx.beginPath();
                ctx.arc(0, 0, radius + 0.12, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        if (frightened) {
            ctx.fillStyle = flashing ? '#ff3b3b' : '#f4f4ff';
            disc(ctx, -0.3, -0.18, 0.16, ctx.fillStyle);
            disc(ctx, 0.3, -0.18, 0.16, ctx.fillStyle);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 0.08;
            ctx.beginPath();
            ctx.moveTo(-0.4, 0.4);
            for (let point = 1; point <= 6; point += 1) {
                ctx.lineTo(-0.4 + point * (0.8 / 6), point % 2 === 0 ? 0.4 : 0.26);
            }
            ctx.stroke();
        } else {
            for (const side of [-1, 1]) {
                ctx.fillStyle = eyesOnly ? '#ffd23f' : '#f4f4ff';
                ctx.beginPath();
                ctx.ellipse(side * 0.3 + dir.x * 0.08, -0.14 + dir.y * 0.1, 0.2, 0.15, side * 0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#07040f';
                ctx.beginPath();
                ctx.ellipse(side * 0.3 + dir.x * 0.16, -0.14 + dir.y * 0.18, 0.06, 0.13, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            // Nose and mouth.
            if (!eyesOnly) {
                polygon(ctx, '#07040f', [[-0.08, 0.14], [0.08, 0.14], [0, 0.24]]);
            }
        }

        ctx.restore();

        if (ghost === game.humanGhost) {
            this.text('P2', ghost.x, ghost.y - 1.5, 0.42, TEXT_COLOR);
        }
    }

    drawFruit(name, x, y) {
        const { ctx } = this;
        ctx.save();
        ctx.translate(x, y);
        drawFruit(ctx, name);
        ctx.restore();
    }

    drawMessages(game, paused) {
        if (paused) {
            this.text('PAUSED', 13.5, 17, 0.9, TEXT_COLOR);

            return;
        }
        switch (game.state) {
            case 'title':
                this.text('NIGHT MARKET', 13.5, 8, 1.1, WALL_COLORS[0], BACKGROUND);
                this.text('RUN', 13.5, 10.2, 1.4, CAT_COLOR, BACKGROUND);
                this.text('PRESS ENTER', 13.5, 17, 0.72, TEXT_COLOR);
                this.text('OR TAP TO PLAY', 13.5, 19, 0.72, TEXT_COLOR, BACKGROUND);
                this.text('D · DAILY RUN', 13.5, 23, 0.56, TEXT_COLOR, BACKGROUND);
                this.text('TAB · PLAYER 2 TAKES A CAT', 13.5, 25, 0.5, '#8a8fb8', BACKGROUND);
                break;
            case 'ready':
                this.text(game.isDaily ? 'DAILY RUN' : `MARKET ${game.level}`, 13.5, 20, 0.7, TEXT_COLOR, BACKGROUND);
                this.text('READY!', 13.5, 17, 0.9, CAT_COLOR);
                break;
            case 'gameOver':
                this.text('GAME OVER', 13.5, 17, 0.9, '#ff3b3b');
                if (game.isNewHighScore && Math.floor(game.stateTime * 3) % 2 === 0) {
                    this.text('NEW HIGH SCORE', 13.5, 11, 0.68, CAT_COLOR);
                }
                if (game.stateTime > 1) {
                    this.text('ENTER OR TAP', 13.5, 23, 0.72, TEXT_COLOR, BACKGROUND);
                }
                break;
            default:
                break;
        }
    }

    // Text is laid out in tile units but rasterised in device pixels, since
    // sub-pixel font sizes under a scale transform render unevenly.
    text(string, x, y, size, color, backdrop = null) {
        const { ctx, tile } = this;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = `${Math.round(size * tile)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const px = (x + 0.5) * tile;
        const py = (y + 0.5) * tile;
        if (backdrop) {
            const width = ctx.measureText(string).width + tile;
            ctx.fillStyle = backdrop;
            ctx.fillRect(px - width / 2, py - size * tile * 0.8, width, size * tile * 1.6);
        }
        ctx.fillStyle = color;
        ctx.fillText(string, px, py);
        ctx.restore();
    }
}

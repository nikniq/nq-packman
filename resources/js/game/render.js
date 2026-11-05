// Canvas drawing. Everything is drawn in tile units with the origin on the
// centre of tile (0, 0), so an entity's x/y can be used directly.

import { COLS, FRUIT_POS, LEFT, MAP, ROWS, UP } from './maze.js';

const FONT = "'Press Start 2P', ui-monospace, monospace";
const WALL_COLOR = '#2a3cff';
const WALL_FLASH_COLOR = '#f4f4ff';
const DOT_COLOR = '#ffb8ae';
const PAC_COLOR = '#ffe600';
const FRIGHT_COLOR = '#2233dd';
const GHOST_COLORS = { blinky: '#ff2b1c', pinky: '#ffb1f5', inky: '#19e6f0', clyde: '#ffb547' };
const LEAF_COLOR = '#3ddc68';
const STEM_COLOR = '#c98a3c';

function disc(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

function stroke(ctx, color, width, points) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
}

// Draws a bonus fruit centred on the origin, about 1.5 tiles across. Shared
// by the maze and the fruit shelf in the HUD.
export function drawFruit(ctx, name) {
    switch (name) {
        case 'cherry':
            stroke(ctx, STEM_COLOR, 0.1, [[-0.3, 0.2], [0.05, -0.4], [0.45, -0.62]]);
            stroke(ctx, STEM_COLOR, 0.1, [[0.32, 0.3], [0.3, -0.25], [0.45, -0.62]]);
            disc(ctx, -0.32, 0.28, 0.34, '#ff2b1c');
            disc(ctx, 0.32, 0.36, 0.34, '#ff2b1c');
            disc(ctx, -0.42, 0.18, 0.08, '#ffd9c9');
            disc(ctx, 0.22, 0.26, 0.08, '#ffd9c9');
            break;
        case 'strawberry':
            ctx.fillStyle = '#ff2b4a';
            ctx.beginPath();
            ctx.moveTo(-0.58, -0.3);
            ctx.quadraticCurveTo(-0.62, 0.35, 0, 0.72);
            ctx.quadraticCurveTo(0.62, 0.35, 0.58, -0.3);
            ctx.quadraticCurveTo(0, -0.62, -0.58, -0.3);
            ctx.fill();
            for (const [x, y] of [[-0.28, -0.05], [0.05, 0.02], [0.32, -0.1], [-0.1, 0.32], [0.2, 0.3]]) {
                disc(ctx, x, y, 0.055, '#fff3c4');
            }
            stroke(ctx, LEAF_COLOR, 0.16, [[-0.34, -0.42], [0, -0.52], [0.34, -0.42]]);
            stroke(ctx, LEAF_COLOR, 0.12, [[0, -0.5], [0, -0.7]]);
            break;
        case 'orange':
            disc(ctx, 0, 0.1, 0.58, '#ffa726');
            disc(ctx, -0.2, -0.08, 0.1, '#ffd08a');
            stroke(ctx, LEAF_COLOR, 0.16, [[0, -0.46], [0.3, -0.64]]);
            break;
        case 'apple':
            disc(ctx, -0.2, 0.1, 0.44, '#e53935');
            disc(ctx, 0.2, 0.1, 0.44, '#e53935');
            disc(ctx, -0.3, -0.04, 0.09, '#ffb3ae');
            stroke(ctx, STEM_COLOR, 0.1, [[0, -0.28], [0.08, -0.66]]);
            stroke(ctx, LEAF_COLOR, 0.14, [[0.1, -0.5], [0.36, -0.58]]);
            break;
        case 'melon':
            disc(ctx, 0, 0.12, 0.58, '#5fcf5a');
            stroke(ctx, '#2f8f3a', 0.07, [[-0.3, -0.34], [-0.38, 0.12], [-0.28, 0.58]]);
            stroke(ctx, '#2f8f3a', 0.07, [[0, -0.44], [0, 0.68]]);
            stroke(ctx, '#2f8f3a', 0.07, [[0.3, -0.34], [0.38, 0.12], [0.28, 0.58]]);
            stroke(ctx, STEM_COLOR, 0.1, [[0, -0.46], [0.12, -0.7]]);
            break;
        case 'galaxian':
            ctx.fillStyle = '#ffd54f';
            ctx.beginPath();
            ctx.moveTo(0, -0.68);
            ctx.lineTo(0.28, -0.05);
            ctx.lineTo(0.7, 0.05);
            ctx.lineTo(0.3, 0.3);
            ctx.lineTo(0.22, 0.68);
            ctx.lineTo(0, 0.4);
            ctx.lineTo(-0.22, 0.68);
            ctx.lineTo(-0.3, 0.3);
            ctx.lineTo(-0.7, 0.05);
            ctx.lineTo(-0.28, -0.05);
            ctx.closePath();
            ctx.fill();
            disc(ctx, 0, -0.1, 0.16, '#ff2b1c');
            stroke(ctx, '#2a8cff', 0.1, [[-0.5, 0.1], [-0.3, 0.2]]);
            stroke(ctx, '#2a8cff', 0.1, [[0.5, 0.1], [0.3, 0.2]]);
            break;
        case 'bell':
            ctx.fillStyle = '#ffe600';
            ctx.beginPath();
            ctx.moveTo(-0.62, 0.42);
            ctx.quadraticCurveTo(-0.4, 0.2, -0.4, -0.2);
            ctx.quadraticCurveTo(-0.4, -0.68, 0, -0.68);
            ctx.quadraticCurveTo(0.4, -0.68, 0.4, -0.2);
            ctx.quadraticCurveTo(0.4, 0.2, 0.62, 0.42);
            ctx.closePath();
            ctx.fill();
            disc(ctx, 0, 0.52, 0.14, '#f4f4ff');
            stroke(ctx, '#fff8b0', 0.08, [[-0.2, -0.4], [-0.24, 0.1]]);
            break;
        case 'key':
            ctx.fillStyle = '#9be7ff';
            ctx.beginPath();
            ctx.arc(0, -0.38, 0.32, 0, Math.PI * 2);
            ctx.arc(0, -0.42, 0.11, 0, Math.PI * 2, true);
            ctx.fill('evenodd');
            stroke(ctx, '#f4f4ff', 0.14, [[0, -0.06], [0, 0.68]]);
            stroke(ctx, '#f4f4ff', 0.12, [[0, 0.4], [0.24, 0.4]]);
            stroke(ctx, '#f4f4ff', 0.12, [[0, 0.64], [0.24, 0.64]]);
            break;
        default:
            disc(ctx, 0, 0, 0.5, '#ff2b1c');
            break;
    }
}

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tile = 16;
        this.walls = null;
        this.wallsFlash = null;
    }

    // Call whenever the canvas backing size changes. `tile` is in device pixels.
    resize(tile) {
        this.tile = tile;
        this.canvas.width = COLS * tile;
        this.canvas.height = ROWS * tile;
        this.walls = this.buildWalls(WALL_COLOR);
        this.wallsFlash = this.buildWalls(WALL_FLASH_COLOR);
    }

    // Walls are drawn once as a hollow outline. A layer is "the wall tiles
    // minus everything within `inset` of open floor"; subtracting a deeper
    // layer from a shallower one leaves a rounded ring of even thickness.
    buildWalls(color) {
        const tile = this.tile;
        const layer = (inset) => {
            const canvas = document.createElement('canvas');
            canvas.width = COLS * tile;
            canvas.height = ROWS * tile;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = color;
            for (let row = 0; row < ROWS; row += 1) {
                for (let col = 0; col < COLS; col += 1) {
                    if (MAP[row][col] === '#') {
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
                    if (outside || MAP[row][col] !== '#') {
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

        return ring;
    }

    draw(game, paused) {
        const { ctx, tile } = this;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const flashing = game.state === 'levelClear' && Math.floor(game.stateTime * 5) % 2 === 1;
        ctx.drawImage(flashing ? this.wallsFlash : this.walls, 0, 0);

        ctx.setTransform(tile, 0, 0, tile, tile / 2, tile / 2);
        this.drawDoor();
        this.drawDots(game);
        if (game.fruit) {
            this.drawFruit(game.fruit.name, FRUIT_POS.x, FRUIT_POS.y);
        }

        const showGhosts = game.state !== 'levelClear' && !(game.state === 'dying' && game.stateTime > 0.5);
        if (game.state !== 'gameOver' && game.state !== 'title') {
            this.drawPac(game);
        }
        if (showGhosts && game.state !== 'gameOver') {
            // On the title screen only the ghosts waiting in the house are
            // shown, which keeps the title text clear.
            game.ghosts
                .filter((ghost) => game.state !== 'title' || ghost.state === 'house')
                .forEach((ghost) => this.drawGhost(game, ghost));
        }

        game.popups.forEach((popup) => this.text(popup.text, popup.x, popup.y, 0.5, '#19e6f0'));
        this.drawMessages(game, paused);
    }

    drawDoor() {
        const { ctx } = this;
        ctx.fillStyle = '#ffb1f5';
        ctx.fillRect(12.5, 11.9, 2, 0.2);
    }

    drawDots(game) {
        const { ctx } = this;
        const pelletVisible = game.state === 'title' || Math.floor(game.clock * 4) % 2 === 0;
        ctx.fillStyle = DOT_COLOR;
        for (let row = 0; row < ROWS; row += 1) {
            for (let col = 0; col < COLS; col += 1) {
                const dot = game.dots[row][col];
                if (dot === '.') {
                    ctx.fillRect(col - 0.1, row - 0.1, 0.2, 0.2);
                } else if (dot === 'o' && pelletVisible) {
                    ctx.beginPath();
                    ctx.arc(col, row, 0.42, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    drawPac(game) {
        const { ctx } = this;
        const pac = game.pac;
        let mouth = 0.22;
        let dir = pac.dir || LEFT;

        if (game.state === 'dying') {
            // Hold still for a beat, then fold away upwards.
            const progress = Math.min(1, Math.max(0, (game.stateTime - 0.5) / 0.9));
            if (progress >= 1) {
                return;
            }
            mouth = 0.22 + progress * 0.78;
            dir = game.stateTime > 0.5 ? UP : dir;
        } else if (game.state === 'ready') {
            mouth = 0;
        } else if (pac.moving && game.state === 'playing') {
            mouth = 0.02 + 0.26 * Math.abs(Math.sin(game.clock * 16));
        }

        const angle = Math.atan2(dir.y, dir.x);
        ctx.fillStyle = PAC_COLOR;
        ctx.beginPath();
        ctx.moveTo(pac.x, pac.y);
        ctx.arc(pac.x, pac.y, 0.8, angle + mouth * Math.PI, angle - mouth * Math.PI + Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }

    drawGhost(game, ghost) {
        const { ctx } = this;
        const dir = ghost.dir || UP;
        const eyesOnly = ghost.state === 'eyes' || ghost.state === 'entering';
        const frightened = ghost.frightened && !eyesOnly;
        // Flash white during the last two seconds of fright as a warning.
        const flashing = frightened && game.frightTime < 2 && Math.floor(game.frightTime * 5) % 2 === 0;

        ctx.save();
        ctx.translate(ghost.x, ghost.y);

        if (!eyesOnly) {
            const radius = 0.8;
            const wobble = Math.floor(game.clock * 8) % 2;
            ctx.fillStyle = frightened ? (flashing ? '#f4f4ff' : FRIGHT_COLOR) : GHOST_COLORS[ghost.name];
            ctx.beginPath();
            ctx.moveTo(-radius, radius);
            ctx.lineTo(-radius, 0);
            ctx.arc(0, 0, radius, Math.PI, 0);
            ctx.lineTo(radius, radius);
            const feet = 4;
            const width = (radius * 2) / feet;
            for (let foot = 0; foot < feet; foot += 1) {
                const right = radius - foot * width;
                const lift = (foot + wobble) % 2 === 0 ? 0.3 : 0.12;
                ctx.quadraticCurveTo(right - width / 2, radius - lift * 2, right - width, radius);
            }
            ctx.closePath();
            ctx.fill();
        }

        if (frightened) {
            ctx.fillStyle = flashing ? '#ff2b1c' : '#ffd9c9';
            ctx.fillRect(-0.36, -0.3, 0.2, 0.2);
            ctx.fillRect(0.16, -0.3, 0.2, 0.2);
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 0.09;
            ctx.beginPath();
            ctx.moveTo(-0.5, 0.38);
            for (let point = 1; point <= 6; point += 1) {
                ctx.lineTo(-0.5 + point * (1 / 6), point % 2 === 0 ? 0.38 : 0.2);
            }
            ctx.stroke();
        } else {
            for (const side of [-1, 1]) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.ellipse(side * 0.33 + dir.x * 0.1, -0.15 + dir.y * 0.12, 0.22, 0.28, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1b2bd6';
                ctx.beginPath();
                ctx.arc(side * 0.33 + dir.x * 0.2, -0.15 + dir.y * 0.24, 0.12, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
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
            this.text('PAUSED', 13.5, 17, 0.9, '#f4f4ff');

            return;
        }
        switch (game.state) {
            case 'title':
                this.text('PACKMAN', 13.5, 11, 1.25, PAC_COLOR);
                this.text('PRESS ENTER', 13.5, 17, 0.72, '#f4f4ff');
                this.text('OR TAP TO PLAY', 13.5, 23, 0.72, '#f4f4ff', '#000');
                break;
            case 'ready':
                this.text('READY!', 13.5, 17, 0.9, PAC_COLOR);
                break;
            case 'gameOver':
                this.text('GAME OVER', 13.5, 17, 0.9, '#ff2b1c');
                if (game.isNewHighScore && Math.floor(game.stateTime * 3) % 2 === 0) {
                    this.text('NEW HIGH SCORE', 13.5, 11, 0.68, PAC_COLOR);
                }
                if (game.stateTime > 1) {
                    this.text('ENTER OR TAP', 13.5, 23, 0.72, '#f4f4ff', '#000');
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

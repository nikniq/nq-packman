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
const FRUIT_COLORS = {
    cherry: '#ff2b1c',
    strawberry: '#ff4f6d',
    orange: '#ffa726',
    apple: '#e53935',
    melon: '#7bd66b',
    galaxian: '#ffd54f',
    bell: '#ffe600',
    key: '#9be7ff',
};

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
        ctx.fillStyle = FRUIT_COLORS[name] || '#ff2b1c';
        ctx.beginPath();
        if (name === 'cherry') {
            ctx.arc(-0.3, 0.25, 0.32, 0, Math.PI * 2);
            ctx.arc(0.32, 0.32, 0.32, 0, Math.PI * 2);
        } else if (name === 'key' || name === 'bell') {
            ctx.moveTo(0, -0.6);
            ctx.lineTo(0.5, 0.45);
            ctx.lineTo(-0.5, 0.45);
            ctx.closePath();
        } else {
            ctx.arc(0, 0.08, 0.52, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#3ddc68';
        ctx.lineWidth = 0.12;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(name === 'cherry' ? -0.25 : 0, name === 'cherry' ? -0.05 : -0.42);
        ctx.quadraticCurveTo(0.1, -0.6, 0.38, -0.66);
        if (name === 'cherry') {
            ctx.lineTo(0.32, 0.02);
        }
        ctx.stroke();
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

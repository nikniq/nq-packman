// Wires the engine to the page: input, the frame loop, the HUD and sound.

import { Sound } from './audio.js';
import { Game, POWER_UPS, fruitForLevel, powerUpForLevel } from './engine.js';
import { COLS, DOWN, LEFT, RIGHT, ROWS, UP } from './maze.js';
import { Online } from './online.js';
import { Renderer, drawFruit, drawPowerUp } from './render.js';

const STEP = 1 / 120;
const HIGH_SCORE_KEY = 'nightmarket.highScore';
const DAILY_KEY = 'nightmarket.daily';
const SWIPE_DISTANCE = 18;
const KEYS = {
    ArrowUp: UP,
    ArrowLeft: LEFT,
    ArrowDown: DOWN,
    ArrowRight: RIGHT,
    w: UP,
    a: LEFT,
    s: DOWN,
    d: RIGHT,
};
// Player two steers their cat with IJKL (or the numpad).
const P2_KEYS = { i: UP, j: LEFT, k: DOWN, l: RIGHT, 8: UP, 4: LEFT, 2: DOWN, 6: RIGHT };

function readHighScore() {
    try {
        return Number(window.localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    } catch {
        return 0;
    }
}

function writeHighScore(score) {
    try {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(score));
    } catch {
        // The high score just won't survive a reload.
    }
}

// Guests get one daily attempt per browser; signed-in players are held to
// one per account by the server.
function readDailyPlayed(today) {
    try {
        return window.localStorage.getItem(DAILY_KEY) === today;
    } catch {
        return false;
    }
}

function writeDailyPlayed(today) {
    try {
        window.localStorage.setItem(DAILY_KEY, today);
    } catch {
        // Not persisted; the server still enforces it for signed-in players.
    }
}

export function boot() {
    const canvas = document.getElementById('game');
    const stage = document.getElementById('stage');
    if (!canvas || !stage) {
        return;
    }

    const hud = {
        score: document.getElementById('score'),
        highScore: document.getElementById('high-score'),
        level: document.getElementById('level'),
        lives: document.getElementById('lives'),
        fruits: document.getElementById('fruits'),
        pause: document.getElementById('pause'),
        mute: document.getElementById('mute'),
        scores: document.getElementById('scores'),
        daily: document.getElementById('daily'),
        powerUp: document.getElementById('power-up'),
        powerUpLabel: document.getElementById('power-up-label'),
        board: document.getElementById('board'),
        boardClose: document.getElementById('board-close'),
        boardStatus: document.getElementById('board-status'),
        boardList: document.getElementById('board-list'),
        boardEmpty: document.getElementById('board-empty'),
        boardTabs: Array.from(document.querySelectorAll('[data-board]')),
    };

    const sound = new Sound();
    const renderer = new Renderer(canvas);
    const online = new Online(window.NIGHT_MARKET_CONFIG ?? null);
    const game = new Game({
        onEvent: (event) => {
            sound.play(event);
            if (event === 'gameOver') {
                submitScore();
            }
        },
        highScore: readHighScore(),
    });
    let paused = false;
    let savedHighScore = game.highScore;
    let boardRun = 'classic';
    const dailyPlayed = () => online.dailyPlayed || readDailyPlayed(online.today);

    // ---- sizing ----------------------------------------------------------

    const resize = () => {
        const ratio = window.devicePixelRatio || 1;
        const cssTile = Math.min(stage.clientWidth / COLS, stage.clientHeight / ROWS);
        const tile = Math.max(4, Math.floor(cssTile * ratio));
        renderer.resize(tile);
        canvas.style.width = `${(COLS * tile) / ratio}px`;
        canvas.style.height = `${(ROWS * tile) / ratio}px`;
        renderer.draw(game, paused);
    };
    new ResizeObserver(resize).observe(stage);
    resize();
    // The pixel font may arrive after the first frame.
    document.fonts?.ready.then(() => renderer.draw(game, paused));

    // ---- controls --------------------------------------------------------

    const canStart = () => game.state === 'title' || (game.state === 'gameOver' && game.stateTime > 1);

    const startIfWaiting = (run = 'classic') => {
        sound.unlock();
        if (!canStart()) {
            return false;
        }
        if (run !== 'classic') {
            if (dailyPlayed()) {
                boardRun = 'daily';
                online.status = 'DAILY RUN DONE · BACK TOMORROW';
                setBoardOpen(true);

                return false;
            }
            writeDailyPlayed(online.today);
        }
        paused = false;
        game.start(run);
        updateDailyLabel();

        return true;
    };

    const updateDailyLabel = () => {
        const done = dailyPlayed();
        hud.daily.textContent = done ? 'DAILY DONE' : 'DAILY';
        hud.daily.setAttribute('aria-disabled', String(done));
        hud.daily.title = done ? "You have played today's run. A new course opens at midnight (Singapore time)." : "One attempt a day on today's course, same for everyone.";
    };
    updateDailyLabel();

    const setPaused = (value) => {
        const playing = game.state !== 'title' && game.state !== 'gameOver';
        paused = value && playing;
        hud.pause.textContent = paused ? 'RESUME' : 'PAUSE';
        hud.pause.setAttribute('aria-pressed', String(paused));
    };

    const updateMuteLabel = () => {
        hud.mute.textContent = sound.muted ? 'SOUND OFF' : 'SOUND ON';
        hud.mute.setAttribute('aria-pressed', String(!sound.muted));
    };
    updateMuteLabel();

    window.addEventListener('keydown', (event) => {
        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (key === 'd' && canStart()) {
            event.preventDefault();
            startIfWaiting('daily');
        } else if (KEYS[key]) {
            event.preventDefault();
            sound.unlock();
            game.steer(KEYS[key]);
        } else if (P2_KEYS[key] && game.humanGhost) {
            event.preventDefault();
            game.steerGhost(P2_KEYS[key]);
        } else if (key === 'Tab') {
            event.preventDefault();
            sound.unlock();
            game.cycleHumanGhost();
        } else if (key === 'Enter' || key === ' ') {
            // Leave Space/Enter alone when a button has focus.
            if (document.activeElement instanceof HTMLButtonElement) {
                return;
            }
            event.preventDefault();
            if (!startIfWaiting() && paused) {
                setPaused(false);
            }
        } else if (key === 'Escape' && !hud.board.hidden) {
            setBoardOpen(false);
        } else if (key === 'p' || key === 'Escape') {
            setPaused(!paused);
        } else if (key === 'm') {
            sound.toggleMute();
            updateMuteLabel();
        }
    });

    hud.daily.addEventListener('click', () => {
        startIfWaiting('daily');
        hud.daily.blur();
    });
    hud.pause.addEventListener('click', () => {
        sound.unlock();
        setPaused(!paused);
        hud.pause.blur();
    });
    hud.mute.addEventListener('click', () => {
        sound.unlock();
        sound.toggleMute();
        updateMuteLabel();
        hud.mute.blur();
    });

    // Swipe anywhere on the stage to steer; a tap starts the game.
    let touchOrigin = null;
    let swiped = false;
    stage.addEventListener(
        'touchstart',
        (event) => {
            const touch = event.changedTouches[0];
            touchOrigin = { x: touch.clientX, y: touch.clientY };
            swiped = false;
        },
        { passive: true },
    );
    stage.addEventListener(
        'touchmove',
        (event) => {
            event.preventDefault();
            if (!touchOrigin) {
                return;
            }
            const touch = event.changedTouches[0];
            const dx = touch.clientX - touchOrigin.x;
            const dy = touch.clientY - touchOrigin.y;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) {
                return;
            }
            game.steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
            // Restart from here so one continuous drag can chain turns.
            touchOrigin = { x: touch.clientX, y: touch.clientY };
            swiped = true;
        },
        { passive: false },
    );
    stage.addEventListener('click', (event) => {
        if (hud.board.contains(event.target)) {
            return;
        }
        if (!swiped && !startIfWaiting() && paused) {
            setPaused(false);
        }
        swiped = false;
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            setPaused(true);
        }
    });
    window.addEventListener('blur', () => setPaused(true));

    // Gamepad: d-pad or left stick steers, A starts, Start pauses.
    const padHeld = { start: false, pause: false };
    const pollGamepad = () => {
        const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
        if (!pad) {
            return;
        }
        const pressed = (index) => Boolean(pad.buttons[index]?.pressed);
        const [stickX = 0, stickY = 0] = pad.axes;
        if (pressed(12) || stickY < -0.5) {
            game.steer(UP);
        } else if (pressed(13) || stickY > 0.5) {
            game.steer(DOWN);
        } else if (pressed(14) || stickX < -0.5) {
            game.steer(LEFT);
        } else if (pressed(15) || stickX > 0.5) {
            game.steer(RIGHT);
        }
        const start = pressed(0);
        const pause = pressed(9);
        if (start && !padHeld.start && !startIfWaiting() && paused) {
            setPaused(false);
        }
        if (pause && !padHeld.pause && !startIfWaiting()) {
            setPaused(!paused);
        }
        padHeld.start = start;
        padHeld.pause = pause;
    };

    // The fruit shelf shows the bonus fruit of the most recent levels.
    const FRUIT_SHELF = 4;
    const FRUIT_SIZE = 20;
    const drawFruitShelf = (level) => {
        const ratio = window.devicePixelRatio || 1;
        const first = Math.max(1, level - FRUIT_SHELF + 1);
        const count = level - first + 1;
        hud.fruits.width = count * FRUIT_SIZE * ratio;
        hud.fruits.height = FRUIT_SIZE * ratio;
        hud.fruits.style.width = `${count * FRUIT_SIZE}px`;
        hud.fruits.style.height = `${FRUIT_SIZE}px`;
        hud.fruits.setAttribute('aria-label', `Bonus snack: ${fruitForLevel(level).name}; power-up: ${powerUpForLevel(level)}`);
        const ctx = hud.fruits.getContext('2d');
        const scale = (FRUIT_SIZE * ratio) / 1.6;
        for (let index = 0; index < count; index += 1) {
            ctx.setTransform(scale, 0, 0, scale, (index + 0.5) * FRUIT_SIZE * ratio, (FRUIT_SIZE * ratio) / 2);
            drawFruit(ctx, fruitForLevel(first + index).name);
        }
    };

    // The power-up badge shows what is active, or what this level offers.
    let shownPowerUp = '';
    const updatePowerUp = () => {
        const active = Object.keys(game.effects)[0] ?? null;
        const kind = active ?? (game.powerUp?.kind ?? null);
        const key = `${kind}:${active ? Math.ceil(game.effects[active]) : 0}`;
        if (key === shownPowerUp) {
            return;
        }
        shownPowerUp = key;
        hud.powerUp.hidden = !kind;
        if (!kind) {
            return;
        }
        hud.powerUpLabel.textContent = active ? `${POWER_UPS[active].label} ${Math.ceil(game.effects[active])}` : POWER_UPS[kind].label;
        const ratio = window.devicePixelRatio || 1;
        const size = 20;
        const canvas = hud.powerUp.querySelector('canvas');
        canvas.width = size * ratio;
        canvas.height = size * ratio;
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform((size * ratio) / 1.4, 0, 0, (size * ratio) / 1.4, (size * ratio) / 2, (size * ratio) / 2);
        drawPowerUp(ctx, kind, 0);
    };

    const updateAmbience = () => {
        if (paused || game.state !== 'playing') {
            sound.setAmbience(null);
        } else if (game.ghosts.some((ghost) => ghost.state === 'eyes' || ghost.state === 'entering')) {
            sound.setAmbience('eyes');
        } else if (game.frightTime > 0) {
            sound.setAmbience('fright');
        } else {
            sound.setAmbience('siren', game.dotsEaten / (game.dotsEaten + game.dotsLeft));
        }
    };

    // ---- leaderboard -----------------------------------------------------

    const renderBoard = () => {
        hud.boardStatus.textContent = online.status;
        hud.boardTabs.forEach((tab) => {
            const selected = tab.dataset.board === boardRun;
            tab.setAttribute('aria-selected', String(selected));
            tab.classList.toggle('is-selected', selected);
        });
        const board = online.board(boardRun);
        hud.boardList.replaceChildren(
            ...board.map((entry, index) => {
                const item = document.createElement('li');
                item.className = 'flex justify-between gap-3';
                const name = document.createElement('span');
                name.className = 'truncate';
                name.textContent = `${String(index + 1).padStart(2, ' ')}. ${entry.name}`;
                const score = document.createElement('span');
                score.className = 'shrink-0 whitespace-nowrap';
                score.textContent = `${entry.score}  L${entry.level}`;
                item.append(name, score);

                return item;
            }),
        );
        hud.boardEmpty.hidden = board.length > 0;
    };

    hud.boardTabs.forEach((tab) =>
        tab.addEventListener('click', () => {
            boardRun = tab.dataset.board;
            renderBoard();
        }),
    );

    const setBoardOpen = (open) => {
        hud.board.hidden = !open;
        hud.board.classList.toggle('hidden', !open);
        hud.scores.setAttribute('aria-expanded', String(open));
        if (open) {
            renderBoard();
            if (game.state === 'playing') {
                setPaused(true);
            }
            hud.boardClose.focus();
        } else {
            hud.scores.blur();
        }
    };

    const submitScore = async () => {
        const score = game.score;
        const level = game.level;
        const run = game.isDaily ? 'daily' : 'classic';
        boardRun = run;
        renderBoard();
        await online.submit(score, level, run);
        renderBoard();
        updateDailyLabel();
        if (online.status) {
            setBoardOpen(true);
        }
    };

    hud.scores.addEventListener('click', () => setBoardOpen(hud.board.hidden));
    hud.boardClose.addEventListener('click', () => setBoardOpen(false));
    online.loadBoards().then(renderBoard);

    // ---- HUD -------------------------------------------------------------

    const shown = {};
    const show = (name, value, render) => {
        if (shown[name] !== value) {
            shown[name] = value;
            render(value);
        }
    };
    const updateHud = () => {
        show('score', game.score, (value) => (hud.score.textContent = String(value)));
        show('highScore', game.highScore, (value) => (hud.highScore.textContent = String(value)));
        show('level', game.level, (value) => {
            hud.level.textContent = String(value);
            drawFruitShelf(value);
        });
        // The life in play is not shown as a spare.
        show('lives', Math.max(0, game.lives - 1), (value) => {
            hud.lives.replaceChildren(
                ...Array.from({ length: value }, () => {
                    const icon = document.createElement('span');
                    icon.className = 'life';

                    return icon;
                }),
            );
            hud.lives.setAttribute('aria-label', `${value} spare ${value === 1 ? 'life' : 'lives'}`);
        });
        if (game.state === 'gameOver' && game.highScore > savedHighScore) {
            savedHighScore = game.highScore;
            writeHighScore(savedHighScore);
        }
    };

    // ---- frame loop ------------------------------------------------------

    let last = performance.now();
    let pending = 0;
    const frame = (now) => {
        // Cap the catch-up so a background tab does not fast-forward.
        pending += Math.min(0.1, (now - last) / 1000);
        last = now;
        while (pending >= STEP) {
            if (!paused) {
                game.update(STEP);
            }
            pending -= STEP;
        }
        pollGamepad();
        updateHud();
        updatePowerUp();
        updateAmbience();
        renderer.draw(game, paused);
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    window.addEventListener('pagehide', () => {
        if (game.highScore > savedHighScore) {
            writeHighScore(game.highScore);
        }
    });
}

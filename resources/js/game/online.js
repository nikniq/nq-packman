// The world leaderboard: reading it is open to everyone, saving a score
// needs the signed-in player's submit URL. window.PACKMAN_CONFIG is written
// by the page; without it the game simply plays offline.

export class Online {
    constructor(config = null) {
        this.config = config;
        this.boards = { classic: [], daily: [] };
        this.status = '';
        this.dailyPlayed = Boolean(config?.dailyPlayed);
    }

    get today() {
        return this.config?.today ?? new Date().toISOString().slice(0, 10);
    }

    board(run = 'classic') {
        return this.boards[run === 'classic' ? 'classic' : 'daily'];
    }

    get available() {
        return Boolean(this.config) && typeof fetch === 'function';
    }

    get canSubmit() {
        return this.available && Boolean(this.config.submitUrl);
    }

    async loadBoard(run = 'classic') {
        const key = run === 'classic' ? 'classic' : 'daily';
        if (!this.available) {
            return this.boards[key];
        }
        try {
            const url = new URL(this.config.scoresUrl, window.location.href);
            url.searchParams.set('board', key);
            const response = await fetch(url, { headers: { Accept: 'application/json' } });
            const json = response.ok ? await response.json() : null;
            if (json && Array.isArray(json.data)) {
                this.boards[key] = json.data;
            }
        } catch {
            // Offline or blocked: keep whatever board we had.
        }

        return this.boards[key];
    }

    async loadBoards() {
        await Promise.all([this.loadBoard('classic'), this.loadBoard('daily')]);
    }

    async submit(score, level, run = 'classic') {
        if (!this.available || score <= 0) {
            this.status = '';

            return;
        }
        if (!this.canSubmit) {
            this.status = 'SIGN IN TO SAVE YOUR SCORE';

            return;
        }
        this.status = 'SAVING SCORE…';
        try {
            const response = await fetch(this.config.submitUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-TOKEN': this.config.csrf },
                credentials: 'same-origin',
                body: JSON.stringify({ score, level, run: run === 'classic' ? 'classic' : 'daily' }),
            });
            if (response.status === 409) {
                this.dailyPlayed = true;
                this.status = 'DAILY RUN ALREADY PLAYED TODAY';

                return;
            }
            if (!response.ok) {
                throw new Error(String(response.status));
            }
            const json = await response.json();
            if (run !== 'classic') {
                this.dailyPlayed = true;
            }
            this.status = `SAVED · ${run === 'classic' ? 'WORLD' : "TODAY'S"} RANK #${json.rank}`;
            await this.loadBoard(run);
        } catch {
            this.status = 'COULD NOT SAVE SCORE';
        }
    }
}

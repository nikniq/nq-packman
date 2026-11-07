// The world leaderboard: reading it is open to everyone, saving a score
// needs the signed-in player's submit URL. window.PACKMAN_CONFIG is written
// by the page; without it the game simply plays offline.

export class Online {
    constructor(config = null) {
        this.config = config;
        this.board = [];
        this.status = '';
    }

    get available() {
        return Boolean(this.config) && typeof fetch === 'function';
    }

    get canSubmit() {
        return this.available && Boolean(this.config.submitUrl);
    }

    async loadBoard() {
        if (!this.available) {
            return this.board;
        }
        try {
            const response = await fetch(this.config.scoresUrl, { headers: { Accept: 'application/json' } });
            const json = response.ok ? await response.json() : null;
            if (json && Array.isArray(json.data)) {
                this.board = json.data;
            }
        } catch {
            // Offline or blocked: keep whatever board we had.
        }

        return this.board;
    }

    async submit(score, level) {
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
                body: JSON.stringify({ score, level }),
            });
            if (!response.ok) {
                throw new Error(String(response.status));
            }
            const json = await response.json();
            this.status = `SAVED · WORLD RANK #${json.rank}`;
            await this.loadBoard();
        } catch {
            this.status = 'COULD NOT SAVE SCORE';
        }
    }
}

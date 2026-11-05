// Sound effects synthesised with Web Audio, so there are no files to ship.
// The context is created on the first user gesture, as browsers require.

const STORAGE_KEY = 'packman.muted';

export class Sound {
    constructor() {
        this.context = null;
        this.waka = false;
        this.muted = false;
        try {
            this.muted = window.localStorage.getItem(STORAGE_KEY) === '1';
        } catch {
            // Storage can be blocked; sound simply starts unmuted.
        }
    }

    unlock() {
        if (this.context === null) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) {
                return;
            }
            this.context = new AudioContext();
        }
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        try {
            window.localStorage.setItem(STORAGE_KEY, this.muted ? '1' : '0');
        } catch {
            // Not persisted; the toggle still applies for this visit.
        }

        return this.muted;
    }

    // One note that glides from one pitch to another.
    tone(from, to, duration, { type = 'square', delay = 0, volume = 0.06 } = {}) {
        if (this.muted || this.context === null) {
            return;
        }
        const start = this.context.currentTime + delay;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + duration);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    }

    play(event) {
        switch (event) {
            case 'dot':
                this.waka = !this.waka;
                this.tone(this.waka ? 520 : 300, this.waka ? 300 : 520, 0.07, { type: 'triangle', volume: 0.09 });
                break;
            case 'power':
                this.tone(180, 520, 0.28, { type: 'sawtooth' });
                break;
            case 'eatGhost':
                this.tone(220, 1500, 0.4);
                break;
            case 'fruit':
                this.tone(700, 1100, 0.1);
                this.tone(1100, 1600, 0.14, { delay: 0.1 });
                break;
            case 'extraLife':
                [0, 0.12, 0.24, 0.36].forEach((delay) => this.tone(1200, 1500, 0.08, { delay }));
                break;
            case 'death':
                this.tone(900, 90, 1.1, { type: 'sawtooth', delay: 0.45 });
                this.tone(140, 60, 0.25, { delay: 1.45 });
                break;
            case 'start':
            case 'level':
                [392, 523, 659, 784, 659, 784].forEach((pitch, index) =>
                    this.tone(pitch, pitch, 0.13, { delay: index * 0.14, volume: 0.07 }),
                );
                break;
            case 'levelClear':
                [523, 659, 784, 1047].forEach((pitch, index) => this.tone(pitch, pitch, 0.16, { delay: index * 0.16 }));
                break;
            default:
                break;
        }
    }
}

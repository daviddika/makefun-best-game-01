// Lumen Drift — audio.js
// One job: every sound in the game, synthesized live with the Web Audio API.
// No audio files are shipped; every effect is an oscillator (or filtered
// noise) shaped by a gain envelope, plus a quiet generative music loop.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    // A slow, hopeful minor arpeggio the music loop walks through.
    this.musicNotes = [220.0, 261.63, 329.63, 392.0, 329.63, 261.63, 196.0, 246.94];
  }

  // Browsers only allow audio after a user gesture; call from the first
  // click or keypress, never at page load.
  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.07;
    this.musicGain.connect(this.master);
    this.startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone({ frequency = 440, endFrequency = null, duration = 0.15, type = 'sine', volume = 0.2, delay = 0 }) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  noise({ duration = 0.3, volume = 0.25, lowpass = 1200, delay = 0 }) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime + delay;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(now);
  }

  shoot() {
    this.tone({ frequency: 880, endFrequency: 440, duration: 0.09, type: 'square', volume: 0.07 });
  }

  enemyHit() {
    this.tone({ frequency: 320, endFrequency: 180, duration: 0.08, type: 'triangle', volume: 0.12 });
  }

  explosion() {
    this.noise({ duration: 0.35, volume: 0.3, lowpass: 900 });
    this.tone({ frequency: 160, endFrequency: 40, duration: 0.3, type: 'sawtooth', volume: 0.16 });
  }

  pickup() {
    this.tone({ frequency: 660, duration: 0.08, type: 'sine', volume: 0.14 });
    this.tone({ frequency: 990, duration: 0.12, type: 'sine', volume: 0.14, delay: 0.07 });
  }

  hurt() {
    this.tone({ frequency: 220, endFrequency: 55, duration: 0.4, type: 'sawtooth', volume: 0.22 });
    this.noise({ duration: 0.25, volume: 0.2, lowpass: 600 });
  }

  bomb() {
    this.noise({ duration: 0.7, volume: 0.35, lowpass: 2400 });
    this.tone({ frequency: 90, endFrequency: 28, duration: 0.7, type: 'sine', volume: 0.3 });
  }

  waveClear() {
    [523.25, 659.25, 783.99].forEach((frequency, i) => {
      this.tone({ frequency, duration: 0.16, type: 'triangle', volume: 0.14, delay: i * 0.09 });
    });
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, i) => {
      this.tone({ frequency, duration: 0.3, type: 'triangle', volume: 0.16, delay: i * 0.12 });
    });
  }

  lose() {
    [392.0, 311.13, 261.63, 196.0].forEach((frequency, i) => {
      this.tone({ frequency, duration: 0.35, type: 'sine', volume: 0.15, delay: i * 0.16 });
    });
  }

  startMusic() {
    if (this.musicTimer !== null) return;
    this.musicTimer = window.setInterval(() => {
      if (!this.context || this.muted) return;
      const frequency = this.musicNotes[this.musicStep % this.musicNotes.length];
      this.musicStep += 1;
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 1.2);
    }, 320);
  }
}

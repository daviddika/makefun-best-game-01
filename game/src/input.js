// Lumen Drift — input.js
// One job: turn keyboard and mouse hardware events into one tidy state
// object the game loop reads each frame. No game logic lives here.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.rightDown = false;
    // Edge-triggered actions: consumed once by the loop, then cleared.
    this.pressed = new Set();
    this.clicked = false;
    this.rightClicked = false;
    this.onFirstGesture = null;

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
      this.noteGesture();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.rightDown = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      this.noteGesture();
      if (event.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
      } else if (event.button === 2) {
        this.rightDown = true;
        this.rightClicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
      if (event.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      this.noteGesture();
      const touch = event.touches[0];
      if (touch) {
        const rect = canvas.getBoundingClientRect();
        this.mouseX = touch.clientX - rect.left;
        this.mouseY = touch.clientY - rect.top;
        this.mouseDown = true;
        this.clicked = true;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
      this.mouseDown = false;
    });
  }

  noteGesture() {
    if (this.onFirstGesture) {
      const callback = this.onFirstGesture;
      this.onFirstGesture = null;
      callback();
    }
  }

  held(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  // True once for the frame after the key went down.
  wasPressed(...codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.rightClicked = false;
  }
}

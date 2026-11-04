export class InputManager {
  private keys = new Set<string>();
  public moveX = 0;
  public moveZ = 0;
  public joystickX = 0;
  public joystickY = 0;
  public joystickActive = false;

  public sprintHeld = false;
  public mobileSprintToggle = false;
  public fireHeld = false;
  public mobileFireHeld = false;

  public dodgeJustPressed = false;
  public reloadJustPressed = false;
  public interactJustPressed = false;
  public interactHeld = false;
  public pauseJustPressed = false;

  public lookDeltaX = 0;
  public lookDeltaY = 0;
  public touchSensitivity = 1.0;

  private canvas: HTMLElement | null = null;
  private isPointerDownOnCanvas = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private lastTouchTimestamp = 0;
  private canvasTouchId: number | null = null;
  private lastCanvasTouchX = 0;
  private lastCanvasTouchY = 0;
  private enabled = false;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private boundBlur: () => void;
  private boundContextMenu: (e: Event) => void;

  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundTouchStart = this.onCanvasTouchStart.bind(this);
    this.boundTouchMove = this.onCanvasTouchMove.bind(this);
    this.boundTouchEnd = this.onCanvasTouchEnd.bind(this);
    this.boundBlur = this.onBlur.bind(this);
    this.boundContextMenu = (e: Event) => e.preventDefault();
  }

  public attach(canvas: HTMLElement) {
    this.detach();
    this.canvas = canvas;
    canvas.style.touchAction = 'none';
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    canvas.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    canvas.addEventListener('touchstart', this.boundTouchStart, {
      passive: false,
    });
    canvas.addEventListener('touchmove', this.boundTouchMove, {
      passive: false,
    });
    canvas.addEventListener('touchend', this.boundTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this.boundTouchEnd, {
      passive: false,
    });
    window.addEventListener('blur', this.boundBlur);
    canvas.addEventListener('contextmenu', this.boundContextMenu);
  }

  public detach() {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundMouseDown);
      this.canvas.removeEventListener('touchstart', this.boundTouchStart);
      this.canvas.removeEventListener('touchmove', this.boundTouchMove);
      this.canvas.removeEventListener('touchend', this.boundTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.boundTouchEnd);
      this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
    }
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('blur', this.boundBlur);
    this.canvas = null;
    this.resetAll();
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.resetAll();
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }

  public resetAll() {
    this.keys.clear();
    this.moveX = 0;
    this.moveZ = 0;
    this.joystickX = 0;
    this.joystickY = 0;
    this.joystickActive = false;
    this.sprintHeld = false;
    this.mobileSprintToggle = false;
    this.fireHeld = false;
    this.mobileFireHeld = false;
    this.dodgeJustPressed = false;
    this.reloadJustPressed = false;
    this.interactJustPressed = false;
    this.interactHeld = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.isPointerDownOnCanvas = false;
    this.canvasTouchId = null;
  }

  /**
   * Clears any stale touch/pointer look state across fullscreen or orientation transitions
   * without interrupting active keyboard controls.
   */
  public resetTouchLookState() {
    this.canvasTouchId = null;
    this.isPointerDownOnCanvas = false;
  }

  private onBlur() {
    this.resetAll();
  }

  private onKeyDown(e: KeyboardEvent) {
    const code = e.code;
    if (code === 'Escape') {
      this.pauseJustPressed = true;
      return;
    }
    if (!this.enabled) return;

    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (!this.keys.has(code)) {
      if (code === 'Space') this.dodgeJustPressed = true;
      if (code === 'KeyR') this.reloadJustPressed = true;
      if (code === 'KeyE') this.interactJustPressed = true;
    }

    this.keys.add(code);
    if (code === 'KeyE') this.interactHeld = true;
    this.updateKeyboardVector();
  }

  private onKeyUp(e: KeyboardEvent) {
    const code = e.code;
    this.keys.delete(code);
    if (code === 'KeyE') this.interactHeld = false;
    this.updateKeyboardVector();
  }

  private updateKeyboardVector() {
    let x = 0;
    let z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }
    this.moveX = x;
    this.moveZ = z;
    this.sprintHeld =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.mobileSprintToggle;
  }

  public handleDesktopMouseDown(e: MouseEvent) {
    this.onMouseDown(e);
  }

  private onMouseDown(e: MouseEvent) {
    if (!this.enabled) return;
    // Ignore synthetic mouse events generated after touch input on mobile browsers
    if (performance.now() - this.lastTouchTimestamp < 650) return;

    if (e.button === 0) {
      this.fireHeld = true;
      this.isPointerDownOnCanvas = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      // Request pointer lock on desktop canvas click if supported (never on Android/touch)
      if (
        this.canvas &&
        !('ontouchstart' in window) &&
        navigator.maxTouchPoints === 0 &&
        document.pointerLockElement !== this.canvas
      ) {
        try {
          this.canvas.requestPointerLock?.();
        } catch {
          // Ignore pointer lock rejection in sandboxed iframes
        }
      }
    } else if (e.button === 2) {
      this.isPointerDownOnCanvas = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.fireHeld = false;
    }
    this.isPointerDownOnCanvas = false;
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.enabled) return;
    // Ignore synthetic mousemove events triggered by touch input
    if (performance.now() - this.lastTouchTimestamp < 650) return;

    if (document.pointerLockElement === this.canvas) {
      this.lookDeltaX += e.movementX;
      this.lookDeltaY += e.movementY;
    } else if (!('ontouchstart' in window) || navigator.maxTouchPoints === 0) {
      // Allow smooth mouse look on desktop even if pointerLock is restricted by iframe
      if (this.isPointerDownOnCanvas || e.movementX !== undefined) {
        const dx =
          e.movementX !== undefined ? e.movementX : e.clientX - this.lastMouseX;
        const dy =
          e.movementY !== undefined ? e.movementY : e.clientY - this.lastMouseY;
        if (Math.abs(dx) < 120 && Math.abs(dy) < 120) {
          this.lookDeltaX += dx;
          this.lookDeltaY += dy;
        }
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    }
  }

  // Fallback direct canvas touch look handlers (if a touch reaches the WebGL canvas directly)
  private onCanvasTouchStart(e: TouchEvent) {
    if (!this.enabled) return;
    this.lastTouchTimestamp = performance.now();
    if (this.canvasTouchId !== null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      // Prefer right side / center area outside the bottom-left joystick zone
      if (t.clientX > window.innerWidth * 0.28 || t.clientY < window.innerHeight * 0.55) {
        this.canvasTouchId = t.identifier;
        this.lastCanvasTouchX = t.clientX;
        this.lastCanvasTouchY = t.clientY;
        e.preventDefault();
        break;
      }
    }
  }

  private onCanvasTouchMove(e: TouchEvent) {
    if (!this.enabled || this.canvasTouchId === null) return;
    this.lastTouchTimestamp = performance.now();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === this.canvasTouchId) {
        const rawDx = t.clientX - this.lastCanvasTouchX;
        const rawDy = t.clientY - this.lastCanvasTouchY;
        this.lastCanvasTouchX = t.clientX;
        this.lastCanvasTouchY = t.clientY;
        if (Math.abs(rawDx) < 160 && Math.abs(rawDy) < 160) {
          const mult = this.touchSensitivity * 1.55;
          this.addTouchLookDelta(rawDx * mult, rawDy * mult);
        }
        e.preventDefault();
        break;
      }
    }
  }

  private onCanvasTouchEnd(e: TouchEvent) {
    this.lastTouchTimestamp = performance.now();
    if (this.canvasTouchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.canvasTouchId) {
        this.canvasTouchId = null;
        break;
      }
    }
  }

  // Mobile Virtual Control Handlers
  public setJoystick(x: number, y: number, active: boolean) {
    this.lastTouchTimestamp = performance.now();
    this.joystickX = x;
    this.joystickY = y;
    this.joystickActive = active;
    if (!active && Math.hypot(this.moveX, this.moveZ) < 0.1) {
      this.mobileSprintToggle = false;
    }
    this.sprintHeld =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.mobileSprintToggle;
  }

  public setMobileSprint(active: boolean) {
    this.lastTouchTimestamp = performance.now();
    this.mobileSprintToggle = active;
    this.sprintHeld =
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.mobileSprintToggle;
  }

  public toggleMobileSprint() {
    this.setMobileSprint(!this.mobileSprintToggle);
  }

  public addTouchLookDelta(dx: number, dy: number) {
    this.lastTouchTimestamp = performance.now();
    if (!this.enabled) return;
    this.lookDeltaX += dx;
    this.lookDeltaY += dy;
  }

  public setMobileFireHeld(held: boolean) {
    this.lastTouchTimestamp = performance.now();
    this.mobileFireHeld = held;
  }

  public triggerDodge() {
    if (!this.enabled) return;
    this.dodgeJustPressed = true;
  }

  public triggerReload() {
    if (!this.enabled) return;
    this.reloadJustPressed = true;
  }

  public triggerInteract(held = false) {
    if (!this.enabled) return;
    this.interactJustPressed = true;
    this.interactHeld = held;
  }

  public setInteractHeld(held: boolean) {
    this.interactHeld = held;
  }

  public getMovementVector(): { x: number; z: number; magnitude: number } {
    let x = this.joystickActive ? this.joystickX : this.moveX;
    let z = this.joystickActive ? this.joystickY : this.moveZ;
    const mag = Math.min(1, Math.hypot(x, z));
    if (mag > 1e-4) {
      const inv = 1 / Math.hypot(x, z);
      x *= inv * mag;
      z *= inv * mag;
    } else {
      x = 0;
      z = 0;
    }
    return { x, z, magnitude: mag };
  }

  public isFiring(): boolean {
    return this.fireHeld || this.mobileFireHeld;
  }

  public consumeLookDelta(): { dx: number; dy: number } {
    const dx = this.lookDeltaX;
    const dy = this.lookDeltaY;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return { dx, dy };
  }

  public consumeEdgeActions() {
    const actions = {
      dodge: this.dodgeJustPressed,
      reload: this.reloadJustPressed,
      interact: this.interactJustPressed,
      pause: this.pauseJustPressed,
    };
    this.dodgeJustPressed = false;
    this.reloadJustPressed = false;
    this.interactJustPressed = false;
    this.pauseJustPressed = false;
    return actions;
  }
}

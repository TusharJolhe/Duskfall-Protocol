import React, { useRef, useState } from 'react';
import { InputManager } from '../game/input';
import { GameSettings, HUDTelemetry } from '../game/types';

interface GameHUDProps {
  hud: HUDTelemetry;
  settings: GameSettings;
  input: InputManager | null;
  isFullscreen: boolean;
  showRotatePrompt: boolean;
  onDismissRotatePrompt: () => void;
  onToggleFullscreen: () => void;
  onPause: () => void;
  onToggleMute: () => void;
}

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  settings,
  input,
  isFullscreen,
  showRotatePrompt,
  onDismissRotatePrompt,
  onToggleFullscreen,
  onPause,
  onToggleMute,
}) => {
  // Multi-touch Virtual Joystick state (Left thumb)
  const joyPointerId = useRef<number | null>(null);
  const joyOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [joyActive, setJoyActive] = useState(false);

  // Multi-touch Camera Look Pad state (Right side drag)
  const lookPointerId = useRef<number | null>(null);
  const lookLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fire button multi-touch tracking
  const firePointerId = useRef<number | null>(null);
  const [firePressed, setFirePressed] = useState(false);

  const maxJoyRadius = 46;

  const handleJoyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyPointerId.current !== null) return;
    joyPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joyOrigin.current = { x: cx, y: cy };
    setJoyActive(true);
    updateJoystickVector(e.clientX, e.clientY);
  };

  const handleJoyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyPointerId.current) return;
    e.stopPropagation();
    updateJoystickVector(e.clientX, e.clientY);
  };

  const handleJoyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyPointerId.current) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setJoyActive(false);
    setKnobOffset({ x: 0, y: 0 });
    input?.setJoystick(0, 0, false);
  };

  const updateJoystickVector = (clientX: number, clientY: number) => {
    const dx = clientX - joyOrigin.current.x;
    const dy = clientY - joyOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxJoyRadius, dist);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    setKnobOffset({ x: ox, y: oy });
    input?.setJoystick(ox / maxJoyRadius, oy / maxJoyRadius, dist > 4);
  };

  // Right-side Touch Camera Drag handlers
  const handleLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== null) return;
    lookPointerId.current = e.pointerId;
    lookLastPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    const dx =
      (e.clientX - lookLastPos.current.x) * settings.touchSensitivity * 1.35;
    const dy =
      (e.clientY - lookLastPos.current.y) * settings.touchSensitivity * 1.35;
    lookLastPos.current = { x: e.clientX, y: e.clientY };
    input?.addTouchLookDelta(dx, dy);
  };

  const handleLookPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    lookPointerId.current = null;
  };

  // Fire Button Pointer handlers
  const handleFireDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    firePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFirePressed(true);
    input?.setMobileFireHeld(true);
  };

  const handleFireUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerId !== firePointerId.current) return;
    e.stopPropagation();
    firePointerId.current = null;
    setFirePressed(false);
    input?.setMobileFireHeld(false);
  };

  const lowHealth = hud.playerHealth <= 30;
  const genCritical = hud.generatorHealth <= 35 || hud.generatorUnderAttack;
  const isFinalMinute = hud.timeRemaining <= 60;
  const hasInteraction =
    hud.canInteractGenerator || Boolean(hud.nearbyCollectibleLabel);
  const ammoRatio = Math.max(0, Math.min(1, hud.ammo / hud.maxMagazine));

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none">
      {/* Player Damage Vignette Overlay */}
      {hud.damageFlash > 0.01 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-75"
          style={{
            opacity: Math.min(0.65, hud.damageFlash * 0.6),
            background:
              'radial-gradient(circle, transparent 48%, rgba(239, 68, 68, 0.72) 100%)',
          }}
        />
      )}

      {/* Right-Side Touch Camera Rotation Surface (behind action buttons) */}
      <div
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
        className="absolute top-14 right-0 bottom-0 w-1/2 pointer-events-auto md:pointer-events-none"
      />

      {/* Center Tactical Aiming Reticle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            className={`transition-transform duration-100 ${
              hud.reticleTargetLocked ? 'scale-110' : 'scale-100'
            }`}
          >
            <circle
              cx="20"
              cy="20"
              r="10"
              fill="none"
              stroke={hud.reticleTargetLocked ? '#f59e0b' : '#38bdf8'}
              strokeWidth="1.5"
              strokeOpacity="0.82"
              strokeDasharray="4 3"
            />
            <line
              x1="20"
              y1="4"
              x2="20"
              y2="10"
              stroke={hud.reticleTargetLocked ? '#f59e0b' : '#38bdf8'}
              strokeWidth="1.6"
            />
            <line
              x1="20"
              y1="30"
              x2="20"
              y2="36"
              stroke={hud.reticleTargetLocked ? '#f59e0b' : '#38bdf8'}
              strokeWidth="1.6"
            />
            <line
              x1="4"
              y1="20"
              x2="10"
              y2="20"
              stroke={hud.reticleTargetLocked ? '#f59e0b' : '#38bdf8'}
              strokeWidth="1.6"
            />
            <line
              x1="30"
              y1="20"
              x2="36"
              y2="20"
              stroke={hud.reticleTargetLocked ? '#f59e0b' : '#38bdf8'}
              strokeWidth="1.6"
            />
            <circle
              cx="20"
              cy="20"
              r="2.2"
              fill={hud.reticleTargetLocked ? '#f59e0b' : '#67e8f9'}
            />
          </svg>
        </div>
      </div>

      {/* TOP BAR: Left Telemetry Panel | Center 7-Minute Countdown | Right Weapon & Telemetry */}
      <div className="relative flex items-start justify-between gap-2 px-3 pt-2.5 md:px-5 md:pt-4">
        {/* LEFT TACTICAL PANEL: Survivor Health, Stamina, Generator Core Integrity */}
        <div className="bg-[#090e1d]/90 border border-cyan-500/25 rounded-xl p-2.5 md:p-3.5 w-48 sm:w-60 md:w-68 shadow-xl">
          {/* Player Health */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className={lowHealth ? 'text-red-400' : 'text-emerald-400'}
                >
                  <path
                    d="M4.5 1.5h3v3h3v3h-3v3h-3v-3h-3v-3h3z"
                    fill="currentColor"
                  />
                </svg>
                <span>SURVIVOR HP</span>
              </span>
              <span
                className={`font-mono-tabular font-bold ${
                  lowHealth ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {hud.playerHealth}/{hud.playerMaxHealth}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950/90 rounded overflow-hidden border border-white/10 p-[1px]">
              <div
                className={`h-full rounded-xs transition-all duration-150 ${
                  lowHealth
                    ? 'bg-gradient-to-r from-red-600 to-red-400'
                    : 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                }`}
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (hud.playerHealth / hud.playerMaxHealth) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Stamina */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[10px] font-medium tracking-wider text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 12 12"
                  className={
                    hud.staminaExhausted ? 'text-red-400' : 'text-amber-400'
                  }
                >
                  <polygon
                    points="7,1 2,7 6,7 5,11 10,5 6,5"
                    fill="currentColor"
                  />
                </svg>
                <span>
                  {hud.staminaExhausted ? 'STAMINA (DEPLETED)' : 'STAMINA'}
                </span>
              </span>
              <span
                className={`font-mono-tabular font-semibold ${
                  hud.staminaExhausted ? 'text-red-400' : 'text-amber-300'
                }`}
              >
                {hud.playerStamina}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-950/90 rounded overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.staminaExhausted
                    ? 'bg-red-500'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                }`}
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (hud.playerStamina / hud.playerMaxStamina) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Generator Core Health */}
          <div className="pt-1.5 border-t border-white/10">
            <div className="flex items-center justify-between text-[11px] font-medium tracking-wider text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className={
                    hud.generatorHealth <= 35 ? 'text-red-400' : 'text-cyan-400'
                  }
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="6" cy="6" r="2" fill="currentColor" />
                </svg>
                <span>GENERATOR CORE</span>
              </span>
              <span
                className={`font-mono-tabular font-bold ${
                  hud.generatorHealth <= 35 ? 'text-red-400' : 'text-cyan-400'
                }`}
              >
                {hud.generatorHealth}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950/90 rounded overflow-hidden border border-white/10 p-[1px]">
              <div
                className={`h-full rounded-xs transition-all duration-150 ${
                  hud.generatorHealth <= 35
                    ? 'bg-gradient-to-r from-red-600 to-red-400'
                    : hud.generatorHealth <= 60
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-cyan-500 to-sky-300'
                }`}
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(
                      100,
                      (hud.generatorHealth / hud.generatorMaxHealth) * 100
                    )
                  )}%`,
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono-tabular text-slate-400">
              <span className="text-amber-300 font-medium">
                KITS: {hud.repairKits}
              </span>
              <span>
                {hud.generatorRepairCooldown > 0
                  ? `EMERG CD ${hud.generatorRepairCooldown}s`
                  : 'EMERG READY'}
              </span>
            </div>
          </div>
        </div>

        {/* TOP CENTER: 7-Minute Countdown Timer & Wave / Threat */}
        <div className="flex flex-col items-center">
          <div
            className={`bg-[#090e1d]/92 border ${
              isFinalMinute ? 'border-red-500/70' : 'border-cyan-500/35'
            } rounded-xl px-4 py-1.5 md:px-7 md:py-2.5 text-center shadow-xl`}
          >
            <div className="text-[10px] tracking-[0.2em] text-slate-400 font-semibold">
              EXTRACTION COUNTDOWN
            </div>
            <div
              className={`font-mono-tabular text-2xl sm:text-3xl md:text-4xl font-bold tracking-wider ${
                isFinalMinute ? 'text-red-400' : 'text-white'
              }`}
            >
              {formatCountdown(hud.timeRemaining)}
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] md:text-xs text-slate-300 whitespace-nowrap">
              <span className="text-cyan-400 font-semibold">
                WAVE {hud.waveNumber}/7
              </span>
              <span aria-hidden="true">·</span>
              <span className="hidden sm:inline text-slate-300">
                {hud.waveLabel}
              </span>
              <span className="hidden sm:inline" aria-hidden="true">
                ·
              </span>
              <span
                className={
                  hud.threatLevel === 'EXTREME' ||
                  hud.threatLevel === 'CRITICAL'
                    ? 'text-red-400 font-semibold'
                    : 'text-amber-400 font-semibold'
                }
              >
                THREAT: {hud.threatLevel}
              </span>
            </div>
          </div>

          {/* Warnings & Notifications Stack */}
          <div className="mt-2 flex flex-col items-center gap-1">
            {showRotatePrompt && (
              <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 bg-[#090e1d]/95 border border-cyan-400/60 text-cyan-200 text-[11px] font-medium tracking-wide px-3 py-1.5 rounded-lg shadow-lg max-w-[92vw]">
                <span>ROTATE PHONE TO LANDSCAPE FOR BEST CONTROLS</span>
                {!isFullscreen && (
                  <button
                    type="button"
                    onClick={onToggleFullscreen}
                    className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-display font-bold tracking-wider"
                  >
                    FULLSCREEN
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDismissRotatePrompt}
                  aria-label="Dismiss orientation tip"
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                >
                  OK
                </button>
              </div>
            )}
            {lowHealth && (
              <div className="bg-red-950/92 border border-red-500/70 text-red-200 text-[11px] font-semibold tracking-wider px-3 py-0.5 rounded shadow">
                WARNING: SURVIVOR HEALTH CRITICAL
              </div>
            )}
            {genCritical && (
              <div className="bg-amber-950/92 border border-amber-500/70 text-amber-200 text-[11px] font-semibold tracking-wider px-3 py-0.5 rounded shadow">
                {hud.generatorUnderAttack
                  ? 'ALERT: GENERATOR UNDER ATTACK'
                  : 'WARNING: GENERATOR INTEGRITY LOW'}
              </div>
            )}
            {hud.notifications.map((n) => (
              <div
                key={n.id}
                className={`bg-[#090e1d]/92 border px-3 py-0.5 rounded text-[11px] font-medium tracking-wide shadow ${
                  n.color === 'emerald'
                    ? 'border-emerald-500/60 text-emerald-300'
                    : n.color === 'amber'
                      ? 'border-amber-500/60 text-amber-300'
                      : n.color === 'crimson'
                        ? 'border-red-500/60 text-red-300'
                        : 'border-cyan-500/60 text-cyan-300'
                }`}
              >
                {n.text}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL: Ammunition, Weapon Status, Kills, Score & Fullscreen/Pause/Mute */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-pressed={isFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              className={`min-w-[44px] min-h-[44px] px-2.5 sm:px-3 py-2 bg-[#090e1d]/90 hover:bg-slate-800 border rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                isFullscreen
                  ? 'border-cyan-400/55 text-cyan-300'
                  : 'border-white/15 text-slate-200'
              }`}
            >
              {isFullscreen ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
                </svg>
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={settings.muted ? 'Unmute Audio' : 'Mute Audio'}
              className="min-w-[44px] min-h-[44px] px-3 py-2 bg-[#090e1d]/90 hover:bg-slate-800 border border-white/15 rounded-lg text-xs font-medium text-slate-200 flex items-center justify-center transition-colors"
            >
              {settings.muted ? 'MUTE: ON' : 'AUDIO: ON'}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause Game"
              className="min-w-[44px] min-h-[44px] px-3.5 py-2 bg-[#090e1d]/90 hover:bg-slate-800 border border-amber-400/35 rounded-lg text-xs font-display font-bold tracking-wider text-amber-400 flex items-center justify-center transition-colors"
            >
              PAUSE
            </button>
          </div>

          <div className="bg-[#090e1d]/90 border border-cyan-500/25 rounded-xl p-2.5 md:p-3.5 w-44 sm:w-52 text-right shadow-xl">
            <div className="flex items-center justify-end gap-1.5 text-[10px] tracking-wider text-slate-400 font-semibold">
              <span>PULSE RIFLE</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="text-cyan-400"
              >
                <rect
                  x="1"
                  y="4"
                  width="10"
                  height="4"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div className="mt-0.5 font-mono-tabular text-xl md:text-2xl font-bold text-cyan-400">
              {hud.ammo}{' '}
              <span className="text-sm text-slate-400 font-normal">
                / {hud.reserveAmmo}
              </span>
            </div>

            {/* Magazine Visual Charge Bar */}
            <div className="mt-1.5 w-full h-1.5 bg-slate-950 rounded overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.isReloading
                    ? 'bg-amber-400'
                    : hud.ammo <= 6
                      ? 'bg-red-500'
                      : 'bg-cyan-400'
                }`}
                style={{
                  width: `${
                    hud.isReloading
                      ? Math.max(0, Math.min(100, hud.reloadProgress * 100))
                      : ammoRatio * 100
                  }%`,
                }}
              />
            </div>

            <div className="mt-1 text-[10px] font-semibold tracking-wide">
              {hud.isReloading ? (
                <span className="text-amber-400">
                  RELOADING CELL ({Math.round(hud.reloadProgress * 100)}%)
                </span>
              ) : hud.ammo === 0 ? (
                <span className="text-red-400">CELL EMPTY — PRESS R</span>
              ) : (
                <span className="text-emerald-400">PULSE READY</span>
              )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300 font-mono-tabular">
              <span>KILLS: {hud.kills}</span>
              <span aria-hidden="true">·</span>
              <span>SCORE: {hud.score}</span>
            </div>
          </div>

          {/* Optional Developer Performance Monitor (Disabled by Default) */}
          {settings.showPerfOverlay && (
            <div className="bg-[#090e1d]/92 border border-white/15 rounded-xl p-2.5 w-44 sm:w-52 text-[10px] font-mono-tabular text-slate-300 shadow-lg space-y-1">
              <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-white/10 pb-1">
                <span>PERF MONITOR</span>
                <span>
                  {hud.perf.preset} ({hud.perf.renderScale}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">FPS / CAP</span>
                <span className="text-emerald-400 font-semibold">
                  {hud.perf.fps} / {hud.perf.targetFps}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">FRAME TIME</span>
                <span>{hud.perf.frameTimeMs.toFixed(1)} ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ACTIVE ENEMIES</span>
                <span>{hud.perf.activeEnemies}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">PARTICLES</span>
                <span>{hud.perf.activeParticles}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">DRAW CALLS</span>
                <span>{hud.perf.drawCalls}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">TRIANGLES</span>
                <span>{hud.perf.triangles.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* On-Screen Emergency Repair Progress Bar & Interaction Prompt Banner */}
      {(hasInteraction || hud.generatorRepairProgress > 0.01) && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          {hud.generatorRepairProgress > 0.01 && (
            <div className="w-64 bg-[#090e1d]/95 border border-emerald-400/60 rounded-xl p-2.5 shadow-xl">
              <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-emerald-300 mb-1">
                <span>EMERGENCY GENERATOR REPAIR</span>
                <span className="font-mono-tabular">
                  {Math.round(hud.generatorRepairProgress * 100)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded overflow-hidden border border-white/15">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-all duration-75"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, hud.generatorRepairProgress * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {hasInteraction && (
            <div className="bg-[#090e1d]/92 border border-emerald-500/55 px-4 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 tracking-wide whitespace-nowrap shadow-lg">
              {hud.nearbyCollectibleLabel
                ? `[E] ${hud.nearbyCollectibleLabel}`
                : hud.repairKits > 0
                  ? '[E] USE REPAIR KIT (+35% GENERATOR HP)'
                  : '[HOLD E 2.0s] EMERGENCY REPAIR (+15% GENERATOR HP)'}
            </div>
          )}
        </div>
      )}

      {/* BOTTOM VIRTUAL TOUCH CONTROLS (Landscape-first ergonomic thumb zones) */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
        {/* LEFT SIDE: Virtual Analog Joystick + Sprint Button */}
        <div className="flex items-end gap-3 pointer-events-auto">
          <div
            onPointerDown={handleJoyPointerDown}
            onPointerMove={handleJoyPointerMove}
            onPointerUp={handleJoyPointerUp}
            onPointerCancel={handleJoyPointerUp}
            className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-[#090e1d]/78 border-2 border-cyan-500/40 flex items-center justify-center touch-none shadow-lg"
          >
            {/* Crosshair guides inside joystick */}
            <div className="w-14 h-14 rounded-full border border-white/10 pointer-events-none" />
            {/* Movable Thumbstick Knob */}
            <div
              className={`w-12 h-12 rounded-full border-2 transition-colors pointer-events-none ${
                joyActive
                  ? 'bg-cyan-400/85 border-white shadow-md'
                  : 'bg-cyan-500/40 border-cyan-300/65'
              }`}
              style={{
                transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
              }}
            />
          </div>

          <button
            onPointerDown={(e) => {
              e.stopPropagation();
              input?.toggleMobileSprint();
            }}
            className={`min-w-[58px] min-h-[56px] px-3 py-2 rounded-xl border font-display text-xs font-bold tracking-wider transition-transform active:scale-95 ${
              hud.isSprinting
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-[#090e1d]/88 text-slate-200 border-white/20'
            }`}
          >
            SPRINT
          </button>
        </div>

        {/* Desktop Flat Control Hint Line */}
        <div className="hidden lg:flex items-center gap-2 bg-[#090e1d]/85 border border-white/12 px-4 py-1.5 rounded-lg text-[11px] text-slate-400 whitespace-nowrap">
          <span>WASD Move</span>
          <span aria-hidden="true">·</span>
          <span>Shift Sprint</span>
          <span aria-hidden="true">·</span>
          <span>Space Dodge</span>
          <span aria-hidden="true">·</span>
          <span>LMB Fire</span>
          <span aria-hidden="true">·</span>
          <span>R Reload</span>
          <span aria-hidden="true">·</span>
          <span>E Repair / Collect</span>
          <span aria-hidden="true">·</span>
          <span>ESC Pause</span>
        </div>

        {/* RIGHT SIDE: Interact/Repair, Reload, Dodge, and Large Fire Button */}
        <div className="flex items-end gap-2.5 sm:gap-3 pointer-events-auto">
          <div className="flex flex-col items-end gap-2">
            {/* Contextual Interact / Repair Button */}
            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                e.currentTarget.setPointerCapture(e.pointerId);
                input?.triggerInteract(true);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                input?.setInteractHeld(false);
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                input?.setInteractHeld(false);
              }}
              className={`min-w-[68px] min-h-[48px] px-3.5 py-2 rounded-xl border font-display text-xs font-bold tracking-wider transition-transform active:scale-95 ${
                hasInteraction || hud.isEmergencyRepairing
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300'
                  : 'bg-[#090e1d]/80 text-slate-400 border-white/15'
              }`}
            >
              {hud.canInteractGenerator ? 'REPAIR' : 'INTERACT'}
            </button>

            <div className="flex items-center gap-2">
              {/* Reload Button */}
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input?.triggerReload();
                }}
                className="min-w-[60px] min-h-[52px] px-3 py-2 rounded-xl bg-[#090e1d]/88 hover:bg-slate-800 border border-cyan-500/45 text-cyan-300 font-display text-xs font-bold tracking-wider active:scale-95"
              >
                RELOAD
              </button>

              {/* Dodge Button */}
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  input?.triggerDodge();
                }}
                className="min-w-[60px] min-h-[52px] px-3 py-2 rounded-xl bg-[#090e1d]/88 hover:bg-slate-800 border border-amber-500/45 text-amber-300 font-display text-xs font-bold tracking-wider active:scale-95"
              >
                DODGE
              </button>
            </div>
          </div>

          {/* Large Primary Attack / Pulse Fire Button */}
          <button
            onPointerDown={handleFireDown}
            onPointerUp={handleFireUp}
            onPointerCancel={handleFireUp}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 font-display text-sm sm:text-base font-bold tracking-wider flex items-center justify-center transition-transform touch-none shadow-lg ${
              firePressed
                ? 'bg-cyan-400 text-slate-950 border-white scale-95'
                : 'bg-cyan-500/90 text-slate-950 border-cyan-200'
            }`}
          >
            FIRE
          </button>
        </div>
      </div>
    </div>
  );
};

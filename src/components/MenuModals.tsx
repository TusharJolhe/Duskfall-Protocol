import React from 'react';
import {
  GameSettings,
  HUDTelemetry,
  ModalView,
  QualityPreset,
} from '../game/types';

interface MenuModalsProps {
  hud: HUDTelemetry;
  settings: GameSettings;
  modalView: ModalView;
  setModalView: (view: ModalView) => void;
  onStartGame: () => void;
  onResumeGame: () => void;
  onRestartGame: () => void;
  onReturnToMenu: () => void;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MenuModals: React.FC<MenuModalsProps> = ({
  hud,
  settings,
  modalView,
  setModalView,
  onStartGame,
  onResumeGame,
  onRestartGame,
  onReturnToMenu,
  onUpdateSettings,
}) => {
  const survivedSeconds = Math.max(0, 420 - hud.timeRemaining);

  // Settings Modal (accessible from Main Menu or Pause Screen)
  if (modalView === 'SETTINGS') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#080b14]/85 p-4">
        <div className="w-full max-w-lg bg-[#0d1326] border border-white/15 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
            <h2 className="font-display text-2xl font-bold tracking-wide text-white">
              SETTINGS
            </h2>
            <button
              onClick={() => setModalView('NONE')}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 rounded-lg"
            >
              CLOSE
            </button>
          </div>

          <div className="space-y-5 text-sm">
            {/* Graphics Quality Preset */}
            <div>
              <div className="flex items-center justify-between text-slate-300 font-medium mb-2">
                <span>Graphics Quality Preset</span>
                <span className="font-mono-tabular text-cyan-400">
                  {settings.graphicsQuality}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    {
                      id: 'LOW',
                      sub: '70% · 30 FPS · No Shadows',
                    },
                    {
                      id: 'MEDIUM',
                      sub: '85% · 45 FPS · Balanced',
                    },
                    {
                      id: 'HIGH',
                      sub: '100% · 60 FPS · Full Detail',
                    },
                  ] as { id: QualityPreset; sub: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() =>
                      onUpdateSettings({ graphicsQuality: preset.id })
                    }
                    className={`min-h-[54px] px-2 py-2 rounded-lg border transition-colors flex flex-col items-center justify-center ${
                      settings.graphicsQuality === preset.id
                        ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                        : 'bg-slate-900 text-slate-300 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <span className="font-display font-bold text-xs tracking-wider">
                      {preset.id}
                    </span>
                    <span
                      className={`text-[10px] mt-0.5 font-mono-tabular ${
                        settings.graphicsQuality === preset.id
                          ? 'text-slate-900 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {preset.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mouse / Touch Sensitivity */}
            <div>
              <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
                <span>Touch & Aim Sensitivity</span>
                <span className="font-mono-tabular text-cyan-400">
                  {settings.touchSensitivity.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.2"
                step="0.1"
                value={settings.touchSensitivity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateSettings({
                    touchSensitivity: val,
                    mouseSensitivity: val,
                  });
                }}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Camera Sensitivity */}
            <div>
              <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
                <span>Camera Rotation Sensitivity</span>
                <span className="font-mono-tabular text-cyan-400">
                  {settings.cameraSensitivity.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.2"
                step="0.1"
                value={settings.cameraSensitivity}
                onChange={(e) =>
                  onUpdateSettings({
                    cameraSensitivity: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sound Volume & Mute */}
            <div>
              <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
                <span>Sound Volume</span>
                <span className="font-mono-tabular text-amber-400">
                  {settings.muted
                    ? 'MUTED'
                    : `${Math.round(settings.soundVolume * 100)}%`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.soundVolume}
                  onChange={(e) =>
                    onUpdateSettings({
                      soundVolume: parseFloat(e.target.value),
                      muted: false,
                    })
                  }
                  className="flex-1 accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() =>
                    onUpdateSettings({ muted: !settings.muted })
                  }
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold border ${
                    settings.muted
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-slate-800 text-slate-200 border-white/10'
                  }`}
                >
                  {settings.muted ? 'UNMUTE' : 'MUTE'}
                </button>
              </div>
            </div>

            {/* Optional Developer Performance Monitor */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <div>
                <div className="text-slate-300 font-medium">
                  Developer Performance Monitor
                </div>
                <div className="text-xs text-slate-400">
                  Show real-time FPS, frame time, draw calls &amp; triangle count
                </div>
              </div>
              <button
                onClick={() =>
                  onUpdateSettings({
                    showPerfOverlay: !settings.showPerfOverlay,
                  })
                }
                className={`min-h-[40px] px-4 py-1.5 rounded-lg font-mono-tabular text-xs font-bold border transition-colors ${
                  settings.showPerfOverlay
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                    : 'bg-slate-900 text-slate-400 border-white/10 hover:border-white/25'
                }`}
              >
                {settings.showPerfOverlay ? 'ENABLED' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="mt-7 pt-4 border-t border-white/10 flex justify-end">
            <button
              onClick={() => setModalView('NONE')}
              className="min-h-[44px] px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm rounded-lg"
            >
              SAVE & RETURN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // How To Play Modal
  if (modalView === 'HOW_TO_PLAY') {
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#080b14]/85 p-4">
        <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d1326] border border-white/15 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
            <h2 className="font-display text-2xl font-bold tracking-wide text-white">
              HOW TO PLAY
            </h2>
            <button
              onClick={() => setModalView('NONE')}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 rounded-lg"
            >
              CLOSE
            </button>
          </div>

          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <div>
              <h3 className="font-display text-base font-bold text-cyan-400 mb-1">
                01. Objective — Survive 7 Minutes
              </h3>
              <p>
                You are trapped inside an abandoned dusk settlement. Protect the
                central emergency power generator and stay alive until the
                7-minute (420-second) countdown reaches 00:00.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4">
                <h4 className="font-display font-bold text-amber-400 mb-2">
                  Mobile Touch Controls
                </h4>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li>Left Analog Stick: Directional movement</li>
                  <li>Sprint Button: Toggle high-speed sprint</li>
                  <li>Right Screen Drag: Rotate third-person camera</li>
                  <li>FIRE Button: Fire Energy Pulse Rifle</li>
                  <li>DODGE / RELOAD: Evasive roll & reload cell</li>
                  <li>REPAIR / INTERACT: Repair generator or grab supplies</li>
                </ul>
              </div>

              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4">
                <h4 className="font-display font-bold text-cyan-400 mb-2">
                  Desktop Keyboard & Mouse
                </h4>
                <ul className="space-y-1 text-xs text-slate-300">
                  <li>W / A / S / D: Move survivor</li>
                  <li>Shift: Sprint (uses stamina)</li>
                  <li>Space: Dodge roll (brief invulnerability)</li>
                  <li>Mouse / Left Click: Rotate camera & Fire weapon</li>
                  <li>R: Reload energy magazine</li>
                  <li>E: Repair generator / Collect supplies · ESC: Pause</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-display text-base font-bold text-emerald-400 mb-1">
                02. Hostiles & Supply Pickups
              </h3>
              <p className="text-xs text-slate-300">
                Watch out for fast Crimson Runners, armored Purple Brutes that
                heavily smash the generator, and flanking Violet Stalkers.
                Collect glowing green Health Packs, cyan Energy Cells, and amber
                Repair Kits around the settlement perimeter.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
            <button
              onClick={() => setModalView('NONE')}
              className="min-h-[44px] px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm rounded-lg"
            >
              GOT IT
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN MENU
  if (hud.gameState === 'MENU') {
    return (
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-12 bg-gradient-to-t from-[#080b14]/90 via-[#080b14]/45 to-transparent">
        {/* Top Metadata Line */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>SETTLEMENT SECTOR 07 · EMERGENCY POWER CORE ACTIVE</span>
          <span>QUALITY: {settings.graphicsQuality}</span>
        </div>

        {/* Center Hero Lockup over negative space */}
        <div className="my-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              className="shrink-0"
            >
              <polygon
                points="18,2 33,10 33,26 18,34 3,26 3,10"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              <circle cx="18" cy="18" r="6" fill="#f59e0b" />
            </svg>
            <span className="text-xs md:text-sm font-mono-tabular tracking-widest text-cyan-400">
              07:00 SURVIVAL PROTOCOL
            </span>
          </div>

          <h1
            className="font-display text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white"
            style={{ textWrap: 'balance' }}
          >
            7 MINUTES LEFT
          </h1>
          <p className="mt-2 font-display text-base sm:text-lg md:text-xl tracking-widest text-amber-400">
            &ldquo;THE LAST LIGHT IS FADING.&rdquo;
          </p>
          <p className="mt-4 max-w-lg text-sm text-slate-300 leading-relaxed">
            Hostile creatures are converging on the settlement&apos;s emergency
            generator. Hold the perimeter, scavenge energy cells and repair
            kits, and survive until the seven-minute countdown reaches zero.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onStartGame}
              className="min-h-[48px] px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-base tracking-wider rounded-xl shadow-lg transition-transform active:scale-95 whitespace-nowrap"
            >
              PLAY
            </button>
            <button
              onClick={() => setModalView('HOW_TO_PLAY')}
              className="min-h-[48px] px-6 py-3.5 bg-[#0d1326]/90 hover:bg-slate-800 text-slate-100 border border-white/15 font-display font-semibold text-sm tracking-wider rounded-xl transition-transform active:scale-95 whitespace-nowrap"
            >
              HOW TO PLAY
            </button>
            <button
              onClick={() => setModalView('SETTINGS')}
              className="min-h-[48px] px-6 py-3.5 bg-[#0d1326]/90 hover:bg-slate-800 text-slate-100 border border-white/15 font-display font-semibold text-sm tracking-wider rounded-xl transition-transform active:scale-95 whitespace-nowrap"
            >
              SETTINGS
            </button>
          </div>
        </div>

        {/* Single Flat Control-Hint Line */}
        <div className="text-xs text-slate-400">
          WASD / Left Stick Move · Mouse / Right Touch Aim &amp; Fire · Space
          Dodge · E Repair Generator · ESC Pause
        </div>
      </div>
    );
  }

  // PAUSE SCREEN
  if (hud.gameState === 'PAUSED') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080b14]/80 p-4">
        <div className="w-full max-w-md bg-[#0d1326] border border-white/15 rounded-2xl p-6 md:p-8 text-center shadow-2xl">
          <div className="text-xs font-mono-tabular text-cyan-400 tracking-widest">
            SIMULATION PAUSED · {formatDuration(hud.timeRemaining)} LEFT
          </div>
          <h2 className="mt-1 font-display text-3xl font-bold text-white">
            GAME PAUSED
          </h2>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={onResumeGame}
              className="min-h-[48px] w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wider rounded-xl"
            >
              RESUME
            </button>
            <button
              onClick={() => setModalView('SETTINGS')}
              className="min-h-[48px] w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 font-display font-semibold text-sm tracking-wider rounded-xl"
            >
              SETTINGS
            </button>
            <button
              onClick={onRestartGame}
              className="min-h-[48px] w-full py-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-white/10 font-display font-semibold text-sm tracking-wider rounded-xl"
            >
              RESTART
            </button>
            <button
              onClick={onReturnToMenu}
              className="min-h-[48px] w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 font-display font-semibold text-sm tracking-wider rounded-xl"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VICTORY SCREEN
  if (hud.gameState === 'VICTORY') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080b14]/85 p-4">
        <div className="w-full max-w-lg bg-[#0d1326] border border-emerald-500/40 rounded-2xl p-6 md:p-8 text-center shadow-2xl">
          <div className="text-xs font-mono-tabular tracking-widest text-emerald-400">
            07:00 COUNTDOWN COMPLETE
          </div>
          <h2 className="mt-1 font-display text-4xl md:text-5xl font-bold text-white">
            SURVIVED
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Dawn breaks over the settlement. The central generator held through
            the final assault.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 text-left bg-slate-900/80 border border-white/10 rounded-xl p-4 font-mono-tabular">
            <div>
              <div className="text-[11px] text-slate-400">SURVIVAL TIME</div>
              <div className="text-lg font-bold text-white">07:00</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">ENEMIES DEFEATED</div>
              <div className="text-lg font-bold text-cyan-400">{hud.kills}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">
                GENERATOR REMAINING
              </div>
              <div className="text-lg font-bold text-emerald-400">
                {hud.generatorHealth}%
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">FINAL SCORE</div>
              <div className="text-lg font-bold text-amber-400">
                {hud.score}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onRestartGame}
              className="flex-1 min-h-[48px] py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-sm tracking-wider rounded-xl"
            >
              PLAY AGAIN
            </button>
            <button
              onClick={onReturnToMenu}
              className="flex-1 min-h-[48px] py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 font-display font-semibold text-sm tracking-wider rounded-xl"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  // DEFEAT SCREEN
  if (hud.gameState === 'DEFEAT') {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#080b14]/88 p-4">
        <div className="w-full max-w-lg bg-[#0d1326] border border-red-500/40 rounded-2xl p-6 md:p-8 text-center shadow-2xl">
          <div className="text-xs font-mono-tabular tracking-widest text-red-400">
            {hud.defeatReason === 'GENERATOR_DESTROYED'
              ? 'EMERGENCY CORE DESTROYED'
              : 'SURVIVOR OVERWHELMED'}
          </div>
          <h2
            className="mt-1 font-display text-3xl md:text-4xl font-bold text-white"
            style={{ textWrap: 'balance' }}
          >
            THE SETTLEMENT HAS FALLEN.
          </h2>

          <div className="mt-6 grid grid-cols-3 gap-3 text-left bg-slate-900/80 border border-white/10 rounded-xl p-4 font-mono-tabular">
            <div>
              <div className="text-[11px] text-slate-400">SURVIVAL TIME</div>
              <div className="text-lg font-bold text-white">
                {formatDuration(survivedSeconds)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">ENEMIES DEFEATED</div>
              <div className="text-lg font-bold text-cyan-400">{hud.kills}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">FINAL SCORE</div>
              <div className="text-lg font-bold text-amber-400">
                {hud.score}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onRestartGame}
              className="flex-1 min-h-[48px] py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-sm tracking-wider rounded-xl"
            >
              RESTART
            </button>
            <button
              onClick={onReturnToMenu}
              className="flex-1 min-h-[48px] py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-white/10 font-display font-semibold text-sm tracking-wider rounded-xl"
            >
              MAIN MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

import React, { useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { MenuModals } from './components/MenuModals';
import { SurvivalGameEngine } from './game/engine';
import { GameSettings, HUDTelemetry, ModalView } from './game/types';

const INITIAL_TELEMETRY: HUDTelemetry = {
  gameState: 'MENU',
  timeRemaining: 420,
  waveNumber: 1,
  waveLabel: 'INITIAL CONTACT',
  threatLevel: 'LOW',
  playerHealth: 100,
  playerMaxHealth: 100,
  playerStamina: 100,
  playerMaxStamina: 100,
  staminaExhausted: false,
  ammo: 30,
  maxMagazine: 30,
  reserveAmmo: 120,
  isReloading: false,
  reloadProgress: 1,
  weaponCooldown: 0,
  repairKits: 1,
  generatorHealth: 100,
  generatorMaxHealth: 100,
  generatorRepairCooldown: 0,
  generatorRepairProgress: 0,
  isEmergencyRepairing: false,
  generatorUnderAttack: false,
  canInteractGenerator: false,
  nearbyCollectibleLabel: null,
  kills: 0,
  score: 0,
  defeatReason: null,
  damageFlash: 0,
  isSprinting: false,
  dodgeCooldownRatio: 1,
  reticleTargetLocked: false,
  notifications: [],
  perf: {
    fps: 45,
    frameTimeMs: 4.2,
    activeEnemies: 0,
    activeParticles: 0,
    drawCalls: 0,
    triangles: 0,
    preset: 'MEDIUM',
    targetFps: 45,
    renderScale: 85,
  },
};

const INITIAL_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  cameraSensitivity: 1.0,
  soundVolume: 0.75,
  muted: false,
  graphicsQuality: 'MEDIUM',
  showPerfOverlay: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SurvivalGameEngine | null>(null);
  const [hud, setHud] = useState<HUDTelemetry>(INITIAL_TELEMETRY);
  const [settings, setSettings] = useState<GameSettings>(INITIAL_SETTINGS);
  const [modalView, setModalView] = useState<ModalView>('NONE');

  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new SurvivalGameEngine(canvasMountRef.current, (data) => {
      setHud({ ...data });
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleUpdateSettings = (partial: Partial<GameSettings>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.updateSettings(partial);
    setSettings({ ...engine.settings });
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#080b14] select-none">
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Active Gameplay HUD & Mobile Virtual Controls */}
      {hud.gameState === 'PLAYING' && modalView === 'NONE' && (
        <GameHUD
          hud={hud}
          settings={settings}
          input={engineRef.current?.input ?? null}
          onPause={() => engineRef.current?.pauseGame()}
          onToggleMute={() =>
            handleUpdateSettings({ muted: !settings.muted })
          }
        />
      )}

      {/* Main Menu, How To Play, Settings, Pause, Victory & Defeat Screens */}
      <MenuModals
        hud={hud}
        settings={settings}
        modalView={modalView}
        setModalView={(view) => {
          engineRef.current?.audio.playUiClick();
          setModalView(view);
        }}
        onStartGame={() => {
          setModalView('NONE');
          engineRef.current?.startGame();
        }}
        onResumeGame={() => {
          setModalView('NONE');
          engineRef.current?.resumeGame();
        }}
        onRestartGame={() => {
          setModalView('NONE');
          engineRef.current?.startGame();
        }}
        onReturnToMenu={() => {
          setModalView('NONE');
          engineRef.current?.returnToMenu();
        }}
        onUpdateSettings={handleUpdateSettings}
      />
    </div>
  );
}

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

function isDebugFlagEnabledInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const val = params.get('debug') ?? params.get('diag');
    return val === '1' || val === 'true';
  } catch {
    return false;
  }
}

const INITIAL_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  cameraSensitivity: 1.0,
  soundVolume: 0.75,
  muted: false,
  graphicsQuality: 'MEDIUM',
  showPerfOverlay: false,
  showAndroidDiagnostics: isDebugFlagEnabledInUrl(),
};

type WebkitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type WebkitFullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
};

interface NavigatorUAData {
  mobile?: boolean;
  platform?: string;
}

interface AndroidDiagnosticsData {
  userAgent: string;
  isSecureContext: boolean;
  isTopLevelContext: boolean;
  fullscreenApiAvailable: boolean;
  fullscreenEnabled: boolean;
  fullscreenState: string;
  lastFullscreenResult: string;
  orientationApiAvailable: boolean;
  currentOrientationType: string;
  lastOrientationResult: string;
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const uaMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      navigator.userAgent
    );
  const uaDataMobile = Boolean(
    (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData
      ?.mobile
  );
  const touchOnlyDevice =
    navigator.maxTouchPoints > 0 &&
    Boolean(
      window.matchMedia?.('(pointer: coarse) and (hover: none)').matches
    );
  return uaMobile || uaDataMobile || touchOnlyDevice;
}

function isTopLevelWindow(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.top === window.self;
  } catch {
    return false;
  }
}

function getActiveFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as WebkitFullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function isDocumentFullscreenEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as WebkitFullscreenDocument;
  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false);
}

function formatDomError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return String(err);
}

export default function App() {
  const appRootRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SurvivalGameEngine | null>(null);
  const fsTransitionInFlightRef = useRef(false);

  const [hud, setHud] = useState<HUDTelemetry>(INITIAL_TELEMETRY);
  const [settings, setSettings] = useState<GameSettings>(INITIAL_SETTINGS);
  const [modalView, setModalView] = useState<ModalView>('NONE');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    Boolean(getActiveFullscreenElement())
  );
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(() =>
    isMobileDevice() ? window.innerHeight > window.innerWidth : false
  );
  const [rotatePromptDismissed, setRotatePromptDismissed] = useState(false);

  const [diagnostics, setDiagnostics] = useState<AndroidDiagnosticsData>(() => {
    const docEl = (typeof document !== 'undefined'
      ? document.documentElement
      : null) as WebkitFullscreenElement | null;
    const fsApi = Boolean(
      docEl &&
        (typeof docEl.requestFullscreen === 'function' ||
          typeof docEl.webkitRequestFullscreen === 'function')
    );
    const orientObj =
      typeof screen !== 'undefined'
        ? (screen.orientation as LockableScreenOrientation | undefined)
        : undefined;
    const orientApi = Boolean(
      orientObj && typeof orientObj.lock === 'function'
    );
    const activeFs = getActiveFullscreenElement();

    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      isSecureContext:
        typeof window !== 'undefined' ? Boolean(window.isSecureContext) : false,
      isTopLevelContext: isTopLevelWindow(),
      fullscreenApiAvailable: fsApi,
      fullscreenEnabled: isDocumentFullscreenEnabled(),
      fullscreenState: activeFs
        ? `ACTIVE (<${activeFs.tagName.toLowerCase()}>)`
        : 'INACTIVE',
      lastFullscreenResult: 'Not requested yet',
      orientationApiAvailable: orientApi,
      currentOrientationType:
        orientObj?.type ??
        (typeof window !== 'undefined' && window.innerWidth >= window.innerHeight
          ? 'landscape (viewport)'
          : 'portrait (viewport)'),
      lastOrientationResult: 'Not requested yet',
    };
  });

  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new SurvivalGameEngine(canvasMountRef.current, (data) => {
      setHud({ ...data });
    });
    engine.updateSettings(INITIAL_SETTINGS);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const syncViewportAndFullscreen = () => {
      const activeFs = getActiveFullscreenElement();
      const fsActive = Boolean(activeFs);
      setIsFullscreen(fsActive);

      const mobile = isMobileDevice();
      const portrait = mobile && window.innerHeight > window.innerWidth;
      setIsPortraitMobile(portrait);
      if (!portrait) {
        setRotatePromptDismissed(false);
      }

      const orientObj =
        typeof screen !== 'undefined'
          ? (screen.orientation as LockableScreenOrientation | undefined)
          : undefined;

      setDiagnostics((prev) => ({
        ...prev,
        fullscreenEnabled: isDocumentFullscreenEnabled(),
        fullscreenState: activeFs
          ? `ACTIVE (<${activeFs.tagName.toLowerCase()}>)`
          : 'INACTIVE',
        currentOrientationType:
          orientObj?.type ??
          (window.innerWidth >= window.innerHeight
            ? 'landscape (viewport)'
            : 'portrait (viewport)'),
      }));

      engineRef.current?.handleResize();
    };

    document.addEventListener('fullscreenchange', syncViewportAndFullscreen);
    document.addEventListener(
      'webkitfullscreenchange',
      syncViewportAndFullscreen
    );
    window.addEventListener('resize', syncViewportAndFullscreen);
    window.addEventListener('orientationchange', syncViewportAndFullscreen);
    screen.orientation?.addEventListener?.('change', syncViewportAndFullscreen);

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        syncViewportAndFullscreen
      );
      document.removeEventListener(
        'webkitfullscreenchange',
        syncViewportAndFullscreen
      );
      window.removeEventListener('resize', syncViewportAndFullscreen);
      window.removeEventListener(
        'orientationchange',
        syncViewportAndFullscreen
      );
      screen.orientation?.removeEventListener?.(
        'change',
        syncViewportAndFullscreen
      );
    };
  }, []);

  const handleUpdateSettings = (partial: Partial<GameSettings>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.updateSettings(partial);
    setSettings({ ...engine.settings });
  };

  /**
   * Executes the Screen Orientation API lock strictly AFTER fullscreen is active.
   * Captures and reports the exact result or DOMException.
   */
  const attemptLandscapeLockAfterFullscreen = async (): Promise<{
    ok: boolean;
    message: string;
  }> => {
    const topLevel = isTopLevelWindow();
    const orient =
      typeof screen !== 'undefined'
        ? (screen.orientation as LockableScreenOrientation | undefined)
        : undefined;

    if (!orient) {
      const msg = 'screen.orientation object is undefined';
      setDiagnostics((prev) => ({ ...prev, lastOrientationResult: msg }));
      return { ok: false, message: msg };
    }

    if (typeof orient.lock !== 'function') {
      const msg = 'screen.orientation.lock() is not supported by this browser';
      setDiagnostics((prev) => ({ ...prev, lastOrientationResult: msg }));
      return { ok: false, message: msg };
    }

    if (!topLevel) {
      // Still attempt lock, but note iframe context if it rejects
      try {
        await orient.lock('landscape');
        const okMsg = `SUCCESS: locked to landscape (${orient.type})`;
        setDiagnostics((prev) => ({
          ...prev,
          currentOrientationType: orient.type,
          lastOrientationResult: okMsg,
        }));
        return { ok: true, message: okMsg };
      } catch (err) {
        const errMsg = `REJECTED (in iframe): ${formatDomError(err)}`;
        console.warn('[Duskfall Orientation Lock]', errMsg);
        setDiagnostics((prev) => ({ ...prev, lastOrientationResult: errMsg }));
        return { ok: false, message: errMsg };
      }
    }

    try {
      await orient.lock('landscape');
      const okMsg = `SUCCESS: locked to landscape (${orient.type})`;
      setDiagnostics((prev) => ({
        ...prev,
        currentOrientationType: orient.type,
        lastOrientationResult: okMsg,
      }));
      return { ok: true, message: okMsg };
    } catch (err) {
      const errMsg = `REJECTED: ${formatDomError(err)}`;
      console.warn('[Duskfall Orientation Lock]', errMsg);
      setDiagnostics((prev) => ({ ...prev, lastOrientationResult: errMsg }));
      return { ok: false, message: errMsg };
    }
  };

  /**
   * Synchronously initiates Fullscreen API inside the user click gesture before any
   * asynchronous work, then chains screen.orientation.lock("landscape") after fullscreen activates.
   */
  const triggerFullscreenAndLandscapeFromUserGesture = () => {
    if (fsTransitionInFlightRef.current) return;

    const targetEl = (appRootRef.current ??
      document.documentElement) as WebkitFullscreenElement;
    const docEl = document.documentElement as WebkitFullscreenElement;
    const fsEnabled = isDocumentFullscreenEnabled();
    const alreadyFs = Boolean(getActiveFullscreenElement());
    const hasStandardFs = typeof targetEl.requestFullscreen === 'function';
    const hasWebkitFs = typeof targetEl.webkitRequestFullscreen === 'function';

    if (alreadyFs) {
      setDiagnostics((prev) => ({
        ...prev,
        lastFullscreenResult: 'Already in fullscreen',
      }));
      if (isMobileDevice()) {
        void attemptLandscapeLockAfterFullscreen().then((lockRes) => {
          engineRef.current?.handleResize();
          if (!lockRes.ok && window.innerHeight > window.innerWidth) {
            setRotatePromptDismissed(false);
            engineRef.current?.notifyUser(
              `ORIENTATION LOCK FAILED (${lockRes.message}) — ROTATE PHONE MANUALLY`,
              'amber'
            );
          }
        });
      }
      return;
    }

    if (!hasStandardFs && !hasWebkitFs) {
      const msg = 'Fullscreen API (element.requestFullscreen) unavailable';
      console.warn('[Duskfall Fullscreen]', msg);
      setDiagnostics((prev) => ({
        ...prev,
        fullscreenApiAvailable: false,
        lastFullscreenResult: msg,
      }));
      setRotatePromptDismissed(false);
      engineRef.current?.notifyUser(
        'FULLSCREEN API UNAVAILABLE — ROTATE DEVICE TO LANDSCAPE',
        'amber'
      );
      return;
    }

    if (!fsEnabled) {
      const msg = isTopLevelWindow()
        ? 'document.fullscreenEnabled is false'
        : 'Blocked by iframe (document.fullscreenEnabled is false)';
      console.warn('[Duskfall Fullscreen]', msg);
      setDiagnostics((prev) => ({
        ...prev,
        fullscreenEnabled: false,
        lastFullscreenResult: msg,
      }));
    }

    fsTransitionInFlightRef.current = true;

    // 1. Synchronous Fullscreen API call directly inside the user click event handler
    let fsPromise: Promise<void>;
    try {
      const maybePromise = hasStandardFs
        ? targetEl.requestFullscreen({ navigationUI: 'hide' })
        : targetEl.webkitRequestFullscreen?.();
      fsPromise = Promise.resolve(maybePromise);
    } catch (syncErr) {
      fsPromise = Promise.reject(syncErr);
    }

    void fsPromise
      .catch(async (firstErr) => {
        // Fallback to document.documentElement if container fullscreen failed
        if (targetEl !== docEl && typeof docEl.requestFullscreen === 'function') {
          await docEl.requestFullscreen({ navigationUI: 'hide' });
          return;
        }
        throw firstErr;
      })
      .then(async () => {
        const activeEl = getActiveFullscreenElement();
        setIsFullscreen(Boolean(activeEl));
        setDiagnostics((prev) => ({
          ...prev,
          fullscreenState: activeEl
            ? `ACTIVE (<${activeEl.tagName.toLowerCase()}>)`
            : 'ACTIVE',
          lastFullscreenResult: 'SUCCESS: entered fullscreen',
        }));

        // 2. Only AFTER fullscreen is active, request landscape orientation lock on mobile
        if (isMobileDevice()) {
          const lockRes = await attemptLandscapeLockAfterFullscreen();
          if (!lockRes.ok && window.innerHeight > window.innerWidth) {
            setRotatePromptDismissed(false);
            engineRef.current?.notifyUser(
              'ROTATE PHONE TO LANDSCAPE FOR BEST VIEW',
              'amber'
            );
          }
        }
        engineRef.current?.handleResize();
      })
      .catch((fsErr) => {
        const errMsg = `REJECTED: ${formatDomError(fsErr)}`;
        console.warn('[Duskfall Fullscreen]', errMsg);
        setDiagnostics((prev) => ({
          ...prev,
          lastFullscreenResult: errMsg,
          lastOrientationResult:
            'Skipped (requires active fullscreen on Android Chrome)',
        }));
        setRotatePromptDismissed(false);
        engineRef.current?.notifyUser(
          !isTopLevelWindow()
            ? 'FULLSCREEN BLOCKED BY EMBEDDED FRAME — OPEN DIRECT URL OR ROTATE PHONE'
            : 'FULLSCREEN REJECTED — USE BROWSER FULLSCREEN OR ROTATE PHONE',
          'amber'
        );
      })
      .finally(() => {
        fsTransitionInFlightRef.current = false;
        engineRef.current?.handleResize();
      });
  };

  // PLAY button click handler — synchronous user activation preserved first
  const handleStartGame = () => {
    // 1. Immediately invoke browser Fullscreen -> Orientation API on mobile before any other work
    if (isMobileDevice()) {
      triggerFullscreenAndLandscapeFromUserGesture();
    }

    // 2. Start the game normally
    setModalView('NONE');
    engineRef.current?.startGame();
    engineRef.current?.handleResize();
  };

  // Manual Fullscreen Toggle button in HUD (Desktop & Mobile)
  const handleToggleFullscreen = () => {
    const doc = document as WebkitFullscreenDocument;
    const activeFs = getActiveFullscreenElement();

    if (activeFs) {
      engineRef.current?.audio.playUiClick();
      const exitPromise =
        typeof doc.exitFullscreen === 'function'
          ? doc.exitFullscreen()
          : Promise.resolve(doc.webkitExitFullscreen?.());
      void exitPromise
        .then(() => {
          setDiagnostics((prev) => ({
            ...prev,
            fullscreenState: 'INACTIVE',
            lastFullscreenResult: 'Exited fullscreen by user',
          }));
        })
        .catch((err) => {
          const errMsg = `Exit failed: ${formatDomError(err)}`;
          setDiagnostics((prev) => ({ ...prev, lastFullscreenResult: errMsg }));
        })
        .finally(() => {
          engineRef.current?.handleResize();
        });
      return;
    }

    // Enter fullscreen synchronously inside click handler before playing audio
    triggerFullscreenAndLandscapeFromUserGesture();
    engineRef.current?.audio.playUiClick();
  };

  return (
    <div
      ref={appRootRef}
      className="relative w-full h-full overflow-hidden bg-[#080b14] select-none"
    >
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Active Gameplay HUD & Mobile Virtual Controls */}
      {hud.gameState === 'PLAYING' && modalView === 'NONE' && (
        <GameHUD
          hud={hud}
          settings={settings}
          input={engineRef.current?.input ?? null}
          isFullscreen={isFullscreen}
          showRotatePrompt={isPortraitMobile && !rotatePromptDismissed}
          onDismissRotatePrompt={() => setRotatePromptDismissed(true)}
          onToggleFullscreen={handleToggleFullscreen}
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
        onStartGame={handleStartGame}
        onResumeGame={() => {
          setModalView('NONE');
          engineRef.current?.resumeGame();
        }}
        onRestartGame={handleStartGame}
        onReturnToMenu={() => {
          setModalView('NONE');
          engineRef.current?.returnToMenu();
        }}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Optional Android Fullscreen & Orientation Diagnostics Panel (Debug Flag Only) */}
      {settings.showAndroidDiagnostics && (
        <div className="absolute bottom-3 left-3 z-40 max-w-sm bg-[#090e1d]/95 border border-amber-400/60 rounded-xl p-3 text-[11px] font-mono-tabular text-slate-200 shadow-2xl pointer-events-auto space-y-1">
          <div className="flex items-center justify-between border-b border-white/15 pb-1 mb-1">
            <span className="font-bold text-amber-400">
              ANDROID FS &amp; ORIENTATION DIAG
            </span>
            <button
              type="button"
              onClick={() =>
                handleUpdateSettings({ showAndroidDiagnostics: false })
              }
              className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300"
            >
              HIDE
            </button>
          </div>
          <div className="truncate" title={diagnostics.userAgent}>
            <span className="text-slate-400">UA: </span>
            <span>{diagnostics.userAgent}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">isSecureContext:</span>
            <span
              className={
                diagnostics.isSecureContext
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              {String(diagnostics.isSecureContext)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">window.top === self:</span>
            <span
              className={
                diagnostics.isTopLevelContext
                  ? 'text-emerald-400'
                  : 'text-amber-400'
              }
            >
              {diagnostics.isTopLevelContext
                ? 'true (Top-Level)'
                : 'false (Iframe)'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Fullscreen API:</span>
            <span
              className={
                diagnostics.fullscreenApiAvailable
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              {diagnostics.fullscreenApiAvailable ? 'Available' : 'Unavailable'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">fullscreenEnabled:</span>
            <span
              className={
                diagnostics.fullscreenEnabled
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              {String(diagnostics.fullscreenEnabled)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">Fullscreen State:</span>
            <span className="text-cyan-300">{diagnostics.fullscreenState}</span>
          </div>
          <div className="break-words text-[10px] text-amber-200">
            <span className="text-slate-400">FS Result: </span>
            {diagnostics.lastFullscreenResult}
          </div>
          <div className="flex justify-between gap-2 pt-1 border-t border-white/10">
            <span className="text-slate-400">Orientation Lock API:</span>
            <span
              className={
                diagnostics.orientationApiAvailable
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              {diagnostics.orientationApiAvailable
                ? `Available (${diagnostics.currentOrientationType})`
                : 'Unavailable'}
            </span>
          </div>
          <div className="break-words text-[10px] text-amber-200">
            <span className="text-slate-400">Lock Result: </span>
            {diagnostics.lastOrientationResult}
          </div>
          <div className="pt-1.5 flex gap-2">
            <button
              type="button"
              onClick={triggerFullscreenAndLandscapeFromUserGesture}
              className="flex-1 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-[10px]"
            >
              TEST FS + LANDSCAPE LOCK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

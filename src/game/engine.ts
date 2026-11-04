import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AudioManager } from './audio';
import { ThirdPersonCamera } from './camera';
import { CombatSystem } from './combat';
import { EnemySystem } from './enemies';
import { GeneratorSystem } from './generator';
import { InputManager } from './input';
import { ParticleSystem } from './particles';
import { PlayerController } from './player';
import { ResourceSystem } from './resources';
import {
  GameSettings,
  GameState,
  HUDTelemetry,
  NotificationItem,
  QualityPreset,
} from './types';
import { WaveDirector } from './waves';
import { buildSettlementWorld, WorldContext } from './world';

const _muzzlePos = new THREE.Vector3();
const _muzzleDir = new THREE.Vector3();
const _aimTarget = new THREE.Vector3();
const _deathOrigin = new THREE.Vector3();

export class SurvivalGameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private world: WorldContext;
  private cameraCtrl: ThirdPersonCamera;
  public input: InputManager;
  private player: PlayerController;
  private generator: GeneratorSystem;
  private enemies: EnemySystem;
  private combat: CombatSystem;
  private resources: ResourceSystem;
  private waves: WaveDirector;
  private particles: ParticleSystem;
  public audio: AudioManager;

  private isSoftwareGl = false;
  private frameId = 0;
  private lastTimestamp = 0;
  private disposed = false;

  public gameState: GameState = 'MENU';
  public settings: GameSettings = {
    mouseSensitivity: 1.0,
    touchSensitivity: 1.0,
    cameraSensitivity: 1.0,
    soundVolume: 0.75,
    muted: false,
    graphicsQuality: 'MEDIUM',
    showPerfOverlay: false,
  };

  // Decoupled 420-second active gameplay countdown
  private totalSurvivalDuration = 420.0;
  private activeGameplayTime = 0.0;
  private visualClock = 0.0;
  private kills = 0;
  private score = 0;
  private defeatReason: 'PLAYER_DIED' | 'GENERATOR_DESTROYED' | null = null;
  private notifications: NotificationItem[] = [];
  private nextNotifId = 1;

  // Performance telemetry counters
  private smoothedFps = 45;
  private smoothedFrameTimeMs = 4.2;

  private onTelemetryUpdate: (telemetry: HUDTelemetry) => void;
  private hudSyncAccumulator = 0;

  constructor(
    container: HTMLElement,
    onTelemetryUpdate: (telemetry: HUDTelemetry) => void
  ) {
    this.container = container;
    this.onTelemetryUpdate = onTelemetryUpdate;

    // Detect Software WebGL per Three.js skill directive
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setSize(width, height);
    this.updateRendererQuality(this.settings.graphicsQuality);
    container.appendChild(this.renderer.domElement);

    // Handle WebGL context loss gracefully
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    // Studio RoomEnvironment reflection for metallic & emissive PBR surfaces
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    this.world = buildSettlementWorld(
      this.scene,
      this.settings.graphicsQuality,
      this.isSoftwareGl
    );
    this.generator = new GeneratorSystem(this.scene, this.world.obstacles);
    this.player = new PlayerController(this.scene);
    this.cameraCtrl = new ThirdPersonCamera(width / Math.max(1, height));
    this.enemies = new EnemySystem(this.scene);
    this.combat = new CombatSystem(this.scene);
    this.resources = new ResourceSystem(this.scene);
    this.waves = new WaveDirector();
    this.particles = new ParticleSystem(this.scene);
    this.particles.setQuality(this.settings.graphicsQuality);
    this.audio = new AudioManager();

    this.input = new InputManager();
    this.input.attach(this.renderer.domElement);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.cameraCtrl.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.emitTelemetry();
    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.cameraCtrl.resize(w, h);
    this.renderer.setSize(w, h);
  };

  public getTargetFps(quality: QualityPreset): number {
    if (quality === 'LOW') return 30;
    if (quality === 'MEDIUM') return 45;
    return 60;
  }

  public getRenderScale(quality: QualityPreset): number {
    if (quality === 'LOW') return 0.7;
    if (quality === 'MEDIUM') return 0.85;
    return 1.0;
  }

  public updateSettings(partial: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.audio.setVolume(this.settings.soundVolume, this.settings.muted);
    if (partial.graphicsQuality) {
      this.updateRendererQuality(partial.graphicsQuality);
      this.world.updateQuality(partial.graphicsQuality, this.isSoftwareGl);
      this.particles.setQuality(partial.graphicsQuality);
      this.smoothedFps = this.getTargetFps(partial.graphicsQuality);
    }
    this.emitTelemetry();
  }

  private updateRendererQuality(quality: QualityPreset) {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(0.7);
      this.renderer.shadowMap.enabled = false;
      return;
    }
    const baseDpr = Math.min(
      window.devicePixelRatio || 1,
      quality === 'HIGH' ? 1.5 : 1.25
    );
    const scale = this.getRenderScale(quality);
    this.renderer.setPixelRatio(Math.max(0.5, baseDpr * scale));

    const wantShadows = quality !== 'LOW';
    const wantShadowType = THREE.PCFShadowMap;

    const shadowChanged =
      this.renderer.shadowMap.enabled !== wantShadows ||
      this.renderer.shadowMap.type !== wantShadowType;

    this.renderer.shadowMap.enabled = wantShadows;
    this.renderer.shadowMap.type = wantShadowType;

    if (shadowChanged && this.scene) {
      this.renderer.shadowMap.needsUpdate = true;
      this.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              m.needsUpdate = true;
            });
          } else {
            obj.material.needsUpdate = true;
          }
        }
      });
    }
  }

  public startGame() {
    this.audio.playUiClick();
    this.activeGameplayTime = 0.0;
    this.kills = 0;
    this.score = 0;
    this.defeatReason = null;
    this.notifications = [];

    this.player.reset();
    this.generator.reset();
    this.enemies.reset();
    this.combat.reset();
    this.resources.reset();
    this.waves.reset();
    this.particles.reset();
    this.cameraCtrl.reset(this.player.position, this.player.rotationY);

    this.gameState = 'PLAYING';
    this.input.setEnabled(true);
    this.pushNotification('PROTECT THE CENTRAL GENERATOR FOR 7 MINUTES', 'cyan');
    this.lastTimestamp = performance.now();
    this.emitTelemetry();
  }

  public pauseGame() {
    if (this.gameState !== 'PLAYING') return;
    this.audio.playUiClick();
    this.gameState = 'PAUSED';
    this.input.setEnabled(false);
    this.emitTelemetry();
  }

  public resumeGame() {
    if (this.gameState !== 'PAUSED') return;
    this.audio.playUiClick();
    this.gameState = 'PLAYING';
    this.input.setEnabled(true);
    this.lastTimestamp = performance.now();
    this.emitTelemetry();
  }

  public returnToMenu() {
    this.audio.playUiClick();
    this.gameState = 'MENU';
    this.input.setEnabled(false);
    this.enemies.reset();
    this.combat.reset();
    this.resources.reset();
    this.waves.reset();
    this.particles.reset();
    this.player.reset();
    this.generator.reset();
    this.emitTelemetry();
  }

  private pushNotification(
    text: string,
    color: 'cyan' | 'amber' | 'emerald' | 'crimson'
  ) {
    this.notifications = [
      {
        id: this.nextNotifId++,
        text,
        color,
        timestamp: performance.now(),
      },
      ...this.notifications.slice(0, 3),
    ];
  }

  private scheduleNextFrame() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush?.();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(
            () => this.tick(performance.now()),
            80
          );
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    if (this.disposed) return;

    // Frame-rate limiter per graphics preset (LOW: 30 FPS, MEDIUM: 45 FPS, HIGH: 60 FPS)
    const targetFps = this.getTargetFps(this.settings.graphicsQuality);
    const minFrameIntervalMs = 1000 / targetFps;
    const elapsedMs = now - this.lastTimestamp;

    if (!this.isSoftwareGl && elapsedMs < minFrameIntervalMs - 1.2) {
      this.scheduleNextFrame();
      return;
    }

    const frameStart = performance.now();
    const rawDeltaSeconds = Math.max(0.001, elapsedMs / 1000);
    this.lastTimestamp = now;

    // Update smoothed FPS counter
    const instantFps = Math.min(targetFps, 1 / rawDeltaSeconds);
    this.smoothedFps = this.smoothedFps * 0.85 + instantFps * 0.15;

    // Clamp physics simulation delta separately so frame spikes never break physics
    const simDelta = Math.min(rawDeltaSeconds, 0.055);
    this.visualClock += simDelta;

    // Check ESC pause key
    const edges = this.input.consumeEdgeActions();
    if (edges.pause) {
      if (this.gameState === 'PLAYING') {
        this.pauseGame();
      } else if (this.gameState === 'PAUSED') {
        this.resumeGame();
      }
    }

    if (this.gameState === 'MENU') {
      this.cameraCtrl.updateMenuOrbit(simDelta);
      this.world.updateEnvironment(
        simDelta,
        this.visualClock,
        this.settings.graphicsQuality
      );
      this.generator.update(simDelta, (origin, count, hex) =>
        this.particles.emitBurst(origin, count, hex, 3.2, 0.8)
      );
      this.resources.update(simDelta);
      this.particles.update(simDelta);
    } else if (this.gameState === 'PLAYING') {
      // Accumulate real active gameplay time (independent of FPS limiter, guarded against background tab suspension)
      const activeTimerDelta = Math.min(rawDeltaSeconds, 0.25);
      this.activeGameplayTime += activeTimerDelta;

      const timeRemaining = Math.max(
        0,
        this.totalSurvivalDuration - this.activeGameplayTime
      );
      if (timeRemaining <= 0) {
        this.score += Math.round(
          this.generator.health * 15 + this.player.health * 5
        );
        this.gameState = 'VICTORY';
        this.input.setEnabled(false);
        this.audio.playPickup();
        this.emitTelemetry();
      } else {
        // Sub-step simulation when running at 30 FPS so movement & collision behave identically across all presets
        const subSteps = simDelta > 0.025 ? 2 : 1;
        const stepDt = simDelta / subSteps;
        for (let s = 0; s < subSteps; s++) {
          if (this.gameState !== 'PLAYING') break;
          this.stepGameplay(
            stepDt,
            s === 0
              ? edges
              : { dodge: false, reload: false, interact: false, pause: false },
            s === 0
          );
        }
      }
    }

    this.renderer.render(this.scene, this.cameraCtrl.camera);

    const frameEnd = performance.now();
    const cpuFrameMs = frameEnd - frameStart;
    this.smoothedFrameTimeMs =
      this.smoothedFrameTimeMs * 0.82 + cpuFrameMs * 0.18;

    this.scheduleNextFrame();
  };

  private handleEnemyDamaged = (
    hitEnemy: ReturnType<EnemySystem['enemies']['find']>,
    hitPos: THREE.Vector3,
    dmg: number
  ) => {
    if (!hitEnemy) return;
    this.particles.emitBurst(hitPos, 6, 0x38bdf8, 5.5, 0.9);
    const killed = this.enemies.damageEnemy(
      hitEnemy,
      dmg,
      this.player.position
    );
    this.audio.playEnemyHit(killed);
    if (killed) {
      this.kills++;
      this.score +=
        hitEnemy.type === 'BRUTE'
          ? 250
          : hitEnemy.type === 'STALKER'
            ? 150
            : 100;
      _deathOrigin.set(
        hitEnemy.position.x,
        hitEnemy.position.y + 1.0,
        hitEnemy.position.z
      );
      const deathColor =
        hitEnemy.type === 'BRUTE'
          ? 0xf59e0b
          : hitEnemy.type === 'STALKER'
            ? 0xa855f7
            : 0xef4444;
      this.particles.emitBurst(_deathOrigin, 16, deathColor, 6.8, 1.35);
      this.particles.emitRing(
        hitEnemy.position,
        deathColor,
        hitEnemy.type === 'BRUTE' ? 3.2 : 1.9,
        0.36
      );
    }
  };

  private stepGameplay(
    simDelta: number,
    edges: {
      dodge: boolean;
      reload: boolean;
      interact: boolean;
      pause: boolean;
    },
    consumeLook = true
  ) {
    // 1. Camera look rotation
    if (consumeLook) {
      const look = this.input.consumeLookDelta();
      if (look.dx !== 0 || look.dy !== 0) {
        this.cameraCtrl.applyLookDelta(
          look.dx,
          look.dy,
          this.settings.mouseSensitivity,
          this.settings.cameraSensitivity
        );
      }
    }

    // 2. Player edge actions (Reload, Dodge, Interact/Repair)
    if (edges.reload) {
      if (this.player.startReload()) {
        this.audio.playUiClick();
      }
    }
    const moveVec = this.input.getMovementVector();
    if (edges.dodge) {
      if (this.player.startDodge(moveVec.x, moveVec.z, this.cameraCtrl.yaw)) {
        this.particles.emitBurst(
          this.player.position,
          6,
          0x38bdf8,
          3.2,
          0.75
        );
      }
    }
    if (edges.interact) {
      this.tryPlayerInteract();
    }

    // 3. Update Player Movement & Third-Person Camera
    const isFiring = this.input.isFiring();
    this.player.update(
      simDelta,
      moveVec,
      this.input.sprintHeld,
      isFiring,
      this.cameraCtrl.yaw,
      this.world.obstacles,
      () => this.audio.playFootstep(),
      () => this.audio.playReloadComplete(),
      this.cameraCtrl.pitch
    );
    this.cameraCtrl.updatePlaying(
      simDelta,
      this.player.position,
      this.world.obstacles,
      this.player.isSprinting
    );

    // 4. Compute 3D Aim Target & Synchronize Weapon Orientation
    const aimedEnemy = this.combat.computeAimTarget(
      this.cameraCtrl.camera,
      this.player.position,
      this.enemies.enemies,
      _aimTarget
    );
    this.player.syncWeaponAim(
      simDelta,
      isFiring,
      this.cameraCtrl.yaw,
      this.cameraCtrl.pitch,
      _aimTarget
    );

    // 5. Firing Weapon (aligned with barrel orientation and aim target)
    if (isFiring && this.player.canFire()) {
      this.player.consumeShot();
      this.player.getMuzzleWorldPosition(_muzzlePos);
      this.player.getMuzzleWorldDirection(_muzzleDir);
      this.cameraCtrl.addShake(0.042);
      this.audio.playLaserPulse();
      this.particles.emitBurst(_muzzlePos, 3, 0x67e8f9, 3.5, 0.65);

      this.combat.fireWeapon(
        _muzzlePos,
        this.cameraCtrl.camera,
        this.enemies.enemies,
        this.handleEnemyDamaged,
        (envPos) => this.particles.emitBurst(envPos, 4, 0x38bdf8, 3.8, 0.7),
        _aimTarget,
        aimedEnemy,
        _muzzleDir
      );
    }

    // 5. Auto-collect or interact with nearby Supply Pickups
    this.resources.update(simDelta);
    const autoPickup = this.resources.getNearestCollectible(
      this.player.position,
      1.35
    );
    if (autoPickup) {
      this.applyCollectible(autoPickup, false);
    }

    // 6. Update Projectiles
    this.combat.update(
      simDelta,
      this.enemies.enemies,
      this.world.obstacles,
      this.handleEnemyDamaged,
      (envPos) => this.particles.emitBurst(envPos, 4, 0x38bdf8, 3.8, 0.7)
    );

    // 7. 7-Minute Progressive Wave Spawning (Runner, Brute, Stalker)
    this.waves.update(
      simDelta,
      this.activeGameplayTime,
      this.enemies.getActiveCount(),
      this.settings.graphicsQuality,
      (enemyType, aggressionMult) => {
        this.enemies.spawnEnemy(
          enemyType,
          this.player.position,
          aggressionMult
        );
      },
      (newBracket) => {
        this.resources.replenishWaveSupplies(2);
        this.pushNotification(
          `WAVE ${newBracket.waveNumber}: ${newBracket.label}`,
          newBracket.waveNumber >= 6 ? 'crimson' : 'amber'
        );
      }
    );

    // 8. Update Enemies & Handle Attacks
    this.enemies.update(
      simDelta,
      this.player.position,
      this.generator.position,
      this.world.obstacles,
      (playerDmg, enemyType, impactPos) => {
        const died = this.player.takeDamage(playerDmg);
        this.audio.playPlayerDamage();
        this.cameraCtrl.addShake(enemyType === 'BRUTE' ? 0.32 : 0.18);
        if (enemyType === 'BRUTE') {
          this.particles.emitBurst(impactPos, 14, 0xf59e0b, 6.2, 1.15);
          this.particles.emitRing(impactPos, 0xf59e0b, 3.4, 0.38);
        }
        if (died) {
          this.defeatReason = 'PLAYER_DIED';
          this.gameState = 'DEFEAT';
          this.input.setEnabled(false);
          this.emitTelemetry();
        }
      },
      (genDmg, enemyType, impactPos) => {
        const destroyed = this.generator.takeDamage(genDmg);
        this.audio.playGeneratorAlarm();
        this.cameraCtrl.addShake(enemyType === 'BRUTE' ? 0.24 : 0.08);
        this.particles.emitBurst(
          enemyType === 'BRUTE' ? impactPos : new THREE.Vector3(0, 2.4, 0),
          enemyType === 'BRUTE' ? 16 : 8,
          0xf59e0b,
          enemyType === 'BRUTE' ? 6.5 : 5.0,
          1.1
        );
        if (enemyType === 'BRUTE') {
          this.particles.emitRing(impactPos, 0xf59e0b, 3.6, 0.4);
        }
        if (destroyed) {
          this.defeatReason = 'GENERATOR_DESTROYED';
          this.gameState = 'DEFEAT';
          this.input.setEnabled(false);
          this.emitTelemetry();
        }
      },
      this.settings.graphicsQuality
    );

    // 9. Update Generator, Environment Animations & Emergency Repair 2.0-second Hold Channel
    this.world.updateEnvironment(
      simDelta,
      this.visualClock,
      this.settings.graphicsQuality
    );

    const distToGen = this.player.position.distanceTo(this.generator.position);
    const emergencyRepaired = this.generator.updateEmergencyRepairChannel(
      simDelta,
      distToGen <= 4.6,
      this.input.interactHeld,
      this.player.repairKits > 0
    );
    if (emergencyRepaired > 0) {
      this.score += emergencyRepaired * 5;
      this.audio.playPickup();
      this.particles.emitBurst(
        new THREE.Vector3(0, 2.5, 0),
        14,
        0x10b981,
        5.5,
        1.1
      );
      this.particles.emitRing(this.generator.position, 0x10b981, 3.5, 0.45);
      this.pushNotification(
        `EMERGENCY REPAIR +${emergencyRepaired}% GENERATOR HP`,
        'emerald'
      );
      this.emitTelemetry();
    }

    this.generator.update(simDelta, (origin, count, hex) =>
      this.particles.emitBurst(origin, count, hex, 4.2, 0.85)
    );
    if (
      this.settings.graphicsQuality !== 'LOW' &&
      Math.random() < 0.035 &&
      this.world.sparkPositions.length > 0
    ) {
      const sp =
        this.world.sparkPositions[
          Math.floor(Math.random() * this.world.sparkPositions.length)
        ];
      this.particles.emitBurst(sp, 3, 0xfbbf24, 3.0, 0.65);
    }

    // 10. Update Pooled Particles
    this.particles.update(simDelta);

    // 11. Throttled HUD Telemetry Sync (~15Hz)
    this.hudSyncAccumulator += simDelta;
    if (this.hudSyncAccumulator >= 0.065) {
      this.hudSyncAccumulator = 0;
      this.emitTelemetry();
    }
  }

  public tryPlayerInteract() {
    // 1. Check nearby supply collectible first
    const nearbyItem = this.resources.getNearestCollectible(
      this.player.position,
      2.65
    );
    if (nearbyItem) {
      const used = this.applyCollectible(nearbyItem, true);
      if (used) return;
    }

    // 2. Check central generator repair with Repair Kit (+35 HP immediate)
    const distToGen = this.player.position.distanceTo(this.generator.position);
    if (distToGen <= 4.6) {
      if (this.generator.health >= this.generator.maxHealth) {
        this.pushNotification('GENERATOR INTEGRITY FULL', 'cyan');
        return;
      }
      if (this.player.repairKits > 0) {
        const repairedAmount = this.generator.useRepairKit();
        if (repairedAmount > 0) {
          this.player.repairKits = Math.max(0, this.player.repairKits - 1);
          this.score += repairedAmount * 5;
          this.audio.playPickup();
          this.particles.emitBurst(
            new THREE.Vector3(0, 2.5, 0),
            16,
            0x10b981,
            6.0,
            1.2
          );
          this.particles.emitRing(this.generator.position, 0x10b981, 4.2, 0.5);
          this.pushNotification(
            `REPAIR KIT USED: +${repairedAmount}% GENERATOR HP`,
            'emerald'
          );
          this.emitTelemetry();
        }
      } else if (this.generator.repairCooldown > 0) {
        this.pushNotification(
          `EMERGENCY REPAIR COOLDOWN: ${Math.ceil(
            this.generator.repairCooldown
          )}s`,
          'amber'
        );
      }
    }
  }

  private applyCollectible(
    item: ReturnType<ResourceSystem['getNearestCollectible']>,
    notifyIfFull: boolean
  ): boolean {
    if (!item) return false;
    const res = this.resources.collectItem(
      item,
      this.player.health,
      this.player.maxHealth,
      this.player.reserveAmmo,
      this.player.maxReserveAmmo,
      this.player.repairKits
    );
    if (res.collected) {
      this.player.health = Math.min(
        this.player.maxHealth,
        this.player.health + res.healthDelta
      );
      this.player.reserveAmmo = Math.min(
        this.player.maxReserveAmmo,
        this.player.reserveAmmo + res.ammoDelta
      );
      this.player.repairKits += res.kitDelta;
      this.score += 50;
      this.audio.playPickup();
      this.particles.emitBurst(
        item.position,
        10,
        res.color === 'emerald'
          ? 0x10b981
          : res.color === 'amber'
            ? 0xf59e0b
            : 0x38bdf8,
        4.5,
        0.95
      );
      this.pushNotification(res.label, res.color);
      this.emitTelemetry();
      return true;
    } else if (notifyIfFull && res.label) {
      this.pushNotification(res.label, res.color);
    }
    return false;
  }

  public emitTelemetry() {
    const now = performance.now();
    this.notifications = this.notifications.filter(
      (n) => now - n.timestamp < 3200
    );

    const timeRemaining = Math.max(
      0,
      this.totalSurvivalDuration - this.activeGameplayTime
    );
    const wave = this.waves.getCurrentBracket(this.activeGameplayTime);
    const distToGen = this.player.position.distanceTo(this.generator.position);
    const canInteractGenerator =
      distToGen <= 4.6 && this.generator.canRepair(this.player.repairKits);

    const nearCollectible = this.resources.getNearestCollectible(
      this.player.position,
      2.65
    );
    const nearbyCollectibleLabel = nearCollectible
      ? nearCollectible.type === 'HEALTH_PACK'
        ? 'COLLECT HEALTH PACK (+35 HP)'
        : nearCollectible.type === 'ENERGY_CELL'
          ? 'COLLECT ENERGY CELL (+24 AMMO)'
          : 'COLLECT REPAIR KIT (+1 CHARGE)'
      : null;

    const reloadProgress = this.player.isReloading
      ? 1 - this.player.reloadTimer / this.player.reloadDuration
      : 1;

    const renderInfo = this.renderer.info.render;

    this.onTelemetryUpdate({
      gameState: this.gameState,
      timeRemaining,
      waveNumber: wave.waveNumber,
      waveLabel: wave.label,
      threatLevel: wave.threat,
      playerHealth: Math.ceil(this.player.health),
      playerMaxHealth: this.player.maxHealth,
      playerStamina: Math.round(this.player.stamina),
      playerMaxStamina: this.player.maxStamina,
      staminaExhausted: this.player.staminaExhausted,
      ammo: this.player.ammo,
      maxMagazine: this.player.maxMagazine,
      reserveAmmo: this.player.reserveAmmo,
      isReloading: this.player.isReloading,
      reloadProgress,
      weaponCooldown: this.player.weaponCooldown,
      repairKits: this.player.repairKits,
      generatorHealth: Math.ceil(this.generator.health),
      generatorMaxHealth: this.generator.maxHealth,
      generatorRepairCooldown: Math.ceil(this.generator.repairCooldown),
      generatorRepairProgress: this.generator.getEmergencyRepairProgress(),
      isEmergencyRepairing: this.generator.isEmergencyRepairing,
      generatorUnderAttack: this.generator.underAttackTimer > 0,
      canInteractGenerator,
      nearbyCollectibleLabel,
      kills: this.kills,
      score: this.score,
      defeatReason: this.defeatReason,
      damageFlash: this.player.damageFlash,
      isSprinting: this.player.isSprinting,
      dodgeCooldownRatio:
        1 -
        Math.min(
          1,
          this.player.dodgeCooldown / this.player.dodgeMaxCooldown
        ),
      reticleTargetLocked:
        this.gameState === 'PLAYING'
          ? this.combat.hasTargetNearReticle(
              this.cameraCtrl.camera,
              this.enemies.enemies
            )
          : false,
      notifications: this.notifications,
      perf: {
        fps: Math.round(this.smoothedFps),
        frameTimeMs: Number(this.smoothedFrameTimeMs.toFixed(1)),
        activeEnemies: this.enemies.getActiveCount(),
        activeParticles: this.particles.getActiveCount(),
        drawCalls: renderInfo.calls,
        triangles: renderInfo.triangles,
        preset: this.settings.graphicsQuality,
        targetFps: this.getTargetFps(this.settings.graphicsQuality),
        renderScale: Math.round(
          this.getRenderScale(this.settings.graphicsQuality) * 100
        ),
      },
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    this.input.detach();
    this.audio.dispose();
    this.world.dispose();
    this.enemies.dispose();
    this.particles.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

import * as THREE from 'three';

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'DEFEAT';
export type ModalView = 'NONE' | 'HOW_TO_PLAY' | 'SETTINGS';
export type QualityPreset = 'LOW' | 'MEDIUM' | 'HIGH';
export type EnemyType = 'RUNNER' | 'BRUTE' | 'STALKER';
export type CollectibleType = 'HEALTH_PACK' | 'ENERGY_CELL' | 'REPAIR_KIT';

export type ThreatLevel =
  | 'LOW'
  | 'MODERATE'
  | 'ELEVATED'
  | 'HIGH'
  | 'SEVERE'
  | 'CRITICAL'
  | 'EXTREME';

export interface GameSettings {
  mouseSensitivity: number;
  touchSensitivity: number;
  cameraSensitivity: number;
  soundVolume: number;
  muted: boolean;
  graphicsQuality: QualityPreset;
  showPerfOverlay: boolean;
}

export interface PerfMetrics {
  fps: number;
  frameTimeMs: number;
  activeEnemies: number;
  activeParticles: number;
  drawCalls: number;
  triangles: number;
  preset: QualityPreset;
  targetFps: number;
  renderScale: number;
}

export interface ObstacleAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  blocksCamera: boolean;
}

export interface NotificationItem {
  id: number;
  text: string;
  color: 'cyan' | 'amber' | 'emerald' | 'crimson';
  timestamp: number;
}

export interface HUDTelemetry {
  gameState: GameState;
  timeRemaining: number; // Starts at 420.0 seconds
  waveNumber: number; // 1..7
  waveLabel: string;
  threatLevel: ThreatLevel;
  playerHealth: number;
  playerMaxHealth: number;
  playerStamina: number;
  playerMaxStamina: number;
  staminaExhausted: boolean;
  ammo: number;
  maxMagazine: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  weaponCooldown: number;
  repairKits: number;
  generatorHealth: number;
  generatorMaxHealth: number;
  generatorRepairCooldown: number;
  generatorRepairProgress: number; // 0..1 during 2-second emergency repair hold
  isEmergencyRepairing: boolean;
  generatorUnderAttack: boolean;
  canInteractGenerator: boolean;
  nearbyCollectibleLabel: string | null;
  kills: number;
  score: number;
  defeatReason: 'PLAYER_DIED' | 'GENERATOR_DESTROYED' | null;
  damageFlash: number;
  isSprinting: boolean;
  dodgeCooldownRatio: number;
  reticleTargetLocked: boolean;
  notifications: NotificationItem[];
  perf: PerfMetrics;
}

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  active: boolean;
  group: THREE.Group;
  torsoMesh: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  headMesh: THREE.Object3D;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  health: number;
  maxHealth: number;
  speed: number;
  radius: number;
  damage: number;
  generatorDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  windupTimer: number;
  hitFlashTimer: number;
  aiTickTimer: number;
  targetType: 'PLAYER' | 'GENERATOR';
  flankSign: number;
  circleTimer: number;
  isCircling: boolean;
  animPhase: number;
}

export interface CollectibleItem {
  id: number;
  type: CollectibleType;
  active: boolean;
  respawnTimer: number;
  position: THREE.Vector3;
  group: THREE.Group;
  ringMesh: THREE.Mesh;
  beaconMesh: THREE.Mesh;
  phase: number;
}

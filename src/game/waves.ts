import { EnemyType, QualityPreset, ThreatLevel } from './types';

export interface WaveBracket {
  waveNumber: number;
  label: string;
  threat: ThreatLevel;
  spawnInterval: number;
  runnerWeight: number;
  bruteWeight: number;
  stalkerWeight: number;
  batchSize: number;
  aggressionMultiplier: number;
}

const WAVE_BRACKETS: WaveBracket[] = [
  // Phase 1: 7:00 - 6:00 (0s - 60s) — Initial Runner scouts
  {
    waveNumber: 1,
    label: 'INITIAL CONTACT',
    threat: 'LOW',
    spawnInterval: 3.3,
    runnerWeight: 1.0,
    bruteWeight: 0.0,
    stalkerWeight: 0.0,
    batchSize: 1,
    aggressionMultiplier: 1.0,
  },
  // Phase 2: 6:00 - 5:00 (60s - 120s) — Runners + agile Stalkers introduced
  {
    waveNumber: 2,
    label: 'STALKER PROWL',
    threat: 'MODERATE',
    spawnInterval: 2.65,
    runnerWeight: 0.72,
    bruteWeight: 0.0,
    stalkerWeight: 0.28,
    batchSize: 1,
    aggressionMultiplier: 1.04,
  },
  // Phase 3: 5:00 - 4:00 (120s - 180s) — Five-Minute Mark: Heavy Brutes introduced!
  {
    waveNumber: 3,
    label: 'HEAVY BREACH — BRUTES',
    threat: 'ELEVATED',
    spawnInterval: 2.35,
    runnerWeight: 0.54,
    bruteWeight: 0.22,
    stalkerWeight: 0.24,
    batchSize: 1,
    aggressionMultiplier: 1.08,
  },
  // Phase 4: 4:00 - 3:00 (180s - 240s) — Increased spawn frequency
  {
    waveNumber: 4,
    label: 'ESCALATING HORDE',
    threat: 'HIGH',
    spawnInterval: 1.95,
    runnerWeight: 0.5,
    bruteWeight: 0.22,
    stalkerWeight: 0.28,
    batchSize: 1,
    aggressionMultiplier: 1.12,
  },
  // Phase 5: 3:00 - 2:00 (240s - 300s) — Mixed enemy packs
  {
    waveNumber: 5,
    label: 'CONVERGING PACKS',
    threat: 'SEVERE',
    spawnInterval: 1.75,
    runnerWeight: 0.45,
    bruteWeight: 0.25,
    stalkerWeight: 0.3,
    batchSize: 2,
    aggressionMultiplier: 1.16,
  },
  // Phase 6: 2:00 - 1:00 (300s - 360s) — Final Two Minutes: Dangerous mixed squads
  {
    waveNumber: 6,
    label: 'RELENTLESS SIEGE',
    threat: 'CRITICAL',
    spawnInterval: 1.45,
    runnerWeight: 0.42,
    bruteWeight: 0.28,
    stalkerWeight: 0.3,
    batchSize: 2,
    aggressionMultiplier: 1.22,
  },
  // Phase 7: 1:00 - 0:00 (360s - 420s) — Final Minute Survival Assault (High Intensity)
  {
    waveNumber: 7,
    label: 'FINAL SURVIVAL ASSAULT',
    threat: 'EXTREME',
    spawnInterval: 1.08,
    runnerWeight: 0.4,
    bruteWeight: 0.32,
    stalkerWeight: 0.28,
    batchSize: 2,
    aggressionMultiplier: 1.28,
  },
];

export class WaveDirector {
  private spawnTimer = 1.2;
  private lastAnnouncedWave = 1;

  public reset() {
    this.spawnTimer = 1.2;
    this.lastAnnouncedWave = 1;
  }

  public getCurrentBracket(activeGameplaySeconds: number): WaveBracket {
    const idx = Math.min(
      WAVE_BRACKETS.length - 1,
      Math.max(0, Math.floor(activeGameplaySeconds / 60))
    );
    return WAVE_BRACKETS[idx];
  }

  /**
   * Enforces preset-specific maximum active enemy caps:
   * - LOW: 8 to 10 active enemies
   * - MEDIUM: 14 to 18 active enemies
   * - HIGH: 22 to 25 active enemies
   */
  public getMaxActiveEnemies(
    quality: QualityPreset,
    activeGameplaySeconds: number
  ): number {
    const progress = Math.min(1, Math.max(0, activeGameplaySeconds / 360));
    if (quality === 'LOW') {
      return Math.round(8 + progress * 2); // 8..10
    }
    if (quality === 'MEDIUM') {
      return Math.round(14 + progress * 4); // 14..18
    }
    return Math.round(22 + progress * 3); // 22..25
  }

  public update(
    dt: number,
    activeGameplaySeconds: number,
    activeEnemyCount: number,
    quality: QualityPreset,
    onSpawnEnemy: (type: EnemyType, aggressionMultiplier: number) => void,
    onWaveChanged?: (bracket: WaveBracket) => void
  ) {
    const bracket = this.getCurrentBracket(activeGameplaySeconds);
    const maxCap = this.getMaxActiveEnemies(quality, activeGameplaySeconds);

    if (bracket.waveNumber !== this.lastAnnouncedWave) {
      this.lastAnnouncedWave = bracket.waveNumber;
      onWaveChanged?.(bracket);

      // Guarantee an immediate Brute vanguard when Wave 3 (5:00 remaining) begins if under cap
      if (bracket.waveNumber === 3 && activeEnemyCount < maxCap) {
        onSpawnEnemy('BRUTE', bracket.aggressionMultiplier);
      } else if (bracket.waveNumber >= 6 && activeEnemyCount < maxCap) {
        onSpawnEnemy('BRUTE', bracket.aggressionMultiplier);
        if (activeEnemyCount + 1 < maxCap) {
          onSpawnEnemy('STALKER', bracket.aggressionMultiplier);
        }
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = bracket.spawnInterval;
      if (activeEnemyCount < maxCap) {
        const countToSpawn = Math.min(
          bracket.batchSize,
          maxCap - activeEnemyCount
        );
        for (let i = 0; i < countToSpawn; i++) {
          onSpawnEnemy(
            this.pickEnemyType(bracket),
            bracket.aggressionMultiplier
          );
        }
      }
    }
  }

  private pickEnemyType(bracket: WaveBracket): EnemyType {
    const r = Math.random();
    if (r < bracket.runnerWeight) return 'RUNNER';
    if (r < bracket.runnerWeight + bracket.bruteWeight) return 'BRUTE';
    return 'STALKER';
  }
}

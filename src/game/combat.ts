import * as THREE from 'three';
import { EnemyEntity, ObstacleAABB } from './types';

interface EnergyProjectile {
  active: boolean;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
}

const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _aimPoint = new THREE.Vector3();
const _toEnemy = new THREE.Vector3();
const _stepVec = new THREE.Vector3();
const _forwardNegZ = new THREE.Vector3(0, 0, -1);
const _projDir = new THREE.Vector3();

export class CombatSystem {
  private projectiles: EnergyProjectile[] = [];
  private impactLight: THREE.PointLight;
  private impactLightTimer = 0;
  private raycaster = new THREE.Raycaster();
  private screenCenter = new THREE.Vector2(0, 0);

  constructor(scene: THREE.Scene, poolSize = 28) {
    // Oriented along -Z/+Z axis so quaternion from (0, 0, -1) aligns projectile along trajectory
    const coreGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.72, 6);
    coreGeo.rotateX(Math.PI / 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
    });

    const trailGeo = new THREE.ConeGeometry(0.085, 1.55, 6);
    trailGeo.rotateX(-Math.PI / 2);
    trailGeo.translate(0, 0, 0.45);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.65,
    });

    for (let i = 0; i < poolSize; i++) {
      const boltGroup = new THREE.Group();
      boltGroup.add(new THREE.Mesh(coreGeo, coreMat));
      boltGroup.add(new THREE.Mesh(trailGeo, trailMat));
      boltGroup.visible = false;
      scene.add(boltGroup);
      this.projectiles.push({
        active: false,
        mesh: boltGroup,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        life: 0,
        damage: 25,
      });
    }

    // Subtle pooled impact flash light
    this.impactLight = new THREE.PointLight(0x38bdf8, 0, 6.5, 2);
    scene.add(this.impactLight);
  }

  public reset() {
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].active = false;
      this.projectiles[i].mesh.visible = false;
    }
    this.impactLight.intensity = 0;
    this.impactLightTimer = 0;
  }

  private triggerImpactFlash(pos: THREE.Vector3) {
    this.impactLight.position.copy(pos);
    this.impactLight.intensity = 2.6;
    this.impactLightTimer = 0.08;
  }

  /**
   * Computes the 3D world aim point and locked enemy (if any) along the camera's
   * center reticle ray so weapon orientation, muzzle flash, projectiles, and hit
   * detection all agree on the exact same shooting vector.
   */
  public computeAimTarget(
    camera: THREE.Camera,
    playerPos: THREE.Vector3,
    enemies: EnemyEntity[],
    outAimPoint: THREE.Vector3
  ): EnemyEntity | null {
    this.raycaster.setFromCamera(this.screenCenter, camera);
    _rayOrigin.copy(this.raycaster.ray.origin);
    _rayDir.copy(this.raycaster.ray.direction);

    const minForwardProj = Math.max(
      2.2,
      _rayOrigin.distanceTo(playerPos) + 0.35
    );

    let bestEnemy: EnemyEntity | null = null;
    let bestDist = 42;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || e.health <= 0) continue;

      const targetCenterY = e.type === 'BRUTE' ? 1.35 : 0.95;
      _toEnemy
        .set(e.position.x, e.position.y + targetCenterY, e.position.z)
        .sub(_rayOrigin);
      const proj = _toEnemy.dot(_rayDir);
      if (proj < minForwardProj || proj > bestDist) continue;

      const perpSq = Math.max(0, _toEnemy.lengthSq() - proj * proj);
      const assistRadius = e.radius + 0.68;
      if (perpSq <= assistRadius * assistRadius) {
        bestDist = proj;
        bestEnemy = e;
        outAimPoint.set(
          e.position.x,
          e.position.y + targetCenterY,
          e.position.z
        );
      }
    }

    if (bestEnemy) {
      return bestEnemy;
    }

    let rayLength = 36;
    if (_rayDir.y < -0.02) {
      const tGround = (0.15 - _rayOrigin.y) / _rayDir.y;
      if (tGround > minForwardProj && tGround < rayLength) {
        rayLength = tGround;
      }
    }

    outAimPoint.copy(_rayOrigin).addScaledVector(_rayDir, rayLength);
    if (outAimPoint.y < 0.15) {
      outAimPoint.y = 0.15;
    }
    return null;
  }

  public hasTargetNearReticle(
    camera: THREE.Camera,
    enemies: EnemyEntity[]
  ): boolean {
    this.raycaster.setFromCamera(this.screenCenter, camera);
    _rayOrigin.copy(this.raycaster.ray.origin);
    _rayDir.copy(this.raycaster.ray.direction);

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || e.health <= 0) continue;
      _toEnemy
        .set(e.position.x, e.position.y + 1.0, e.position.z)
        .sub(_rayOrigin);
      const dist = _toEnemy.length();
      if (dist > 38) continue;
      const proj = _toEnemy.dot(_rayDir);
      if (proj < 2.2) continue;
      const perpSq = Math.max(0, _toEnemy.lengthSq() - proj * proj);
      if (perpSq <= (e.radius + 0.68) * (e.radius + 0.68)) {
        return true;
      }
    }
    return false;
  }

  public fireWeapon(
    muzzlePos: THREE.Vector3,
    camera: THREE.Camera,
    enemies: EnemyEntity[],
    onHitEnemy: (
      enemy: EnemyEntity,
      hitPos: THREE.Vector3,
      damage: number
    ) => void,
    onImpactEnv?: (hitPos: THREE.Vector3) => void,
    precomputedAimPoint?: THREE.Vector3,
    precomputedEnemy?: EnemyEntity | null,
    muzzleDir?: THREE.Vector3
  ) {
    let bestEnemy: EnemyEntity | null = null;
    if (precomputedAimPoint) {
      _aimPoint.copy(precomputedAimPoint);
      bestEnemy = precomputedEnemy ?? null;
    } else {
      bestEnemy = this.computeAimTarget(
        camera,
        muzzlePos,
        enemies,
        _aimPoint
      );
    }

    if (muzzleDir && muzzleDir.lengthSq() > 0.5) {
      _projDir.copy(muzzleDir).normalize();
    } else {
      _projDir.copy(_aimPoint).sub(muzzlePos).normalize();
    }

    const distToAim = muzzlePos.distanceTo(_aimPoint);

    const slot = this.projectiles.find((p) => !p.active);
    if (slot) {
      slot.active = true;
      slot.position.copy(muzzlePos);
      slot.velocity.copy(_projDir).multiplyScalar(48);
      slot.life = 0.65;
      slot.damage = 26;
      slot.mesh.position.copy(muzzlePos);
      slot.mesh.quaternion.setFromUnitVectors(_forwardNegZ, _projDir);
      slot.mesh.visible = true;
    }

    if (bestEnemy && distToAim < 28) {
      const hitPos = _aimPoint.clone();
      this.triggerImpactFlash(hitPos);
      onHitEnemy(bestEnemy, hitPos, 26);
      if (slot) {
        slot.life = Math.min(0.18, distToAim / 48);
        slot.damage = 0;
      }
    } else if (!bestEnemy && onImpactEnv && _aimPoint.y <= 0.22 && distToAim < 32) {
      const hitPos = _aimPoint.clone();
      this.triggerImpactFlash(hitPos);
      onImpactEnv(hitPos);
    }
  }

  public update(
    dt: number,
    enemies: EnemyEntity[],
    obstacles: ObstacleAABB[],
    onHitEnemy: (
      enemy: EnemyEntity,
      hitPos: THREE.Vector3,
      damage: number
    ) => void,
    onImpactEnv?: (hitPos: THREE.Vector3) => void
  ) {
    if (this.impactLightTimer > 0) {
      this.impactLightTimer -= dt;
      if (this.impactLightTimer <= 0) {
        this.impactLight.intensity = 0;
      }
    }

    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      _stepVec.copy(p.velocity).multiplyScalar(dt);
      p.position.add(_stepVec);
      p.mesh.position.copy(p.position);

      let hitWall = false;
      for (let o = 0; o < obstacles.length; o++) {
        const b = obstacles[o];
        if (
          p.position.x >= b.minX &&
          p.position.x <= b.maxX &&
          p.position.z >= b.minZ &&
          p.position.z <= b.maxZ &&
          p.position.y <= b.height
        ) {
          hitWall = true;
          break;
        }
      }

      if (hitWall || p.position.y <= 0.08) {
        this.triggerImpactFlash(p.position);
        onImpactEnv?.(p.position);
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      if (p.damage > 0) {
        for (let eIdx = 0; eIdx < enemies.length; eIdx++) {
          const e = enemies[eIdx];
          if (!e.active || e.health <= 0) continue;
          const enemyHeight = e.type === 'BRUTE' ? 2.5 : 1.95;
          if (p.position.y < -0.1 || p.position.y > enemyHeight) continue;

          const dx = p.position.x - e.position.x;
          const dz = p.position.z - e.position.z;
          const hitR = e.radius + 0.38;
          if (dx * dx + dz * dz <= hitR * hitR) {
            const hitPos = p.position.clone();
            this.triggerImpactFlash(hitPos);
            onHitEnemy(e, hitPos, p.damage);
            p.active = false;
            p.mesh.visible = false;
            break;
          }
        }
      }
    }
  }
}

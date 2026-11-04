import * as THREE from 'three';
import { EnemyEntity, EnemyType, ObstacleAABB, QualityPreset } from './types';

const _toTarget = new THREE.Vector3();
const _sepForce = new THREE.Vector3();
const _perpDir = new THREE.Vector3();

export class EnemySystem {
  public enemies: EnemyEntity[] = [];
  private scene: THREE.Scene;
  private nextId = 1;

  // Shared Reusable Geometries (allocated once, shared across all pooled enemies)
  private unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  private unitCone4Geo = new THREE.ConeGeometry(1, 1, 4);
  private unitCone5Geo = new THREE.ConeGeometry(1, 1, 5);
  private forwardCone4Geo: THREE.ConeGeometry;
  private shadowCircleGeo: THREE.CircleGeometry;
  private octCoreGeo = new THREE.OctahedronGeometry(1, 0);

  // Shared PBR Materials per Enemy Archetype
  private runnerBodyMat = new THREE.MeshStandardMaterial({
    color: 0x8f1d24,
    roughness: 0.62,
    metalness: 0.18,
  });
  private runnerCarapaceMat = new THREE.MeshStandardMaterial({
    color: 0x451219,
    roughness: 0.48,
    metalness: 0.35,
  });
  private bruteBodyMat = new THREE.MeshStandardMaterial({
    color: 0x3b2a54,
    roughness: 0.48,
    metalness: 0.42,
  });
  private bruteArmorMat = new THREE.MeshStandardMaterial({
    color: 0x1f172e,
    roughness: 0.32,
    metalness: 0.78,
  });
  private stalkerBodyMat = new THREE.MeshStandardMaterial({
    color: 0x183446,
    roughness: 0.42,
    metalness: 0.52,
  });
  private stalkerChitinMat = new THREE.MeshStandardMaterial({
    color: 0x0f2230,
    roughness: 0.3,
    metalness: 0.68,
  });
  private darkLimbMat = new THREE.MeshStandardMaterial({
    color: 0x171824,
    roughness: 0.76,
    metalness: 0.2,
  });
  private crimsonGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff5252,
    emissive: 0xef4444,
    emissiveIntensity: 2.5,
  });
  private amberGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.7,
  });
  private violetGlowMat = new THREE.MeshStandardMaterial({
    color: 0xd8b4fe,
    emissive: 0xa855f7,
    emissiveIntensity: 2.6,
  });
  private shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  private hitFlashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.forwardCone4Geo = new THREE.ConeGeometry(1, 1, 4);
    this.forwardCone4Geo.rotateX(-Math.PI / 2);

    this.shadowCircleGeo = new THREE.CircleGeometry(1, 12);
    this.shadowCircleGeo.rotateX(-Math.PI / 2);
  }

  public reset() {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      e.active = false;
      e.group.visible = false;
      (e.headMesh as THREE.Mesh).material = this.darkLimbMat;
      (e.torsoMesh as THREE.Mesh).material = this.getArchetypeBodyMaterial(
        e.type
      );
    }
  }

  public getActiveCount(): number {
    let count = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].active) count++;
    }
    return count;
  }

  public spawnEnemy(
    type: EnemyType,
    playerPos: THREE.Vector3,
    aggressionMultiplier = 1.0
  ) {
    // Pick a spawn position along the settlement perimeter strictly outside immediate player proximity
    let spawnX = 0;
    let spawnZ = 0;
    for (let attempt = 0; attempt < 14; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30.5 + Math.random() * 3.5;
      spawnX = Math.cos(angle) * dist;
      spawnZ = Math.sin(angle) * dist;
      const dToPlayer = Math.hypot(spawnX - playerPos.x, spawnZ - playerPos.z);
      if (dToPlayer >= 16.5) break;
    }

    // Configure stats by archetype + progressive wave aggression scaling
    const speedScale = 1 + (aggressionMultiplier - 1) * 0.65;
    let maxHealth = Math.round(45 * aggressionMultiplier);
    let speed = 5.2 * speedScale;
    let radius = 0.52;
    let damage = 9;
    let generatorDamage = 6;
    let attackRange = 1.65;
    let attackCooldown = 1.05;
    let targetType: 'PLAYER' | 'GENERATOR' =
      Math.random() < 0.55 ? 'PLAYER' : 'GENERATOR';

    if (type === 'BRUTE') {
      maxHealth = Math.round(155 * aggressionMultiplier);
      speed = 2.55 * speedScale;
      radius = 0.95;
      damage = 22;
      generatorDamage = 18;
      attackRange = 2.45;
      attackCooldown = 1.95;
      targetType = 'GENERATOR';
    } else if (type === 'STALKER') {
      maxHealth = Math.round(80 * aggressionMultiplier);
      speed = 4.55 * speedScale;
      radius = 0.6;
      damage = 13;
      generatorDamage = 9;
      attackRange = 1.85;
      attackCooldown = 1.05;
      targetType = Math.random() < 0.72 ? 'PLAYER' : 'GENERATOR';
    }

    // Reuse an inactive pooled EnemyEntity of the same type if available
    let entity = this.enemies.find((e) => !e.active && e.type === type);
    if (entity) {
      entity.active = true;
      entity.position.set(spawnX, 0, spawnZ);
      entity.velocity.set(0, 0, 0);
      entity.health = maxHealth;
      entity.maxHealth = maxHealth;
      entity.speed = speed;
      entity.radius = radius;
      entity.damage = damage;
      entity.generatorDamage = generatorDamage;
      entity.attackRange = attackRange;
      entity.attackCooldown = attackCooldown;
      entity.attackTimer = 0.35;
      entity.windupTimer = 0;
      entity.hitFlashTimer = 0;
      entity.aiTickTimer = Math.random() * 0.12;
      entity.targetType = targetType;
      entity.flankSign = Math.random() < 0.5 ? 1 : -1;
      entity.circleTimer = 1.5 + Math.random() * 2.5;
      entity.isCircling = type === 'STALKER' && Math.random() < 0.5;
      entity.animPhase = Math.random() * Math.PI * 2;
      (entity.headMesh as THREE.Mesh).material = this.darkLimbMat;
      (entity.torsoMesh as THREE.Mesh).material =
        this.getArchetypeBodyMaterial(type);
      entity.group.position.set(spawnX, 0, spawnZ);
      entity.group.visible = true;
      return;
    }

    const built = this.createEnemyMesh(type);
    built.group.position.set(spawnX, 0, spawnZ);
    this.scene.add(built.group);

    entity = {
      id: this.nextId++,
      type,
      active: true,
      group: built.group,
      torsoMesh: built.torso,
      leftLeg: built.leftLeg,
      rightLeg: built.rightLeg,
      leftArm: built.leftArm,
      rightArm: built.rightArm,
      headMesh: built.headMesh,
      position: new THREE.Vector3(spawnX, 0, spawnZ),
      velocity: new THREE.Vector3(),
      health: maxHealth,
      maxHealth,
      speed,
      radius,
      damage,
      generatorDamage,
      attackRange,
      attackCooldown,
      attackTimer: 0.35,
      windupTimer: 0,
      hitFlashTimer: 0,
      aiTickTimer: Math.random() * 0.12,
      targetType,
      flankSign: Math.random() < 0.5 ? 1 : -1,
      circleTimer: 1.5 + Math.random() * 2.5,
      isCircling: type === 'STALKER' && Math.random() < 0.5,
      animPhase: Math.random() * Math.PI * 2,
    };

    this.enemies.push(entity);
  }

  private getArchetypeBodyMaterial(type: EnemyType): THREE.Material {
    if (type === 'BRUTE') return this.bruteBodyMat;
    if (type === 'STALKER') return this.stalkerBodyMat;
    return this.runnerBodyMat;
  }

  private createEnemyMesh(type: EnemyType) {
    const group = new THREE.Group();
    const scale = type === 'BRUTE' ? 1.54 : type === 'STALKER' ? 1.12 : 0.92;
    group.scale.setScalar(scale);

    const bodyMat = this.getArchetypeBodyMaterial(type);
    const glowMat =
      type === 'BRUTE'
        ? this.amberGlowMat
        : type === 'STALKER'
          ? this.violetGlowMat
          : this.crimsonGlowMat;

    // Ground Contact Shadow
    const shadow = new THREE.Mesh(this.shadowCircleGeo, this.shadowMat);
    const sRad = type === 'BRUTE' ? 0.72 : 0.54;
    shadow.scale.set(sRad, 1, sRad);
    shadow.position.y = 0.02;
    group.add(shadow);

    // Sculpted Upper Torso & Tapered Waist
    const torsoW = type === 'BRUTE' ? 0.88 : type === 'STALKER' ? 0.48 : 0.44;
    const torsoH = type === 'BRUTE' ? 0.86 : type === 'STALKER' ? 0.62 : 0.58;
    const torsoD = type === 'BRUTE' ? 0.58 : type === 'STALKER' ? 0.3 : 0.32;

    const torso = new THREE.Mesh(this.unitBoxGeo, bodyMat);
    torso.scale.set(torsoW, torsoH, torsoD);
    torso.position.y = 1.04;
    torso.castShadow = true;
    group.add(torso);

    // Child details container attached to torso (undoes torso non-uniform scale so children keep exact proportions)
    const torsoDetails = new THREE.Group();
    torsoDetails.scale.set(1 / torsoW, 1 / torsoH, 1 / torsoD);
    torso.add(torsoDetails);

    const waist = new THREE.Mesh(this.unitBoxGeo, this.darkLimbMat);
    waist.scale.set(torsoW * 0.74, 0.24, torsoD * 0.8);
    waist.position.set(0, -torsoH * 0.54, 0.02);
    torsoDetails.add(waist);

    // Glowing Infection Core on Chest
    const core = new THREE.Mesh(this.octCoreGeo, glowMat);
    const coreRad = type === 'BRUTE' ? 0.29 : 0.18;
    core.scale.setScalar(coreRad);
    core.position.set(0, 0.06, -torsoD * 0.5);
    torsoDetails.add(core);

    if (type === 'BRUTE') {
      const hump = new THREE.Mesh(this.unitBoxGeo, this.bruteArmorMat);
      hump.scale.set(0.76, 0.48, 0.42);
      hump.position.set(0, 0.26, 0.16);
      hump.rotation.x = 0.28;
      torsoDetails.add(hump);

      for (const side of [-1, 1]) {
        const pauldron = new THREE.Mesh(this.unitBoxGeo, this.bruteArmorMat);
        pauldron.scale.set(0.38, 0.34, 0.64);
        pauldron.position.set(side * (torsoW * 0.58), 0.32, 0);
        pauldron.rotation.z = side * -0.24;
        torsoDetails.add(pauldron);

        const horn = new THREE.Mesh(this.unitCone5Geo, glowMat);
        horn.scale.set(0.12, 0.46, 0.12);
        horn.position.set(side * (torsoW * 0.56), 0.58, 0.06);
        horn.rotation.z = side * -0.36;
        torsoDetails.add(horn);

        const chestPlate = new THREE.Mesh(this.unitBoxGeo, this.bruteArmorMat);
        chestPlate.scale.set(0.24, 0.18, 0.08);
        chestPlate.position.set(side * 0.26, 0.18, -torsoD * 0.5);
        chestPlate.rotation.z = side * 0.2;
        torsoDetails.add(chestPlate);
      }
    } else if (type === 'STALKER') {
      for (const side of [-0.15, 0.15]) {
        const fin = new THREE.Mesh(this.unitCone4Geo, glowMat);
        fin.scale.set(0.085, 0.58, 0.085);
        fin.position.set(side, 0.24, 0.22);
        fin.rotation.x = 0.76;
        fin.rotation.z = side * -0.85;
        torsoDetails.add(fin);

        const lowerFin = new THREE.Mesh(this.unitCone4Geo, glowMat);
        lowerFin.scale.set(0.065, 0.38, 0.065);
        lowerFin.position.set(side * 0.85, -0.05, 0.22);
        lowerFin.rotation.x = 0.88;
        lowerFin.rotation.z = side * -0.6;
        torsoDetails.add(lowerFin);
      }

      const chitinCollar = new THREE.Mesh(
        this.unitBoxGeo,
        this.stalkerChitinMat
      );
      chitinCollar.scale.set(0.58, 0.16, 0.34);
      chitinCollar.position.set(0, 0.26, -0.02);
      torsoDetails.add(chitinCollar);
    } else {
      for (let s = 0; s < 3; s++) {
        const spine = new THREE.Mesh(
          this.unitCone5Geo,
          s === 0 ? glowMat : this.runnerCarapaceMat
        );
        const r = 0.085 - s * 0.015;
        spine.scale.set(r, 0.38 - s * 0.06, r);
        spine.position.set(0, 0.26 - s * 0.18, 0.2);
        spine.rotation.x = 0.68;
        torsoDetails.add(spine);
      }

      for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(this.unitBoxGeo, this.runnerCarapaceMat);
        rib.scale.set(0.14, 0.07, 0.34);
        rib.position.set(side * 0.18, 0.08, -0.02);
        torsoDetails.add(rib);
      }
    }

    // Sculpted Head + Mandibles/Crest + Glowing Eyes
    const headGroup = new THREE.Group();
    headGroup.position.set(
      0,
      type === 'BRUTE' ? 1.56 : 1.52,
      type === 'STALKER' ? -0.15 : type === 'RUNNER' ? -0.12 : -0.08
    );
    const head = new THREE.Mesh(this.unitBoxGeo, this.darkLimbMat);
    head.scale.set(
      type === 'BRUTE' ? 0.44 : type === 'STALKER' ? 0.3 : 0.32,
      type === 'BRUTE' ? 0.36 : 0.3,
      type === 'STALKER' ? 0.44 : 0.36
    );
    headGroup.add(head);

    if (type === 'STALKER') {
      const crest = new THREE.Mesh(this.unitCone4Geo, this.stalkerChitinMat);
      crest.scale.set(0.14, 0.45, 0.14);
      crest.position.set(0, 0.14, 0.18);
      crest.rotation.x = 1.15;
      headGroup.add(crest);
    } else if (type === 'BRUTE') {
      const jaw = new THREE.Mesh(this.unitBoxGeo, this.bruteArmorMat);
      jaw.scale.set(0.48, 0.16, 0.38);
      jaw.position.set(0, -0.12, -0.04);
      headGroup.add(jaw);
    }

    const eyeBar = new THREE.Mesh(this.unitBoxGeo, glowMat);
    eyeBar.scale.set(type === 'BRUTE' ? 0.34 : 0.26, 0.08, 0.06);
    eyeBar.position.set(0, 0.03, type === 'STALKER' ? -0.21 : -0.18);
    headGroup.add(eyeBar);
    group.add(headGroup);

    // Articulated Legs
    const buildEnemyLeg = (isLeft: boolean) => {
      const legPivot = new THREE.Group();
      legPivot.position.set((isLeft ? -1 : 1) * torsoW * 0.28, 0.68, 0);

      const legW = type === 'BRUTE' ? 0.25 : 0.17;
      const upperLeg = new THREE.Mesh(this.unitBoxGeo, this.darkLimbMat);
      upperLeg.scale.set(legW, 0.38, legW);
      upperLeg.position.set(0, -0.18, -0.03);
      upperLeg.rotation.x = -0.15;
      legPivot.add(upperLeg);

      const lowerLeg = new THREE.Mesh(this.unitBoxGeo, bodyMat);
      lowerLeg.scale.set(legW * 0.85, 0.38, legW * 0.88);
      lowerLeg.position.set(0, -0.49, 0.03);
      lowerLeg.rotation.x = 0.18;
      legPivot.add(lowerLeg);

      return legPivot;
    };

    const leftLeg = buildEnemyLeg(true);
    group.add(leftLeg);

    const rightLeg = buildEnemyLeg(false);
    group.add(rightLeg);

    // Articulated Arms
    const armW = type === 'BRUTE' ? 0.28 : 0.15;
    const leftArm = new THREE.Group();
    leftArm.position.set(-(torsoW * 0.5 + armW * 0.55), 1.3, 0);
    const lArmMesh = new THREE.Mesh(this.unitBoxGeo, bodyMat);
    lArmMesh.scale.set(armW, 0.62, armW);
    lArmMesh.position.y = -0.27;
    leftArm.add(lArmMesh);

    const rightArm = new THREE.Group();
    rightArm.position.set(torsoW * 0.5 + armW * 0.55, 1.3, 0);
    const rArmMesh = new THREE.Mesh(this.unitBoxGeo, bodyMat);
    rArmMesh.scale.set(armW, 0.62, armW);
    rArmMesh.position.y = -0.27;
    rightArm.add(rArmMesh);

    if (type === 'BRUTE') {
      for (const arm of [leftArm, rightArm]) {
        const fist = new THREE.Mesh(this.unitBoxGeo, this.bruteArmorMat);
        fist.scale.set(0.38, 0.3, 0.38);
        fist.position.set(0, -0.58, -0.05);
        arm.add(fist);

        const knuckle = new THREE.Mesh(this.unitBoxGeo, glowMat);
        knuckle.scale.set(0.39, 0.08, 0.12);
        knuckle.position.set(0, -0.64, -0.2);
        arm.add(knuckle);
      }
    } else if (type === 'STALKER') {
      for (const arm of [leftArm, rightArm]) {
        const blade = new THREE.Mesh(this.forwardCone4Geo, glowMat);
        blade.scale.set(0.075, 0.075, 0.56);
        blade.position.set(0, -0.52, -0.24);
        arm.add(blade);
      }
    } else {
      for (const arm of [leftArm, rightArm]) {
        const claw = new THREE.Mesh(this.forwardCone4Geo, glowMat);
        claw.scale.set(0.045, 0.045, 0.28);
        claw.position.set(0, -0.55, -0.14);
        arm.add(claw);
      }
    }

    group.add(leftArm);
    group.add(rightArm);

    return {
      group,
      torso,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      headMesh: head,
    };
  }

  public damageEnemy(
    enemy: EnemyEntity,
    damage: number,
    attackerPos: THREE.Vector3
  ): boolean {
    if (!enemy.active || enemy.health <= 0) return false;
    enemy.health -= damage;
    enemy.hitFlashTimer = 0.1;
    (enemy.headMesh as THREE.Mesh).material = this.hitFlashMat;
    (enemy.torsoMesh as THREE.Mesh).material = this.hitFlashMat;

    _toTarget.copy(enemy.position).sub(attackerPos).setY(0);
    if (_toTarget.lengthSq() > 0.01) {
      _toTarget.normalize();
      const kb = enemy.type === 'BRUTE' ? 0.12 : 0.32;
      enemy.position.addScaledVector(_toTarget, kb);
    }

    if (enemy.position.distanceTo(attackerPos) < 16 && enemy.type !== 'BRUTE') {
      enemy.targetType = 'PLAYER';
    }

    if (enemy.health <= 0) {
      // Return defeated enemy to object pool immediately
      enemy.active = false;
      enemy.group.visible = false;
      (enemy.headMesh as THREE.Mesh).material = this.darkLimbMat;
      (enemy.torsoMesh as THREE.Mesh).material = this.getArchetypeBodyMaterial(
        enemy.type
      );
      return true;
    }
    return false;
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    generatorPos: THREE.Vector3,
    obstacles: ObstacleAABB[],
    onAttackPlayer: (
      damage: number,
      enemyType: EnemyType,
      impactPos: THREE.Vector3
    ) => void,
    onAttackGenerator: (
      damage: number,
      enemyType: EnemyType,
      impactPos: THREE.Vector3
    ) => void,
    quality: QualityPreset = 'MEDIUM'
  ) {
    const enemyCount = this.enemies.length;

    for (let i = 0; i < enemyCount; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;

      e.animPhase +=
        dt *
        (e.type === 'RUNNER' ? 12.8 : e.type === 'STALKER' ? 10.8 : 6.4);

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        if (e.hitFlashTimer <= 0) {
          (e.headMesh as THREE.Mesh).material = this.darkLimbMat;
          (e.torsoMesh as THREE.Mesh).material = this.getArchetypeBodyMaterial(
            e.type
          );
        }
      }

      if (e.attackTimer > 0) {
        e.attackTimer = Math.max(0, e.attackTimer - dt);
      }

      // Staggered AI target re-evaluation (avoids redundant distance checks every frame)
      e.aiTickTimer -= dt;
      if (e.aiTickTimer <= 0) {
        const dxP = e.position.x - playerPos.x;
        const dzP = e.position.z - playerPos.z;
        const distToPlayerSq = dxP * dxP + dzP * dzP;
        const distToGenSq =
          e.position.x * e.position.x + e.position.z * e.position.z;

        // Distant enemies (> 18m) re-evaluate AI less frequently
        e.aiTickTimer = distToPlayerSq > 324 ? 0.22 : 0.1;

        if (e.type === 'BRUTE') {
          e.targetType = distToPlayerSq < 12.96 ? 'PLAYER' : 'GENERATOR';
        } else if (e.type === 'STALKER') {
          e.targetType = distToPlayerSq < 169.0 ? 'PLAYER' : 'GENERATOR';
          e.circleTimer -= e.aiTickTimer;
          if (e.circleTimer <= 0) {
            e.circleTimer = 1.6 + Math.random() * 2.2;
            e.isCircling =
              e.targetType === 'PLAYER' &&
              distToPlayerSq > 10.24 &&
              distToPlayerSq < 90.25 &&
              Math.random() < 0.65;
            if (Math.random() < 0.35) e.flankSign *= -1;
          }
        } else {
          if (distToPlayerSq < 60.84) {
            e.targetType = 'PLAYER';
          } else if (distToGenSq < 51.84) {
            e.targetType = 'GENERATOR';
          }
        }
      }

      const targetPos = e.targetType === 'PLAYER' ? playerPos : generatorPos;
      const targetRadius = e.targetType === 'PLAYER' ? 0.55 : 2.35;

      _toTarget.copy(targetPos).sub(e.position).setY(0);
      const distToTarget = _toTarget.length();
      const effectiveRange = e.attackRange + targetRadius;

      const requiredWindup =
        e.type === 'BRUTE' ? 0.52 : e.type === 'STALKER' ? 0.14 : 0.16;

      if (distToTarget <= effectiveRange) {
        e.windupTimer += dt;
        if (e.attackTimer <= 0 && e.windupTimer >= requiredWindup) {
          e.attackTimer = e.attackCooldown;
          e.windupTimer = 0;
          if (e.targetType === 'PLAYER') {
            onAttackPlayer(e.damage, e.type, e.position);
          } else {
            onAttackGenerator(e.generatorDamage, e.type, e.position);
          }
        }
        if (distToTarget > 0.05) {
          e.group.rotation.y = Math.atan2(-_toTarget.x, -_toTarget.z);
        }
      } else {
        e.windupTimer = 0;
        if (distToTarget > 0.01) {
          _toTarget.divideScalar(distToTarget);
        }

        if (e.type === 'STALKER') {
          _perpDir.set(
            -_toTarget.z * e.flankSign,
            0,
            _toTarget.x * e.flankSign
          );
          if (
            e.isCircling &&
            e.targetType === 'PLAYER' &&
            distToTarget > 3.2 &&
            distToTarget < 9.5
          ) {
            _toTarget
              .multiplyScalar(0.38)
              .addScaledVector(_perpDir, 0.92)
              .normalize();
          } else if (distToTarget > 2.8) {
            const weave = Math.sin(e.animPhase * 0.52) * 0.72;
            _toTarget.addScaledVector(_perpDir, weave).normalize();
          }
        }

        // Fast-rejected separation steering
        _sepForce.set(0, 0, 0);
        for (let j = 0; j < enemyCount; j++) {
          if (i === j) continue;
          const other = this.enemies[j];
          if (!other.active) continue;
          const minSep = e.radius + other.radius + 0.35;
          const dx = e.position.x - other.position.x;
          if (dx >= minSep || dx <= -minSep) continue;
          const dz = e.position.z - other.position.z;
          if (dz >= minSep || dz <= -minSep) continue;

          const dSq = dx * dx + dz * dz;
          if (dSq > 1e-4 && dSq < minSep * minSep) {
            const d = Math.sqrt(dSq);
            const push = (minSep - d) / minSep;
            _sepForce.x += (dx / d) * push * 1.6;
            _sepForce.z += (dz / d) * push * 1.6;
          }
        }

        const dirX = _toTarget.x + _sepForce.x;
        const dirZ = _toTarget.z + _sepForce.z;
        const dirLen = Math.hypot(dirX, dirZ);
        if (dirLen > 1e-4) {
          e.velocity.x = (dirX / dirLen) * e.speed;
          e.velocity.z = (dirZ / dirLen) * e.speed;
        }

        e.position.x += e.velocity.x * dt;
        e.position.z += e.velocity.z * dt;
        this.resolveEnemyObstacles(e, obstacles);

        e.group.rotation.y = Math.atan2(-e.velocity.x, -e.velocity.z);
      }

      e.group.position.copy(e.position);

      // Skip detailed limb damping for very distant enemies on LOW quality
      if (quality === 'LOW' && distToTarget > 21) {
        const legSwing = Math.sin(e.animPhase) * 0.6;
        e.leftLeg.rotation.x = legSwing;
        e.rightLeg.rotation.x = -legSwing;
        continue;
      }

      const legSwing = Math.sin(e.animPhase) * 0.66;
      e.leftLeg.rotation.x = THREE.MathUtils.damp(
        e.leftLeg.rotation.x,
        legSwing,
        16,
        dt
      );
      e.rightLeg.rotation.x = THREE.MathUtils.damp(
        e.rightLeg.rotation.x,
        -legSwing,
        16,
        dt
      );

      if (e.type === 'BRUTE') {
        if (e.windupTimer > 0 && e.attackTimer <= 0.1) {
          const windupRatio = Math.min(1, e.windupTimer / requiredWindup);
          const raise = THREE.MathUtils.lerp(1.1, 2.58, windupRatio);
          e.leftArm.rotation.x = THREE.MathUtils.damp(
            e.leftArm.rotation.x,
            raise,
            18,
            dt
          );
          e.rightArm.rotation.x = THREE.MathUtils.damp(
            e.rightArm.rotation.x,
            raise,
            18,
            dt
          );
          e.leftArm.rotation.z = 0.25 * windupRatio;
          e.rightArm.rotation.z = -0.25 * windupRatio;
          e.torsoMesh.rotation.x = THREE.MathUtils.damp(
            e.torsoMesh.rotation.x,
            -0.25 * windupRatio,
            18,
            dt
          );
        } else if (e.attackTimer > e.attackCooldown * 0.65) {
          e.leftArm.rotation.x = THREE.MathUtils.damp(
            e.leftArm.rotation.x,
            0.52,
            22,
            dt
          );
          e.rightArm.rotation.x = THREE.MathUtils.damp(
            e.rightArm.rotation.x,
            0.52,
            22,
            dt
          );
          e.leftArm.rotation.z = 0;
          e.rightArm.rotation.z = 0;
          e.torsoMesh.rotation.x = THREE.MathUtils.damp(
            e.torsoMesh.rotation.x,
            0.3,
            22,
            dt
          );
        } else {
          e.leftArm.rotation.x = THREE.MathUtils.damp(
            e.leftArm.rotation.x,
            0.95 - legSwing * 0.3,
            14,
            dt
          );
          e.rightArm.rotation.x = THREE.MathUtils.damp(
            e.rightArm.rotation.x,
            0.95 + legSwing * 0.3,
            14,
            dt
          );
          e.leftArm.rotation.z = 0;
          e.rightArm.rotation.z = 0;
          e.torsoMesh.rotation.x = THREE.MathUtils.damp(
            e.torsoMesh.rotation.x,
            0.08,
            12,
            dt
          );
        }
      } else if (e.type === 'STALKER') {
        e.torsoMesh.rotation.x = THREE.MathUtils.damp(
          e.torsoMesh.rotation.x,
          0.24,
          14,
          dt
        );
        e.torsoMesh.rotation.z = Math.sin(e.animPhase * 0.5) * 0.11;
        if (e.attackTimer > e.attackCooldown * 0.6) {
          e.leftArm.rotation.x = THREE.MathUtils.damp(
            e.leftArm.rotation.x,
            2.08,
            24,
            dt
          );
          e.rightArm.rotation.x = THREE.MathUtils.damp(
            e.rightArm.rotation.x,
            2.08,
            24,
            dt
          );
          e.leftArm.rotation.z = -0.36;
          e.rightArm.rotation.z = 0.36;
        } else {
          e.leftArm.rotation.x = THREE.MathUtils.damp(
            e.leftArm.rotation.x,
            1.25 - legSwing * 0.45,
            16,
            dt
          );
          e.rightArm.rotation.x = THREE.MathUtils.damp(
            e.rightArm.rotation.x,
            1.25 + legSwing * 0.45,
            16,
            dt
          );
          e.leftArm.rotation.z = 0.18;
          e.rightArm.rotation.z = -0.18;
        }
      } else {
        e.torsoMesh.rotation.x = THREE.MathUtils.damp(
          e.torsoMesh.rotation.x,
          0.18,
          14,
          dt
        );
        if (e.attackTimer > e.attackCooldown * 0.6) {
          e.leftArm.rotation.x = THREE.MathUtils.damp(
            e.leftArm.rotation.x,
            1.88,
            24,
            dt
          );
          e.rightArm.rotation.x = THREE.MathUtils.damp(
            e.rightArm.rotation.x,
            1.88,
            24,
            dt
          );
        } else {
          e.leftArm.rotation.x = THREE.MathUtils.damp(
            e.leftArm.rotation.x,
            1.1 - legSwing * 0.36,
            16,
            dt
          );
          e.rightArm.rotation.x = THREE.MathUtils.damp(
            e.rightArm.rotation.x,
            1.1 + legSwing * 0.36,
            16,
            dt
          );
        }
      }
    }
  }

  private resolveEnemyObstacles(e: EnemyEntity, obstacles: ObstacleAABB[]) {
    const r = e.radius;
    for (let i = 0; i < obstacles.length; i++) {
      const box = obstacles[i];
      if (
        e.position.x + r < box.minX ||
        e.position.x - r > box.maxX ||
        e.position.z + r < box.minZ ||
        e.position.z - r > box.maxZ
      ) {
        continue;
      }
      const closestX = THREE.MathUtils.clamp(e.position.x, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(e.position.z, box.minZ, box.maxZ);
      const dx = e.position.x - closestX;
      const dz = e.position.z - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < r * r) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-4) {
          const overlap = r - dist;
          e.position.x += (dx / dist) * overlap;
          e.position.z += (dz / dist) * overlap;
        } else {
          e.position.x += r;
        }
      }
    }
  }

  public dispose() {
    this.unitBoxGeo.dispose();
    this.unitCone4Geo.dispose();
    this.unitCone5Geo.dispose();
    this.forwardCone4Geo.dispose();
    this.shadowCircleGeo.dispose();
    this.octCoreGeo.dispose();
    this.runnerBodyMat.dispose();
    this.runnerCarapaceMat.dispose();
    this.bruteBodyMat.dispose();
    this.bruteArmorMat.dispose();
    this.stalkerBodyMat.dispose();
    this.stalkerChitinMat.dispose();
    this.darkLimbMat.dispose();
    this.crimsonGlowMat.dispose();
    this.amberGlowMat.dispose();
    this.violetGlowMat.dispose();
    this.shadowMat.dispose();
    this.hitFlashMat.dispose();
  }
}

import * as THREE from 'three';
import { ObstacleAABB } from './types';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _originZero = new THREE.Vector3(0, 0, 0);
const _worldUp = new THREE.Vector3(0, 1, 0);
const _xAxis = new THREE.Vector3(1, 0, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _weaponWorldPos = new THREE.Vector3();
const _aimDirWorld = new THREE.Vector3(0, 0, -1);
const _lookMat = new THREE.Matrix4();
const _parentWorldQuat = new THREE.Quaternion();
const _desiredWorldQuat = new THREE.Quaternion();
const _targetLocalQuat = new THREE.Quaternion();
const _auxQuat = new THREE.Quaternion();

export class PlayerController {
  public group: THREE.Group;
  private bodyPivot: THREE.Group;
  private headGroup: THREE.Group;
  private leftLegPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private leftArmPivot: THREE.Group;
  private rightArmPivot: THREE.Group;
  private weaponGroup: THREE.Group;
  private muzzlePoint: THREE.Object3D;
  private muzzleFlashMesh: THREE.Group;
  private muzzleLight: THREE.PointLight;

  public position = new THREE.Vector3(0, 0, 7.5);
  public velocity = new THREE.Vector3();
  public rotationY = Math.PI;
  public radius = 0.55;

  // Core Survivor Stats
  public health = 100;
  public maxHealth = 100;
  public stamina = 100;
  public maxStamina = 100;
  public staminaExhausted = false;
  public ammo = 30;
  public maxMagazine = 30;
  public reserveAmmo = 120;
  public maxReserveAmmo = 120;
  public repairKits = 1;

  // Combat & Action States
  public isReloading = false;
  public reloadDuration = 1.8;
  public reloadTimer = 0;
  public weaponCooldown = 0;
  public fireInterval = 0.16;

  public isSprinting = false;
  public isDodging = false;
  public dodgeTimer = 0;
  public dodgeDuration = 0.28;
  public dodgeCooldown = 0;
  public dodgeMaxCooldown = 1.3;
  private dodgeDir = new THREE.Vector3(0, 0, -1);

  public damageFlash = 0;
  private animTime = 0;
  private idleTime = 0;
  private shootRecoilTimer = 0;
  private footstepTimer = 0;

  // Quaternion aiming state (Y = up, -Z = forward)
  private smoothedAimDir = new THREE.Vector3(0, 0, -1);
  private currentWeaponWorldQuat = new THREE.Quaternion();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    scene.add(this.group);

    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    // Stylized Survivor Materials
    const jacketMat = new THREE.MeshStandardMaterial({
      color: 0x264653,
      roughness: 0.72,
      metalness: 0.14,
    });
    const jacketTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1d3540,
      roughness: 0.78,
      metalness: 0.12,
    });
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x1e2433,
      roughness: 0.55,
      metalness: 0.38,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1b202e,
      roughness: 0.84,
      metalness: 0.08,
    });
    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x141720,
      roughness: 0.65,
      metalness: 0.25,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x4a3222,
      roughness: 0.75,
      metalness: 0.15,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd8a484,
      roughness: 0.62,
    });
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x7c4d2b,
      roughness: 0.76,
      metalness: 0.14,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0x242c3d,
      roughness: 0.45,
      metalness: 0.55,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.2,
      roughness: 0.15,
    });
    const amberLedMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    const gunMat = new THREE.MeshStandardMaterial({
      color: 0x151924,
      roughness: 0.32,
      metalness: 0.86,
    });
    const gunSteelMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.28,
      metalness: 0.88,
    });
    const gunGlowMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.8,
    });

    // Ground Contact Shadow Disc
    const shadowGeo = new THREE.CircleGeometry(0.58, 20);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
    shadowDisc.position.y = 0.02;
    this.group.add(shadowDisc);

    // 1. Sculpted Upper & Lower Torso, Tactical Rig, Collar & Utility Belt
    const pelvis = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.22, 0.29),
      pantsMat
    );
    pelvis.position.y = 0.78;
    pelvis.castShadow = true;
    this.bodyPivot.add(pelvis);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.1, 0.33),
      leatherMat
    );
    belt.position.y = 0.86;
    this.bodyPivot.add(belt);

    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.11, 0.04),
      gunSteelMat
    );
    buckle.position.set(0, 0.86, -0.16);
    this.bodyPivot.add(buckle);

    // Hip Pouches & Side Holster
    for (const side of [-1, 1]) {
      const hipPouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.16, 0.16),
        leatherMat
      );
      hipPouch.position.set(side * 0.26, 0.82, 0);
      this.bodyPivot.add(hipPouch);
    }

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.54, 0.31),
      jacketMat
    );
    torso.position.y = 1.15;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.bodyPivot.add(torso);

    // Broadened Shoulder Yoke & Tactical Pauldrons
    const shoulderYoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.16, 0.34),
      jacketTrimMat
    );
    shoulderYoke.position.y = 1.38;
    shoulderYoke.castShadow = true;
    this.bodyPivot.add(shoulderYoke);

    // Layered Tactical Chest Armor Vest + Mag Pouches + Chest Beacon
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.44, 0.35),
      vestMat
    );
    vest.position.y = 1.16;
    vest.castShadow = true;
    this.bodyPivot.add(vest);

    for (const px of [-0.14, 0, 0.14]) {
      const magPouch = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.15, 0.05),
        leatherMat
      );
      magPouch.position.set(px, 1.07, -0.19);
      this.bodyPivot.add(magPouch);
    }

    const chestRigLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.06, 0.04),
      visorMat
    );
    chestRigLight.position.set(0.14, 1.28, -0.19);
    this.bodyPivot.add(chestRigLight);

    // High Weatherproof Jacket Collar / Hood cowl around neck
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.25, 0.16, 8),
      jacketTrimMat
    );
    collar.position.set(0, 1.44, 0.02);
    this.bodyPivot.add(collar);

    // 2. Detailed Survival Backpack + Bedroll + Radio Antenna + Lantern Cell
    const backpack = new THREE.Group();
    backpack.position.set(0, 1.16, 0.25);

    const mainPack = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.48, 0.22),
      packMat
    );
    mainPack.castShadow = true;
    backpack.add(mainPack);

    const upperFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.14, 0.24),
      leatherMat
    );
    upperFlap.position.y = 0.19;
    backpack.add(upperFlap);

    const bedroll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.48, 10),
      jacketTrimMat
    );
    bedroll.rotation.z = Math.PI / 2;
    bedroll.position.set(0, 0.31, 0);
    backpack.add(bedroll);

    // Side Canteen / Thermos canister
    const canister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.26, 8),
      gunSteelMat
    );
    canister.position.set(-0.24, -0.04, 0);
    backpack.add(canister);

    // Comms Radio Antenna Whip
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.018, 0.52, 6),
      gunSteelMat
    );
    antenna.position.set(0.16, 0.44, -0.04);
    backpack.add(antenna);

    // Glowing Rear Energy Telemetry Cell + Amber Survival Beacon
    const packCell = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.24, 0.08),
      gunGlowMat
    );
    packCell.position.set(-0.06, -0.02, 0.12);
    backpack.add(packCell);

    const packBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      amberLedMat
    );
    packBeacon.position.set(0.12, 0.08, 0.12);
    backpack.add(packBeacon);

    this.bodyPivot.add(backpack);

    // 3. Sculpted Head, Tactical Helmet, Ear Comms, Mask & Glowing Visor (local -Z = forward, +Y = up)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.58, 0);

    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.35, 0.33),
      skinMat
    );
    headMesh.castShadow = true;
    this.headGroup.add(headMesh);

    // Lower respirator / tactical scarf mask
    const faceMask = new THREE.Mesh(
      new THREE.BoxGeometry(0.335, 0.16, 0.35),
      vestMat
    );
    faceMask.position.set(0, -0.09, -0.01);
    this.headGroup.add(faceMask);

    // Contoured Helmet Crown + Brow Brim + Side Ear Muffs
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.37, 0.2, 0.38),
      helmetMat
    );
    helmet.position.set(0, 0.1, 0.01);
    helmet.castShadow = true;
    this.headGroup.add(helmet);

    const helmetBrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.05, 0.12),
      helmetMat
    );
    helmetBrim.position.set(0, 0.08, -0.18);
    helmetBrim.rotation.x = 0.15;
    this.headGroup.add(helmetBrim);

    for (const side of [-1, 1]) {
      const earPod = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.16, 0.16),
        gunSteelMat
      );
      earPod.position.set(side * 0.19, 0.0, 0.01);
      this.headGroup.add(earPod);
    }

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.33, 0.1, 0.06),
      visorMat
    );
    visor.position.set(0, 0.02, -0.175);
    this.headGroup.add(visor);
    this.bodyPivot.add(this.headGroup);

    // 4. Articulated Left & Right Legs (Thigh, Knee Pad, Shin & Heavy Combat Boot)
    const buildLeg = (isLeft: boolean) => {
      const pivot = new THREE.Group();
      pivot.position.set(isLeft ? -0.15 : 0.15, 0.74, 0);

      const thigh = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.36, 0.22),
        pantsMat
      );
      thigh.position.y = -0.18;
      thigh.castShadow = true;
      pivot.add(thigh);

      const kneePad = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.12, 0.06),
        vestMat
      );
      kneePad.position.set(0, -0.35, -0.11);
      pivot.add(kneePad);

      const shin = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.26, 0.19),
        pantsMat
      );
      shin.position.y = -0.48;
      shin.castShadow = true;
      pivot.add(shin);

      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.19, 0.18, 0.27),
        bootMat
      );
      boot.position.set(0, -0.65, -0.03);
      boot.castShadow = true;
      pivot.add(boot);

      return pivot;
    };

    this.leftLegPivot = buildLeg(true);
    this.bodyPivot.add(this.leftLegPivot);

    this.rightLegPivot = buildLeg(false);
    this.bodyPivot.add(this.rightLegPivot);

    // 5. Left Arm (Shoulder Pad, Upper Sleeve, Forearm Bracer & Gloved Hand)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.34, 1.34, 0);

    const lPauldron = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.18, 0.22),
      vestMat
    );
    lPauldron.position.set(-0.02, -0.04, 0);
    this.leftArmPivot.add(lPauldron);

    const leftArmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.46, 0.17),
      jacketMat
    );
    leftArmMesh.position.y = -0.21;
    leftArmMesh.castShadow = true;
    this.leftArmPivot.add(leftArmMesh);

    const leftGlove = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.15),
      bootMat
    );
    leftGlove.position.y = -0.47;
    this.leftArmPivot.add(leftGlove);
    this.bodyPivot.add(this.leftArmPivot);

    // 6. Right Arm + Upgraded Energy Pulse Rifle
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.34, 1.34, 0);

    const rPauldron = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.18, 0.22),
      vestMat
    );
    rPauldron.position.set(0.02, -0.04, 0);
    this.rightArmPivot.add(rPauldron);

    const rightArmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.45, 0.17),
      jacketMat
    );
    rightArmMesh.position.y = -0.2;
    rightArmMesh.castShadow = true;
    this.rightArmPivot.add(rightArmMesh);

    const rightGlove = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.15),
      bootMat
    );
    rightGlove.position.y = -0.45;
    this.rightArmPivot.add(rightGlove);

    // Energy Pulse Weapon Model — Strictly built in (Y = up, -Z = forward) convention
    this.weaponGroup = new THREE.Group();
    this.weaponGroup.position.set(-0.08, -0.42, -0.02);

    // Rifle Stock & Receiver Body
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.16, 0.64),
      gunMat
    );
    receiver.position.set(0, 0.02, -0.14);
    receiver.castShadow = true;
    this.weaponGroup.add(receiver);

    // Upper Picatinny Rail & Holographic Reflex Optic
    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.035, 0.44),
      gunSteelMat
    );
    topRail.position.set(0, 0.11, -0.18);
    this.weaponGroup.add(topRail);

    const opticHood = new THREE.Mesh(
      new THREE.BoxGeometry(0.088, 0.075, 0.12),
      gunMat
    );
    opticHood.position.set(0, 0.155, -0.12);
    this.weaponGroup.add(opticHood);

    const opticLens = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.045, 0.02),
      visorMat
    );
    opticLens.position.set(0, 0.155, -0.16);
    this.weaponGroup.add(opticLens);

    // Pistol Grip & Angled Tactical Foregrip
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.18, 0.11),
      vestMat
    );
    grip.position.set(0, -0.09, 0.04);
    grip.rotation.x = 0.22;
    this.weaponGroup.add(grip);

    const foregrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.13, 0.09),
      vestMat
    );
    foregrip.position.set(0, -0.08, -0.34);
    foregrip.rotation.x = -0.15;
    this.weaponGroup.add(foregrip);

    // Removable Cyan Plasma Magazine Cell
    const magCell = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.16, 0.12),
      gunGlowMat
    );
    magCell.position.set(0, -0.09, -0.16);
    magCell.rotation.x = -0.12;
    this.weaponGroup.add(magCell);

    // Barrel Shroud & Heavy Fluted Barrel oriented along -Z
    const shroud = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.13, 0.28),
      gunSteelMat
    );
    shroud.position.set(0, 0.03, -0.42);
    this.weaponGroup.add(shroud);

    const barrelGeo = new THREE.CylinderGeometry(0.032, 0.042, 0.46, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, gunMat);
    barrel.position.set(0, 0.035, -0.48);
    barrel.castShadow = true;
    this.weaponGroup.add(barrel);

    // Glowing Side Plasma Accelerator Rails
    const energyRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.05, 0.5),
      gunGlowMat
    );
    energyRail.position.set(0, 0.045, -0.24);
    this.weaponGroup.add(energyRail);

    // Muzzle point at the tip of the barrel along -Z
    this.muzzlePoint = new THREE.Object3D();
    this.muzzlePoint.position.set(0, 0.035, -0.74);
    this.weaponGroup.add(this.muzzlePoint);

    // Multi-layered Star & Core Muzzle Flash
    this.muzzleFlashMesh = new THREE.Group();
    this.muzzleFlashMesh.position.copy(this.muzzlePoint.position);

    const flashCoreMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.95,
    });
    const flashOuterMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.78,
    });

    const coreSpike = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.15, 0),
      flashCoreMat
    );
    coreSpike.scale.set(0.85, 0.85, 1.9);
    this.muzzleFlashMesh.add(coreSpike);

    const crossFins1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.05, 0.08),
      flashOuterMat
    );
    this.muzzleFlashMesh.add(crossFins1);

    const crossFins2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.42, 0.08),
      flashOuterMat
    );
    this.muzzleFlashMesh.add(crossFins2);

    this.muzzleFlashMesh.visible = false;
    this.weaponGroup.add(this.muzzleFlashMesh);

    this.muzzleLight = new THREE.PointLight(0x22d3ee, 0, 7.5, 2);
    this.muzzleLight.position.copy(this.muzzlePoint.position);
    this.weaponGroup.add(this.muzzleLight);

    this.rightArmPivot.add(this.weaponGroup);
    this.bodyPivot.add(this.rightArmPivot);

    // Set natural initial rest pose so weapon points horizontally forward on frame 0
    this.applyInitialPose();
  }

  private applyInitialPose() {
    this.rightArmPivot.rotation.set(1.12, -0.14, 0);
    this.leftArmPivot.rotation.set(1.18, 0.52, -0.18);
    this.smoothedAimDir.set(
      -Math.sin(this.rotationY),
      0,
      -Math.cos(this.rotationY)
    );
    _lookMat.lookAt(_originZero, this.smoothedAimDir, _worldUp);
    this.currentWeaponWorldQuat.setFromRotationMatrix(_lookMat);

    this.group.updateMatrixWorld(true);
    this.rightArmPivot.getWorldQuaternion(_parentWorldQuat);
    this.weaponGroup.quaternion
      .copy(_parentWorldQuat)
      .invert()
      .multiply(this.currentWeaponWorldQuat);
    this.weaponGroup.updateMatrixWorld(true);
  }

  public reset() {
    this.position.set(0, 0, 7.5);
    this.velocity.set(0, 0, 0);
    this.rotationY = Math.PI;
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.staminaExhausted = false;
    this.ammo = this.maxMagazine;
    this.reserveAmmo = 120;
    this.repairKits = 1;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.weaponCooldown = 0;
    this.isSprinting = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.damageFlash = 0;
    this.shootRecoilTimer = 0;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;
    this.bodyPivot.rotation.set(0, 0, 0);
    this.bodyPivot.position.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.applyInitialPose();
  }

  public getMuzzleWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    this.weaponGroup.updateMatrixWorld(true);
    return this.muzzlePoint.getWorldPosition(target);
  }

  public getMuzzleWorldDirection(target: THREE.Vector3): THREE.Vector3 {
    this.weaponGroup.updateMatrixWorld(true);
    this.weaponGroup.getWorldQuaternion(_desiredWorldQuat);
    return target.set(0, 0, -1).applyQuaternion(_desiredWorldQuat).normalize();
  }

  public startReload(): boolean {
    if (
      this.isReloading ||
      this.ammo >= this.maxMagazine ||
      this.reserveAmmo <= 0
    ) {
      return false;
    }
    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
    this.shootRecoilTimer = 0;
    this.muzzleFlashMesh.visible = false;
    this.muzzleLight.intensity = 0;
    return true;
  }

  public startDodge(moveX: number, moveZ: number, cameraYaw: number): boolean {
    if (this.isDodging || this.dodgeCooldown > 0 || this.stamina < 25) {
      return false;
    }
    this.stamina = Math.max(0, this.stamina - 25);
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.staminaExhausted = true;
      this.isSprinting = false;
    }
    this.isDodging = true;
    this.dodgeTimer = this.dodgeDuration;
    this.dodgeCooldown = this.dodgeMaxCooldown;

    _forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw)).normalize();
    _right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).normalize();

    if (Math.hypot(moveX, moveZ) > 0.1) {
      this.dodgeDir
        .set(0, 0, 0)
        .addScaledVector(_right, moveX)
        .addScaledVector(_forward, -moveZ)
        .normalize();
    } else {
      this.dodgeDir.copy(_forward);
    }
    return true;
  }

  public canFire(): boolean {
    return !this.isReloading && this.weaponCooldown <= 0 && this.ammo > 0;
  }

  public consumeShot(): void {
    this.ammo = Math.max(0, this.ammo - 1);
    this.weaponCooldown = this.fireInterval;
    this.shootRecoilTimer = 0.11;
    this.muzzleFlashMesh.visible = true;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
    const s = 0.85 + Math.random() * 0.35;
    this.muzzleFlashMesh.scale.setScalar(s);
    this.muzzleLight.intensity = 3.6;

    if (this.ammo === 0 && this.reserveAmmo > 0) {
      this.startReload();
    }
  }

  public takeDamage(amount: number): boolean {
    if (this.isDodging) return false;
    this.health = Math.max(0, this.health - amount);
    this.damageFlash = 1.0;
    return this.health <= 0;
  }

  public update(
    dt: number,
    moveInput: { x: number; z: number; magnitude: number },
    sprintRequested: boolean,
    isFiring: boolean,
    cameraYaw: number,
    obstacles: ObstacleAABB[],
    onFootstep?: () => void,
    onReloadComplete?: () => void,
    cameraPitch = -0.12,
    aimTargetWorld?: THREE.Vector3
  ) {
    this.idleTime += dt;

    if (this.weaponCooldown > 0) {
      this.weaponCooldown = Math.max(0, this.weaponCooldown - dt);
    }
    if (this.dodgeCooldown > 0) {
      this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    }
    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
    }
    if (this.shootRecoilTimer > 0) {
      this.shootRecoilTimer = Math.max(0, this.shootRecoilTimer - dt);
      if (this.shootRecoilTimer <= 0.04) {
        this.muzzleFlashMesh.visible = false;
        this.muzzleLight.intensity = 0;
      }
    } else {
      this.muzzleFlashMesh.visible = false;
      this.muzzleLight.intensity = 0;
    }

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = this.maxMagazine - this.ammo;
        const transfer = Math.min(needed, this.reserveAmmo);
        this.ammo += transfer;
        this.reserveAmmo -= transfer;
        this.isReloading = false;
        this.reloadTimer = 0;
        onReloadComplete?.();
      }
    }

    _forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw)).normalize();
    _right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw)).normalize();

    if (this.isDodging) {
      this.dodgeTimer -= dt;
      const dodgeSpeed = 13.5;
      this.velocity.copy(this.dodgeDir).multiplyScalar(dodgeSpeed);
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
      }
    } else {
      _moveDir
        .set(0, 0, 0)
        .addScaledVector(_right, moveInput.x)
        .addScaledVector(_forward, -moveInput.z);

      const isMoving = moveInput.magnitude > 0.08;
      if (this.staminaExhausted && this.stamina >= 20) {
        this.staminaExhausted = false;
      }

      this.isSprinting =
        isMoving &&
        sprintRequested &&
        !this.staminaExhausted &&
        this.stamina > 0 &&
        !isFiring;

      if (this.isSprinting) {
        this.stamina = Math.max(0, this.stamina - 22 * dt);
        if (this.stamina <= 0) {
          this.stamina = 0;
          this.staminaExhausted = true;
          this.isSprinting = false;
        }
      } else {
        const regenRate = isMoving ? 12 : 22;
        this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
        if (this.staminaExhausted && this.stamina >= 20) {
          this.staminaExhausted = false;
        }
      }

      const baseSpeed = this.isSprinting ? 8.4 : 5.4;
      if (isMoving) {
        _moveDir.normalize();
        const targetVx = _moveDir.x * baseSpeed * moveInput.magnitude;
        const targetVz = _moveDir.z * baseSpeed * moveInput.magnitude;
        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVx, 14, dt);
        this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVz, 14, dt);
      } else {
        this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 16, dt);
        this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 16, dt);
      }
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.resolveCollisions(obstacles);

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    let targetYaw = cameraYaw;
    if (this.isDodging && speed > 0.5) {
      targetYaw = Math.atan2(-this.velocity.x, -this.velocity.z);
    } else if (this.isSprinting && !isFiring && speed > 1.0) {
      const moveYaw = Math.atan2(-this.velocity.x, -this.velocity.z);
      let moveDiff = moveYaw - cameraYaw;
      while (moveDiff > Math.PI) moveDiff -= Math.PI * 2;
      while (moveDiff < -Math.PI) moveDiff += Math.PI * 2;
      targetYaw = cameraYaw + THREE.MathUtils.clamp(moveDiff, -0.65, 0.65);
    }

    let diff = targetYaw - this.rotationY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = isFiring ? 26 : 16;
    this.rotationY += diff * Math.min(1, dt * turnRate);

    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotationY;

    if (speed > 1.2 && !this.isDodging) {
      this.footstepTimer -= dt * (this.isSprinting ? 1.45 : 1.0);
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.36;
        onFootstep?.();
      }
    }

    this.animateLimbsAndWeapon(
      dt,
      speed,
      isFiring,
      cameraYaw,
      cameraPitch,
      aimTargetWorld
    );
  }

  public syncWeaponAim(
    dt: number,
    isFiring: boolean,
    cameraYaw: number,
    cameraPitch: number,
    aimTargetWorld: THREE.Vector3
  ) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.animateLimbsAndWeapon(
      dt,
      speed,
      isFiring,
      cameraYaw,
      cameraPitch,
      aimTargetWorld
    );
  }

  private resolveCollisions(obstacles: ObstacleAABB[]) {
    const distFromCenter = Math.hypot(this.position.x, this.position.z);
    if (distFromCenter > 34.2) {
      const scale = 34.2 / distFromCenter;
      this.position.x *= scale;
      this.position.z *= scale;
    }

    const r = this.radius;
    for (let i = 0; i < obstacles.length; i++) {
      const box = obstacles[i];
      const closestX = THREE.MathUtils.clamp(this.position.x, box.minX, box.maxX);
      const closestZ = THREE.MathUtils.clamp(this.position.z, box.minZ, box.maxZ);
      const dx = this.position.x - closestX;
      const dz = this.position.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < r * r) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-4) {
          const overlap = r - dist;
          this.position.x += (dx / dist) * overlap;
          this.position.z += (dz / dist) * overlap;
        } else {
          this.position.z += r;
        }
      }
    }
  }

  private animateLimbsAndWeapon(
    dt: number,
    speed: number,
    _isFiring: boolean,
    cameraYaw: number,
    cameraPitch: number,
    aimTargetWorld?: THREE.Vector3
  ) {
    const strideFreq = this.isSprinting ? 13 : 9;
    if (speed > 0.3) {
      this.animTime += dt * strideFreq;
    } else {
      this.animTime += dt * 2.2;
    }

    const moveFactor = THREE.MathUtils.clamp(speed / 6.5, 0, 1);
    const breathWave = Math.sin(this.idleTime * 2.4) * 0.014 * (1 - moveFactor);

    // 1. Smoothly damped legs stride & idle stance
    const targetLegSwing = Math.sin(this.animTime) * 0.68 * moveFactor;
    this.leftLegPivot.rotation.x = THREE.MathUtils.damp(
      this.leftLegPivot.rotation.x,
      targetLegSwing,
      18,
      dt
    );
    this.rightLegPivot.rotation.x = THREE.MathUtils.damp(
      this.rightLegPivot.rotation.x,
      -targetLegSwing,
      18,
      dt
    );

    // 2. Body bob, idle breathing & dodge tuck
    if (this.isDodging) {
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.bodyPivot.rotation.x,
        -0.48,
        18,
        dt
      );
      this.bodyPivot.position.y = THREE.MathUtils.damp(
        this.bodyPivot.position.y,
        -0.15,
        18,
        dt
      );
    } else {
      const flinchBack = this.damageFlash > 0.4 ? (this.damageFlash - 0.4) * 0.22 : 0;
      const targetLean =
        (this.isSprinting ? -0.15 : -0.045 * moveFactor) + flinchBack;
      this.bodyPivot.rotation.x = THREE.MathUtils.damp(
        this.bodyPivot.rotation.x,
        targetLean,
        12,
        dt
      );
      const stepBob = Math.abs(Math.cos(this.animTime)) * 0.055 * moveFactor;
      this.bodyPivot.position.y = stepBob + breathWave;
    }

    // 3. Compute 3D Aiming Direction & Vertical Pitch Angle
    this.group.updateMatrixWorld(true);
    this.weaponGroup.getWorldPosition(_weaponWorldPos);

    if (aimTargetWorld) {
      _aimDirWorld.copy(aimTargetWorld).sub(_weaponWorldPos);
      if (_aimDirWorld.lengthSq() > 0.001) {
        _aimDirWorld.normalize();
      } else {
        _aimDirWorld.set(
          -Math.sin(cameraYaw) * Math.cos(cameraPitch),
          Math.sin(cameraPitch),
          -Math.cos(cameraYaw) * Math.cos(cameraPitch)
        ).normalize();
      }
    } else {
      _aimDirWorld.set(
        -Math.sin(cameraYaw) * Math.cos(cameraPitch),
        Math.sin(cameraPitch),
        -Math.cos(cameraYaw) * Math.cos(cameraPitch)
      ).normalize();
    }

    // Constrain aim direction horizontally relative to torso facing so gun never twists behind back
    const aimHorizontalYaw = Math.atan2(-_aimDirWorld.x, -_aimDirWorld.z);
    let yawDelta = aimHorizontalYaw - this.rotationY;
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
    const clampedYawDelta = THREE.MathUtils.clamp(yawDelta, -0.78, 0.78);
    const effectiveYaw = this.rotationY + clampedYawDelta;

    const clampedAimY = THREE.MathUtils.clamp(_aimDirWorld.y, -0.62, 0.58);
    const horizMag = Math.sqrt(Math.max(0.01, 1 - clampedAimY * clampedAimY));
    _aimDirWorld.set(
      -Math.sin(effectiveYaw) * horizMag,
      clampedAimY,
      -Math.cos(effectiveYaw) * horizMag
    ).normalize();

    const aimPitchAngle = Math.asin(clampedAimY);

    // 4. Head tracking (pitch & subtle yaw) + damage flinch
    this.headGroup.rotation.x = THREE.MathUtils.clamp(
      aimPitchAngle * 0.65,
      -0.42,
      0.42
    );
    this.headGroup.rotation.y = THREE.MathUtils.clamp(
      clampedYawDelta * 0.5,
      -0.4,
      0.4
    );
    if (this.damageFlash > 0.5) {
      this.headGroup.rotation.z = Math.sin(this.damageFlash * 25) * 0.15;
    } else {
      this.headGroup.rotation.z = 0;
    }

    // 5. Arms Pose — raise/lower naturally with vertical aimPitchAngle so hands follow the gun
    const bodyLeanComp = -this.bodyPivot.rotation.x;
    const armAimLift = aimPitchAngle * 0.75 + bodyLeanComp;
    const recoilSlide = this.shootRecoilTimer > 0 ? 0.065 : 0;

    if (this.isReloading) {
      this.rightArmPivot.rotation.set(
        1.02 + bodyLeanComp + Math.sin(this.reloadTimer * 10) * 0.1,
        -0.18,
        0
      );
      this.leftArmPivot.rotation.set(
        1.12 + bodyLeanComp + Math.cos(this.reloadTimer * 12) * 0.16,
        0.55,
        -0.22
      );
    } else {
      const subtleBob = targetLegSwing * 0.08 + breathWave * 1.2;
      this.rightArmPivot.rotation.set(
        1.12 + armAimLift - recoilSlide + subtleBob,
        -0.14 + clampedYawDelta * 0.35,
        0
      );
      this.leftArmPivot.rotation.set(
        1.18 + armAimLift - recoilSlide + subtleBob,
        0.52 + clampedYawDelta * 0.35,
        -0.18
      );
    }

    // Keep weapon anchored in the right hand with subtle recoil slide along +Z
    this.weaponGroup.position.set(
      -0.08,
      -0.42,
      -0.02 + (this.shootRecoilTimer > 0 ? 0.038 : 0)
    );

    // 6. Quaternion Weapon Orientation (Y = up, -Z = forward)
    const lerpFactor = Math.min(1, dt * 32);
    this.smoothedAimDir.lerp(_aimDirWorld, lerpFactor).normalize();

    _lookMat.lookAt(_originZero, this.smoothedAimDir, _worldUp);
    _desiredWorldQuat.setFromRotationMatrix(_lookMat);

    if (this.isReloading) {
      _auxQuat.setFromAxisAngle(_xAxis, 0.26);
      _desiredWorldQuat.multiply(_auxQuat);
      _auxQuat.setFromAxisAngle(_zAxis, 0.38);
      _desiredWorldQuat.multiply(_auxQuat);
    } else if (this.shootRecoilTimer > 0) {
      const kickPitch = (this.shootRecoilTimer / 0.11) * 0.045;
      _auxQuat.setFromAxisAngle(_xAxis, kickPitch);
      _desiredWorldQuat.multiply(_auxQuat);
    }

    this.currentWeaponWorldQuat.copy(_desiredWorldQuat);

    // Convert desired world quaternion into rightArmPivot local space:
    // localQuat = inverse(rightArmPivotWorldQuat) * desiredWorldQuat
    this.rightArmPivot.updateMatrixWorld(true);
    this.rightArmPivot.getWorldQuaternion(_parentWorldQuat);
    _targetLocalQuat
      .copy(_parentWorldQuat)
      .invert()
      .multiply(this.currentWeaponWorldQuat);

    this.weaponGroup.quaternion.copy(_targetLocalQuat);
    this.weaponGroup.updateMatrixWorld(true);
  }
}

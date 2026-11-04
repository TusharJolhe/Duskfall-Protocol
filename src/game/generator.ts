import * as THREE from 'three';
import { ObstacleAABB } from './types';

export class GeneratorSystem {
  public group: THREE.Group;
  public position = new THREE.Vector3(0, 0, 0);
  public health = 100;
  public maxHealth = 100;

  // Emergency repair: 15 HP after holding interaction for 2.0s, with 20.0s cooldown
  public repairCooldown = 0;
  public maxRepairCooldown = 20;
  public emergencyHoldDuration = 2.0;
  public emergencyHoldTimer = 0;
  public isEmergencyRepairing = false;

  public underAttackTimer = 0;

  private coreMesh: THREE.Mesh;
  private coreShellMesh: THREE.Mesh;
  private coreMat: THREE.MeshStandardMaterial;
  private coreShellMat: THREE.MeshBasicMaterial;
  private outerRing: THREE.Mesh;
  private midRing: THREE.Mesh;
  private innerRing: THREE.Mesh;
  private turbineRotor: THREE.Group;
  private statusRingMat: THREE.MeshStandardMaterial;
  private beaconMat: THREE.MeshStandardMaterial;
  private pulseWaveRing: THREE.Mesh;
  private pulseWaveMat: THREE.MeshBasicMaterial;
  private coreLight: THREE.PointLight;
  private pylons: THREE.Group[] = [];
  private arcLines: THREE.Line[] = [];
  private arcMat: THREE.LineBasicMaterial;
  private elapsedTime = 0;

  constructor(scene: THREE.Scene, obstacles: ObstacleAABB[]) {
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    scene.add(this.group);

    const baseMetal = new THREE.MeshStandardMaterial({
      color: 0x242b3b,
      roughness: 0.38,
      metalness: 0.84,
    });
    const accentMetal = new THREE.MeshStandardMaterial({
      color: 0x3b4861,
      roughness: 0.32,
      metalness: 0.78,
    });
    const copperCoilMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.3,
      metalness: 0.88,
    });
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.45,
      metalness: 0.25,
    });

    // 1. Heavy Octagonal Industrial Pedestal + Hazard Trim
    const lowerPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.38, 2.65, 0.38, 8),
      baseMetal
    );
    lowerPlinth.position.y = 0.19;
    lowerPlinth.castShadow = true;
    lowerPlinth.receiveShadow = true;
    this.group.add(lowerPlinth);

    const hazardBand = new THREE.Mesh(
      new THREE.CylinderGeometry(2.32, 2.4, 0.12, 8),
      hazardMat
    );
    hazardBand.position.y = 0.42;
    this.group.add(hazardBand);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.05, 2.28, 0.48, 8),
      accentMetal
    );
    pedestal.position.y = 0.68;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    this.group.add(pedestal);

    // Condition Status Ring on Pedestal Deck
    this.statusRingMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.1,
      roughness: 0.18,
    });
    const statusRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.08, 0.075, 10, 32),
      this.statusRingMat
    );
    statusRing.rotation.x = Math.PI / 2;
    statusRing.position.y = 0.93;
    this.group.add(statusRing);

    // Expanding Ground Energy Pulse Wave Ring
    this.pulseWaveMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.pulseWaveRing = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.15, 32).rotateX(-Math.PI / 2),
      this.pulseWaveMat
    );
    this.pulseWaveRing.position.y = 0.12;
    this.group.add(this.pulseWaveRing);

    // 2. Central Lower Turbine Column + Rotating Cooling Blades
    const lowerColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(1.08, 1.42, 1.05, 8),
      baseMetal
    );
    lowerColumn.position.y = 1.42;
    lowerColumn.castShadow = true;
    this.group.add(lowerColumn);

    this.turbineRotor = new THREE.Group();
    this.turbineRotor.position.y = 1.65;
    for (let b = 0; b < 8; b++) {
      const ang = (b / 8) * Math.PI * 2;
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.42, 0.48),
        copperCoilMat
      );
      fin.position.set(Math.cos(ang) * 1.16, 0, Math.sin(ang) * 1.16);
      fin.rotation.y = -ang;
      this.turbineRotor.add(fin);
    }
    this.group.add(this.turbineRotor);

    // 3. Upper Capacitor Crown & Emitter Spire
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 1.48, 0.55, 8),
      baseMetal
    );
    topCap.position.y = 4.25;
    topCap.castShadow = true;
    this.group.add(topCap);

    const topSpire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.52, 0.75, 8),
      accentMetal
    );
    topSpire.position.y = 4.88;
    topSpire.castShadow = true;
    this.group.add(topSpire);

    const topCoil = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.06, 8, 16),
      this.statusRingMat
    );
    topCoil.rotation.x = Math.PI / 2;
    topCoil.position.y = 4.75;
    this.group.add(topCoil);

    // Warning Beacon Material (reacts to damage)
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.6,
    });

    // 4. Four Detailed Electromagnetic Containment Pylons with Coils & Warning Beacons
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(angle) * 1.62;
      const pz = Math.sin(angle) * 1.62;

      const pylonGroup = new THREE.Group();
      pylonGroup.position.set(px, 0, pz);
      pylonGroup.rotation.y = -angle;

      // Main structural strut
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 3.45, 0.38),
        accentMetal
      );
      strut.position.y = 2.48;
      strut.castShadow = true;
      pylonGroup.add(strut);

      // Inner copper induction coils facing the core
      for (const cy of [2.25, 2.85, 3.45]) {
        const coil = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.16, 0.44),
          copperCoilMat
        );
        coil.position.y = cy;
        pylonGroup.add(coil);
      }

      // Emissive vertical energy conduit strip on outer face
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.5, 0.08),
        this.statusRingMat
      );
      strip.position.set(0.16, 2.55, 0);
      pylonGroup.add(strip);

      // Top Pylon Warning Beacon Dome
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        this.beaconMat
      );
      beacon.position.set(0, 4.3, 0);
      pylonGroup.add(beacon);

      this.group.add(pylonGroup);
      this.pylons.push(pylonGroup);
    }

    // 5. Multi-Layered Glowing Cyan Energy Core
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.8,
      roughness: 0.12,
      metalness: 0.1,
    });
    this.coreMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.76, 1),
      this.coreMat
    );
    this.coreMesh.position.y = 2.88;
    this.group.add(this.coreMesh);

    this.coreShellMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      wireframe: true,
    });
    this.coreShellMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.98, 1),
      this.coreShellMat
    );
    this.coreShellMesh.position.y = 2.88;
    this.group.add(this.coreShellMesh);

    // 6. Triple Concentric Gyroscopic Containment Rings
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.22,
      metalness: 0.9,
    });
    this.outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.34, 0.065, 10, 28),
      ringMat
    );
    this.outerRing.position.y = 2.88;
    this.group.add(this.outerRing);

    this.midRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.16, 0.05, 8, 24),
      this.statusRingMat
    );
    this.midRing.position.y = 2.88;
    this.group.add(this.midRing);

    this.innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.05, 8, 22),
      ringMat
    );
    this.innerRing.position.y = 2.88;
    this.group.add(this.innerRing);

    // 7. Central Generator Focal PointLight
    this.coreLight = new THREE.PointLight(0x22d3ee, 4.6, 26, 1.55);
    this.coreLight.position.set(0, 2.95, 0);
    this.group.add(this.coreLight);

    // 8. Multi-Segment Electrical Plasma Arcs between Core and Pylons
    this.arcMat = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 4; i++) {
      const pts = [
        new THREE.Vector3(0, 2.88, 0),
        new THREE.Vector3(0.4, 2.95, 0.4),
        new THREE.Vector3(0.8, 2.82, 0.8),
        new THREE.Vector3(1.15, 2.88, 1.15),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, this.arcMat);
      this.group.add(line);
      this.arcLines.push(line);
    }

    // Register collision AABB around central generator
    obstacles.push({
      minX: -2.2,
      maxX: 2.2,
      minZ: -2.2,
      maxZ: 2.2,
      height: 4.5,
      blocksCamera: false,
    });
  }

  public reset() {
    this.health = this.maxHealth;
    this.repairCooldown = 0;
    this.emergencyHoldTimer = 0;
    this.isEmergencyRepairing = false;
    this.underAttackTimer = 0;
    this.elapsedTime = 0;
    this.updateVisualCondition(0.016);
  }

  public takeDamage(amount: number): boolean {
    if (this.health <= 0) return true;
    this.health = Math.max(0, this.health - amount);
    this.underAttackTimer = 2.5;
    return this.health <= 0;
  }

  public canRepair(playerRepairKits: number): boolean {
    if (this.health >= this.maxHealth) return false;
    return playerRepairKits > 0 || this.repairCooldown <= 0;
  }

  /**
   * Instant Repair Kit usage: restores 35 generator health per charge.
   */
  public useRepairKit(): number {
    if (this.health >= this.maxHealth) return 0;
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + 35);
    this.emergencyHoldTimer = 0;
    this.isEmergencyRepairing = false;
    return Math.round(this.health - before);
  }

  /**
   * Timed 2-second hold Emergency Repair: restores 15 generator health and triggers a 20-second cooldown.
   */
  public updateEmergencyRepairChannel(
    dt: number,
    inRange: boolean,
    holdingInteract: boolean,
    hasRepairKit: boolean
  ): number {
    if (
      !inRange ||
      !holdingInteract ||
      hasRepairKit ||
      this.health >= this.maxHealth ||
      this.repairCooldown > 0
    ) {
      this.emergencyHoldTimer = Math.max(0, this.emergencyHoldTimer - dt * 2.5);
      this.isEmergencyRepairing = false;
      return 0;
    }

    this.isEmergencyRepairing = true;
    this.emergencyHoldTimer += dt;
    if (this.emergencyHoldTimer >= this.emergencyHoldDuration) {
      this.emergencyHoldTimer = 0;
      this.isEmergencyRepairing = false;
      const before = this.health;
      this.health = Math.min(this.maxHealth, this.health + 15);
      this.repairCooldown = this.maxRepairCooldown;
      return Math.round(this.health - before);
    }
    return 0;
  }

  public getEmergencyRepairProgress(): number {
    return THREE.MathUtils.clamp(
      this.emergencyHoldTimer / this.emergencyHoldDuration,
      0,
      1
    );
  }

  public update(
    dt: number,
    onSpark?: (origin: THREE.Vector3, count: number, colorHex: number) => void
  ) {
    this.elapsedTime += dt;
    if (this.repairCooldown > 0) {
      this.repairCooldown = Math.max(0, this.repairCooldown - dt);
    }
    if (this.underAttackTimer > 0) {
      this.underAttackTimer = Math.max(0, this.underAttackTimer - dt);
    }
    this.updateVisualCondition(dt, onSpark);
  }

  private updateVisualCondition(
    dt: number,
    onSpark?: (origin: THREE.Vector3, count: number, colorHex: number) => void
  ) {
    const ratio = THREE.MathUtils.clamp(this.health / this.maxHealth, 0, 1);

    // Spin speed & instability increase as health drops
    const spinSpeed = 1.25 + (1 - ratio) * 2.1;
    this.coreMesh.rotation.y += dt * spinSpeed;
    this.coreMesh.rotation.x = Math.sin(this.elapsedTime * 2.4) * 0.28;
    const coreY = 2.88 + Math.sin(this.elapsedTime * 3.1) * 0.11;
    this.coreMesh.position.y = coreY;

    this.coreShellMesh.position.y = coreY;
    this.coreShellMesh.rotation.y -= dt * (spinSpeed * 0.7);
    const shellPulse = 1.0 + Math.sin(this.elapsedTime * 5.0) * 0.08;
    this.coreShellMesh.scale.setScalar(shellPulse);

    this.turbineRotor.rotation.y += dt * (2.2 + ratio * 1.5);

    this.outerRing.rotation.x += dt * (spinSpeed * 0.85);
    this.outerRing.rotation.y += dt * 0.65;
    this.midRing.rotation.y -= dt * (spinSpeed * 1.1);
    this.midRing.rotation.z += dt * 0.55;
    this.innerRing.rotation.z -= dt * (spinSpeed * 1.35);
    this.innerRing.rotation.x -= dt * 0.5;

    // Animated Ground Energy Pulse Wave
    const pulseCycle = (this.elapsedTime * 0.85) % 1;
    const pulseScale = 1.0 + pulseCycle * 2.1;
    this.pulseWaveRing.scale.set(pulseScale, pulseScale, 1);
    this.pulseWaveMat.opacity = (1 - pulseCycle) * 0.38;

    // Color transitions by Generator Health:
    // High (>60%): Stable Cyan | Medium (30%-60%): Unstable Amber | Low (<30%): Critical Crimson + Warning Strobe
    if (ratio > 0.6) {
      this.coreMat.color.setHex(0x67e8f9);
      this.coreMat.emissive.setHex(0x06b6d4);
      this.coreShellMat.color.setHex(0x38bdf8);
      this.statusRingMat.color.setHex(0x06b6d4);
      this.statusRingMat.emissive.setHex(0x06b6d4);
      this.beaconMat.color.setHex(0x38bdf8);
      this.beaconMat.emissive.setHex(0x06b6d4);
      this.beaconMat.emissiveIntensity = 1.4;
      this.pulseWaveMat.color.setHex(0x22d3ee);
      this.arcMat.color.setHex(0x67e8f9);
      this.coreLight.color.setHex(0x22d3ee);
    } else if (ratio > 0.3) {
      this.coreMat.color.setHex(0xfde047);
      this.coreMat.emissive.setHex(0xf59e0b);
      this.coreShellMat.color.setHex(0xfbbf24);
      this.statusRingMat.color.setHex(0xf59e0b);
      this.statusRingMat.emissive.setHex(0xf59e0b);
      this.beaconMat.color.setHex(0xfbbf24);
      this.beaconMat.emissive.setHex(0xd97706);
      this.beaconMat.emissiveIntensity =
        1.8 + Math.sin(this.elapsedTime * 8) * 0.8;
      this.pulseWaveMat.color.setHex(0xf59e0b);
      this.arcMat.color.setHex(0xfde047);
      this.coreLight.color.setHex(0xf59e0b);
    } else {
      const alarmStrobe = Math.sin(this.elapsedTime * 16) > 0 ? 3.4 : 0.6;
      this.coreMat.color.setHex(0xfca5a5);
      this.coreMat.emissive.setHex(0xef4444);
      this.coreShellMat.color.setHex(0xef4444);
      this.statusRingMat.color.setHex(0xef4444);
      this.statusRingMat.emissive.setHex(0xef4444);
      this.beaconMat.color.setHex(0xef4444);
      this.beaconMat.emissive.setHex(0xdc2626);
      this.beaconMat.emissiveIntensity = alarmStrobe;
      this.pulseWaveMat.color.setHex(0xef4444);
      this.arcMat.color.setHex(0xf87171);
      this.coreLight.color.setHex(0xef4444);
    }

    // Electrical flicker when damaged or under active enemy attack
    const instability = (1 - ratio) * 0.4 + (this.underAttackTimer > 0 ? 0.25 : 0);
    const flicker =
      instability > 0.15 && Math.random() < instability
        ? 0.42
        : 1.0 + Math.sin(this.elapsedTime * 6.5) * 0.14;
    this.coreLight.intensity = 4.4 * flicker;
    this.coreMat.emissiveIntensity = 2.6 * flicker;

    // Update 4-point jagged electrical arcs between core and pylons
    const jitterAmp = 0.22 + (1 - ratio) * 0.38;
    for (let i = 0; i < this.arcLines.length; i++) {
      const line = this.arcLines[i];
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const px = Math.cos(angle) * 1.48;
      const pz = Math.sin(angle) * 1.48;
      const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
      posAttr.setXYZ(0, 0, coreY, 0);
      posAttr.setXYZ(
        1,
        px * 0.35 + (Math.random() - 0.5) * jitterAmp,
        coreY + (Math.random() - 0.5) * jitterAmp,
        pz * 0.35 + (Math.random() - 0.5) * jitterAmp
      );
      posAttr.setXYZ(
        2,
        px * 0.72 + (Math.random() - 0.5) * jitterAmp,
        coreY + (Math.random() - 0.5) * jitterAmp,
        pz * 0.72 + (Math.random() - 0.5) * jitterAmp
      );
      posAttr.setXYZ(
        3,
        px,
        2.88 + Math.sin(this.elapsedTime * 4.5 + i) * 0.32,
        pz
      );
      posAttr.needsUpdate = true;
    }

    // Emit damage sparks when generator health is medium/low
    if (onSpark && ratio < 0.78 && Math.random() < (1 - ratio) * 0.32) {
      onSpark(
        new THREE.Vector3(
          (Math.random() - 0.5) * 1.65,
          2.65 + (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 1.65
        ),
        ratio < 0.35 ? 6 : 4,
        ratio < 0.35 ? 0xef4444 : 0xf59e0b
      );
    }
  }
}

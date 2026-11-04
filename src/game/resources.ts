import * as THREE from 'three';
import { CollectibleItem, CollectibleType } from './types';

interface SpawnNode {
  x: number;
  z: number;
  preferredType: CollectibleType;
}

const SPAWN_NODES: SpawnNode[] = [
  { x: -11.5, z: -9.5, preferredType: 'HEALTH_PACK' },
  { x: 11.5, z: -9.5, preferredType: 'ENERGY_CELL' },
  { x: -11.5, z: 9.5, preferredType: 'ENERGY_CELL' },
  { x: 11.5, z: 9.5, preferredType: 'HEALTH_PACK' },
  { x: 0, z: -15.5, preferredType: 'REPAIR_KIT' },
  { x: 0, z: 16.5, preferredType: 'ENERGY_CELL' },
  { x: -16.5, z: 0, preferredType: 'REPAIR_KIT' },
  { x: 16.5, z: 0, preferredType: 'HEALTH_PACK' },
  { x: -9.0, z: -18.0, preferredType: 'ENERGY_CELL' },
  { x: 9.5, z: 17.5, preferredType: 'REPAIR_KIT' },
  { x: -19.5, z: -7.5, preferredType: 'ENERGY_CELL' },
  { x: 19.5, z: 7.5, preferredType: 'HEALTH_PACK' },
];

export class ResourceSystem {
  public items: CollectibleItem[] = [];
  private scene: THREE.Scene;
  private elapsedTime = 0;

  private healthMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 1.4,
    roughness: 0.25,
    metalness: 0.2,
  });
  private energyMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.6,
    roughness: 0.2,
    metalness: 0.4,
  });
  private repairMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 1.5,
    roughness: 0.3,
    metalness: 0.5,
  });
  private whiteCrossMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe2e8f0,
    emissiveIntensity: 0.6,
  });
  private darkCasingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.75,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initCollectibles();
  }

  private initCollectibles() {
    SPAWN_NODES.forEach((node, idx) => {
      const built = this.createCollectibleMesh(node.preferredType);
      built.group.position.set(node.x, 0, node.z);
      this.scene.add(built.group);

      this.items.push({
        id: idx + 1,
        type: node.preferredType,
        active: true,
        respawnTimer: 0,
        position: new THREE.Vector3(node.x, 0, node.z),
        group: built.group,
        ringMesh: built.ringMesh,
        beaconMesh: built.beaconMesh,
        phase: idx * 0.9,
      });
    });
  }

  private createCollectibleMesh(type: CollectibleType) {
    const group = new THREE.Group();

    const mainMat =
      type === 'HEALTH_PACK'
        ? this.healthMat
        : type === 'ENERGY_CELL'
          ? this.energyMat
          : this.repairMat;

    const accentHex =
      type === 'HEALTH_PACK'
        ? 0x10b981
        : type === 'ENERGY_CELL'
          ? 0x38bdf8
          : 0xf59e0b;

    // Ground Holo Ring Indicator
    const ringGeo = new THREE.RingGeometry(0.48, 0.65, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: accentHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      })
    );
    ringMesh.position.y = 0.04;
    group.add(ringMesh);

    // Subtle Vertical Light Beacon Indicator
    const beaconGeo = new THREE.CylinderGeometry(0.28, 0.42, 1.85, 12, 1, true);
    const beaconMesh = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshBasicMaterial({
        color: accentHex,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beaconMesh.position.y = 0.95;
    group.add(beaconMesh);

    const floatingHolder = new THREE.Group();
    floatingHolder.name = 'floatingHolder';
    floatingHolder.position.y = 0.62;

    if (type === 'HEALTH_PACK') {
      // Medkit Case + Cross
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.4, 0.36),
        mainMat
      );
      floatingHolder.add(box);

      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.09, 0.38),
        this.whiteCrossMat
      );
      floatingHolder.add(crossH);

      const crossV = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.26, 0.38),
        this.whiteCrossMat
      );
      floatingHolder.add(crossV);
    } else if (type === 'ENERGY_CELL') {
      // Glowing Plasma Battery Cylinder with End Caps
      const core = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.56, 10),
        mainMat
      );
      floatingHolder.add(core);

      for (const cy of [-0.28, 0.28]) {
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 0.08, 10),
          this.darkCasingMat
        );
        cap.position.y = cy;
        floatingHolder.add(cap);
      }
    } else {
      // Repair Kit Toolbox + Handle
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.38, 0.38),
        mainMat
      );
      floatingHolder.add(body);

      const lid = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.08, 0.4),
        this.darkCasingMat
      );
      lid.position.y = 0.2;
      floatingHolder.add(lid);

      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.08, 0.08),
        this.darkCasingMat
      );
      handle.position.y = 0.29;
      floatingHolder.add(handle);
    }

    group.add(floatingHolder);
    return { group, ringMesh, beaconMesh };
  }

  public reset() {
    this.elapsedTime = 0;
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].active = true;
      this.items[i].respawnTimer = 0;
      this.items[i].group.visible = true;
    }
  }

  /**
   * Replenishes up to `count` previously collected supply nodes when a new wave starts
   * so resources remain balanced across 7 minutes without allowing duplicate collection.
   */
  public replenishWaveSupplies(count = 2) {
    let restored = 0;
    for (let i = 0; i < this.items.length && restored < count; i++) {
      const it = this.items[i];
      if (!it.active) {
        it.active = true;
        it.respawnTimer = 0;
        it.group.visible = true;
        restored++;
      }
    }
  }

  public getNearestCollectible(
    playerPos: THREE.Vector3,
    maxDist = 2.6
  ): CollectibleItem | null {
    let best: CollectibleItem | null = null;
    let bestDist = maxDist;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.active) continue;
      const d = it.position.distanceTo(playerPos);
      if (d < bestDist) {
        bestDist = d;
        best = it;
      }
    }
    return best;
  }

  public collectItem(
    item: CollectibleItem,
    playerHealth: number,
    playerMaxHealth: number,
    reserveAmmo: number,
    maxReserveAmmo: number,
    repairKits: number
  ): {
    collected: boolean;
    healthDelta: number;
    ammoDelta: number;
    kitDelta: number;
    label: string;
    color: 'emerald' | 'cyan' | 'amber';
  } {
    // Prevent duplicate collection
    if (!item.active) {
      return {
        collected: false,
        healthDelta: 0,
        ammoDelta: 0,
        kitDelta: 0,
        label: '',
        color: 'cyan',
      };
    }

    if (item.type === 'HEALTH_PACK') {
      if (playerHealth >= playerMaxHealth) {
        return {
          collected: false,
          healthDelta: 0,
          ammoDelta: 0,
          kitDelta: 0,
          label: 'HEALTH FULL (100/100)',
          color: 'emerald',
        };
      }
      // Restores 35 player health, cannot exceed 100 max health
      const gain = Math.min(35, playerMaxHealth - playerHealth);
      this.consumeItem(item, 42);
      return {
        collected: true,
        healthDelta: gain,
        ammoDelta: 0,
        kitDelta: 0,
        label: `+${Math.round(gain)} HEALTH PACK`,
        color: 'emerald',
      };
    }

    if (item.type === 'ENERGY_CELL') {
      if (reserveAmmo >= maxReserveAmmo) {
        return {
          collected: false,
          healthDelta: 0,
          ammoDelta: 0,
          kitDelta: 0,
          label: 'RESERVE AMMO FULL (120)',
          color: 'cyan',
        };
      }
      // Restores 24 ammunition
      const gain = Math.min(24, maxReserveAmmo - reserveAmmo);
      this.consumeItem(item, 35);
      return {
        collected: true,
        healthDelta: 0,
        ammoDelta: gain,
        kitDelta: 0,
        label: `+${gain} ENERGY CELL`,
        color: 'cyan',
      };
    }

    // REPAIR_KIT: Adds 1 generator repair charge (each restores 35 generator health)
    if (repairKits >= 4) {
      return {
        collected: false,
        healthDelta: 0,
        ammoDelta: 0,
        kitDelta: 0,
        label: 'REPAIR KITS FULL',
        color: 'amber',
      };
    }
    this.consumeItem(item, 48);
    return {
      collected: true,
      healthDelta: 0,
      ammoDelta: 0,
      kitDelta: 1,
      label: '+1 REPAIR KIT CHARGE (+35% GEN HP)',
      color: 'amber',
    };
  }

  private consumeItem(item: CollectibleItem, respawnSeconds: number) {
    item.active = false;
    item.respawnTimer = respawnSeconds;
    item.group.visible = false;
  }

  public update(dt: number) {
    this.elapsedTime += dt;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it.active) {
        it.respawnTimer -= dt;
        if (it.respawnTimer <= 0) {
          it.active = true;
          it.respawnTimer = 0;
          it.group.visible = true;
        }
        continue;
      }

      const holder = it.group.getObjectByName('floatingHolder');
      if (holder) {
        holder.position.y =
          0.62 + Math.sin(this.elapsedTime * 2.8 + it.phase) * 0.12;
        holder.rotation.y += dt * 1.6;
      }
      const s = 1 + Math.sin(this.elapsedTime * 3.5 + it.phase) * 0.1;
      it.ringMesh.scale.set(s, s, 1);
      it.beaconMesh.rotation.y -= dt * 0.8;
    }
  }
}

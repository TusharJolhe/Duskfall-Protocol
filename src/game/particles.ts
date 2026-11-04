import * as THREE from 'three';
import { QualityPreset } from './types';

interface PooledParticle {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
}

interface PooledRing {
  active: boolean;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxRadius: number;
}

export class ParticleSystem {
  private pool: PooledParticle[] = [];
  private rings: PooledRing[] = [];
  private particleGeo: THREE.BufferGeometry;
  private ringGeo: THREE.BufferGeometry;
  private ambientPoints: THREE.Points;
  private ambientGeo: THREE.BufferGeometry;
  private ambientMat: THREE.PointsMaterial;
  private ambientVelocities: Float32Array;
  private ambientPhases: Float32Array;
  private elapsedTime = 0;
  private quality: QualityPreset = 'MEDIUM';

  constructor(scene: THREE.Scene, poolSize = 120) {
    this.particleGeo = new THREE.OctahedronGeometry(0.11, 0);

    for (let i = 0; i < poolSize; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        active: false,
        mesh,
        mat,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        baseScale: 1,
      });
    }

    // Pooled Shockwave / Energy Impact Rings
    this.ringGeo = new THREE.RingGeometry(0.32, 0.48, 20);
    this.ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({
        active: false,
        mesh,
        mat,
        life: 0,
        maxLife: 0.35,
        maxRadius: 2.0,
      });
    }

    // Drifting dusk embers & atmospheric dust motes around the settlement
    const emberCount = 110;
    const positions = new Float32Array(emberCount * 3);
    const colors = new Float32Array(emberCount * 3);
    this.ambientVelocities = new Float32Array(emberCount);
    this.ambientPhases = new Float32Array(emberCount);

    const cCyan = new THREE.Color(0x38bdf8);
    const cAmber = new THREE.Color(0xf59e0b);
    const cDust = new THREE.Color(0x94a3b8);

    for (let i = 0; i < emberCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = 0.4 + Math.random() * 9.0;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      this.ambientVelocities[i] = 0.28 + Math.random() * 0.52;
      this.ambientPhases[i] = Math.random() * Math.PI * 2;

      const c = i % 3 === 0 ? cCyan : i % 3 === 1 ? cAmber : cDust;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    this.ambientGeo = new THREE.BufferGeometry();
    this.ambientGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(positions, 3)
    );
    this.ambientGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.ambientMat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });

    this.ambientPoints = new THREE.Points(this.ambientGeo, this.ambientMat);
    scene.add(this.ambientPoints);
    this.setQuality(this.quality);
  }

  public setQuality(quality: QualityPreset) {
    this.quality = quality;
    if (quality === 'LOW') {
      this.ambientPoints.visible = false;
    } else if (quality === 'MEDIUM') {
      this.ambientPoints.visible = true;
      this.ambientGeo.setDrawRange(0, 55);
    } else {
      this.ambientPoints.visible = true;
      this.ambientGeo.setDrawRange(0, 110);
    }
  }

  public getActiveCount(): number {
    let c = 0;
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) c++;
    }
    for (let i = 0; i < this.rings.length; i++) {
      if (this.rings[i].active) c++;
    }
    return c;
  }

  public reset() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].mesh.visible = false;
    }
    for (let i = 0; i < this.rings.length; i++) {
      this.rings[i].active = false;
      this.rings[i].mesh.visible = false;
    }
  }

  public emitRing(
    origin: THREE.Vector3,
    colorHex: number,
    maxRadius = 2.2,
    duration = 0.34
  ) {
    const r = this.rings.find((item) => !item.active);
    if (!r) return;
    r.active = true;
    r.maxLife = this.quality === 'LOW' ? duration * 0.7 : duration;
    r.life = r.maxLife;
    r.maxRadius = maxRadius;
    r.mat.color.setHex(colorHex);
    r.mat.opacity = 0.85;
    r.mesh.position.set(origin.x, Math.max(0.08, origin.y), origin.z);
    r.mesh.scale.setScalar(0.2);
    r.mesh.visible = true;
  }

  public emitBurst(
    origin: THREE.Vector3,
    count: number,
    colorHex: number,
    speed = 4.5,
    scale = 1.0
  ) {
    // Scale simultaneous particle cap and burst density by preset
    const maxActiveLimit =
      this.quality === 'LOW'
        ? 26
        : this.quality === 'MEDIUM'
          ? 64
          : this.pool.length;
    const mult =
      this.quality === 'LOW' ? 0.3 : this.quality === 'MEDIUM' ? 0.68 : 1.05;
    const lifeScale = this.quality === 'LOW' ? 0.65 : 1.0;
    const actualCount = Math.max(1, Math.round(count * mult));

    let spawned = 0;
    for (let i = 0; i < maxActiveLimit && spawned < actualCount; i++) {
      const p = this.pool[i];
      if (p.active) continue;

      p.active = true;
      p.maxLife = (0.26 + Math.random() * 0.32) * lifeScale;
      p.life = p.maxLife;
      p.baseScale = scale * (0.7 + Math.random() * 0.65);
      p.mat.color.setHex(colorHex);
      p.mat.opacity = 1;

      p.mesh.position.copy(origin);
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;

      const theta = Math.random() * Math.PI * 2;
      const up = 0.32 + Math.random() * 0.92;
      const horiz = (0.3 + Math.random() * 0.7) * speed;
      p.velocity.set(
        Math.cos(theta) * horiz,
        up * speed * 0.68,
        Math.sin(theta) * horiz
      );

      spawned++;
    }
  }

  public update(dt: number) {
    this.elapsedTime += dt;

    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.velocity.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.mesh.position.y < 0.06) {
        p.mesh.position.y = 0.06;
        p.velocity.y *= -0.32;
      }

      const ratio = p.life / p.maxLife;
      p.mat.opacity = ratio;
      p.mesh.scale.setScalar(p.baseScale * (0.3 + ratio * 0.7));
      p.mesh.rotation.x += dt * 5.5;
      p.mesh.rotation.y += dt * 4.5;
    }

    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.active) continue;

      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      const s = THREE.MathUtils.lerp(0.25, r.maxRadius, progress);
      r.mesh.scale.setScalar(s);
      r.mat.opacity = (1 - progress) * 0.85;
    }

    // Animate drifting dusk motes when visible (MEDIUM / HIGH)
    if (this.ambientPoints.visible) {
      const posAttr = this.ambientGeo.attributes
        .position as THREE.BufferAttribute;
      const activeMotes = this.quality === 'MEDIUM' ? 55 : posAttr.count;
      for (let i = 0; i < activeMotes; i++) {
        let x =
          posAttr.getX(i) +
          Math.sin(this.elapsedTime * 0.9 + this.ambientPhases[i]) * 0.25 * dt;
        let y = posAttr.getY(i) + this.ambientVelocities[i] * dt;
        if (y > 9.2) y = 0.4;
        if (x > 30) x = -30;
        if (x < -30) x = 30;
        posAttr.setXY(i, x, y);
      }
      posAttr.needsUpdate = true;
    }
  }

  public dispose() {
    this.particleGeo.dispose();
    this.ringGeo.dispose();
    this.ambientGeo.dispose();
    this.ambientMat.dispose();
    this.pool.forEach((p) => p.mat.dispose());
    this.rings.forEach((r) => r.mat.dispose());
  }
}

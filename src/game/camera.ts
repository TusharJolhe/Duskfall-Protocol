import * as THREE from 'three';
import { ObstacleAABB } from './types';

const _desiredPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  public yaw = Math.PI;
  public pitch = -0.2;
  private currentPos = new THREE.Vector3(0, 4, 12);
  private currentLook = new THREE.Vector3(0, 1.5, 0);
  private shakeIntensity = 0;
  private menuOrbitAngle = 0.65;
  private currentFov = 61;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(61, aspect, 0.15, 175);
    this.camera.position.copy(this.currentPos);
  }

  public reset(playerPos: THREE.Vector3, playerYaw: number) {
    this.yaw = playerYaw;
    this.pitch = -0.2;
    this.shakeIntensity = 0;
    this.currentFov = 61;
    this.camera.fov = 61;
    this.camera.updateProjectionMatrix();
    this.computeCameraGoal(playerPos, _desiredPos, _lookTarget);
    this.currentPos.copy(_desiredPos);
    this.currentLook.copy(_lookTarget);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }

  public addShake(amount: number) {
    this.shakeIntensity = Math.min(0.42, this.shakeIntensity + amount);
  }

  public applyLookDelta(
    dx: number,
    dy: number,
    sensitivity: number,
    cameraSensitivity: number
  ) {
    const scale = 0.0028 * sensitivity * cameraSensitivity;
    this.yaw -= dx * scale;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * scale * 0.85,
      -0.68,
      0.32
    );
  }

  private computeCameraGoal(
    playerPos: THREE.Vector3,
    outPos: THREE.Vector3,
    outLook: THREE.Vector3
  ) {
    // Balanced over-the-shoulder right offset with clear distant horizon framing
    const dist = 4.65;
    const height = 2.08;
    const shoulderOffset = 0.72;

    const horizontalDist = dist * Math.cos(this.pitch);
    const verticalOffset = -dist * Math.sin(this.pitch);

    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    outPos.set(
      playerPos.x - forwardX * horizontalDist + rightX * shoulderOffset,
      playerPos.y + height + verticalOffset,
      playerPos.z - forwardZ * horizontalDist + rightZ * shoulderOffset
    );

    outLook.set(
      playerPos.x + forwardX * 6.8 + rightX * (shoulderOffset * 0.45),
      playerPos.y + 1.48 + Math.sin(this.pitch) * 3.9,
      playerPos.z + forwardZ * 6.8 + rightZ * (shoulderOffset * 0.45)
    );
  }

  public updatePlaying(
    dt: number,
    playerPos: THREE.Vector3,
    obstacles: ObstacleAABB[],
    isSprinting = false
  ) {
    this.computeCameraGoal(playerPos, _desiredPos, _lookTarget);

    // Subtle dynamic FOV response when sprinting
    const targetFov = isSprinting ? 64.2 : 61.0;
    if (Math.abs(this.currentFov - targetFov) > 0.05) {
      this.currentFov = THREE.MathUtils.damp(
        this.currentFov,
        targetFov,
        10,
        dt
      );
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // Prevent camera from clipping inside settlement buildings
    const pivotX = playerPos.x;
    const pivotZ = playerPos.z;
    _rayDir.set(_desiredPos.x - pivotX, 0, _desiredPos.z - pivotZ);
    const totalDist = _rayDir.length();
    if (totalDist > 0.01) {
      _rayDir.divideScalar(totalDist);
      let safeFraction = 1.0;
      const samples = 8;
      for (let s = 1; s <= samples; s++) {
        const frac = s / samples;
        const sx = pivotX + _rayDir.x * totalDist * frac;
        const sz = pivotZ + _rayDir.z * totalDist * frac;
        let hit = false;
        for (let i = 0; i < obstacles.length; i++) {
          const b = obstacles[i];
          if (!b.blocksCamera) continue;
          if (
            sx > b.minX - 0.35 &&
            sx < b.maxX + 0.35 &&
            sz > b.minZ - 0.35 &&
            sz < b.maxZ + 0.35 &&
            _desiredPos.y < b.height + 0.4
          ) {
            hit = true;
            break;
          }
        }
        if (hit) {
          safeFraction = Math.max(0.28, (s - 1) / samples);
          break;
        }
      }
      if (safeFraction < 1.0) {
        _desiredPos.x = pivotX + (_desiredPos.x - pivotX) * safeFraction;
        _desiredPos.z = pivotZ + (_desiredPos.z - pivotZ) * safeFraction;
      }
    }

    // Clamp minimum ground clearance
    _desiredPos.y = Math.max(0.85, _desiredPos.y);

    // Smooth camera interpolation
    const dampLambda = 16;
    this.currentPos.x = THREE.MathUtils.damp(
      this.currentPos.x,
      _desiredPos.x,
      dampLambda,
      dt
    );
    this.currentPos.y = THREE.MathUtils.damp(
      this.currentPos.y,
      _desiredPos.y,
      dampLambda,
      dt
    );
    this.currentPos.z = THREE.MathUtils.damp(
      this.currentPos.z,
      _desiredPos.z,
      dampLambda,
      dt
    );

    this.currentLook.x = THREE.MathUtils.damp(
      this.currentLook.x,
      _lookTarget.x,
      20,
      dt
    );
    this.currentLook.y = THREE.MathUtils.damp(
      this.currentLook.y,
      _lookTarget.y,
      20,
      dt
    );
    this.currentLook.z = THREE.MathUtils.damp(
      this.currentLook.z,
      _lookTarget.z,
      20,
      dt
    );

    this.camera.position.copy(this.currentPos);

    // Controlled combat screen shake
    if (this.shakeIntensity > 0.001) {
      this.camera.position.x +=
        (Math.random() - 0.5) * this.shakeIntensity * 0.38;
      this.camera.position.y +=
        (Math.random() - 0.5) * this.shakeIntensity * 0.38;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.3);
    }

    this.camera.lookAt(this.currentLook);
  }

  public updateMenuOrbit(dt: number) {
    this.menuOrbitAngle += dt * 0.12;
    const radius = 17.5 + Math.sin(this.menuOrbitAngle * 0.5) * 1.8;
    this.camera.position.set(
      Math.cos(this.menuOrbitAngle) * radius,
      5.8 + Math.sin(this.menuOrbitAngle * 0.7) * 1.15,
      Math.sin(this.menuOrbitAngle) * radius
    );
    this.camera.lookAt(0, 2.35, 0);
  }

  public resize(width: number, height: number) {
    this.camera.aspect = Math.max(0.1, width / Math.max(1, height));
    this.camera.updateProjectionMatrix();
  }
}

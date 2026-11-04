import * as THREE from 'three';
import { ObstacleAABB, QualityPreset } from './types';

export interface WorldContext {
  worldGroup: THREE.Group;
  obstacles: ObstacleAABB[];
  streetLights: THREE.PointLight[];
  sparkPositions: THREE.Vector3[];
  updateQuality: (quality: QualityPreset, isSoftwareGl: boolean) => void;
  updateEnvironment: (
    dt: number,
    elapsedTime: number,
    quality: QualityPreset
  ) => void;
  dispose: () => void;
}

function createProceduralAsphaltTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#181b26';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = 20 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${v}, ${v + 3}, ${v + 12})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = '#0e1017';
  ctx.lineWidth = 1.5;
  for (let c = 0; c < 6; c++) {
    ctx.beginPath();
    let cx = Math.random() * 256;
    let cy = Math.random() * 256;
    ctx.moveTo(cx, cy);
    for (let s = 0; s < 5; s++) {
      cx += (Math.random() - 0.5) * 36;
      cy += (Math.random() - 0.5) * 36;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(217, 140, 46, 0.42)';
  ctx.fillRect(124, 16, 8, 88);
  ctx.fillRect(124, 152, 8, 88);

  ctx.fillStyle = 'rgba(75, 85, 108, 0.55)';
  ctx.fillRect(4, 0, 6, 256);
  ctx.fillRect(246, 0, 6, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createProceduralWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4e382a';
  ctx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle =
      y % 32 === 0 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, 128, 14);
    ctx.fillStyle = '#291c14';
    ctx.fillRect(0, y + 14, 128, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createProceduralConcreteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#3b4254';
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const shade = 48 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 16})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = 'rgba(20, 24, 34, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 60, 60);
  ctx.strokeRect(66, 2, 60, 60);
  ctx.strokeRect(2, 66, 60, 60);
  ctx.strokeRect(66, 66, 60, 60);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSettlementWorld(
  scene: THREE.Scene,
  quality: QualityPreset,
  isSoftwareGl: boolean
): WorldContext {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // Decorative detail group toggled on LOW vs MEDIUM/HIGH
  const decorativeGroup = new THREE.Group();
  worldGroup.add(decorativeGroup);

  const obstacles: ObstacleAABB[] = [];
  const streetLights: THREE.PointLight[] = [];
  const volumetricCones: THREE.Mesh[] = [];
  const upperTreeCones: THREE.Mesh[] = [];
  const flickeringLights: {
    light: THREE.PointLight;
    bulbMat: THREE.MeshStandardMaterial;
    coneMat: THREE.MeshBasicMaterial;
    baseIntensity: number;
    phase: number;
  }[] = [];
  const sparkPositions: THREE.Vector3[] = [];
  const treeFoliageClusters: THREE.Object3D[] = [];

  const disposableGeometries: THREE.BufferGeometry[] = [];
  const disposableMaterials: THREE.Material[] = [];
  const disposableTextures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposableGeometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposableMaterials.push(m);
    return m;
  };

  // Shared Reusable Primitive Geometries (eliminates hundreds of duplicate buffer allocations)
  const unitBoxGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
  const unitCyl8Geo = trackGeo(new THREE.CylinderGeometry(1, 1, 1, 8));
  const unitCone4Geo = trackGeo(new THREE.ConeGeometry(1, 1, 4));
  const unitCone7Geo = trackGeo(new THREE.ConeGeometry(1, 1, 7));

  // 1. Cinematic Dusk Sky & Atmospheric Fog
  const skyColor = new THREE.Color(0x101328);
  scene.background = skyColor;
  const sceneFog = new THREE.FogExp2(0x17142b, 0.0132);
  scene.fog = sceneFog;

  // Rich 4-Stop Dusk Sky Dome
  const skyGeo = trackGeo(new THREE.SphereGeometry(148, 24, 16));
  const skyCount = skyGeo.attributes.position.count;
  const skyColors = new Float32Array(skyCount * 3);
  const zenithCol = new THREE.Color(0x070a18);
  const upperMidCol = new THREE.Color(0x1c1635);
  const lowerMidCol = new THREE.Color(0x3b2142);
  const horizonGlowCol = new THREE.Color(0x7c3a4d);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < skyCount; i++) {
    const x = skyGeo.attributes.position.getX(i);
    const y = skyGeo.attributes.position.getY(i);
    const z = skyGeo.attributes.position.getZ(i);
    const t = THREE.MathUtils.clamp((y + 18) / 145, 0, 1);
    const sunDirBias = THREE.MathUtils.clamp((-x - z) / 210, 0, 0.35);

    if (t < 0.18) {
      tmpCol.lerpColors(horizonGlowCol, lowerMidCol, t / 0.18);
    } else if (t < 0.48) {
      tmpCol.lerpColors(lowerMidCol, upperMidCol, (t - 0.18) / 0.3);
    } else {
      tmpCol.lerpColors(upperMidCol, zenithCol, (t - 0.48) / 0.52);
    }
    if (t < 0.35) {
      tmpCol.r = Math.min(1, tmpCol.r + sunDirBias * 0.25);
      tmpCol.g = Math.min(1, tmpCol.g + sunDirBias * 0.08);
    }

    skyColors[i * 3] = tmpCol.r;
    skyColors[i * 3 + 1] = tmpCol.g;
    skyColors[i * 3 + 2] = tmpCol.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const skyMat = trackMat(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
    })
  );
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.matrixAutoUpdate = false;
  skyDome.updateMatrix();
  worldGroup.add(skyDome);

  // Distant Low-Poly Mountain Silhouette Ring (placed in decorativeGroup)
  const mountainMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x111024,
      fog: true,
    })
  );
  const mountainPeaks = 24;
  for (let i = 0; i < mountainPeaks; i++) {
    const ang = (i / mountainPeaks) * Math.PI * 2;
    const dist = 102 + (i % 3) * 6;
    const h = 16 + ((i * 7) % 15);
    const w = 18 + (i % 4) * 4;
    const peak = new THREE.Mesh(unitCone4Geo, mountainMat);
    peak.scale.set(w, h, w);
    peak.position.set(Math.cos(ang) * dist, h * 0.42 - 1, Math.sin(ang) * dist);
    peak.rotation.y = ang + Math.PI / 4;
    peak.matrixAutoUpdate = false;
    peak.updateMatrix();
    decorativeGroup.add(peak);
  }

  // 2. Balanced Warm-vs-Cool Dusk Lighting Setup
  const hemiLight = new THREE.HemisphereLight(0x5268ab, 0x1d1726, 0.95);
  hemiLight.position.set(0, 50, 0);
  worldGroup.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffa066, 1.48);
  dirLight.position.set(-40, 44, -30);
  dirLight.castShadow = !isSoftwareGl && quality !== 'LOW';
  const initShadowRes =
    quality === 'HIGH' ? 1536 : quality === 'MEDIUM' ? 512 : 256;
  dirLight.shadow.mapSize.width = initShadowRes;
  dirLight.shadow.mapSize.height = initShadowRes;
  const d = 42;
  dirLight.shadow.camera.left = -d;
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;
  dirLight.shadow.camera.near = 4;
  dirLight.shadow.camera.far = 115;
  dirLight.shadow.bias = -0.0006;
  dirLight.shadow.normalBias = 0.025;
  worldGroup.add(dirLight);

  // Cool indigo-cyan rim light (active on MEDIUM/HIGH, disabled on LOW)
  const rimLight = new THREE.DirectionalLight(0x4c78ff, 0.52);
  rimLight.position.set(36, 28, 36);
  worldGroup.add(rimLight);

  // 3. Shared Procedural Textures & Rich PBR Materials
  const asphaltTex = createProceduralAsphaltTexture();
  const woodTex = createProceduralWoodTexture();
  const concreteTex = createProceduralConcreteTexture();
  disposableTextures.push(asphaltTex, woodTex, concreteTex);

  const groundMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.93,
      metalness: 0.04,
    })
  );
  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.82,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const dirtPathMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2b2428,
      roughness: 0.95,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const gravelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x333846,
      roughness: 0.9,
      metalness: 0.08,
    })
  );
  const plazaMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: concreteTex,
      color: 0x8896b0,
      roughness: 0.72,
      metalness: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const woodMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: woodTex,
      color: 0x9c7a63,
      roughness: 0.84,
      metalness: 0.05,
    })
  );
  const darkWoodMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: woodTex,
      color: 0x634b3b,
      roughness: 0.88,
      metalness: 0.04,
    })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2b3242,
      roughness: 0.38,
      metalness: 0.82,
    })
  );
  const brushedSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.32,
      metalness: 0.85,
    })
  );
  const rustMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x633b2c,
      roughness: 0.72,
      metalness: 0.52,
    })
  );
  const concreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: concreteTex,
      color: 0x7b8499,
      roughness: 0.85,
      metalness: 0.1,
    })
  );
  const brickMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x59342e,
      roughness: 0.88,
      metalness: 0.06,
    })
  );
  const warmWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffa94d,
      emissive: 0xff7b1c,
      emissiveIntensity: 0.85,
      roughness: 0.22,
    })
  );
  const dimWindowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1c2838,
      emissive: 0x0e1726,
      emissiveIntensity: 0.2,
      roughness: 0.15,
      metalness: 0.85,
    })
  );
  const hazardMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.45,
      metalness: 0.25,
    })
  );

  // 4. Sculpted Vertex-Colored Terrain
  const groundGeo = trackGeo(new THREE.PlaneGeometry(195, 195, 48, 48));
  groundGeo.rotateX(-Math.PI / 2);
  const gPos = groundGeo.attributes.position;
  const gCols = new Float32Array(gPos.count * 3);
  const cSoil = new THREE.Color(0x1b202e);
  const cMoss = new THREE.Color(0x1b2b2b);
  const cDuskGravel = new THREE.Color(0x282738);
  const cOuterHill = new THREE.Color(0x131724);

  for (let i = 0; i < gPos.count; i++) {
    const vx = gPos.getX(i);
    const vz = gPos.getZ(i);
    const r = Math.hypot(vx, vz);

    let vy = 0;
    if (r > 36.5) {
      const hillFactor = Math.min(1, (r - 36.5) / 42);
      const wave =
        Math.sin(vx * 0.08) * Math.cos(vz * 0.08) * 3.8 +
        Math.sin(vx * 0.03 - vz * 0.04) * 4.5;
      vy = Math.max(0, (wave + 2.6) * hillFactor * hillFactor);
    }
    gPos.setY(i, vy);

    const noise =
      0.5 +
      0.5 *
        Math.sin(vx * 0.19 + vz * 0.13) *
        Math.cos(vx * 0.11 - vz * 0.17);
    tmpCol.copy(cSoil).lerp(cMoss, noise * 0.65);
    if (r < 18) {
      tmpCol.lerp(cDuskGravel, 1 - r / 18);
    } else if (r > 38) {
      tmpCol.lerp(cOuterHill, Math.min(1, (r - 38) / 40));
    }
    gCols[i * 3] = tmpCol.r;
    gCols[i * 3 + 1] = tmpCol.g;
    gCols[i * 3 + 2] = tmpCol.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(gCols, 3));
  groundGeo.computeVertexNormals();

  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.receiveShadow = true;
  groundMesh.matrixAutoUpdate = false;
  groundMesh.updateMatrix();
  worldGroup.add(groundMesh);

  // Central Plaza Platform & Conduit Rings
  const outerPlaza = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(9.4, 9.9, 0.14, 24)),
    concreteMat
  );
  outerPlaza.position.set(0, 0.07, 0);
  outerPlaza.receiveShadow = true;
  outerPlaza.matrixAutoUpdate = false;
  outerPlaza.updateMatrix();
  worldGroup.add(outerPlaza);

  const innerPlaza = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(7.2, 7.5, 0.18, 16)),
    plazaMat
  );
  innerPlaza.position.set(0, 0.09, 0);
  innerPlaza.receiveShadow = true;
  innerPlaza.matrixAutoUpdate = false;
  innerPlaza.updateMatrix();
  worldGroup.add(innerPlaza);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const conduit = new THREE.Mesh(unitBoxGeo, darkMetalMat);
    conduit.scale.set(0.42, 0.14, 6.8);
    conduit.position.set(Math.cos(a) * 5.6, 0.09, Math.sin(a) * 5.6);
    conduit.rotation.y = a;
    conduit.receiveShadow = true;
    conduit.matrixAutoUpdate = false;
    conduit.updateMatrix();
    worldGroup.add(conduit);
  }

  // Cracked Asphalt Cross-Roads
  const roadPlaneGeo = trackGeo(new THREE.PlaneGeometry(7.4, 110));
  const roadNS = new THREE.Mesh(roadPlaneGeo, roadMat);
  roadNS.rotation.x = -Math.PI / 2;
  roadNS.position.y = 0.02;
  roadNS.receiveShadow = true;
  roadNS.matrixAutoUpdate = false;
  roadNS.updateMatrix();
  worldGroup.add(roadNS);

  const roadEW = new THREE.Mesh(roadPlaneGeo, roadMat);
  roadEW.rotation.x = -Math.PI / 2;
  roadEW.rotation.z = Math.PI / 2;
  roadEW.position.y = 0.025;
  roadEW.receiveShadow = true;
  roadEW.matrixAutoUpdate = false;
  roadEW.updateMatrix();
  worldGroup.add(roadEW);

  // Diagonal Dirt Paths & Gravel Patches (placed in decorativeGroup)
  const discGeo = trackGeo(new THREE.CircleGeometry(1, 10));
  const patchConfigs = [
    { x: -12, z: -11, rx: 4.2, rz: 2.8, rot: 0.7, mat: dirtPathMat },
    { x: 12, z: -11, rx: 4.0, rz: 2.6, rot: -0.7, mat: dirtPathMat },
    { x: -13, z: 11, rx: 4.5, rz: 2.9, rot: -0.65, mat: dirtPathMat },
    { x: 12, z: 12, rx: 4.2, rz: 2.8, rot: 0.75, mat: dirtPathMat },
    { x: -7, z: -17, rx: 2.8, rz: 2.1, rot: 0.2, mat: gravelMat },
    { x: 8, z: 16, rx: 3.1, rz: 2.0, rot: -0.4, mat: gravelMat },
    { x: -16, z: 3, rx: 2.6, rz: 2.2, rot: 1.1, mat: gravelMat },
    { x: 16, z: -4, rx: 2.9, rz: 1.9, rot: 0.5, mat: gravelMat },
  ];
  patchConfigs.forEach((p) => {
    const disc = new THREE.Mesh(discGeo, p.mat);
    disc.rotation.x = -Math.PI / 2;
    disc.rotation.z = p.rot;
    disc.scale.set(p.rx, p.rz, 1);
    disc.position.set(p.x, 0.018, p.z);
    disc.receiveShadow = true;
    disc.matrixAutoUpdate = false;
    disc.updateMatrix();
    decorativeGroup.add(disc);
  });

  // Broken Concrete Curb Slabs along roads (in decorativeGroup)
  const rubbleCoords = [
    [-4.3, -10.5, 0.2],
    [4.4, -15.2, -0.4],
    [-4.2, 13.8, 0.5],
    [4.3, 11.4, -0.15],
    [-12.5, -4.2, 1.2],
    [14.2, 4.3, -0.8],
    [-18.4, 4.1, 0.35],
    [19.0, -4.2, 1.1],
  ];
  rubbleCoords.forEach(([rx, rz, rot]) => {
    const slab = new THREE.Mesh(unitBoxGeo, concreteMat);
    slab.scale.set(1.1, 0.14, 0.75);
    slab.position.set(rx, 0.07, rz);
    slab.rotation.set(0.05, rot, -0.04);
    slab.receiveShadow = true;
    slab.matrixAutoUpdate = false;
    slab.updateMatrix();
    decorativeGroup.add(slab);
  });

  const addObstacle = (
    x: number,
    z: number,
    halfW: number,
    halfD: number,
    height: number,
    blocksCamera = true
  ) => {
    obstacles.push({
      minX: x - halfW,
      maxX: x + halfW,
      minZ: z - halfD,
      maxZ: z + halfD,
      height,
      blocksCamera,
    });
  };

  const createGableRoof = (
    width: number,
    depth: number,
    rise: number,
    roofMaterial: THREE.Material,
    trimMaterial: THREE.Material
  ) => {
    const roofGroup = new THREE.Group();
    const pitchAngle = Math.atan2(rise, width * 0.5);
    const slopeLen = Math.hypot(width * 0.5 + 0.35, rise);

    for (const side of [-1, 1]) {
      const slope = new THREE.Mesh(unitBoxGeo, roofMaterial);
      slope.scale.set(slopeLen, 0.16, depth + 0.6);
      slope.position.set(side * (width * 0.25 + 0.08), rise * 0.5 - 0.05, 0);
      slope.rotation.z = -side * pitchAngle;
      slope.castShadow = true;
      slope.receiveShadow = true;
      roofGroup.add(slope);
    }

    const ridge = new THREE.Mesh(unitBoxGeo, trimMaterial);
    ridge.scale.set(0.28, 0.22, depth + 0.68);
    ridge.position.set(0, rise, 0);
    roofGroup.add(ridge);

    const gableShape = new THREE.Shape();
    gableShape.moveTo(-width * 0.5, 0);
    gableShape.lineTo(width * 0.5, 0);
    gableShape.lineTo(0, rise);
    gableShape.closePath();
    const gableGeo = trackGeo(
      new THREE.ExtrudeGeometry(gableShape, {
        depth: depth,
        bevelEnabled: false,
      })
    );
    gableGeo.translate(0, 0, -depth * 0.5);
    const gableMesh = new THREE.Mesh(gableGeo, trimMaterial);
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    roofGroup.add(gableMesh);

    return roofGroup;
  };

  // 5. Detailed Abandoned Settlement Houses
  const buildHouse = (
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    rotY: number,
    wallHex: number,
    roofHex: number,
    variant: number
  ) => {
    const house = new THREE.Group();
    house.position.set(x, 0, z);
    house.rotation.y = rotY;

    const wallMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: wallHex,
        roughness: 0.84,
        metalness: 0.06,
      })
    );
    const roofMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: roofHex,
        roughness: 0.68,
        metalness: 0.22,
      })
    );

    const found = new THREE.Mesh(unitBoxGeo, concreteMat);
    found.scale.set(w + 0.45, 0.44, d + 0.45);
    found.position.y = 0.22;
    found.receiveShadow = true;
    house.add(found);

    const body = new THREE.Mesh(unitBoxGeo, wallMat);
    body.scale.set(w, h, d);
    body.position.y = 0.44 + h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    house.add(body);

    for (const cx of [-w / 2, w / 2]) {
      for (const cz of [-d / 2, d / 2]) {
        const trim = new THREE.Mesh(unitBoxGeo, darkWoodMat);
        trim.scale.set(0.22, h + 0.06, 0.22);
        trim.position.set(cx, 0.44 + h / 2, cz);
        house.add(trim);
      }
    }

    const belt = new THREE.Mesh(unitBoxGeo, darkWoodMat);
    belt.scale.set(w + 0.14, 0.18, d + 0.14);
    belt.position.y = 1.45;
    house.add(belt);

    const roofRise = 1.85 + (variant % 2) * 0.35;
    const gableRoof = createGableRoof(w, d, roofRise, roofMat, darkWoodMat);
    gableRoof.position.y = 0.44 + h;
    house.add(gableRoof);

    if (variant % 2 === 0) {
      const dormer = new THREE.Mesh(unitBoxGeo, wallMat);
      dormer.scale.set(1.5, 1.05, 1.4);
      dormer.position.set(0, 0.44 + h + 0.72, d * 0.22);
      house.add(dormer);

      const dormerRoof = new THREE.Mesh(unitCone4Geo, roofMat);
      dormerRoof.scale.set(1.15, 0.65, 1.15);
      dormerRoof.position.set(0, 0.44 + h + 1.52, d * 0.22);
      dormerRoof.rotation.y = Math.PI / 4;
      house.add(dormerRoof);

      const dormerWin = new THREE.Mesh(unitBoxGeo, warmWindowMat);
      dormerWin.scale.set(0.68, 0.55, 0.1);
      dormerWin.position.set(0, 0.44 + h + 0.72, d * 0.22 + 0.68);
      house.add(dormerWin);
    } else {
      const hvac = new THREE.Mesh(unitBoxGeo, darkMetalMat);
      hvac.scale.set(1.3, 0.75, 1.1);
      hvac.position.set(-w * 0.2, 0.44 + h + 0.85, -d * 0.15);
      house.add(hvac);

      const ventCap = new THREE.Mesh(unitCyl8Geo, brushedSteelMat);
      ventCap.scale.set(0.24, 0.6, 0.24);
      ventCap.position.set(-w * 0.2 + 0.4, 0.44 + h + 1.35, -d * 0.15);
      house.add(ventCap);
    }

    const chimney = new THREE.Mesh(unitBoxGeo, brickMat);
    chimney.scale.set(0.82, 2.45, 0.82);
    chimney.position.set(w * 0.28, 0.44 + h + 1.15, -d * 0.22);
    chimney.castShadow = true;
    house.add(chimney);

    const chimneyCap = new THREE.Mesh(unitBoxGeo, concreteMat);
    chimneyCap.scale.set(0.98, 0.16, 0.98);
    chimneyCap.position.set(w * 0.28, 0.44 + h + 2.4, -d * 0.22);
    house.add(chimneyCap);

    // Front Porch
    const porchW = w * 0.62;
    const porchDeck = new THREE.Mesh(unitBoxGeo, woodMat);
    porchDeck.scale.set(porchW, 0.36, 1.55);
    porchDeck.position.set(0, 0.22, d / 2 + 0.75);
    porchDeck.receiveShadow = true;
    house.add(porchDeck);

    const porchRoof = new THREE.Mesh(unitBoxGeo, roofMat);
    porchRoof.scale.set(porchW + 0.3, 0.18, 1.75);
    porchRoof.position.set(0, 2.72, d / 2 + 0.8);
    porchRoof.rotation.x = 0.16;
    house.add(porchRoof);

    for (const px of [-porchW * 0.44, porchW * 0.44]) {
      const pillar = new THREE.Mesh(unitBoxGeo, darkWoodMat);
      pillar.scale.set(0.18, 2.35, 0.18);
      pillar.position.set(px, 1.4, d / 2 + 1.42);
      house.add(pillar);

      const rail = new THREE.Mesh(unitBoxGeo, woodMat);
      rail.scale.set(0.1, 0.65, 1.35);
      rail.position.set(px, 0.72, d / 2 + 0.75);
      house.add(rail);
    }

    if (variant === 1 || variant === 4) {
      const balc = new THREE.Mesh(unitBoxGeo, darkWoodMat);
      balc.scale.set(w * 0.46, 0.16, 1.1);
      balc.position.set(0, 3.05, -d / 2 - 0.5);
      house.add(balc);

      const balcRail = new THREE.Mesh(unitBoxGeo, woodMat);
      balcRail.scale.set(w * 0.46, 0.65, 0.1);
      balcRail.position.set(0, 3.42, -d / 2 - 0.98);
      house.add(balcRail);
    }

    const doorFrame = new THREE.Mesh(unitBoxGeo, darkWoodMat);
    doorFrame.scale.set(1.32, 2.18, 0.16);
    doorFrame.position.set(0, 1.48, d / 2 + 0.03);
    house.add(doorFrame);

    const door = new THREE.Mesh(unitBoxGeo, woodMat);
    door.scale.set(1.08, 2.02, 0.12);
    door.position.set(0, 1.44, d / 2 + 0.06);
    house.add(door);

    const windowOffsets = [-w * 0.31, w * 0.31];
    windowOffsets.forEach((wx, wIdx) => {
      const isLit = (variant + wIdx) % 2 === 0;
      const winFrame = new THREE.Mesh(unitBoxGeo, darkWoodMat);
      winFrame.scale.set(1.22, 1.24, 0.14);
      winFrame.position.set(wx, 2.12, d / 2 + 0.03);
      house.add(winFrame);

      const winPane = new THREE.Mesh(
        unitBoxGeo,
        isLit ? warmWindowMat : dimWindowMat
      );
      winPane.scale.set(0.98, 1.0, 0.1);
      winPane.position.set(wx, 2.12, d / 2 + 0.05);
      house.add(winPane);

      const sill = new THREE.Mesh(unitBoxGeo, concreteMat);
      sill.scale.set(1.36, 0.12, 0.24);
      sill.position.set(wx, 1.48, d / 2 + 0.08);
      house.add(sill);

      for (const py of [-0.22, 0.22]) {
        const plank = new THREE.Mesh(unitBoxGeo, woodMat);
        plank.scale.set(1.32, 0.16, 0.08);
        plank.position.set(wx, 2.12 + py, d / 2 + 0.11);
        plank.rotation.z = (wIdx === 0 ? 0.14 : -0.18) + py * 0.25;
        house.add(plank);
      }
    });

    for (const sideSign of [-1, 1]) {
      const sideWinFrame = new THREE.Mesh(unitBoxGeo, darkWoodMat);
      sideWinFrame.scale.set(0.14, 1.15, 1.15);
      sideWinFrame.position.set(sideSign * (w / 2 + 0.02), 2.15, 0);
      house.add(sideWinFrame);

      const sidePane = new THREE.Mesh(
        unitBoxGeo,
        sideSign < 0 && variant % 3 === 0 ? warmWindowMat : dimWindowMat
      );
      sidePane.scale.set(0.1, 0.94, 0.94);
      sidePane.position.set(sideSign * (w / 2 + 0.04), 2.15, 0);
      house.add(sidePane);
    }

    house.updateMatrixWorld(true);
    house.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(house);

    const isRotated = Math.abs(Math.sin(rotY)) > 0.7;
    const halfW = (isRotated ? d : w) / 2 + 0.45;
    const halfD = (isRotated ? w : d) / 2 + 0.45;
    addObstacle(x, z, halfW, halfD, h + 2.2, true);
  };

  buildHouse(-18, -16, 7.2, 5.8, 3.8, 0, 0x3d4659, 0x262030, 0);
  buildHouse(19, -17, 6.6, 5.6, 3.6, -Math.PI / 2, 0x4b404e, 0x242636, 1);
  buildHouse(-20, 17, 6.8, 6.0, 3.9, Math.PI / 2, 0x38474f, 0x2b2230, 2);
  buildHouse(18, 18, 7.4, 5.8, 3.7, Math.PI, 0x4d423d, 0x222736, 3);
  buildHouse(-27, -2, 5.8, 5.2, 3.5, Math.PI / 2, 0x3d3d54, 0x251d2b, 4);
  buildHouse(27, 3, 6.0, 5.4, 3.6, -Math.PI / 2, 0x3e4954, 0x2a222e, 5);

  // 6. Distinguishable Abandoned Vehicles
  const wheelGeo = trackGeo(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 12));
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8));
  hubGeo.rotateZ(Math.PI / 2);
  const headlightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
    })
  );
  const taillightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.4,
    })
  );

  const buildVehicle = (
    x: number,
    z: number,
    rotY: number,
    bodyHex: number,
    style: 'PICKUP' | 'SUV' | 'VAN' | 'SEDAN'
  ) => {
    const car = new THREE.Group();
    car.position.set(x, 0, z);
    car.rotation.y = rotY;
    car.rotation.z = (Math.random() - 0.5) * 0.05;

    const carMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: bodyHex,
        roughness: 0.48,
        metalness: 0.65,
      })
    );

    const chassis = new THREE.Mesh(unitBoxGeo, carMat);
    chassis.scale.set(2.12, 0.72, 4.45);
    chassis.position.y = 0.64;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    car.add(chassis);

    const underbody = new THREE.Mesh(unitBoxGeo, darkMetalMat);
    underbody.scale.set(2.18, 0.22, 3.8);
    underbody.position.y = 0.36;
    car.add(underbody);

    if (style === 'PICKUP') {
      const cab = new THREE.Mesh(unitBoxGeo, carMat);
      cab.scale.set(1.9, 0.76, 1.65);
      cab.position.set(0, 1.34, -0.35);
      cab.castShadow = true;
      car.add(cab);

      const glass = new THREE.Mesh(unitBoxGeo, dimWindowMat);
      glass.scale.set(1.94, 0.54, 1.45);
      glass.position.set(0, 1.36, -0.35);
      car.add(glass);

      for (const bx of [-0.96, 0.96]) {
        const bedSide = new THREE.Mesh(unitBoxGeo, carMat);
        bedSide.scale.set(0.16, 0.42, 1.75);
        bedSide.position.set(bx, 1.15, 1.25);
        car.add(bedSide);
      }
      const bedCrate = new THREE.Mesh(unitBoxGeo, woodMat);
      bedCrate.scale.set(1.1, 0.65, 1.0);
      bedCrate.position.set(0.1, 1.18, 1.25);
      bedCrate.rotation.y = 0.22;
      car.add(bedCrate);
    } else if (style === 'VAN') {
      const vanBody = new THREE.Mesh(unitBoxGeo, carMat);
      vanBody.scale.set(2.02, 1.05, 3.35);
      vanBody.position.set(0, 1.42, 0.3);
      vanBody.castShadow = true;
      car.add(vanBody);

      const vanStripe = new THREE.Mesh(unitBoxGeo, hazardMat);
      vanStripe.scale.set(2.06, 0.2, 3.38);
      vanStripe.position.set(0, 1.12, 0.3);
      car.add(vanStripe);

      const windshield = new THREE.Mesh(unitBoxGeo, dimWindowMat);
      windshield.scale.set(1.92, 0.62, 0.85);
      windshield.position.set(0, 1.46, -1.05);
      car.add(windshield);
    } else if (style === 'SUV') {
      const cabin = new THREE.Mesh(unitBoxGeo, carMat);
      cabin.scale.set(1.92, 0.76, 2.85);
      cabin.position.set(0, 1.35, 0.15);
      cabin.castShadow = true;
      car.add(cabin);

      const glass = new THREE.Mesh(unitBoxGeo, dimWindowMat);
      glass.scale.set(1.96, 0.54, 2.55);
      glass.position.set(0, 1.36, 0.15);
      car.add(glass);

      const rack = new THREE.Mesh(unitBoxGeo, darkMetalMat);
      rack.scale.set(1.55, 0.12, 2.1);
      rack.position.set(0, 1.78, 0.25);
      car.add(rack);
    } else {
      const cabin = new THREE.Mesh(unitBoxGeo, carMat);
      cabin.scale.set(1.85, 0.68, 2.15);
      cabin.position.set(0, 1.3, -0.1);
      cabin.castShadow = true;
      car.add(cabin);

      const glass = new THREE.Mesh(unitBoxGeo, dimWindowMat);
      glass.scale.set(1.89, 0.5, 1.92);
      glass.position.set(0, 1.31, -0.1);
      car.add(glass);

      const poppedHood = new THREE.Mesh(unitBoxGeo, carMat);
      poppedHood.scale.set(1.88, 0.1, 1.15);
      poppedHood.position.set(0, 1.06, -1.55);
      poppedHood.rotation.x = 0.18;
      car.add(poppedHood);
    }

    const grille = new THREE.Mesh(unitBoxGeo, darkMetalMat);
    grille.scale.set(1.4, 0.36, 0.1);
    grille.position.set(0, 0.66, -2.22);
    car.add(grille);

    for (const side of [-0.72, 0.72]) {
      const hl = new THREE.Mesh(unitBoxGeo, headlightMat);
      hl.scale.set(0.32, 0.2, 0.1);
      hl.position.set(side, 0.72, -2.23);
      car.add(hl);

      const tl = new THREE.Mesh(unitBoxGeo, taillightMat);
      tl.scale.set(0.34, 0.2, 0.1);
      tl.position.set(side, 0.72, 2.23);
      car.add(tl);
    }

    for (const bz of [-2.26, 2.26]) {
      const bumper = new THREE.Mesh(unitBoxGeo, darkMetalMat);
      bumper.scale.set(2.22, 0.24, 0.22);
      bumper.position.set(0, 0.42, bz);
      car.add(bumper);
    }

    for (const wx of [-1.06, 1.06]) {
      for (const wz of [-1.38, 1.38]) {
        const wheel = new THREE.Mesh(wheelGeo, darkMetalMat);
        wheel.position.set(wx, 0.4, wz);
        car.add(wheel);

        const hub = new THREE.Mesh(hubGeo, brushedSteelMat);
        hub.position.set(wx, 0.4, wz);
        car.add(hub);
      }
    }

    car.updateMatrixWorld(true);
    car.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(car);
    addObstacle(x, z, 1.8, 2.1, 1.7, false);
  };

  buildVehicle(-4.2, -13.5, 0.28, 0x7a3428, 'PICKUP');
  buildVehicle(13.8, -3.6, -1.25, 0x33536b, 'SUV');
  buildVehicle(-14.5, 4.5, 1.85, 0x5c5836, 'VAN');
  buildVehicle(4.8, 15.2, -0.35, 0x4c3b5e, 'SEDAN');

  // 7. Concrete Jersey Barriers & Supply Containers
  const buildBarrier = (x: number, z: number, rotY: number) => {
    const barrier = new THREE.Group();
    barrier.position.set(x, 0, z);
    barrier.rotation.y = rotY;

    const base = new THREE.Mesh(unitBoxGeo, concreteMat);
    base.scale.set(2.65, 0.52, 0.74);
    base.position.y = 0.26;
    base.castShadow = true;
    base.receiveShadow = true;
    barrier.add(base);

    const upper = new THREE.Mesh(unitBoxGeo, concreteMat);
    upper.scale.set(2.62, 0.5, 0.46);
    upper.position.y = 0.74;
    barrier.add(upper);

    const stripe = new THREE.Mesh(unitBoxGeo, hazardMat);
    stripe.scale.set(2.66, 0.18, 0.5);
    stripe.position.y = 0.78;
    barrier.add(stripe);

    barrier.updateMatrixWorld(true);
    barrier.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(barrier);
    const isNS = Math.abs(Math.sin(rotY)) > 0.7;
    addObstacle(x, z, isNS ? 0.55 : 1.35, isNS ? 1.35 : 0.55, 1.0, false);
  };

  buildBarrier(-8.5, -8.5, Math.PI / 4);
  buildBarrier(8.5, -8.5, -Math.PI / 4);
  buildBarrier(-8.5, 8.5, -Math.PI / 4);
  buildBarrier(8.5, 8.5, Math.PI / 4);
  buildBarrier(0, -22, 0);
  buildBarrier(0, 22, 0);

  const buildSupplyContainer = (
    x: number,
    z: number,
    rotY: number,
    hex: number
  ) => {
    const container = new THREE.Group();
    container.position.set(x, 0, z);
    container.rotation.y = rotY;

    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.58,
        metalness: 0.48,
      })
    );
    const box = new THREE.Mesh(unitBoxGeo, mat);
    box.scale.set(2.4, 2.2, 4.4);
    box.position.y = 1.1;
    box.castShadow = true;
    box.receiveShadow = true;
    container.add(box);

    for (const fz of [-1.9, -0.95, 0, 0.95, 1.9]) {
      const rib = new THREE.Mesh(unitBoxGeo, darkMetalMat);
      rib.scale.set(2.48, 2.24, 0.18);
      rib.position.set(0, 1.1, fz);
      container.add(rib);
    }

    const sideCrate = new THREE.Mesh(unitBoxGeo, woodMat);
    sideCrate.scale.set(0.75, 0.75, 0.75);
    sideCrate.position.set(0.55, 2.57, -0.8);
    sideCrate.rotation.y = 0.3;
    container.add(sideCrate);

    container.updateMatrixWorld(true);
    container.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(container);
    const isRot = Math.abs(Math.sin(rotY)) > 0.7;
    addObstacle(x, z, isRot ? 2.3 : 1.3, isRot ? 1.3 : 2.3, 2.2, true);
  };

  buildSupplyContainer(-11, -19, 0.15, 0x2b4c59);
  buildSupplyContainer(12, 19, -0.2, 0x593a2b);
  buildSupplyContainer(-21, 9, Math.PI / 2, 0x3b4d3b);

  // 8. Streetlights (Optimized PointLight count + Volumetric Cones on HIGH)
  const lampConfigs = [
    { x: -9.5, z: -3.5, rot: 0, working: true, hasLight: true, flicker: false },
    { x: 9.5, z: 3.5, rot: Math.PI, working: true, hasLight: true, flicker: false },
    { x: -3.5, z: 10.5, rot: Math.PI / 2, working: true, hasLight: true, flicker: true },
    { x: 3.5, z: -10.5, rot: -Math.PI / 2, working: true, hasLight: true, flicker: false },
    { x: -16, z: -8, rot: 0.4, working: false, hasLight: false, flicker: false },
    { x: 16, z: -9, rot: -0.5, working: true, hasLight: false, flicker: false },
    { x: -15, z: 12, rot: 0.2, working: true, hasLight: false, flicker: false },
    { x: 16, z: 11, rot: -0.3, working: false, hasLight: false, flicker: false },
  ];

  const coneGeo = trackGeo(new THREE.ConeGeometry(2.5, 4.8, 12, 1, true));
  const poolGeo = trackGeo(new THREE.CircleGeometry(3.4, 14));
  poolGeo.rotateX(-Math.PI / 2);
  const poolMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xff8c24,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
  );
  const bulbSphereGeo = trackGeo(new THREE.SphereGeometry(0.16, 8, 8));

  lampConfigs.forEach((cfg, idx) => {
    const lamp = new THREE.Group();
    lamp.position.set(cfg.x, 0, cfg.z);
    lamp.rotation.y = cfg.rot;
    if (!cfg.working) {
      lamp.rotation.z = 0.22;
      sparkPositions.push(new THREE.Vector3(cfg.x, 4.4, cfg.z));
    }

    const baseCollar = new THREE.Mesh(unitCyl8Geo, concreteMat);
    baseCollar.scale.set(0.25, 0.85, 0.25);
    baseCollar.position.y = 0.42;
    lamp.add(baseCollar);

    const pole = new THREE.Mesh(unitCyl8Geo, darkMetalMat);
    pole.scale.set(0.12, 5.2, 0.12);
    pole.position.y = 2.7;
    pole.castShadow = true;
    lamp.add(pole);

    const arm = new THREE.Mesh(unitBoxGeo, darkMetalMat);
    arm.scale.set(1.5, 0.12, 0.12);
    arm.position.set(0.65, 5.15, 0);
    lamp.add(arm);

    const hood = new THREE.Mesh(unitCyl8Geo, darkMetalMat);
    hood.scale.set(0.32, 0.22, 0.32);
    hood.position.set(1.22, 5.1, 0);
    lamp.add(hood);

    const bulbMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: cfg.working ? 0xffbe5c : 0x2b2b36,
        emissive: cfg.working ? 0xff8c1a : 0x000000,
        emissiveIntensity: cfg.working ? 2.8 : 0,
      })
    );
    const bulb = new THREE.Mesh(bulbSphereGeo, bulbMat);
    bulb.position.set(1.22, 4.96, 0);
    lamp.add(bulb);

    if (cfg.working) {
      // Ground warm light pool (always visible, zero lighting cost)
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.position.set(1.22, 0.035, 0);
      lamp.add(pool);

      const coneMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xff9838,
          transparent: true,
          opacity: 0.055,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(1.22, 2.45, 0);
      lamp.add(cone);
      volumetricCones.push(cone);

      if (cfg.hasLight) {
        const pLight = new THREE.PointLight(0xff9638, 2.85, 19, 1.75);
        pLight.position.set(1.22, 4.75, 0);
        lamp.add(pLight);
        streetLights.push(pLight);

        if (cfg.flicker) {
          flickeringLights.push({
            light: pLight,
            bulbMat,
            coneMat,
            baseIntensity: 2.85,
            phase: idx * 2.1,
          });
        }
      }
    }

    lamp.updateMatrixWorld(true);
    lamp.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(lamp);
  });

  // Utility Electricity Poles & Sagging Power Lines
  const polePositions: [number, number][] = [
    [-24, -18],
    [-24, 18],
    [24, 18],
    [24, -18],
  ];
  polePositions.forEach(([px, pz]) => {
    const ePole = new THREE.Group();
    ePole.position.set(px, 0, pz);
    const trunk = new THREE.Mesh(unitCyl8Geo, darkWoodMat);
    trunk.scale.set(0.18, 7.2, 0.18);
    trunk.position.y = 3.6;
    ePole.add(trunk);

    for (const cy of [5.8, 6.6]) {
      const cross = new THREE.Mesh(unitBoxGeo, woodMat);
      cross.scale.set(2.4, 0.16, 0.16);
      cross.position.y = cy;
      ePole.add(cross);
    }
    ePole.updateMatrixWorld(true);
    ePole.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(ePole);
  });

  const cableMat = trackMat(
    new THREE.LineBasicMaterial({
      color: 0x1e2436,
      transparent: true,
      opacity: 0.75,
    })
  );
  for (let i = 0; i < polePositions.length; i++) {
    const [x1, z1] = polePositions[i];
    const [x2, z2] = polePositions[(i + 1) % polePositions.length];
    for (const offset of [-0.85, 0.85]) {
      const pts: THREE.Vector3[] = [];
      const segments = 10;
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const sag = Math.sin(t * Math.PI) * 1.15;
        pts.push(
          new THREE.Vector3(
            THREE.MathUtils.lerp(x1, x2, t) + offset * 0.3,
            6.5 - sag,
            THREE.MathUtils.lerp(z1, z2, t)
          )
        );
      }
      const lineGeo = trackGeo(new THREE.BufferGeometry().setFromPoints(pts));
      const cableLine = new THREE.Line(lineGeo, cableMat);
      cableLine.matrixAutoUpdate = false;
      cableLine.updateMatrix();
      decorativeGroup.add(cableLine);
    }
  }

  // 9. Perimeter Fences
  const fenceRadius = 36;
  const fenceSegments = 24;
  for (let i = 0; i < fenceSegments; i++) {
    if (i % 6 === 0) continue;
    const angle = (i / fenceSegments) * Math.PI * 2;
    const fx = Math.cos(angle) * fenceRadius;
    const fz = Math.sin(angle) * fenceRadius;

    const seg = new THREE.Group();
    seg.position.set(fx, 0, fz);
    seg.rotation.y = -angle + Math.PI / 2;

    for (const px of [-1.8, 0, 1.8]) {
      const post = new THREE.Mesh(unitBoxGeo, darkWoodMat);
      post.scale.set(0.24, 1.95, 0.24);
      post.position.set(px, 0.97, 0);
      post.rotation.z = ((i % 3) - 1) * 0.04;
      seg.add(post);
    }

    for (const ry of [0.5, 1.1, 1.65]) {
      const rail = new THREE.Mesh(unitBoxGeo, woodMat);
      rail.scale.set(3.85, 0.14, 0.09);
      rail.position.set(0, ry, 0);
      seg.add(rail);
    }
    seg.updateMatrixWorld(true);
    seg.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(seg);
  }

  // 10. Stylized Multi-Tiered Pine Trees & Boulder Clusters
  const foliageDarkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x192e2b,
      roughness: 0.86,
      metalness: 0.04,
    })
  );
  const foliageMidMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x223d37,
      roughness: 0.84,
      metalness: 0.05,
    })
  );
  const rockMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x3b4254,
      roughness: 0.88,
      metalness: 0.1,
    })
  );

  const treeCoords = [
    [-13, -24],
    [14, -25],
    [-26, -12],
    [28, -11],
    [-29, 9],
    [27, 13],
    [-12, 26],
    [13, 25],
    [-33, -24],
    [32, -26],
    [-34, 24],
    [34, 25],
    [-38, 4],
    [38, -5],
    [-5, -33],
    [6, 33],
    [-22, -31],
    [22, 31],
  ];

  treeCoords.forEach(([tx, tz], idx) => {
    const tree = new THREE.Group();
    tree.position.set(tx, 0, tz);
    const scale = 0.88 + (idx % 4) * 0.15;
    tree.scale.setScalar(scale);

    const trunk = new THREE.Mesh(unitCyl8Geo, darkWoodMat);
    trunk.scale.set(0.26, 1.9, 0.26);
    trunk.position.y = 0.95;
    trunk.castShadow = true;
    tree.add(trunk);

    const canopyGroup = new THREE.Group();
    canopyGroup.position.y = 1.6;

    const tiers = [
      { r: 1.65, h: 2.2, y: 0.8, mat: foliageDarkMat },
      { r: 1.35, h: 2.0, y: 1.95, mat: foliageMidMat },
      { r: 1.0, h: 1.75, y: 2.95, mat: foliageDarkMat },
      { r: 0.65, h: 1.4, y: 3.8, mat: foliageMidMat },
    ];
    tiers.forEach((t, tIdx) => {
      const cone = new THREE.Mesh(unitCone7Geo, t.mat);
      cone.scale.set(t.r, t.h, t.r);
      cone.position.y = t.y;
      cone.rotation.y = tIdx * 0.45;
      cone.castShadow = tIdx < 2;
      canopyGroup.add(cone);
      if (tIdx >= 2) {
        upperTreeCones.push(cone);
      }
    });

    tree.add(canopyGroup);
    treeFoliageClusters.push(canopyGroup);
    worldGroup.add(tree);
    addObstacle(tx, tz, 0.55 * scale, 0.55 * scale, 4.5, false);
  });

  // Layered Rock Formations
  const rockGeo = trackGeo(new THREE.DodecahedronGeometry(0.9, 0));
  const rockCoords = [
    [-11, -5],
    [12, 6],
    [-6, 15],
    [7, -15],
    [-23, -15],
    [22, -14],
    [-23, 14],
    [23, 14],
    [-16, -28],
    [17, 28],
  ];
  rockCoords.forEach(([rx, rz], i) => {
    const cluster = new THREE.Group();
    cluster.position.set(rx, 0, rz);
    const s = 0.65 + (i % 3) * 0.3;

    const mainRock = new THREE.Mesh(rockGeo, rockMat);
    mainRock.scale.set(s * 1.25, s * 0.78, s);
    mainRock.position.y = s * 0.36;
    mainRock.rotation.set(i * 0.5, i * 1.1, 0);
    mainRock.castShadow = true;
    mainRock.receiveShadow = true;
    cluster.add(mainRock);

    cluster.updateMatrixWorld(true);
    cluster.traverse((obj) => {
      obj.matrixAutoUpdate = false;
      obj.updateMatrix();
    });
    worldGroup.add(cluster);
    addObstacle(rx, rz, s * 0.85, s * 0.85, s, false);
  });

  // 11. GPU-Instanced Grass Clusters (scaled by preset: 0 on LOW, 90 on MEDIUM, 180 on HIGH)
  const grassCount = 180;
  const grassGeo = trackGeo(new THREE.ConeGeometry(0.22, 0.65, 4));
  grassGeo.translate(0, 0.32, 0);
  const grassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x26453a,
      roughness: 0.9,
      metalness: 0.02,
    })
  );
  const grassInstanced = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  grassInstanced.receiveShadow = false;

  const dummy = new THREE.Object3D();
  let validGrassIdx = 0;

  for (let i = 0; i < grassCount; i++) {
    const angle = (i * 137.5 * Math.PI) / 180;
    const dist = 9.8 + ((i * 19) % 26) + (i % 5) * 0.7;
    const gx = Math.cos(angle) * dist;
    const gz = Math.sin(angle) * dist;

    if (Math.abs(gx) < 4.2 || Math.abs(gz) < 4.2) continue;

    const scaleXZ = 0.75 + (i % 4) * 0.25;
    const scaleY = 0.7 + (i % 5) * 0.22;
    const rotY = (i * 1.3) % (Math.PI * 2);
    dummy.position.set(gx, 0, gz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(scaleXZ, scaleY, scaleXZ);
    dummy.updateMatrix();
    grassInstanced.setMatrixAt(validGrassIdx++, dummy.matrix);
  }
  grassInstanced.count = validGrassIdx;
  grassInstanced.instanceMatrix.needsUpdate = true;
  worldGroup.add(grassInstanced);

  const maxValidGrass = validGrassIdx;

  // Apply real Graphics Quality Preset differences across shadows, lights, foliage & decorative props
  const updateQuality = (newQuality: QualityPreset, softGl: boolean) => {
    const enableShadows = !softGl && newQuality !== 'LOW';
    dirLight.castShadow = enableShadows;

    if (enableShadows) {
      const targetMapSize = newQuality === 'HIGH' ? 1536 : 512;
      if (dirLight.shadow.mapSize.width !== targetMapSize) {
        dirLight.shadow.mapSize.set(targetMapSize, targetMapSize);
        dirLight.shadow.map?.dispose();
        dirLight.shadow.map = null;
      }
    }

    // Lighting simplification on LOW vs MEDIUM vs HIGH
    rimLight.visible = newQuality !== 'LOW';
    hemiLight.intensity = newQuality === 'LOW' ? 1.18 : 0.95;

    streetLights.forEach((sl, idx) => {
      if (newQuality === 'LOW') {
        sl.visible = false; // Zero dynamic streetlight PointLights on LOW
      } else if (newQuality === 'MEDIUM') {
        sl.visible = idx < 2; // 2 dynamic PointLights on MEDIUM
      } else {
        sl.visible = true; // All 4 working streetlight PointLights on HIGH
      }
    });

    // Volumetric streetlight cones only on HIGH
    volumetricCones.forEach((cone) => {
      cone.visible = newQuality === 'HIGH';
    });

    // Environmental decorative props & upper tree tiers simplified on LOW
    decorativeGroup.visible = newQuality !== 'LOW';
    upperTreeCones.forEach((cone) => {
      cone.visible = newQuality !== 'LOW';
    });

    // Foliage density scaling
    if (newQuality === 'LOW') {
      grassInstanced.visible = false;
      grassInstanced.count = 0;
    } else if (newQuality === 'MEDIUM') {
      grassInstanced.visible = true;
      grassInstanced.count = Math.floor(maxValidGrass * 0.5);
    } else {
      grassInstanced.visible = true;
      grassInstanced.count = maxValidGrass;
    }
  };

  const updateEnvironment = (
    _dt: number,
    elapsedTime: number,
    currentQuality: QualityPreset
  ) => {
    // Skip per-frame decorative animations on LOW preset to save CPU
    if (currentQuality === 'LOW') return;

    // Subtle wind sway on tree canopies
    const step = currentQuality === 'MEDIUM' ? 2 : 1;
    for (let i = 0; i < treeFoliageClusters.length; i += step) {
      const c = treeFoliageClusters[i];
      c.rotation.z = Math.sin(elapsedTime * 1.4 + i * 0.9) * 0.032;
      c.rotation.x = Math.cos(elapsedTime * 1.1 + i * 0.7) * 0.022;
    }

    // Subtle atmospheric flicker on damaged streetlights
    for (let i = 0; i < flickeringLights.length; i++) {
      const fl = flickeringLights[i];
      if (!fl.light.visible) continue;
      const wave =
        Math.sin(elapsedTime * 14 + fl.phase) *
        Math.sin(elapsedTime * 23 + fl.phase * 1.7);
      const factor =
        wave > 0.68
          ? 0.35
          : 0.94 + Math.sin(elapsedTime * 4 + fl.phase) * 0.06;
      fl.light.intensity = fl.baseIntensity * factor;
      fl.bulbMat.emissiveIntensity = 2.8 * factor;
      fl.coneMat.opacity = 0.055 * factor;
    }
  };

  const dispose = () => {
    disposableGeometries.forEach((g) => g.dispose());
    disposableMaterials.forEach((m) => m.dispose());
    disposableTextures.forEach((t) => t.dispose());
    dirLight.shadow.map?.dispose();
  };

  updateQuality(quality, isSoftwareGl);

  return {
    worldGroup,
    obstacles,
    streetLights,
    sparkPositions,
    updateQuality,
    updateEnvironment,
    dispose,
  };
}

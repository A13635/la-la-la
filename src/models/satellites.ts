import * as THREE from 'three';

/**
 * Procedural composite 3D satellite models
 * Adhering to the Three.js skill requirement:
 * 3-12 parts per group with varied roughness/metalness and distinct silhouette scales.
 */

export function createISSModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Satellite_ISS';

  // Materials with physical contrast
  const moduleMat = new THREE.MeshStandardMaterial({
    color: 0xdddede,
    metalness: 0.65,
    roughness: 0.25,
  });

  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x3a3f44,
    metalness: 0.85,
    roughness: 0.35,
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a68,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0x0a1e3b,
    emissiveIntensity: 0.3,
  });

  const goldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.92,
    roughness: 0.2,
  });

  const thrusterGlowMat = new THREE.MeshBasicMaterial({
    color: 0x4df0ff,
    transparent: true,
    opacity: 0.8,
  });

  // 1. Central Pressurized Modules (Zarya / Destiny)
  const coreModule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 2.2, 16),
    moduleMat
  );
  coreModule.rotation.x = Math.PI / 2;
  group.add(coreModule);

  // Cross module (Unity Node)
  const nodeModule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 1.4, 16),
    moduleMat
  );
  nodeModule.rotation.z = Math.PI / 2;
  group.add(nodeModule);

  // Cupola observatory window
  const cupola = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    goldFoilMat
  );
  cupola.position.set(0, 0.35, 0.3);
  group.add(cupola);

  // 2. Integrated Truss Structure (Main spine)
  const truss = new THREE.Mesh(
    new THREE.BoxGeometry(7.0, 0.15, 0.15),
    trussMat
  );
  truss.position.set(0, 0, -0.6);
  group.add(truss);

  // 3. Solar Array Wings (4 dual wings)
  const wingGeo = new THREE.BoxGeometry(1.6, 0.02, 3.2);
  const wingPositions = [-2.8, -1.2, 1.2, 2.8];

  wingPositions.forEach((posX) => {
    const wing = new THREE.Mesh(wingGeo, solarPanelMat);
    wing.position.set(posX, 0, -0.6);
    group.add(wing);

    // Gold solar rotary joint
    const joint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12),
      goldFoilMat
    );
    joint.position.set(posX, 0, -0.6);
    joint.rotation.z = Math.PI / 2;
    group.add(joint);
  });

  // 4. Heat Radiator Panels (White rectangular panels)
  const radiatorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.3,
    roughness: 0.1,
  });
  const radiator1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 1.6), radiatorMat);
  radiator1.position.set(-0.6, 0.6, -0.6);
  group.add(radiator1);

  const radiator2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.2, 1.6), radiatorMat);
  radiator2.position.set(0.6, 0.6, -0.6);
  group.add(radiator2);

  // 5. Blue Ion Thruster Plume
  const plume = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.6, 12),
    thrusterGlowMat
  );
  plume.position.set(0, 0, -1.4);
  plume.rotation.x = Math.PI / 2;
  group.add(plume);

  return group;
}

export function createHubbleModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Satellite_Hubble';

  const silverMat = new THREE.MeshStandardMaterial({
    color: 0xd8e0e8,
    metalness: 0.95,
    roughness: 0.12,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe6b800,
    metalness: 0.9,
    roughness: 0.2,
  });

  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x102540,
    metalness: 0.85,
    roughness: 0.2,
    emissive: 0x051329,
    emissiveIntensity: 0.3,
  });

  // Main telescope body tube
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.5, 2.4, 24),
    silverMat
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Aft shroud (larger back section)
  const aft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.9, 24),
    goldMat
  );
  aft.position.set(0, 0, -0.9);
  aft.rotation.x = Math.PI / 2;
  group.add(aft);

  // Aperture door (front lid open)
  const door = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.05, 20),
    silverMat
  );
  door.position.set(0, 0.4, 1.2);
  door.rotation.x = -Math.PI / 4;
  group.add(door);

  // Secondary mirror spider inside front aperture
  const innerAperture = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  innerAperture.position.set(0, 0, 1.2);
  innerAperture.rotation.x = Math.PI / 2;
  group.add(innerAperture);

  // Two deployable solar wings
  const wingGeo = new THREE.BoxGeometry(0.04, 1.8, 0.8);
  const leftWing = new THREE.Mesh(wingGeo, panelMat);
  leftWing.position.set(-1.1, 0, 0.1);
  group.add(leftWing);

  const rightWing = new THREE.Mesh(wingGeo, panelMat);
  rightWing.position.set(1.1, 0, 0.1);
  group.add(rightWing);

  // High gain antenna dish
  const dish = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.15, 16, 1, true),
    silverMat
  );
  dish.position.set(0, 0.65, -0.7);
  dish.rotation.x = Math.PI * 0.7;
  group.add(dish);

  return group;
}

export function createVoyagerModel(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Satellite_Voyager';

  const whiteDishMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeee,
    metalness: 0.3,
    roughness: 0.3,
  });

  const goldBlanketMat = new THREE.MeshStandardMaterial({
    color: 0xcca01a,
    metalness: 0.88,
    roughness: 0.25,
  });

  const darkStrutMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.8,
    roughness: 0.4,
  });

  // 1. High Gain Antenna Dish (Large parabola)
  const dish = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 0.4, 24, 1, true),
    whiteDishMat
  );
  dish.rotation.x = -Math.PI / 2;
  group.add(dish);

  // Sub-reflector feed horn
  const feedHorn = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.3, 12),
    goldBlanketMat
  );
  feedHorn.position.set(0, 0, 0.35);
  feedHorn.rotation.x = Math.PI / 2;
  group.add(feedHorn);

  // 2. Decagonal Bus Body with Gold Thermal Blanket
  const bus = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.4, 10),
    goldBlanketMat
  );
  bus.position.set(0, 0, -0.4);
  bus.rotation.x = Math.PI / 2;
  group.add(bus);

  // 3. Magnetometer boom (long triangular lattice truss)
  const magBoom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6),
    darkStrutMat
  );
  magBoom.position.set(0, 1.8, -0.4);
  group.add(magBoom);

  // 4. Radioisotope Thermoelectric Generator (RTG) canister boom
  const rtgBoom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6),
    darkStrutMat
  );
  rtgBoom.position.set(-1.1, -0.6, -0.4);
  rtgBoom.rotation.z = Math.PI / 3;
  group.add(rtgBoom);

  const rtgCanister = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 })
  );
  rtgCanister.position.set(-1.7, -0.9, -0.4);
  rtgCanister.rotation.z = Math.PI / 3;
  group.add(rtgCanister);

  // 5. Golden Record (Iconic NASA artifact)
  const goldenRecord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.1,
    })
  );
  goldenRecord.position.set(0.42, -0.2, -0.4);
  goldenRecord.rotation.z = Math.PI / 2;
  group.add(goldenRecord);

  return group;
}

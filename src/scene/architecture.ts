// The observatory shell: floor, columns, dome ribs, the dome shutter and the sky beyond it.
import * as THREE from "three";
import type { Materials } from "./materials";

export const DOME_RADIUS = 14;
/** Horizontal angle of the dome slit, facing back and to the right (towards the Sky Deck). */
const SLIT_PHI = 4.25;
const SLIT_WIDTH = 0.5;

export interface Architecture {
  group: THREE.Group;
  shutter: THREE.Object3D;
  stars: THREE.Points;
}

export function buildArchitecture(m: Materials): Architecture {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.CircleGeometry(DOME_RADIUS, 72), m.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Inlaid floor rings: the old meridian markings.
  for (const r of [3.2, 6.4, 9.6]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.04, 96), m.brass);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    group.add(ring);
  }

  // Dome shell with a slit; the shutter covers the slit until the Sky Deck opens it.
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(
      DOME_RADIUS,
      64,
      24,
      SLIT_PHI + SLIT_WIDTH / 2,
      Math.PI * 2 - SLIT_WIDTH,
      0,
      Math.PI / 2,
    ),
    new THREE.MeshStandardMaterial({ color: "#1d2130", roughness: 0.85, side: THREE.BackSide }),
  );
  group.add(shell);

  const shutterPivot = new THREE.Group();
  const shutter = new THREE.Mesh(
    new THREE.SphereGeometry(
      DOME_RADIUS - 0.15,
      8,
      16,
      SLIT_PHI - SLIT_WIDTH / 2 - 0.02,
      SLIT_WIDTH + 0.04,
      0,
      Math.PI / 2,
    ),
    new THREE.MeshStandardMaterial({
      color: "#1c1d22",
      roughness: 0.6,
      metalness: 0.6,
      side: THREE.BackSide,
    }),
  );
  shutterPivot.add(shutter);
  group.add(shutterPivot);

  // Ribs: meridian arcs, instanced.
  const ribCount = 16;
  const rib = new THREE.TorusGeometry(DOME_RADIUS - 0.2, 0.07, 6, 48, Math.PI / 2);
  const ribs = new THREE.InstancedMesh(rib, m.iron, ribCount);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < ribCount; i++) {
    tmp.rotation.set(0, (i / ribCount) * Math.PI * 2, 0);
    tmp.updateMatrix();
    ribs.setMatrixAt(i, tmp.matrix);
  }
  group.add(ribs);

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(DOME_RADIUS - 0.25, 0.14, 8, 96), m.iron);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.2;
  group.add(baseRing);

  // Columns carrying a gallery ring.
  const colCount = 12;
  const columns = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.28, 7.2, 12),
    m.stone,
    colCount,
  );
  columns.castShadow = true;
  columns.receiveShadow = true;
  for (let i = 0; i < colCount; i++) {
    const a = (i / colCount) * Math.PI * 2 + 0.26;
    tmp.rotation.set(0, 0, 0);
    tmp.position.set(Math.cos(a) * 10.8, 3.6, Math.sin(a) * 10.8);
    tmp.updateMatrix();
    columns.setMatrixAt(i, tmp.matrix);
  }
  group.add(columns);
  const gallery = new THREE.Mesh(new THREE.TorusGeometry(10.8, 0.16, 8, 96), m.brass);
  gallery.rotation.x = Math.PI / 2;
  gallery.position.y = 7.2;
  group.add(gallery);

  // Stars beyond the dome, gathered where the slit looks out.
  const starCount = 1600;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const phi = SLIT_PHI + (Math.random() - 0.5) * 0.9;
    const theta = Math.random() * 1.35;
    const r = 40 + Math.random() * 20;
    positions[i * 3] = -r * Math.cos(phi) * Math.sin(theta);
    positions[i * 3 + 1] = r * Math.cos(theta);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: "#dcd6ff",
      size: 0.32,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(stars);

  return { group, shutter: shutterPivot, stars };
}

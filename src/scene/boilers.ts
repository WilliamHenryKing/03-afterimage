// The Boiler Room: lathed copper boilers with riveted bands and seams, firebox doors with real
// light, brass gauges behind glass, handwheel valves, flanged copper pipework, and steam.
import * as THREE from "three";
import { jitter } from "./jitter";
import { glowMap, type Materials } from "./materials";

/** [x, z, radius, height] for each boiler. */
const BOILERS: [number, number, number, number][] = [
  [-7.6, -1.6, 0.95, 3.4],
  [-5.4, -2.8, 0.75, 2.7],
  [-8.6, 1.2, 0.7, 2.5],
];
const ROUTES: [number, number, number][][] = [
  [
    [-7.6, 3.9, -1.6],
    [-7.4, 6.2, -1.4],
    [-4.2, 7.0, -2.2],
    [-1.8, 7.4, -3.4],
  ],
  [
    [-5.4, 3.1, -2.8],
    [-5.2, 5.0, -3.4],
    [-3.0, 5.6, -4.0],
  ],
  [
    [-8.6, 2.9, 1.2],
    [-8.9, 5.4, 0.6],
    [-9.6, 7.0, -1.8],
  ],
  [
    [-9.8, 0.3, -3.2],
    [-7.2, 0.6, -3.6],
    [-4.6, 0.4, -3.2],
    [-3.2, 2.2, -3.8],
  ],
];
const VENTS = ROUTES.map((r) => {
  const end = r[r.length - 1] as [number, number, number];
  return new THREE.Vector3(...end);
});

function boilerProfile(r: number, h: number): THREE.Vector2[] {
  const body = h - r * 0.75;
  const pts: [number, number][] = [
    [0, 0],
    [r * 1.1, 0],
    [r * 1.1, 0.1],
    [r * 1.04, 0.14],
    [r * 1.0, 0.2],
    [r * 1.0, body],
  ];
  // Domed crown.
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2) * 0.82;
    pts.push([Math.cos(a) * r, body + Math.sin(a) * r * 0.62]);
  }
  const crown = body + r * 0.62 * Math.sin((Math.PI / 2) * 0.82);
  pts.push([r * 0.26, crown + 0.02], [r * 0.26, crown + 0.16], [r * 0.34, crown + 0.16]);
  pts.push([r * 0.34, crown + 0.22], [r * 0.2, crown + 0.22], [0, crown + 0.24]);
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}

function dialTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#efe6cf";
    g.fillRect(0, 0, 256, 256);
    g.translate(128, 128);
    g.strokeStyle = "#1c1410";
    g.fillStyle = "#1c1410";
    for (let i = 0; i <= 40; i++) {
      const a = -Math.PI * 0.75 + (i / 40) * Math.PI * 1.5;
      const long = i % 5 === 0;
      g.lineWidth = long ? 5 : 2;
      g.beginPath();
      g.moveTo(Math.sin(a) * (long ? 88 : 98), -Math.cos(a) * (long ? 88 : 98));
      g.lineTo(Math.sin(a) * 110, -Math.cos(a) * 110);
      g.stroke();
    }
    g.fillStyle = "#a3261c";
    g.beginPath();
    g.arc(0, 0, 112, -Math.PI * 0.25 - 0.3, -Math.PI * 0.25 + 0.05);
    g.arc(0, 0, 100, -Math.PI * 0.25 + 0.05, -Math.PI * 0.25 - 0.3, true);
    g.fill();
    g.fillStyle = "#1c1410";
    g.font = "bold 26px ui-sans-serif, system-ui, sans-serif";
    g.textAlign = "center";
    g.fillText("PSI", 0, 50);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rivet heads along a ring or a line, each slightly different. */
function rivets(
  points: THREE.Vector3[],
  normals: THREE.Vector3[],
  material: THREE.Material,
  seed: number,
): THREE.InstancedMesh {
  const geo = new THREE.SphereGeometry(0.022, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, material, points.length);
  const tmp = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  points.forEach((p, i) => {
    tmp.position.copy(p);
    tmp.quaternion.setFromUnitVectors(up, normals[i] as THREE.Vector3);
    tmp.scale.setScalar(0.85 + jitter(i, seed) * 0.3);
    tmp.updateMatrix();
    mesh.setMatrixAt(i, tmp.matrix);
  });
  mesh.castShadow = false;
  return mesh;
}

export class BoilerRoom {
  readonly group = new THREE.Group();
  private readonly fires: THREE.Mesh[] = [];
  private readonly fireLights: THREE.PointLight[] = [];
  private readonly needles: THREE.Object3D[] = [];
  private readonly steam: THREE.Sprite[] = [];

  constructor(m: Materials) {
    const dial = dialTexture();
    const face = new THREE.MeshStandardMaterial({ map: dial, roughness: 0.55 });
    const needleMat = new THREE.MeshStandardMaterial({ color: "#16100c", roughness: 0.5 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.04,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });

    BOILERS.forEach(([x, z, r, h], bi) => {
      const boiler = new THREE.Group();
      boiler.position.set(x, 0, z);
      // Face the room centre, with a little irregularity.
      boiler.rotation.y = Math.atan2(-x, -z) + (jitter(bi, 5) - 0.5) * 0.2;
      const shell = new THREE.Mesh(new THREE.LatheGeometry(boilerProfile(r, h), 56), m.copper);
      shell.castShadow = true;
      shell.receiveShadow = true;
      boiler.add(shell);

      // Riveted bands in patinated copper, and a vertical seam of rivets up the back.
      const body = h - r * 0.75;
      for (const y of [0.55, body * 0.5, body - 0.15]) {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(r + 0.025, r + 0.025, 0.1, 56, 1, true),
          m.patina,
        );
        band.position.y = y;
        boiler.add(band);
        const n = Math.round((Math.PI * 2 * r) / 0.11);
        const pts: THREE.Vector3[] = [];
        const nor: THREE.Vector3[] = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          nor.push(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
          pts.push(new THREE.Vector3(Math.sin(a) * (r + 0.03), y, Math.cos(a) * (r + 0.03)));
        }
        boiler.add(rivets(pts, nor, m.brass, bi * 10 + y));
      }
      const seam: THREE.Vector3[] = [];
      for (let y = 0.3; y < body; y += 0.1) seam.push(new THREE.Vector3(0, y, -(r + 0.004)));
      boiler.add(
        rivets(
          seam,
          seam.map(() => new THREE.Vector3(0, 0, -1)),
          m.copper,
          bi + 40,
        ),
      );

      // Firebox: iron frame, glowing grate, a door hanging ajar, and the fire's own light.
      const door = new THREE.Group();
      door.position.set(0, 0.5, r * 0.98);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(r * 0.95, r * 0.6, 0.08), m.iron);
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.72, r * 0.4), m.fire);
      hole.position.z = 0.042;
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(r * 0.72, r * 0.42, 0.03), m.iron);
      leaf.geometry.translate(r * 0.36, 0, 0);
      leaf.position.set(-r * 0.36, 0, 0.07);
      leaf.rotation.y = -1.1 - jitter(bi, 6) * 0.4;
      door.add(frame, hole, leaf);
      frame.castShadow = true;
      leaf.castShadow = true;
      boiler.add(door);
      this.fires.push(hole);
      const fireLight = new THREE.PointLight("#ff7a2e", 6, 0, 2);
      fireLight.position.set(0, 0.55, r + 0.35);
      boiler.add(fireLight);
      this.fireLights.push(fireLight);

      // Pressure gauge: brass bezel, dial, needle, glass.
      const gauge = new THREE.Group();
      gauge.position.set(r * 0.42, body * 0.72, Math.sqrt(r * r - (r * 0.42) ** 2) + 0.02);
      gauge.rotation.y = Math.asin(0.42);
      const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 10, 32), m.brass);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 32), m.brass);
      back.rotation.x = Math.PI / 2;
      back.position.z = -0.03;
      const dialFace = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), face);
      dialFace.position.z = 0.002;
      const needle = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.13, 0.004), needleMat);
      blade.position.y = 0.05;
      needle.add(blade);
      needle.position.z = 0.008;
      const cover = new THREE.Mesh(new THREE.CircleGeometry(0.165, 32), glass);
      cover.position.z = 0.02;
      gauge.add(back, bezel, dialFace, needle, cover);
      this.needles.push(needle);
      boiler.add(gauge);

      // Handwheel valve on the crown.
      const crown = h - r * 0.75 + r * 0.62 * Math.sin((Math.PI / 2) * 0.82) + 0.24;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), m.brass);
      stem.position.set(r * 0.5, crown - 0.05, 0);
      const wheel = new THREE.Group();
      wheel.position.set(r * 0.5, crown + 0.12, 0);
      wheel.rotation.x = Math.PI / 2;
      wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24), m.iron));
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.015), m.iron);
        spoke.rotation.z = (s * Math.PI) / 4;
        wheel.add(spoke);
      }
      wheel.rotation.z = jitter(bi, 7) * Math.PI;
      boiler.add(stem, wheel);
      this.group.add(boiler);
    });

    // Copper pipework: flanged joints at every bend and brackets where it meets the wall.
    const flangeGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.06, 20);
    ROUTES.forEach((route, ri) => {
      const pts = route.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.2);
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.09, 12), m.copper);
      pipe.castShadow = true;
      this.group.add(pipe);
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const flange = new THREE.Mesh(flangeGeo, m.patina);
        flange.position.copy(curve.getPointAt(t));
        flange.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangentAt(t));
        flange.scale.setScalar(0.9 + jitter(i, ri + 20) * 0.2);
        this.group.add(flange);
      }
    });

    // Steam from the pipe ends, lit by whatever light it drifts through.
    const steamMat = new THREE.SpriteMaterial({
      map: glowMap(),
      color: "#9a978f",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 32; i++) {
      const puff = new THREE.Sprite(steamMat.clone());
      puff.userData = { vent: i % VENTS.length, phase: i / 32, drift: jitter(i, 30) * Math.PI * 2 };
      this.steam.push(puff);
      this.group.add(puff);
    }
  }

  /** Sprites and glass the AO pass should not treat as solid. */
  get aoHidden(): THREE.Object3D[] {
    return [...this.steam];
  }

  update(time: number, level: number, reduced: boolean) {
    const flicker = reduced ? 1 : 0.86 + Math.sin(time * 9) * 0.07 + Math.sin(time * 23) * 0.05;
    this.fireLights.forEach((l, i) => {
      l.intensity = (2.5 + 9 * level) * (reduced ? 1 : flicker + Math.sin(time * 5 + i) * 0.03);
    });
    for (const f of this.fires) f.scale.setScalar(0.85 + 0.15 * level);
    this.needles.forEach((n, i) => {
      n.rotation.z = 1.9 - level * 2.2 + (reduced ? 0 : Math.sin(time * (2 + i) + i) * 0.05);
    });
    for (const puff of this.steam) {
      const d = puff.userData as { vent: number; phase: number; drift: number };
      const k = reduced ? d.phase : (d.phase + time * 0.1) % 1;
      const vent = VENTS[d.vent] as THREE.Vector3;
      puff.position.set(
        vent.x + Math.sin(d.drift + k * 3) * 0.45,
        vent.y + k * 2.6,
        vent.z + Math.cos(d.drift) * 0.3,
      );
      puff.scale.setScalar(0.9 + k * 2.8);
      puff.material.opacity = Math.sin(k * Math.PI) * (0.06 + 0.16 * level);
    }
  }
}

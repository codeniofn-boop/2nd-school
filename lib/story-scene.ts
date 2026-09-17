/* The "Find your path" cinematic: one continuous Three.js scene whose camera,
 * lighting, and set pieces are driven by a single GSAP ScrollTrigger timeline
 * (scrub) over the page's scroll. Five acts:
 *   0 night sky  ->  1 your average  ->  2 dawn over campus
 *   ->  3 the four labels  ->  4 arrival + CTA
 *
 * Libraries are injected so the identical body also runs in the standalone
 * demo page against the UMD builds (globals THREE / gsap / ScrollTrigger).
 * Keep to APIs stable across three r160-r186.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface StorySceneOptions {
  THREE: any;
  gsap: any;
  ScrollTrigger: any;
  canvas: HTMLCanvasElement;
  /** Tall element whose scroll span maps to timeline progress. */
  scrollEl: HTMLElement;
  /** Container holding the .act overlay blocks and the grade counter. */
  overlayRoot: HTMLElement;
}

export interface StoryScene {
  destroy(): void;
}

const LABELS = [
  { name: "Safe", line: "At or above the safe zone, prerequisites done.", color: 0x34d399 },
  { name: "Target", line: "Inside the competitive range — right where admits happen.", color: 0x60a5fa },
  { name: "Reach", line: "Below the range or one course short. Worth the shot.", color: 0xfbbf24 },
  { name: "Unlikely", line: "Under the minimum — better paths exist.", color: 0xfb7185 },
];

export function createStoryScene(opts: StorySceneOptions): StoryScene {
  const { THREE, gsap, ScrollTrigger, canvas, scrollEl, overlayRoot } = opts;
  gsap.registerPlugin(ScrollTrigger);

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d);
    return d;
  };

  // ---- renderer / scene / camera ------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1220, 30, 150);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  camera.position.set(0, 6, 60);
  const lookTarget = new THREE.Vector3(0, 3, 0);

  const setSize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  setSize();
  window.addEventListener("resize", setSize);

  // ---- canvas-texture helpers (the "layered images") ----------------------
  const canvasTexture = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    draw(cv.getContext("2d") as CanvasRenderingContext2D);
    const tex = new THREE.CanvasTexture(cv);
    return track(tex);
  };

  // Vertical sky gradient plane (two of them crossfade night -> dawn).
  const skyPlane = (stops: [string, string, string]) => {
    const tex = canvasTexture(4, 512, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, stops[0]);
      g.addColorStop(0.62, stops[1]);
      g.addColorStop(1, stops[2]);
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 512);
    });
    const mat = track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(560, 260)), mat);
    mesh.position.set(0, 40, -160);
    scene.add(mesh);
    return mesh;
  };
  const nightSky = skyPlane(["#05070f", "#0b1220", "#101b31"]);
  const dawnSky = skyPlane(["#1b2650", "#7a4a7d", "#f0a05a"]);
  dawnSky.material.opacity = 0;

  // Stars.
  const starCount = 1300;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 90 + Math.random() * 130;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.48; // upper hemisphere
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = 4 + r * Math.cos(phi) * 0.55;
    starPos[i * 3 + 2] = -40 - Math.abs(r * Math.sin(phi) * Math.sin(theta));
  }
  const starGeo = track(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = track(
    new THREE.PointsMaterial({ color: 0xcdd8ff, size: 0.55, transparent: true, opacity: 0.9, sizeAttenuation: true, fog: false })
  );
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Sun disc + glow.
  const sunMat = track(new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, fog: false }));
  const sun = new THREE.Mesh(track(new THREE.CircleGeometry(7, 40)), sunMat);
  sun.position.set(14, -14, -140);
  scene.add(sun);

  // Cloud layers: soft blobs on transparent canvases, staggered in depth.
  const cloudTexture = () =>
    canvasTexture(512, 256, (c) => {
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * 512;
        const y = 60 + Math.random() * 140;
        const r = 45 + Math.random() * 75;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(235,240,255,0.55)");
        g.addColorStop(1, "rgba(235,240,255,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, 512, 256);
      }
    });
  const clouds: any[] = [];
  const cloudZs = [-18, -30, -44, -58, -72];
  for (let i = 0; i < cloudZs.length; i++) {
    const mat = track(
      new THREE.MeshBasicMaterial({ map: cloudTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false })
    );
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(150, 55)), mat);
    m.position.set((i % 2 === 0 ? -1 : 1) * (6 + i * 3), 12 + i * 1.5, cloudZs[i]);
    scene.add(m);
    clouds.push(m);
  }

  // Skyline layers (far / mid / near silhouettes with lit windows).
  const skylineTexture = (fill: string, litRatio: number, withTower: boolean) =>
    canvasTexture(1024, 256, (c) => {
      c.fillStyle = fill;
      let x = 0;
      while (x < 1024) {
        const w = 46 + Math.random() * 84;
        const h = 60 + Math.random() * 150;
        c.fillRect(x, 256 - h, w - 6, h);
        if (litRatio > 0) {
          for (let wy = 256 - h + 10; wy < 246; wy += 14) {
            for (let wx = x + 6; wx < x + w - 14; wx += 12) {
              if (Math.random() < litRatio) {
                c.fillStyle = "rgba(255,214,140,0.85)";
                c.fillRect(wx, wy, 5, 7);
                c.fillStyle = fill;
              }
            }
          }
        }
        x += w;
      }
      if (withTower) {
        // A campus clock tower front and center.
        c.fillStyle = fill;
        c.fillRect(478, 40, 44, 216);
        c.beginPath();
        c.moveTo(470, 44);
        c.lineTo(500, 10);
        c.lineTo(530, 44);
        c.closePath();
        c.fill();
        c.fillStyle = "rgba(255,230,170,0.95)";
        c.beginPath();
        c.arc(500, 74, 11, 0, Math.PI * 2);
        c.fill();
      }
    });
  const skylineLayers: any[] = [];
  const skylineSpecs = [
    { w: 380, h: 22, z: -115, y: 2.8, fill: "#131c30", lit: 0, tower: false },
    { w: 340, h: 24, z: -100, y: 2.6, fill: "#0e1526", lit: 0.1, tower: false },
    { w: 300, h: 26, z: -85, y: 2.4, fill: "#080d1a", lit: 0.2, tower: true },
  ];
  for (const s of skylineSpecs) {
    const mat = track(
      new THREE.MeshStandardMaterial({
        map: skylineTexture(s.fill, s.lit, s.tower),
        transparent: true,
        roughness: 0.95,
        metalness: 0,
      })
    );
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(s.w, s.h)), mat);
    m.position.set(0, s.y - 26, s.z); // parked below ground; rises in act 2
    m.userData.finalY = s.y;
    m.castShadow = true;
    scene.add(m);
    skylineLayers.push(m);
  }

  // Ground.
  const groundMat = track(new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 1 }));
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(500, 400)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -8.2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Label gates.
  const gateTexture = (name: string, line: string, color: string) =>
    canvasTexture(512, 640, (c) => {
      const r = 46;
      c.fillStyle = "rgba(10,16,30,0.92)";
      c.beginPath();
      // rounded rect
      c.moveTo(r, 0);
      c.lineTo(512 - r, 0);
      c.quadraticCurveTo(512, 0, 512, r);
      c.lineTo(512, 640 - r);
      c.quadraticCurveTo(512, 640, 512 - r, 640);
      c.lineTo(r, 640);
      c.quadraticCurveTo(0, 640, 0, 640 - r);
      c.lineTo(0, r);
      c.quadraticCurveTo(0, 0, r, 0);
      c.closePath();
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = 10;
      c.stroke();
      c.fillStyle = color;
      c.font = "700 92px -apple-system, 'Segoe UI', Roboto, sans-serif";
      c.textAlign = "center";
      c.fillText(name, 256, 300);
      c.fillStyle = "rgba(226,232,240,0.92)";
      c.font = "400 34px -apple-system, 'Segoe UI', Roboto, sans-serif";
      const words = line.split(" ");
      let row = "";
      let y = 380;
      for (const w of words) {
        if ((row + " " + w).trim().length > 24) {
          c.fillText(row.trim(), 256, y);
          row = w;
          y += 44;
        } else row += " " + w;
      }
      c.fillText(row.trim(), 256, y);
    });
  const gates: { mesh: any; light: any }[] = [];
  LABELS.forEach((l, i) => {
    const hex = "#" + l.color.toString(16).padStart(6, "0");
    const mat = track(
      new THREE.MeshBasicMaterial({
        map: gateTexture(l.name, l.line, hex),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      })
    );
    const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(9, 11.25)), mat);
    const x = i % 2 === 0 ? -4.0 : 4.0;
    mesh.position.set(x, -0.5, -6 - i * 13);
    mesh.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.5;
    mesh.castShadow = true;
    const light = new THREE.PointLight(l.color, 0, 34, 1.6);
    light.position.set(x * 0.75, 2, mesh.position.z + 4);
    scene.add(mesh);
    scene.add(light);
    gates.push({ mesh, light });
  });

  // ---- lights --------------------------------------------------------------
  const ambient = new THREE.AmbientLight(0x33415e, 0.75);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0x8fa3ff, 0.5);
  moon.position.set(-30, 40, 20);
  scene.add(moon);
  const sunLight = new THREE.DirectionalLight(0xffc37a, 0);
  sunLight.position.set(30, 6, -60);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.far = 300;
  scene.add(sunLight);

  // ---- the master scroll timeline -----------------------------------------
  const overlay = (sel: string) => overlayRoot.querySelectorAll(sel);
  const counter = { value: 65 };
  const counterEl = overlayRoot.querySelector("[data-counter]");
  const camState = { swayX: 0, lookX: 0 };

  gsap.set(overlay(".act"), { autoAlpha: 0, y: 24 });
  gsap.set(overlay('[data-act="0"]'), { autoAlpha: 1, y: 0 });

  const tl = gsap.timeline({
    defaults: { ease: "power1.inOut" },
    scrollTrigger: { trigger: scrollEl, start: "top top", end: "bottom bottom", scrub: 1 },
  });

  // Act 0 -> 1: push in, hand off copy, count the average up.
  tl.to(camera.position, { z: 46, y: 6.6, duration: 1.4 }, 0)
    .to(overlay('[data-act="0"]'), { autoAlpha: 0, y: -28, duration: 0.5 }, 1.0)
    .to(overlay('[data-act="1"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, 1.45)
    .to(camera.position, { z: 30, duration: 1.6 }, 1.4)
    .to(
      counter,
      {
        value: 92,
        duration: 1.4,
        ease: "power2.out",
        onUpdate: () => {
          if (counterEl) counterEl.textContent = String(Math.round(counter.value)) + "%";
        },
      },
      1.5
    )
    .to(overlay(".chip"), { yPercent: -220, stagger: 0.08, duration: 1.8, ease: "none" }, 1.3)

    // Act 2: through the clouds, skyline rises, dawn breaks.
    .to(overlay('[data-act="1"]'), { autoAlpha: 0, y: -28, duration: 0.4 }, 2.9)
    .to(
      clouds.map((c) => c.material),
      { opacity: 0.4, stagger: 0.06, duration: 0.7 },
      2.7
    )
    .to(camera.position, { z: 10, y: 6.0, duration: 2.2, ease: "power1.in" }, 3.0)
    .to(
      clouds.map((c) => c.material),
      { opacity: 0, stagger: 0.08, duration: 0.9 },
      4.1
    )
    .to(
      skylineLayers.map((m) => m.position),
      { y: (i: number) => skylineSpecs[i].y, stagger: 0.12, duration: 1.5, ease: "power2.out" },
      3.4
    )
    .to(dawnSky.material, { opacity: 1, duration: 1.8 }, 3.3)
    .to(nightSky.material, { opacity: 0.15, duration: 1.8 }, 3.3)
    .to(starMat, { opacity: 0, duration: 1.2 }, 3.5)
    .to(sun.position, { y: 16, duration: 2.0 }, 3.4)
    .to(sunMat, { opacity: 0.95, duration: 1.2 }, 3.4)
    .to(sunLight, { intensity: 1.5, duration: 1.8 }, 3.5)
    .to(moon, { intensity: 0.06, duration: 1.4 }, 3.5)
    .to(ambient.color, { r: 0.35, g: 0.33, b: 0.38, duration: 1.8 }, 3.5)
    .to(scene.fog.color, { r: 0.2, g: 0.24, b: 0.38, duration: 1.8 }, 3.5)
    .to(scene.fog, { far: 230, duration: 1.8 }, 3.5)
    .to(groundMat.color, { r: 0.1, g: 0.13, b: 0.22, duration: 1.8 }, 3.5)
    .to(overlay('[data-act="2"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, 3.8)

    // Act 3: glide past the four gates.
    .to(overlay('[data-act="2"]'), { autoAlpha: 0, y: -28, duration: 0.4 }, 5.2)
    .to(overlay('[data-act="3"]'), { autoAlpha: 1, y: 0, duration: 0.5 }, 5.5)
    .to(camera.position, { z: -50, duration: 3.4, ease: "none" }, 5.4)
    .to(camState, { swayX: 1, duration: 3.4, ease: "none" }, 5.4);

  gates.forEach((g, i) => {
    const at = 5.4 + i * 0.75;
    tl.to(g.mesh.material, { opacity: 1, duration: 0.5 }, at)
      .to(g.light, { intensity: 2.4, duration: 0.45, ease: "power2.out" }, at + 0.15)
      .to(g.light, { intensity: 0.7, duration: 0.6 }, at + 0.7);
  });

  // Act 4: settle, warm to morning, CTA.
  tl.to(overlay('[data-act="3"]'), { autoAlpha: 0, y: -28, duration: 0.4 }, 8.6)
    .to(camera.position, { z: -46, y: 10.5, duration: 1.2 }, 8.8)
    .to(camState, { lookX: 9, duration: 1.2 }, 8.8)
    .to(camState, { swayX: 0, duration: 1.2 }, 8.8)
    .to(sun.scale, { x: 1.6, y: 1.6, duration: 1.2 }, 8.8)
    .to(camera, { fov: 55, duration: 1.2, onUpdate: () => camera.updateProjectionMatrix() }, 8.8)
    .to(sunLight, { intensity: 2.0, duration: 1.0 }, 8.8)
    .to(sunLight.color, { r: 1, g: 0.93, b: 0.78, duration: 1.0 }, 8.8)
    .to(overlay('[data-act="4"]'), { autoAlpha: 1, y: 0, duration: 0.6 }, 9.2);

  // ---- render loop ----------------------------------------------------------
  const clock = new THREE.Clock();
  let raf = 0;
  const render = () => {
    raf = requestAnimationFrame(render);
    const t = clock.getElapsedTime();
    // Ambient drift: clouds slide, stars shimmer — independent of scroll.
    clouds.forEach((c, i) => {
      c.position.x += Math.sin(t * 0.05 + i) * 0.006;
    });
    stars.rotation.y = t * 0.004;
    // Camera sway through the gate corridor + steady look-ahead.
    const sway = camState.swayX * Math.sin(camera.position.z * 0.18) * 2.4;
    camera.position.x = sway;
    lookTarget.set(sway * 0.4 + camState.lookX, 2.6 + camState.lookX * 0.35, camera.position.z - 26);
    camera.lookAt(lookTarget);
    renderer.render(scene, camera);
  };
  render();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setSize);
      if (tl.scrollTrigger) tl.scrollTrigger.kill();
      tl.kill();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
}

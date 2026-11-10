import * as THREE from "https://esm.sh/three@0.170.0";
import { OrbitControls } from "https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js";

const stage = document.getElementById("stage");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(6.4, 4.4, 6.4);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 13;
controls.target.set(0, 0.3, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0xc9dde2, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(4, 8, 5);
scene.add(keyLight);

function axisLabel(text, color, position) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 96, 96);
  context.font = "700 58px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.fillText(text, 48, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.copy(position);
  sprite.scale.set(.55, .55, .55);
  sprite.renderOrder = 20;
  return sprite;
}

const axes = new THREE.Group();
axes.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 2.75, 0xd73535, .24, .13));
axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 2.75, 0x2f8f46, .24, .13));
axes.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 2.75, 0x3156b8, .24, .13));
axes.renderOrder = 10;
scene.add(axes);
scene.add(axisLabel("x", "#d73535", new THREE.Vector3(3.02, 0, 0)));
scene.add(axisLabel("y", "#2f8f46", new THREE.Vector3(0, 3.02, 0)));
scene.add(axisLabel("z", "#3156b8", new THREE.Vector3(0, 0, 3.02)));

const COLORS = { current: 0xef7b31, field: 0x1687a7, vector: 0x293b8f, path: 0x9b4fc2, ink: 0x12313b, skin: 0xe5ad84 };
const content = new THREE.Group();
scene.add(content);
let mode = "hand";
let direction = 1;

function disposeGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse?.((node) => {
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose?.());
      else node.material?.dispose?.();
    });
  }
}

function arrow(dir, origin, length, color, head = 0.28) {
  return new THREE.ArrowHelper(dir.clone().normalize(), origin, length, color, head, head * 0.55);
}

function directionMarker(dir, position, color, scale = 1) {
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(.085 * scale, .24 * scale, 12),
    new THREE.MeshStandardMaterial({ color, roughness: .48 })
  );
  marker.position.copy(position);
  marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return marker;
}

function wire(currentSign = 1) {
  const group = new THREE.Group();
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 6.4, 24),
    new THREE.MeshStandardMaterial({ color: COLORS.current, roughness: 0.4 })
  );
  group.add(cylinder);
  group.add(arrow(new THREE.Vector3(0, currentSign, 0), new THREE.Vector3(0, -1.35 * currentSign, 0), 2.7, COLORS.current, 0.38));
  return group;
}

function fieldRing(radius, y, sign, arrowCount = 8, opacity = 1, drawCircle = true) {
  const group = new THREE.Group();
  const points = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    points.push(new THREE.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)));
  }
  if (drawCircle) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: COLORS.field, transparent: true, opacity })
    );
    group.add(line);
  }
  for (let i = 0; i < arrowCount; i++) {
    const a = (i / arrowCount) * Math.PI * 2;
    const p = new THREE.Vector3(radius * Math.cos(a), y, radius * Math.sin(a));
    // For a current along +y, B is proportional to y-hat × r-hat.
    const tangent = new THREE.Vector3(Math.sin(a) * sign, 0, -Math.cos(a) * sign);
    group.add(directionMarker(tangent, p, COLORS.field, Math.min(1.15, .76 + radius * .12)));
  }
  return group;
}

function amperePath(radius) {
  const group = new THREE.Group();
  const dashCount = 34;
  const dashFraction = .64;
  const material = new THREE.MeshStandardMaterial({ color: COLORS.path, roughness: .55 });
  for (let i = 0; i < dashCount; i++) {
    const start = (i / dashCount) * Math.PI * 2;
    const end = start + (Math.PI * 2 / dashCount) * dashFraction;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(radius * Math.cos(start), .025, radius * Math.sin(start)),
      new THREE.Vector3(radius * Math.cos((start + end) / 2), .025, radius * Math.sin((start + end) / 2)),
      new THREE.Vector3(radius * Math.cos(end), .025, radius * Math.sin(end)),
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, .025, 7, false), material));
  }
  return group;
}

function magneticFieldLines(currentMagnitude, fixedRadii = null) {
  const group = new THREE.Group();
  const ringCount = Math.round(2 + currentMagnitude);
  const radii = fixedRadii || Array.from(
    { length: ringCount },
    (_, i) => .55 + 1.9 * Math.pow(i / Math.max(1, ringCount - 1), 1.55)
  );
  radii.forEach((radius, index) => {
    const strength = currentMagnitude / radius;
    const opacity = Math.min(.95, .23 + strength * .16);
    const arrowCount = Math.max(5, Math.round(5 + strength * 1.25));
    group.add(fieldRing(radius, 0, direction, arrowCount, opacity));
  });
  return group;
}

function buildHand(currentMagnitude) {
  content.add(wire(direction));
  content.add(magneticFieldLines(currentMagnitude));
}

function buildBiot(radius) {
  const dlLength = 1.55;
  const dlOrigin = new THREE.Vector3(0, -.78 * direction, 0);
  content.add(arrow(new THREE.Vector3(0, direction, 0), dlOrigin, dlLength, COLORS.current, .35));
  const theta = Math.PI * .18;
  const p = new THREE.Vector3(radius * Math.cos(theta), 1.0, radius * Math.sin(theta));
  const r = p.clone();
  content.add(arrow(r, new THREE.Vector3(), r.length(), COLORS.vector, .3));
  const point = new THREE.Mesh(new THREE.SphereGeometry(.13, 24, 16), new THREE.MeshStandardMaterial({ color: COLORS.ink }));
  point.position.copy(p);
  content.add(point);
  const dl = new THREE.Vector3(0, direction, 0);
  const b = dl.clone().cross(r).normalize();
  const relative = Math.min(2.25, .55 + 3.2 / Math.max(.6, r.lengthSq()));
  content.add(arrow(b, p, relative, COLORS.field, .34));
  content.add(fieldRing(radius, 1, direction, 8, .35));
}

function buildAmpere(radius) {
  content.add(wire(direction));
  content.add(magneticFieldLines(2, [.62, .88, 1.18, 1.55, 2.05, 2.6]));
  content.add(amperePath(radius));
}

const copy = {
  hand: {
    step: "STEP 1", title: "電流を親指に合わせる",
    text: "右手の親指を電流の向きに合わせると、曲げた指が磁場の向きを示します。",
    question: "電流を反転すると、磁場の回る向きはどうなるでしょう？",
    label: "電流の大きさ", min: .5, max: 5, step: .5, value: 2,
    formula: "",
  },
  biot: {
    step: "STEP 2", title: "一点に届く磁場を見る",
    text: "電流要素 dℓ と観測点を結ぶ位置ベクトル r の外積が、微小磁場 dB の向きを決めます。",
    question: "観測点を遠ざけると、dBの矢印はどのように変わるでしょう？",
    label: "観測点までの距離", min: .8, max: 3.2, step: .1, value: 1.8,
    formula: "d<b>B</b> = <span>μ<sub>0</sub></span>⁄<span>4π</span> · <span>I d<b>ℓ</b> × <b>r̂</b></span>⁄<span>r<sup>2</sup></span><small>ビオ＝サバールの法則</small>",
  },
  ampere: {
    step: "STEP 3", title: "円周に沿って一周する",
    text: "紫の円は任意に選ぶ積分経路 C、青い矢印は経路上の磁場 B です。両者は別のものです。",
    question: "経路半径を変えると、磁場 B と円周 2πr はそれぞれどう変わるでしょう？",
    label: "アンペール経路の半径", min: .8, max: 2.8, step: .1, value: 1.6,
    formula: "∮<sub>C</sub> <b>B</b> · d<b>ℓ</b> = μ<sub>0</sub>I<sub>enc</sub><small>アンペールの法則</small>",
  },
};

const range = document.getElementById("main-range");
const rangeOutput = document.getElementById("range-output");
const result = document.getElementById("result");

function updateResult(value) {
  if (mode === "hand") {
    rangeOutput.textContent = `${value.toFixed(1)} A`;
    result.innerHTML = `<span>右手の親指</span><strong>電流と同じ${direction > 0 ? "上" : "下"}向き</strong>`;
  } else if (mode === "biot") {
    const r3 = Math.pow(Math.sqrt(value * value + 1), 3);
    const relative = value / r3;
    rangeOutput.textContent = `${value.toFixed(1)}`;
    result.innerHTML = `<span>相対的な磁場の大きさ</span><strong>|dB| = ${relative.toFixed(3)}</strong>`;
  } else {
    const b = 1 / value;
    rangeOutput.textContent = `${value.toFixed(1)}`;
    result.innerHTML = `<span>B × 2πr</span><strong>${b.toFixed(2)} × ${(2 * Math.PI * value).toFixed(2)} = ${(2 * Math.PI).toFixed(2)}</strong>`;
  }
}

function renderModel() {
  disposeGroup(content);
  const value = Number(range.value);
  if (mode === "hand") buildHand(value);
  if (mode === "biot") buildBiot(value);
  if (mode === "ampere") buildAmpere(value);
  updateResult(value);
}

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll(".step-tab").forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  const c = copy[mode];
  document.getElementById("step-label").textContent = c.step;
  document.getElementById("lesson-title").textContent = c.title;
  document.getElementById("lesson-text").textContent = c.text;
  document.getElementById("question").textContent = c.question;
  const formula = document.getElementById("law-formula");
  formula.hidden = !c.formula;
  formula.innerHTML = c.formula;
  document.getElementById("range-label").textContent = c.label;
  document.getElementById("r-legend").hidden = mode !== "biot";
  document.getElementById("path-legend").hidden = mode !== "ampere";
  range.min = c.min; range.max = c.max; range.step = c.step; range.value = c.value;
  renderModel();
}

document.querySelectorAll(".step-tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
document.getElementById("current-direction").addEventListener("click", (event) => {
  direction *= -1;
  event.currentTarget.setAttribute("aria-pressed", String(direction < 0));
  document.getElementById("direction-label").textContent = direction > 0 ? "上向き" : "下向き";
  renderModel();
});
range.addEventListener("input", renderModel);
document.getElementById("reset-view").addEventListener("click", () => {
  camera.position.set(6.4, 4.4, 6.4);
  controls.target.set(0, .3, 0);
  controls.update();
});

function resize() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();
renderModel();

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

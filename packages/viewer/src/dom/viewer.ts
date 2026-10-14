/**
 * The DOM side of the viewer (plan 0034): the WebGL renderer, the HTML
 * labels, the orbit controls, resizing and the animation loop. Nothing in
 * here touches a flight value; it draws the `FlightScene` and reports the
 * wall-clock interval of each frame to the caller, who owns the replay
 * clock. Not covered by the Node tests; exercised by the end-to-end tests.
 */
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  ACESFilmicToneMapping,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  cameraPose,
  type CameraMode,
  type FlightScene,
  type SceneLabel,
} from '../scene/flight-scene.js';
import { mergeLabels } from '../scene/labels.js';
import { buildLightDome } from '../scene/sky.js';
import { loadSceneAssets } from './assets.js';

export interface ViewerOptions {
  /**
   * Called once per animation frame with the wall-clock seconds since the
   * previous frame; returns true when the scene changed (the replay time
   * moved) so the frame must be drawn. Frames are drawn only on a change.
   */
  readonly onFrame?: (deltaSeconds: number) => boolean;
  /** Called when the photographic scenery could not be loaded (the plain scenery stays). */
  readonly onAssetsError?: (message: string) => void;
  /** Called when the photographic scenery is on. */
  readonly onAssetsReady?: () => void;
  readonly initialCamera?: CameraMode;
  /** Show a close-up of the rocket in a corner when the main camera is not following it (default true). */
  readonly inset?: boolean;
}

export interface ViewerHandle {
  setCamera(mode: CameraMode): void;
  readonly cameraMode: CameraMode;
  /** The canvas, for tests and screenshots. */
  readonly canvas: HTMLCanvasElement;
  /** 'high', or 'low' after a software renderer or slow frames were detected (fewer pixels, no shadows, no inset). */
  readonly quality: 'high' | 'low';
  /** Render one frame now (used after a seek while paused). */
  render(): void;
  dispose(): void;
}

/** Merge order of the labels (#29): lower first. */
const LABEL_PRIORITY: Readonly<Record<SceneLabel['kind'], number>> = {
  event: 0,
  pad: 1,
  wind: 2,
  compass: 3,
  scale: 4,
};
/** Kinds whose text is folded into the label they collide with; others are only hidden. */
const MERGED_KINDS: ReadonlySet<SceneLabel['kind']> = new Set(['event', 'pad', 'wind']);
/** Labels closer than this on screen are merged, pixels (a drawing choice). */
const LABEL_MERGE_X = 90;
const LABEL_MERGE_Y = 18;

/** Average frame interval above which the quality drops, seconds (about 14 frames per second). */
const SLOW_FRAME = 0.07;

/**
 * Mount the scene into `container` (which must have a size). The labels are
 * HTML elements with the class `viewer-label` and `viewer-label-<kind>`.
 */
export function mountViewer(
  container: HTMLElement,
  scene: FlightScene,
  options: ViewerOptions = {},
): ViewerHandle {
  const renderer = new WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    // The scene spans a few centimetres (the rocket) to tens of kilometres (the terrain).
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  // Quality: a software renderer, or frames slower than SLOW_FRAME on average, switch to 'low'
  // once (fewer pixels, no shadows, no inset), so the replay stays usable on weak machines.
  let quality: 'high' | 'low' = 'high';
  const setLow = (scale: number): void => {
    if (quality === 'low') return;
    quality = 'low';
    renderer.setPixelRatio(Math.min(1, window.devicePixelRatio) * scale);
    scene.setLowDetail(true);
    resize();
  };
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName = String(
    info === null ? gl.getParameter(gl.RENDERER) : gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
  );
  const software = /swiftshader|llvmpipe|software|basic render/i.test(rendererName);

  // Image-based lighting: from the gradient sky now, from the photograph's HDR once loaded.
  const pmrem = new PMREMGenerator(renderer);
  const envScene = new Scene();
  envScene.add(new Mesh(new SphereGeometry(100, 32, 16), scene.skyMaterial));
  let env = pmrem.fromScene(envScene, 0, 0.1, 1000);
  scene.scene.environment = env.texture;
  scene.scene.environmentIntensity = 0.55;
  let disposed = false;
  loadSceneAssets(renderer.capabilities.getMaxAnisotropy()).then(
    (assets) => {
      if (disposed) return;
      scene.applyAssets(assets);
      const lightScene = new Scene();
      lightScene.add(buildLightDome(assets.skyLight));
      const next = pmrem.fromScene(lightScene, 0, 0.1, 1000);
      env.dispose();
      env = next;
      scene.scene.environment = env.texture;
      scene.scene.environmentIntensity = 1.0;
      scene.useImageLighting();
      invalidate();
      options.onAssetsReady?.();
    },
    (error: unknown) => {
      if (disposed) return;
      options.onAssetsError?.(
        `The photographic scenery could not be loaded (${error instanceof Error ? error.message : String(error)}); the plain scenery is shown.`,
      );
    },
  );
  renderer.domElement.setAttribute('aria-label', '3D replay of the flight');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  labelRenderer.domElement.className = 'viewer-labels';
  container.appendChild(labelRenderer.domElement);

  const labelObjects: CSS2DObject[] = [];
  const labelText = new Map<CSS2DObject, string>();
  const labelKind = new Map<CSS2DObject, SceneLabel['kind']>();
  // In priority order for merging (#29): events (in time order), then the pad, wind, compass, scale.
  const ordered = [...scene.labels].sort((a, b) => LABEL_PRIORITY[a.kind] - LABEL_PRIORITY[b.kind]);
  for (const label of ordered) {
    const div = document.createElement('div');
    div.className = `viewer-label viewer-label-${label.kind}`;
    div.textContent = label.text;
    const obj = new CSS2DObject(div);
    obj.position.set(label.position.x, label.position.y, label.position.z);
    scene.scene.add(obj);
    labelObjects.push(obj);
    labelText.set(obj, label.text);
    labelKind.set(obj, label.kind);
  }

  // Labels that land on top of each other on screen are merged into the first (#29).
  const projected = new Vector3();
  const declutter = (camera: PerspectiveCamera, w: number, h: number): void => {
    const points = labelObjects.map((obj) => {
      projected.setFromMatrixPosition(obj.matrixWorld).project(camera);
      if (projected.z < -1 || projected.z > 1) return undefined;
      return { x: ((projected.x + 1) / 2) * w, y: ((1 - projected.y) / 2) * h };
    });
    const into = mergeLabels(points, LABEL_MERGE_X, LABEL_MERGE_Y);
    const texts = labelObjects.map((obj) => [labelText.get(obj) ?? '']);
    // Events, the pad and the wind fold their text into the label they land on; the distance
    // scale and the compass are only hidden when they collide.
    labelObjects.forEach((obj, i) => {
      const k = into[i] ?? i;
      const host = labelObjects[k];
      if (k < 0 || k === i || host === undefined) return;
      if (
        MERGED_KINDS.has(labelKind.get(obj) ?? 'scale') &&
        MERGED_KINDS.has(labelKind.get(host) ?? 'scale')
      ) {
        texts[k]?.push(labelText.get(obj) ?? '');
      }
    });
    labelObjects.forEach((obj, i) => {
      const k = into[i] ?? i;
      obj.element.style.visibility = k === i || k < 0 ? '' : 'hidden';
      const text = (texts[i] ?? []).join(' · ');
      if (k === i && obj.element.textContent !== text) obj.element.textContent = text;
    });
  };

  const controls = new OrbitControls(scene.camera, renderer.domElement);
  controls.enableDamping = false;
  // Drawing on demand: a frame is drawn only when something changed.
  let dirty = true;
  const invalidate = (): void => {
    dirty = true;
  };
  controls.addEventListener('change', invalidate);
  let mode: CameraMode = options.initialCamera ?? 'follow';

  // The close-up inset: its own camera, a corner viewport and a frame.
  const insetCamera = new PerspectiveCamera(35, 4 / 3, 0.02, scene.camera.far);
  insetCamera.up.set(0, 0, 1);
  const insetFrame = document.createElement('div');
  insetFrame.className = 'viewer-inset';
  insetFrame.setAttribute('aria-hidden', 'true');
  Object.assign(insetFrame.style, {
    position: 'absolute',
    right: '10px',
    bottom: '10px',
    border: '2px solid rgba(255,255,255,0.9)',
    borderRadius: '6px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
    display: 'none',
  });
  container.appendChild(insetFrame);
  const useInset = options.inset ?? true;
  let inset = { x: 0, y: 0, w: 0, h: 0 };

  const resize = (): void => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    labelRenderer.setSize(w, h);
    scene.camera.aspect = w / h;
    scene.camera.updateProjectionMatrix();
    const iw = Math.round(Math.min(320, Math.max(140, 0.28 * w)));
    const ih = Math.round(Math.min(0.45 * h, (iw * 3) / 4));
    inset = { x: w - iw - 10, y: 10, w: iw, h: ih };
    insetFrame.style.width = `${String(iw)}px`;
    insetFrame.style.height = `${String(ih)}px`;
    insetCamera.aspect = iw / Math.max(1, ih);
    insetCamera.updateProjectionMatrix();
    invalidate();
  };
  // A software renderer shades every pixel on the CPU: half the resolution in each direction.
  if (software) setLow(0.5);
  resize();
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  observer?.observe(container);

  const render = (): void => {
    if (mode === 'orbit') controls.update();
    else scene.applyCamera(mode);
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    scene.prepareRender(scene.camera, h);
    renderer.render(scene.scene, scene.camera);
    labelRenderer.render(scene.scene, scene.camera);
    declutter(scene.camera, w, h);
    const showInset = useInset && quality === 'high' && mode !== 'follow' && inset.w > 0;
    insetFrame.style.display = showInset ? 'block' : 'none';
    if (showInset) {
      const p = scene.rocket.position;
      const pose = cameraPose('follow', { x: p.x, y: p.y, z: p.z }, 0.45 * scene.rocketLength);
      if (pose !== undefined) {
        insetCamera.position.set(pose.position.x, pose.position.y, pose.position.z);
        insetCamera.lookAt(p.x, p.y, p.z);
        insetCamera.updateMatrixWorld(true);
        renderer.setScissorTest(true);
        renderer.setScissor(inset.x, inset.y, inset.w, inset.h);
        renderer.setViewport(inset.x, inset.y, inset.w, inset.h);
        scene.prepareRender(insetCamera, inset.h);
        renderer.render(scene.scene, insetCamera);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, w, h);
      }
    }
  };

  const setCamera = (next: CameraMode): void => {
    if (next === 'orbit' && mode !== 'orbit') {
      // Start orbiting from where the follow camera is, about the rocket.
      scene.applyCamera('follow');
      controls.target.copy(scene.rocket.position);
    }
    mode = next;
    controls.enabled = next === 'orbit';
    render();
  };
  setCamera(mode);

  let last = performance.now();
  let frame = 0;
  let slowSum = 0;
  let slowCount = 0;
  let drewLast = false;
  const loop = (now: number): void => {
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    // Only intervals between two drawn frames say how fast drawing is.
    if (quality === 'high' && drewLast && dt < 2) {
      slowSum += dt;
      slowCount++;
      if (slowCount === 30) {
        if (slowSum / slowCount > SLOW_FRAME) setLow(0.75);
        slowSum = 0;
        slowCount = 0;
      }
    }
    if (options.onFrame?.(dt) === true) dirty = true;
    drewLast = dirty;
    if (dirty) {
      dirty = false;
      render();
    }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    setCamera,
    get cameraMode() {
      return mode;
    },
    get quality() {
      return quality;
    },
    canvas: renderer.domElement,
    render,
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      controls.removeEventListener('change', invalidate);
      observer?.disconnect();
      controls.dispose();
      for (const o of labelObjects) scene.scene.remove(o);
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      insetFrame.remove();
      labelRenderer.domElement.remove();
    },
  };
}

export { imagerySource, loadMapScenery, searchPlace, type MapScenery } from './map-loader.js';

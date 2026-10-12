/**
 * The DOM side of the viewer (plan 0034): the WebGL renderer, the HTML
 * labels, the orbit controls, resizing and the animation loop. Nothing in
 * here touches a flight value; it draws the `FlightScene` and reports the
 * wall-clock interval of each frame to the caller, who owns the replay
 * clock. Not covered by the Node tests; exercised by the end-to-end tests.
 */
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { WebGLRenderer } from 'three';
import type { CameraMode, FlightScene } from '../scene/flight-scene.js';

export interface ViewerOptions {
  /** Called once per animation frame with the wall-clock seconds since the previous frame. */
  readonly onFrame?: (deltaSeconds: number) => void;
  readonly initialCamera?: CameraMode;
}

export interface ViewerHandle {
  setCamera(mode: CameraMode): void;
  readonly cameraMode: CameraMode;
  /** The canvas, for tests and screenshots. */
  readonly canvas: HTMLCanvasElement;
  /** Render one frame now (used after a seek while paused). */
  render(): void;
  dispose(): void;
}

/**
 * Mount the scene into `container` (which must have a size). The labels are
 * HTML elements with the class `viewer-label` and `viewer-label-<kind>`.
 */
export function mountViewer(
  container: HTMLElement,
  scene: FlightScene,
  options: ViewerOptions = {},
): ViewerHandle {
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
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
  for (const label of scene.labels) {
    const div = document.createElement('div');
    div.className = `viewer-label viewer-label-${label.kind}`;
    div.textContent = label.text;
    const obj = new CSS2DObject(div);
    obj.position.set(label.position.x, label.position.y, label.position.z);
    scene.scene.add(obj);
    labelObjects.push(obj);
  }

  const controls = new OrbitControls(scene.camera, renderer.domElement);
  controls.enableDamping = false;
  let mode: CameraMode = options.initialCamera ?? 'follow';

  const resize = (): void => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    labelRenderer.setSize(w, h);
    scene.camera.aspect = w / h;
    scene.camera.updateProjectionMatrix();
  };
  resize();
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  observer?.observe(container);

  const render = (): void => {
    if (mode === 'orbit') controls.update();
    else scene.applyCamera(mode);
    renderer.render(scene.scene, scene.camera);
    labelRenderer.render(scene.scene, scene.camera);
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
  const loop = (now: number): void => {
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    options.onFrame?.(dt);
    render();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    setCamera,
    get cameraMode() {
      return mode;
    },
    canvas: renderer.domElement,
    render,
    dispose: () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      controls.dispose();
      for (const o of labelObjects) scene.scene.remove(o);
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
}

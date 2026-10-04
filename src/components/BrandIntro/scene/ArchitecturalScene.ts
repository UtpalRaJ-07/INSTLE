/**
 * ArchitecturalScene — the WebGL tier.
 *
 * Raw WebGL2, no engine: the scene is a few thousand box vertices and four small
 * programs, and a general-purpose 3D library would weigh more than everything
 * else on the homepage put together. This module is loaded with a dynamic
 * import, only on a first visit, only when the device passes the capability
 * checks, so it never counts against the homepage's first-load script.
 *
 * The scene owns nothing outside its canvas. `dispose()` deletes every buffer,
 * vertex array, shader and program, removes its one listener, releases the
 * context and shrinks the canvas. It schedules no frames of its own; the caller
 * drives them, so there is no loop left behind to cancel.
 */

import type { ResolvedFullTimeline, SceneQuality } from '../intro-config';
import { EASE, progress } from '../timeline';
import { FOG_DENSITY, buildPoints } from './Atmosphere';
import { buildBackgroundBuildings } from './BackgroundBuildings';
import { cameraAt, compositionFor, sweepDirection } from './Camera';
import { MeshBuilder, type MeshData } from './geometry';
import { KEY_DIRECTION, RIM_DIRECTION, lightAt } from './Lighting';
import { buildMainBuilding } from './MainBuilding';
import { invert, lookAt, multiply, perspective } from './math';
import {
  ARCH_FRAGMENT,
  ARCH_VERTEX,
  GROUND_FRAGMENT,
  GROUND_VERTEX,
  POINTS_FRAGMENT,
  POINTS_VERTEX,
  SKY_FRAGMENT,
  SKY_VERTEX,
} from './shaders';

export interface SceneOptions {
  quality: SceneQuality;
  timeline: ResolvedFullTimeline;
  intensity: number;
  /** Called once if the GPU drops the context mid-film. */
  onContextLost: () => void;
  /** Checked after shader compilation: true if the film no longer wants the scene. */
  shouldAbort: () => boolean;
}

export interface ArchitecturalSceneHandle {
  /** Draw the frame for time `t` on the intro timeline, in ms. */
  render(t: number): void;
  dispose(): void;
}

/** Renderers that mean "no real GPU": the CSS scene is the better experience there. */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

interface DrawCall {
  vao: WebGLVertexArrayObject;
  count: number;
  indexed: boolean;
}

export async function createArchitecturalScene(
  canvas: HTMLCanvasElement,
  options: SceneOptions
): Promise<ArchitecturalSceneHandle | null> {
  const context = canvas.getContext('webgl2', {
    alpha: false,
    antialias: options.quality.antialias,
    depth: true,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: true,
  });
  if (!context) return null;
  // A non-null binding, so the nested helpers below see the narrowed type.
  const gl: WebGL2RenderingContext = context;

  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  if (debug && SOFTWARE_RENDERER.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)))) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }

  const shaders: WebGLShader[] = [];
  const programs: WebGLProgram[] = [];
  const buffers: WebGLBuffer[] = [];
  const arrays: WebGLVertexArrayObject[] = [];
  let disposed = false;

  const release = () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', onLost);
    for (const vao of arrays) gl.deleteVertexArray(vao);
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    for (const program of programs) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    arrays.length = 0;
    buffers.length = 0;
    programs.length = 0;
    shaders.length = 0;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    // Drop the backing store as well; a zero-sized canvas holds no GPU memory.
    canvas.width = 1;
    canvas.height = 1;
  };

  function onLost(event: Event) {
    event.preventDefault();
    if (disposed) return;
    release();
    options.onContextLost();
  }
  canvas.addEventListener('webglcontextlost', onLost);

  // -------------------------------------------------------------------------
  // Programs
  // -------------------------------------------------------------------------

  // Compile and link everything without asking for a status: asking forces the
  // driver to finish synchronously, which is a long frame in the middle of the
  // film. With KHR_parallel_shader_compile the driver works off the main thread
  // and we poll for completion once per frame while the CSS scene plays.
  function compile(type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  function link(vertex: string, fragment: string): WebGLProgram | null {
    const vs = compile(gl.VERTEX_SHADER, vertex);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return null;
    programs.push(program);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    return program;
  }

  const pending = [
    link(SKY_VERTEX, SKY_FRAGMENT),
    link(ARCH_VERTEX, ARCH_FRAGMENT),
    link(GROUND_VERTEX, GROUND_FRAGMENT),
    link(POINTS_VERTEX, POINTS_FRAGMENT),
  ];
  const parallel = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: number } | null;
  if (parallel) {
    const started = performance.now();
    while (
      !disposed &&
      performance.now() - started < 3000 &&
      !pending.every((program) => !program || gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR))
    ) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  if (disposed || options.shouldAbort()) {
    release();
    return null;
  }
  const linked = pending.map((program) =>
    program && gl.getProgramParameter(program, gl.LINK_STATUS) ? { program, uniforms: new Map() } : null
  ) as (Program | null)[];
  const [sky, arch, ground, points] = linked;
  if (!sky || !arch || !ground || !points) {
    release();
    return null;
  }

  // -------------------------------------------------------------------------
  // Geometry
  // -------------------------------------------------------------------------

  function upload(
    data: Float32Array,
    layout: readonly (readonly [location: number, size: number])[],
    index?: Uint32Array
  ): DrawCall {
    const vao = gl.createVertexArray()!;
    arrays.push(vao);
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    buffers.push(vbo);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const stride = layout.reduce((sum, [, size]) => sum + size, 0);
    let offset = 0;
    for (const [location, size] of layout) {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride * 4, offset * 4);
      offset += size;
    }
    let count = data.length / stride;
    if (index) {
      const ibo = gl.createBuffer()!;
      buffers.push(ibo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
      count = index.length;
    }
    gl.bindVertexArray(null);
    return { vao, count, indexed: Boolean(index) };
  }

  const probe = compositionFor(16 / 9);
  const solid = new MeshBuilder();
  const railGlass = new MeshBuilder();
  buildMainBuilding(solid, railGlass);
  buildBackgroundBuildings(solid, options.quality.cityBlocks, probe.end.eye);
  const meshLayout = [
    [0, 3],
    [1, 3],
    [2, 2],
  ] as const;
  const asDraw = (mesh: MeshData) => upload(mesh.vertices, meshLayout, mesh.indices);
  const solidDraw = asDraw(solid.build());
  const railDraw = asDraw(railGlass.build());
  const skyDraw = upload(new Float32Array([-1, -1, 3, -1, -1, 3]), [[0, 2]]);
  const G = 900;
  const groundDraw = upload(new Float32Array([-G, 0, -G, G, 0, -G, G, 0, G, -G, 0, -G, G, 0, G, -G, 0, G]), [[0, 3]]);
  const pointData = buildPoints(options.quality.streetLights, options.quality.dust);
  const pointDraw = upload(pointData, [
    [0, 3],
    [1, 3],
  ]);

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  function location(target: Program, name: string) {
    if (!target.uniforms.has(name)) target.uniforms.set(name, gl.getUniformLocation(target.program, name));
    return target.uniforms.get(name) ?? null;
  }

  let width = 0;
  let height = 0;
  function fit() {
    const ratio = Math.min(window.devicePixelRatio || 1, options.quality.maxPixelRatio) * options.quality.renderScale;
    const w = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const h = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (w !== width || h !== height) {
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw(call: DrawCall) {
    gl.bindVertexArray(call.vao);
    if (call.indexed) gl.drawElements(gl.TRIANGLES, call.count, gl.UNSIGNED_INT, 0);
    else gl.drawArrays(gl.TRIANGLES, 0, call.count);
  }

  const { timeline, intensity } = options;

  return {
    render(t: number) {
      if (disposed || gl.isContextLost()) return;
      fit();
      const aspect = width / height;
      const composition = compositionFor(aspect);
      const pose = cameraAt(EASE.camera(progress(t, timeline.cameraIn, timeline.cameraDuration)), composition);
      const projection = perspective(pose.fov, aspect, 0.3, 1600);
      const view = lookAt(pose.eye, pose.target, [0, 1, 0]);
      const viewProj = multiply(projection, view);
      const light = lightAt(t, timeline, intensity);
      const sweep = sweepDirection(composition);
      const pixel = height / (2 * Math.tan(pose.fov / 2));

      const common = (target: Program) => {
        gl.useProgram(target.program);
        gl.uniform3fv(location(target, 'uCamPos'), pose.eye as unknown as Float32List);
        gl.uniform1f(location(target, 'uTime'), t / 1000);
        gl.uniform3fv(location(target, 'uSweepN'), sweep as unknown as Float32List);
        gl.uniform1f(location(target, 'uSweepPos'), light.sweepPos);
        gl.uniform1f(location(target, 'uSweepGain'), light.sweepGain);
        gl.uniform1f(location(target, 'uRevealAll'), light.revealAll);
        gl.uniform1f(location(target, 'uWindows'), light.windows);
        gl.uniform1f(location(target, 'uCity'), light.city);
        gl.uniform1f(location(target, 'uFogDensity'), FOG_DENSITY);
        gl.uniform1f(location(target, 'uExposure'), light.exposure);
        gl.uniform1f(location(target, 'uLift'), light.lift);
        gl.uniform3fv(location(target, 'uKeyDir'), KEY_DIRECTION as unknown as Float32List);
        gl.uniform3fv(location(target, 'uRimDir'), RIM_DIRECTION as unknown as Float32List);
        gl.uniformMatrix4fv(location(target, 'uViewProj'), false, viewProj);
      };

      gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Sky, behind everything.
      gl.disable(gl.DEPTH_TEST);
      common(sky);
      gl.uniformMatrix4fv(location(sky, 'uInvViewProj'), false, invert(viewProj));
      draw(skyDraw);

      // Opaque architecture, then the ground.
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      common(arch);
      gl.uniform1f(location(arch, 'uInteriorDetail'), options.quality.dust > 0 ? 1 : 0.6);
      draw(solidDraw);
      gl.disable(gl.CULL_FACE);
      common(ground);
      draw(groundDraw);

      // Transparent passes: no depth writes.
      gl.depthMask(false);
      gl.enable(gl.BLEND);

      gl.blendFunc(gl.ONE, gl.ONE);
      common(points);
      gl.uniform1f(location(points, 'uPixel'), pixel);
      gl.uniform1f(location(points, 'uDust'), options.quality.dust > 0 ? intensity : 0);
      gl.bindVertexArray(pointDraw.vao);
      gl.drawArrays(gl.POINTS, 0, pointDraw.count);

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      common(arch);
      draw(railDraw);

      gl.bindVertexArray(null);
    },
    dispose: release,
  };
}

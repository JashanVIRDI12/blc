// Compiling a scene's shaders before it is first drawn, without holding the
// page still. Where the browser can say when a program is ready
// (KHR_parallel_shader_compile: Chrome, Safari), three's compileAsync waits
// on that. Where it cannot (Firefox), compileAsync returns at once and the
// first frame then waits on every program together: a second or more with
// the page frozen, and under ScrollSmoother the scroll with it. There the
// compiling is asked for, a fence is set behind it in the GPU's queue, and
// the fence is watched from one moment to the next: the GPU works through its
// queue in its own process while the page stays live.
export async function compileAhead(renderer, scene, camera, targetScene = null) {
  if (renderer.extensions.has('KHR_parallel_shader_compile')) return renderer.compileAsync(scene, camera, targetScene);
  renderer.compile(scene, camera, targetScene);
  const gl = renderer.getContext();
  if (typeof gl.fenceSync !== 'function') return;
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const started = performance.now();
  await new Promise(resolve => {
    const watch = () => {
      if (gl.isContextLost() || gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED || performance.now() - started > 8000) { gl.deleteSync(fence); resolve(); }
      else setTimeout(watch, 16);
    };
    setTimeout(watch, 16);
  });
}

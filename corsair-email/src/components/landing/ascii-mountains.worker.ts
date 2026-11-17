import {
  createMountainPainter,
  type MountainCommand,
  type MountainPointer,
  type MountainSettings,
} from "./mountain-painter";

let canvas: OffscreenCanvas | undefined;
let settings: MountainSettings | undefined;
let paint: ReturnType<typeof createMountainPainter> | undefined;
let pointer: MountainPointer = { x: -9999, y: -9999, active: false };
let visible = true;
let frame = 0;
let lastFrame = 0;
let pixelRatio = 1;

function render(time: number) {
  frame = 0;
  if (!visible || !settings || !paint) return;
  if (time - lastFrame >= 1000 / 30 || settings.reducedMotion) {
    paint(settings, pointer, time);
    lastFrame = time;
  }
  if (!settings.reducedMotion) frame = requestAnimationFrame(render);
}
function restart() {
  cancelAnimationFrame(frame);
  lastFrame = 0;
  if (visible) frame = requestAnimationFrame(render);
}
function resize() {
  if (!canvas || !settings) return;
  canvas.width = Math.round(settings.width * pixelRatio);
  canvas.height = Math.round(settings.height * pixelRatio);
  canvas.getContext("2d")?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  restart();
}
addEventListener("message", (event: MessageEvent<MountainCommand>) => {
  const command = event.data;
  switch (command.type) {
    case "init": {
      canvas = command.canvas;
      settings = command.settings;
      pixelRatio = command.pixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) paint = createMountainPainter(ctx);
      resize();
      break;
    }
    case "resize":
      if (settings) {
        settings.width = command.width;
        settings.height = command.height;
      }
      pixelRatio = command.pixelRatio;
      resize();
      break;
    case "pointer":
      pointer = command.pointer;
      break;
    case "visibility":
      visible = command.visible;
      restart();
      break;
    case "motion":
      if (settings) settings.reducedMotion = command.reducedMotion;
      restart();
      break;
  }
});

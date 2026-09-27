// Draws a Composition onto a 2D canvas. The same drawing feeds the projection screen,
// the pass preview and the PNG export, so all three always agree.
import type { Composition, Layer } from "../game/composition";

export const POSTER_W = 768;
export const POSTER_H = 1024;
export const FONT = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const PAPER = "#f1ece0";

function rgba(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function ground(ctx: CanvasRenderingContext2D, c: Composition, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.ground[0]);
  g.addColorStop(1, c.ground[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Optical registration: the aperture rings and crosshair every pass shares.
  ctx.save();
  ctx.strokeStyle = rgba(c.accent, 0.22);
  ctx.lineWidth = w * 0.002;
  const cx = w * 0.5;
  const cy = h * 0.47;
  for (let i = 1; i <= 5; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, w * (0.08 + i * 0.075), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.12);
  ctx.lineTo(cx, h * 0.76);
  ctx.moveTo(w * 0.06, cy);
  ctx.lineTo(w * 0.94, cy);
  ctx.stroke();
  ctx.restore();
}

function slit(ctx: CanvasRenderingContext2D, l: Layer, w: number, h: number) {
  ctx.save();
  ctx.translate(l.x * w, l.y * h);
  ctx.rotate((l.angle * Math.PI) / 180);
  const bw = w * 0.018 * l.scale;
  const fringes: [string, number][] = [
    ["#ff3355", -bw * 1.2],
    ["#33ffaa", 0],
    ["#3377ff", bw * 1.2],
  ];
  for (const [colour, dx] of fringes) {
    const g = ctx.createLinearGradient(0, -h, 0, h);
    g.addColorStop(0, rgba(colour, 0));
    g.addColorStop(0.5, rgba(colour, 0.55));
    g.addColorStop(1, rgba(colour, 0));
    ctx.fillStyle = g;
    ctx.fillRect(dx - bw * 1.5, -h, bw * 3, h * 2);
  }
  ctx.shadowColor = l.hue;
  ctx.shadowBlur = w * 0.05;
  ctx.fillStyle = rgba(l.hue, 0.95);
  ctx.fillRect(-bw * 0.35, -h, bw * 0.7, h * 2);
  ctx.restore();
}

function foil(ctx: CanvasRenderingContext2D, l: Layer, w: number, h: number) {
  ctx.save();
  ctx.translate(l.x * w, l.y * h);
  ctx.rotate((l.angle * Math.PI) / 180);
  const span = w * 0.75 * l.scale;
  const lift = h * (0.08 + l.seed * 0.08);
  const g = ctx.createLinearGradient(-span, 0, span, 0);
  g.addColorStop(0, rgba(l.hue, 0.1));
  g.addColorStop(0.35, rgba(l.hue, 0.9));
  g.addColorStop(0.5, rgba("#fff6dc", 1));
  g.addColorStop(0.65, rgba(l.hue, 0.8));
  g.addColorStop(1, rgba(l.hue, 0.1));
  ctx.strokeStyle = g;
  ctx.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    ctx.globalAlpha = 0.35 + 0.65 * Math.sin(t * Math.PI);
    ctx.lineWidth = w * (0.002 + 0.003 * Math.sin(t * Math.PI));
    const off = (t - 0.5) * w * 0.07;
    ctx.beginPath();
    ctx.moveTo(-span, off + lift);
    ctx.bezierCurveTo(
      -span * 0.3,
      off - lift * 1.6,
      span * 0.3,
      off + lift * 1.6,
      span,
      off - lift,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function pattern(ctx: CanvasRenderingContext2D, l: Layer, w: number, h: number) {
  const r = w * 0.24 * l.scale;
  ctx.save();
  ctx.translate(l.x * w, l.y * h);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  glow.addColorStop(0, rgba(l.hue, 0.25));
  glow.addColorStop(1, rgba(l.hue, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.strokeStyle = rgba(l.hue, 0.75);
  ctx.lineWidth = w * 0.004;
  // Two gratings at slightly different angles: a projected moiré.
  for (const turn of [0, 0.09 + l.seed * 0.08]) {
    ctx.save();
    ctx.rotate((l.angle * Math.PI) / 180 + turn);
    for (let x = -r; x <= r; x += w * 0.016) {
      ctx.beginPath();
      ctx.moveTo(x, -r);
      ctx.lineTo(x, r);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function field(ctx: CanvasRenderingContext2D, l: Layer, w: number, h: number) {
  const r = w * 0.55 * l.scale;
  const g = ctx.createRadialGradient(l.x * w, l.y * h, 0, l.x * w, l.y * h, r);
  g.addColorStop(0, rgba(l.hue, 0.6));
  g.addColorStop(0.5, rgba(l.hue, 0.22));
  g.addColorStop(1, rgba(l.hue, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

const MOTIFS = { slit, foil, pattern, field } as const;

function identity(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = w * 0.205;
  ctx.save();
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  const words = ["AFTER", "IMAGE"];
  words.forEach((word, i) => {
    const y = h * 0.84 + i * size * 0.86;
    // The afterimage: ghost copies in the separated primaries, then the ink-paper word.
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = rgba("#ff3355", 0.35);
    ctx.fillText(word, w * 0.045 - size * 0.03, y);
    ctx.fillStyle = rgba("#3377ff", 0.35);
    ctx.fillText(word, w * 0.045 + size * 0.03, y);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = PAPER;
    ctx.fillText(word, w * 0.045, y);
  });
  ctx.restore();
}

function details(ctx: CanvasRenderingContext2D, c: Composition, w: number, h: number) {
  const pad = w * 0.05;
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${w * 0.022}px ${FONT}`;
  ctx.fillText("THE OBSERVATORY FESTIVAL", pad, h * 0.055);
  ctx.textAlign = "right";
  ctx.fillText(c.nights, w - pad, h * 0.055);
  ctx.fillStyle = rgba(c.accent, 0.95);
  ctx.fillText(c.serial, w - pad, h * 0.085);
  ctx.textAlign = "left";
  ctx.font = `400 ${w * 0.018}px ${FONT}`;
  ctx.fillStyle = rgba(PAPER, 0.7);
  ctx.fillText("THE LENS · THE BOILER ROOM · THE SKY DECK", pad, h * 0.085);

  ctx.fillStyle = PAPER;
  ctx.font = `italic 600 ${w * 0.036}px ${FONT}`;
  ctx.fillText(c.mood, pad, h * 0.145);
  ctx.font = `500 ${w * 0.018}px ${FONT}`;
  const lines = c.lines.slice(0, 6);
  lines.forEach((line, i) => {
    const y = h * 0.18 + i * w * 0.026;
    ctx.fillStyle = rgba(c.accent, 0.95);
    ctx.fillText(line.when, pad, y);
    ctx.fillStyle = rgba(PAPER, 0.88);
    ctx.fillText(`${line.title} — ${line.venue}`, pad + w * 0.17, y);
  });
  if (c.lines.length > 6) {
    ctx.fillStyle = rgba(PAPER, 0.6);
    ctx.fillText(`+ ${c.lines.length - 6} more`, pad + w * 0.17, h * 0.18 + 6 * w * 0.026);
  }
  if (c.stamp) stamp(ctx, w * 0.82, h * 0.63, w * 0.085);
  ctx.restore();
}

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.25);
  ctx.strokeStyle = "#d8b46a";
  ctx.fillStyle = "#d8b46a";
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = `800 ${r * 0.26}px ${FONT}`;
  ctx.fillText("PROJECTIONIST", 0, r * 0.09);
  ctx.restore();
}

/** Draw the full poster at the canvas's own size. */
export function drawPoster(canvas: HTMLCanvasElement, c: Composition) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ground(ctx, c, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (const layer of c.layers) MOTIFS[layer.kind](ctx, layer, w, h);
  ctx.globalCompositeOperation = "source-over";
  // Ink bands that hold the type, so it reads over any combination of light.
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.34);
  top.addColorStop(0, rgba(c.ground[0], 0.92));
  top.addColorStop(0.7, rgba(c.ground[0], 0.55));
  top.addColorStop(1, rgba(c.ground[0], 0));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, h * 0.34);
  const band = ctx.createLinearGradient(0, h * 0.62, 0, h * 0.7);
  band.addColorStop(0, rgba(c.ground[1], 0));
  band.addColorStop(1, rgba(c.ground[1], 0.82));
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  identity(ctx, w, h);
  details(ctx, c, w, h);
  ctx.restore();
}

export function createPosterCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  return canvas;
}

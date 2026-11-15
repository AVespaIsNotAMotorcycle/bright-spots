// Shareable trip card: one 1080 x 1350 PNG drawn on a canvas (photo, park, month, score, reasons).
import { photoOf } from "../../detective/photos";
import { MONTHS_LONG, reasonText, seasonOf, type TripPark, type Unit } from "./tripModel";

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

export async function drawTripCard(p: TripPark, unit: Unit, changed: string | null): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const season = seasonOf(p.best_month);
  ctx.fillStyle = "#f5efe2";
  ctx.fillRect(0, 0, W, H);
  const photo = photoOf(p.park.code);
  const img = photo ? await loadImage(photo.file) : null;
  if (img) cover(ctx, img, 0, 0, W, 760);
  else {
    ctx.fillStyle = season.color;
    ctx.fillRect(0, 0, W, 760);
  }
  const g = ctx.createLinearGradient(0, 380, 0, 760);
  g.addColorStop(0, "rgba(20,28,22,0)");
  g.addColorStop(1, "rgba(20,28,22,.8)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 380, W, 380);

  ctx.fillStyle = "#fff";
  ctx.font = "800 30px Outfit, system-ui, sans-serif";
  ctx.fillText(`${season.emoji}  ${MONTHS_LONG[p.best_month - 1].toUpperCase()} TRIP`, 64, 610);
  ctx.font = "400 84px Gloock, Georgia, serif";
  ctx.fillText(p.park.short, 64, 705, W - 300);

  // Score ring.
  const cx = W - 140, cy = 650, r = 86;
  ctx.lineWidth = 18;
  ctx.strokeStyle = "rgba(255,255,255,.3)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#f3c969";
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (p.score ?? 0)) / 100);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "900 64px Outfit, system-ui, sans-serif";
  ctx.fillText(String(Math.round(p.score ?? 0)), cx, cy + 22);
  ctx.textAlign = "left";

  ctx.fillStyle = "#2d5a27";
  ctx.font = "800 34px Outfit, system-ui, sans-serif";
  ctx.fillText("Why it fits", 64, 840);
  ctx.font = "500 36px Outfit, system-ui, sans-serif";
  const good = p.reasons.filter((x) => x.score != null && x.score >= 0.6).sort((a, b) => b.score! - a.score!).slice(0, 5);
  good.forEach((x, i) => {
    ctx.fillStyle = "#261e14";
    ctx.fillText(`✓  ${reasonText(x, unit)}`, 64, 900 + i * 58);
  });
  if (changed) {
    ctx.fillStyle = "#8b3a1a";
    ctx.font = "600 30px Outfit, system-ui, sans-serif";
    wrap(ctx, `What changed? ${changed}`, 64, 1215, W - 128, 40);
  }
  ctx.fillStyle = "#6b5d49";
  ctx.font = "500 24px Outfit, system-ui, sans-serif";
  ctx.fillText("Canopy · NASA POWER climate data" + (photo ? ` · Photo: ${photo.credit.slice(0, 40)} (${photo.license})` : ""), 64, H - 40, W - 128);
  return new Promise((res) => c.toBlob(res, "image/png"));
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = "";
  for (const word of text.split(" ")) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > max && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
}

/** Share the card (phones) or download it. */
export async function shareTripCard(p: TripPark, unit: Unit, changed: string | null): Promise<void> {
  const blob = await drawTripCard(p, unit, changed);
  if (!blob) return;
  const name = `${p.park.short.replace(/\W+/g, "-").toLowerCase()}-trip.png`;
  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `${p.park.short} trip` }).catch(() => undefined);
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Image de partage 1080×1350 (format portrait Instagram / TikTok / X) + légende prête à poster.
import { colorFor, fmtCap, fmtPct } from '../util.js';

const W = 1080;
const H = 1350;
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", Inter, system-ui, sans-serif';
const MONO = SANS; // chiffres : la police système (tabulaire) suffit

function alpha(color, a) {
  // Accepte #rrggbb ou rgb(r, g, b).
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = color.match(/\d+(\.\d+)?/g) || [0, 0, 0];
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
}

function drawBackground(ctx) {
  ctx.fillStyle = '#1c1c1e';
  ctx.fillRect(0, 0, W, H);
  const blob = (x, y, r, rgb, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(820, 220, 760, '10,132,255', 0.16);
  blob(160, 1180, 700, '191,90,242', 0.1);
  blob(540, 700, 600, '255,255,255', 0.035);
}

function drawViz(ctx, snap, box) {
  const items = snap.domains.length ? snap.domains : snap.nodes;
  const x0 = Math.min(...items.map((d) => d.x - d.r));
  const x1 = Math.max(...items.map((d) => d.x + d.r));
  const y0 = Math.min(...items.map((d) => d.y - d.r));
  const y1 = Math.max(...items.map((d) => d.y + d.r));
  const k = Math.min(box.w / (x1 - x0), box.h / (y1 - y0));
  const tx = (x) => box.x + box.w / 2 + (x - (x0 + x1) / 2) * k;
  const ty = (y) => box.y + box.h / 2 + (y - (y0 + y1) / 2) * k;

  if (snap.core) {
    const cx = tx(snap.core.x), cy = ty(snap.core.y), r = snap.core.r * k;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.3, 'rgba(155,133,255,0.7)');
    g.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2c2c2e';
    ctx.strokeStyle = colorFor(snap.core.index);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(r * 0.55)}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('IA', cx, cy - r * 0.1);
    ctx.fillStyle = colorFor(snap.core.index);
    ctx.font = `600 ${Math.round(r * 0.24)}px ${MONO}`;
    ctx.fillText(fmtPct(snap.core.index), cx, cy + r * 0.45);
  }

  for (const d of snap.domains) {
    const cx = tx(d.x), cy = ty(d.y), r = d.r * k;
    ctx.strokeStyle = alpha(d.color, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([3, 12]);
    ctx.strokeStyle = alpha(d.color, 0.4);
    ctx.beginPath(); ctx.arc(cx, cy, r + 7, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    if (snap.mode === 'pack' && r > 50) {
      ctx.font = `600 ${Math.round(Math.min(18, Math.max(12, r / 12)))}px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1c1c1e';
      const label = d.name.toUpperCase();
      ctx.strokeText(label, cx, cy - r - 10);
      ctx.fillStyle = d.color;
      ctx.fillText(label, cx, cy - r - 10);
    }
  }

  for (const n of snap.nodes) {
    const cx = tx(n.x), cy = ty(n.y), r = n.r * k;
    ctx.fillStyle = alpha(n.color, n.listed ? 0.22 : 0.06);
    ctx.strokeStyle = n.color;
    ctx.lineWidth = r > 20 ? 2.5 : 1.5;
    ctx.setLineDash(n.listed ? [] : [5, 5]);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]);
    if (r > 4) {
      const sh = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.45, 0, cx, cy, r);
      sh.addColorStop(0, 'rgba(255,255,255,0.3)');
      sh.addColorStop(0.45, 'rgba(255,255,255,0.05)');
      sh.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    if (r > 16) {
      const fs = Math.min(34, r * 0.36);
      const label = n.ticker.length > 6 ? n.name.split(' ')[0] : n.ticker;
      ctx.fillStyle = '#f5f5f7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${fs}px ${MONO}`;
      const showPct = r > 30;
      ctx.fillText(label, cx, cy - (showPct ? fs * 0.35 : 0));
      if (showPct) {
        ctx.font = `400 ${fs * 0.66}px ${MONO}`;
        ctx.fillText(n.listed ? fmtPct(n.pct) : fmtCap(n.cap), cx, cy + fs * 0.55);
      }
    }
  }
}

export async function renderShareImage({ snapshot, stats, movers, sourceLabel }) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawBackground(ctx);

  // En-tête
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f5f5f7';
  ctx.font = `700 54px ${SANS}`;
  ctx.fillText('AI Orbit', 60, 110);
  ctx.fillStyle = '#98989f';
  ctx.font = `400 24px ${SANS}`;
  ctx.fillText('Les valeurs qui construisent l’IA', 60, 148);
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date());
  ctx.textAlign = 'right';
  ctx.font = `400 22px ${MONO}`;
  ctx.fillText(date, W - 60, 110);
  ctx.fillStyle = sourceLabel.startsWith('DÉMO') ? '#ff9f0a' : '#30d158';
  ctx.fillText(sourceLabel, W - 60, 148);

  // Statistiques
  const statY = 220;
  const cols = [
    ['Indice IA', fmtPct(stats.index), colorFor(stats.index * 2)],
    ['Capitalisation', fmtCap(stats.cap), '#f5f5f7'],
    ['Hausse / Baisse', `${stats.up} / ${stats.down}`, '#f5f5f7'],
  ];
  cols.forEach(([label, value, color], i) => {
    const x = 60 + i * 330;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#98989f';
    ctx.font = `500 18px ${SANS}`;
    ctx.fillText(label, x, statY);
    ctx.fillStyle = color;
    ctx.font = `600 44px ${MONO}`;
    ctx.fillText(value, x, statY + 52);
  });

  drawViz(ctx, snapshot, { x: 60, y: 320, w: W - 120, h: 700 });

  // Classement
  const boxY = 1060;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(60, boxY, W - 120, 200, 32);
  ctx.fill();
  ctx.stroke();
  const list = (title, rows, x, color) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.font = `600 20px ${SANS}`;
    ctx.fillText(title, x, boxY + 46);
    rows.slice(0, 3).forEach((r, i) => {
      const y = boxY + 92 + i * 40;
      ctx.fillStyle = '#f5f5f7';
      ctx.font = `600 26px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillText(r.ticker, x, y);
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(fmtPct(r.pct), x + 380, y);
    });
  };
  list('▲ Top hausses', movers.gainers, 100, '#30d158');
  list('▼ Top baisses', movers.losers, 580, '#ff453a');

  ctx.textAlign = 'center';
  ctx.fillStyle = '#636366';
  ctx.font = `400 18px ${SANS}`;
  ctx.fillText('Données à titre informatif — pas un conseil en investissement', W / 2, H - 40);

  return canvas;
}

export function buildCaption({ stats, movers, sourceLabel }) {
  const up = movers.gainers.slice(0, 3).map((r) => `$${r.ticker} ${fmtPct(r.pct)}`).join(' · ');
  const down = movers.losers.slice(0, 3).map((r) => `$${r.ticker} ${fmtPct(r.pct)}`).join(' · ');
  const demo = sourceLabel.startsWith('DÉMO') ? '\n⚠️ Données simulées (démo)' : '';
  return `🧠 Indice IA du jour : ${fmtPct(stats.index)} (${stats.up} en hausse / ${stats.down} en baisse)
🚀 Top : ${up}
📉 Flop : ${down}${demo}

#IA #Bourse #NVIDIA #Tech`;
}

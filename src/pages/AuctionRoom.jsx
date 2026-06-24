import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Share2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuctionStore } from '../stores/auctionStore';
import { useAuctionRoom } from '../hooks/useAuctionRoom';
import { useRole } from '../hooks/useRole';
import * as auctionService from '../services/auctionService';
import * as playerService from '../services/playerService';
import { generateAuctionSoldCard } from '../lib/generateShareCard';
import ActivePlayerSpotlight from '../components/auction/ActivePlayerSpotlight';
import PlayerDrawAnimation from '../components/auction/PlayerDrawAnimation';
import BudgetBars from '../components/auction/BudgetBars';
import AuctioneerControls from '../components/auction/AuctioneerControls';
import CaptainControls from '../components/auction/CaptainControls';
import PassIndicator from '../components/auction/PassIndicator';
import HeldQueue from '../components/auction/HeldQueue';
import BottomSheet from '../components/shared/BottomSheet';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import PlayerAvatar from '../components/player/PlayerAvatar';

const SOLD_CARD_STYLES = `
@keyframes sc-confetti-fall {
  0%   { transform: translateY(-10px) rotate(0deg) scale(1); opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateY(110vh) rotate(900deg) scale(0.5); opacity: 0; }
}
@keyframes sc-confetti-sway {
  0%, 100% { margin-left: 0; }
  25%       { margin-left: 30px; }
  75%       { margin-left: -30px; }
}
@keyframes sc-overlay-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sc-card-pop {
  0%   { transform: scale(0.4) translateY(80px); opacity: 0; }
  65%  { transform: scale(1.06) translateY(-6px); opacity: 1; }
  82%  { transform: scale(0.97) translateY(2px); }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
@keyframes sc-sold-stamp {
  0%   { transform: rotate(-8deg) scale(4); opacity: 0; filter: blur(6px); }
  55%  { transform: rotate(-8deg) scale(0.92); opacity: 1; filter: blur(0); }
  70%  { transform: rotate(-8deg) scale(1.04); }
  85%  { transform: rotate(-8deg) scale(0.98); }
  100% { transform: rotate(-8deg) scale(1); opacity: 1; filter: blur(0); }
}
@keyframes sc-price-pop {
  0%   { transform: scale(0) rotate(-12deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(3deg); opacity: 1; }
  80%  { transform: scale(0.95) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes sc-glow {
  0%, 100% { text-shadow: 0 0 20px #f59e0b, 0 0 40px #f59e0b88; }
  50%       { text-shadow: 0 0 40px #fbbf24, 0 0 80px #f59e0baa, 0 0 120px #f59e0b55; }
}
@keyframes sc-shine {
  0%   { left: -100%; }
  100% { left: 200%; }
}
@keyframes sc-ring-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.7); }
  50%       { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
}
.sc-overlay  { animation: sc-overlay-in 0.25s ease both; }
.sc-card     { animation: sc-card-pop 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.05s both; }
.sc-stamp    { animation: sc-sold-stamp 0.7s cubic-bezier(0.22,1,0.36,1) 0.55s both; }
.sc-price    { animation: sc-price-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) 1.0s both; }
.sc-glow     { animation: sc-glow 2s ease-in-out 1.2s infinite; }
.sc-ring     { animation: sc-ring-pulse 1.8s ease-out 0.8s infinite; }
.sc-confetti { animation: sc-confetti-fall var(--dur) linear var(--delay) both,
                           sc-confetti-sway calc(var(--dur) * 0.6) ease-in-out var(--delay) infinite; }
.sc-shine-wrap { position: relative; overflow: hidden; }
.sc-shine-wrap::after {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 60%; height: 100%;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%);
  animation: sc-shine 2.2s ease-in-out 1.3s infinite;
}
`;

const CONFETTI_COLORS = ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899','#f97316','#06b6d4','#84cc16'];
const CONFETTI_SHAPES = ['rounded-sm', 'rounded-full', ''];

// ── Canvas photo cache ────────────────────────────────────────────────────────
const _canvasImgCache = {};
function loadCanvasImage(url) {
  if (_canvasImgCache[url]) return Promise.resolve(_canvasImgCache[url]);
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { _canvasImgCache[url] = img; res(img); };
    img.onerror = rej;
    img.src = url;
  });
}

function drawRRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function springOut(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.cos(t * Math.PI * 2.4) * Math.pow(1 - t, 2.2);
}
function easeOut3(t) { return 1 - Math.pow(1 - Math.min(1, t), 3); }

// ── Canvas → GIF encoder ──────────────────────────────────────────────────────
// Renders a 3s animated sold card frame-by-frame and encodes as animated GIF.
// Runs synchronously (no rAF) so it works in all browsers including iOS Safari.
async function generateSoldCardGif(data, onProgress) {
  const { GIFEncoder, quantize, applyPalette, prequantize } = await import('gifenc');

  // Render at 540×960 (high-DPI mobile resolution) using a logical 360×640 drawing space.
  // All coordinates below are in logical pixels; ctx.scale(S,S) maps them to physical pixels.
  const W = 540, H = 960, S = 1.5;   // physical GIF dimensions
  const LW = W / S, LH = H / S;      // logical drawing space (360×640)
  const FPS = 15, DURATION = 3.0;
  const TOTAL_FRAMES = Math.round(FPS * DURATION);
  const DELAY = Math.round(1000 / FPS);

  let photo = null;
  if (data.player?.photo_url) {
    try { photo = await loadCanvasImage(data.player.photo_url); } catch {}
  }

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // Confetti particles in logical coords — seeded for deterministic frames
  const particles = Array.from({ length: 60 }, (_, i) => ({
    x: (i * 137.5) % LW,
    y: -40 - (i * 83) % 300,
    vx: ((i % 5) - 2) * 1.2,
    vy: 2.5 + (i % 4) * 0.8,
    rot: (i * 0.7) % (Math.PI * 2),
    vr: ((i % 3) - 1) * 0.1,
    w: 6 + (i % 8),
    h: 4 + (i % 7),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    circle: i % 3 === 1,
  }));

  const gif = GIFEncoder();
  // All layout values in logical (360×640) pixels
  const CX = 20, CW = LW - 40, CH = Math.round(LH * 0.84), CY = Math.round((LH - CH) / 2);

  for (let fi = 0; fi < TOTAL_FRAMES; fi++) {
    const t = fi / FPS;
    onProgress?.(fi / TOTAL_FRAMES);

    ctx.save();
    ctx.scale(S, S); // all drawing in 360×640 logical space

    // ── Background ──────────────────────────────────────────
    // Solid flat colours instead of gradients — GIF's 256-colour palette handles
    // flat fills perfectly; gradients cause visible dithering bands.
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, LW, LH);

    // ── Card bg ─────────────────────────────────────────────
    ctx.fillStyle = '#1e1b4b'; drawRRect(ctx, CX, CY, CW, CH, 22); ctx.fill();
    // Subtle inner highlight strip (flat, no gradient)
    ctx.fillStyle = '#1e293b';
    drawRRect(ctx, CX + 1, CY + 1, CW - 2, Math.round(CH * 0.5), 21); ctx.fill();

    // Rainbow top bar (5 solid segments, no gradient)
    const barColors = ['#10b981','#f59e0b','#ef4444','#8b5cf6','#10b981'];
    const segW = CW / barColors.length;
    barColors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(CX + i * segW, CY, segW + 1, 6);
    });

    // ── Avatar ──────────────────────────────────────────────
    const AX = LW / 2, AY = CY + 96, AR = 46;
    const ringT = easeOut3(Math.min(1, t / 0.6));
    // Pulsing glow ring (flat green)
    ctx.beginPath(); ctx.arc(AX, AY, AR + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(16,185,129,${(ringT * (0.7 + Math.sin(t * 3) * 0.3)).toFixed(2)})`;
    ctx.lineWidth = 4; ctx.stroke();
    // Solid gradient-ring replaced with two-tone stroke
    ctx.beginPath(); ctx.arc(AX, AY, AR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.stroke();
    // Photo / initials
    ctx.save(); ctx.beginPath(); ctx.arc(AX, AY, AR, 0, Math.PI * 2); ctx.clip();
    if (photo) {
      ctx.drawImage(photo, AX - AR, AY - AR, AR * 2, AR * 2);
    } else {
      ctx.fillStyle = '#1e293b'; ctx.fillRect(AX - AR, AY - AR, AR * 2, AR * 2);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 26px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((data.player?.name ?? '').split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase(), AX, AY);
    }
    ctx.restore();

    // ── SOLD stamp ──────────────────────────────────────────
    const stampT = Math.min(1, Math.max(0, (t - 0.4) / 0.4));
    if (stampT > 0) {
      const sc = springOut(stampT);
      const SX = CX + CW - 18, SY = CY + 42;
      ctx.save();
      ctx.translate(SX, SY); ctx.rotate(-8 * Math.PI / 180); ctx.scale(sc, sc);
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4;
      ctx.strokeRect(-58, -21, 116, 42);
      ctx.fillStyle = '#ef4444'; ctx.font = '900 34px Impact, Arial Black, Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('SOLD', 0, 2);
      ctx.restore();
    }

    // ── Name + role ─────────────────────────────────────────
    const nameAlpha = easeOut3(Math.min(1, t / 0.4));
    ctx.globalAlpha = nameAlpha;
    const nameY = AY + AR + 28;
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(data.player?.name ?? '—', LW / 2, nameY);
    ctx.fillStyle = '#34d399'; ctx.font = '600 12px Arial';
    ctx.fillText((data.player?.role ?? '').toUpperCase(), LW / 2, nameY + 24);
    ctx.globalAlpha = 1;

    // Divider
    const divY = nameY + 44;
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(CX + 20, divY, CW - 40, 1);

    // ── Bought by ───────────────────────────────────────────
    const buyAlpha = easeOut3(Math.min(1, Math.max(0, (t - 0.35) / 0.35)));
    ctx.globalAlpha = buyAlpha;
    const buyY = divY + 16;
    ctx.fillStyle = '#0d2e22'; drawRRect(ctx, CX + 10, buyY, CW - 20, 58, 10); ctx.fill();
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1; drawRRect(ctx, CX + 10, buyY, CW - 20, 58, 10); ctx.stroke();
    ctx.fillStyle = '#34d399'; ctx.font = '700 10px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BOUGHT BY', LW / 2, buyY + 17);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 17px Arial';
    ctx.fillText(data.teamName ?? '—', LW / 2, buyY + 40);
    ctx.globalAlpha = 1;

    // ── Price ───────────────────────────────────────────────
    const priceT = Math.min(1, Math.max(0, (t - 0.75) / 0.4));
    const priceSc = springOut(priceT);
    const priceY = buyY + 70;
    ctx.save();
    ctx.translate(LW / 2, priceY + 42); ctx.scale(priceSc, priceSc); ctx.translate(-LW / 2, -(priceY + 42));
    ctx.globalAlpha = Math.min(1, priceT * 3);
    ctx.fillStyle = '#2d1f00'; drawRRect(ctx, CX + 10, priceY, CW - 20, 86, 10); ctx.fill();
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1; drawRRect(ctx, CX + 10, priceY, CW - 20, 86, 10); ctx.stroke();
    ctx.fillStyle = '#fbbf24'; ctx.font = '700 10px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FINAL PRICE', LW / 2, priceY + 18);
    ctx.font = 'bold 34px Arial Narrow, Arial'; ctx.fillStyle = '#fbbf24';
    ctx.fillText(`₹${(data.soldPrice ?? 0).toLocaleString('en-IN')}`, LW / 2, priceY + 54);
    if ((data.soldPrice ?? 0) > (data.basePrice ?? 0)) {
      ctx.font = '500 10px Arial'; ctx.fillStyle = '#d97706';
      const pct = Math.round(((data.soldPrice - data.basePrice) / data.basePrice) * 100);
      ctx.fillText(`Base ₹${(data.basePrice).toLocaleString('en-IN')} · +${pct}%`, LW / 2, priceY + 74);
    }
    ctx.restore(); ctx.globalAlpha = 1;

    // ── Confetti ────────────────────────────────────────────
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      if (p.y > LH + 20) { p.y = -20; p.x = (p.x + 73) % LW; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.min(1, (p.y + 40) / 60) * 0.9;
      if (p.circle) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      ctx.restore(); ctx.globalAlpha = 1;
    }

    ctx.restore(); // restore scale

    // ── Encode frame ────────────────────────────────────────
    const frame = ctx.getImageData(0, 0, W, H);
    prequantize(frame.data, { roundRobin: true, oneBitAlpha: false });
    const palette = quantize(frame.data, 256, { format: 'rgb444', oneBitAlpha: false });
    const indexed = applyPalette(frame.data, palette, 'rgb444');
    gif.writeFrame(indexed, W, H, { palette, delay: DELAY, repeat: 0 });
  }

  onProgress?.(1);
  gif.finish();
  return new Blob([gif.bytesView()], { type: 'image/gif' });
}

async function shareExport(url, mimeType, playerName) {
  const res = await fetch(url);
  const blob = await res.blob();
  const ext = mimeType === 'image/gif' ? 'gif' : 'png';
  const file = new File([blob], `${playerName ?? 'player'}-sold.${ext}`, { type: mimeType });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `${playerName} — Sold!` }); return; } catch {}
  }
  const a = document.createElement('a');
  a.href = url; a.download = file.name; a.click();
  toast.success(ext === 'gif' ? 'GIF downloaded' : 'Card downloaded');
}

function SoldCardModal({ data, exportUrl, exportMimeType, recording, recordingProgress, onClose, onGenerateGif }) {
  const particles = useMemo(() =>
    Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
      dur: (2.2 + Math.random() * 2.5).toFixed(2),
      delay: (Math.random() * 1.8).toFixed(2),
      w: Math.floor(6 + Math.random() * 9),
      h: Math.floor(4 + Math.random() * 10),
    })), []);

  if (!data) return null;

  const isGif = exportMimeType === 'image/gif';
  const shareLabel = recording ? 'Preparing…' : isGif ? 'Share GIF' : 'Share Card';
  const pct = Math.round((recordingProgress ?? 0) * 100);

  return createPortal(
    <>
      <style>{SOLD_CARD_STYLES}</style>
      <div
        className="sc-overlay fixed inset-0 z-[200] flex items-center justify-center px-5"
        style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        {/* Confetti rain */}
        {particles.map(p => (
          <div
            key={p.id}
            className={`sc-confetti fixed top-0 pointer-events-none ${p.shape}`}
            style={{
              left: `${p.left}%`,
              width: p.w,
              height: p.h,
              background: p.color,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
              zIndex: 201,
            }}
          />
        ))}

        {/* Main card */}
        <div
          className="sc-card relative w-full max-w-sm rounded-3xl overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', zIndex: 202 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Top glow bar */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444, #8b5cf6, #10b981)' }} />

          {/* SOLD stamp */}
          <div className="sc-stamp absolute top-6 right-5 pointer-events-none" style={{ zIndex: 10 }}>
            <div
              className="sc-glow px-4 py-1 rounded border-4 border-red-500"
              style={{
                fontFamily: 'Impact, Arial Black, sans-serif',
                fontSize: 44, fontWeight: 900, color: '#ef4444',
                letterSpacing: 4, lineHeight: 1,
                textShadow: '0 0 20px #ef444488',
                background: 'rgba(239,68,68,0.08)',
              }}
            >
              SOLD
            </div>
          </div>

          {/* Player identity */}
          <div className="flex flex-col items-center pt-8 pb-4 px-6">
            <div className="sc-ring rounded-full mb-3" style={{ padding: 3, background: 'linear-gradient(135deg, #10b981, #f59e0b)' }}>
              <div className="rounded-full overflow-hidden" style={{ width: 96, height: 96 }}>
                <PlayerAvatar name={data.player?.name} photoUrl={data.player?.photo_url} size={96} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 mt-1">
              <p className="text-white font-black text-xl text-center leading-tight">{data.player?.name}</p>
              {data.isCaptain && (
                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 tracking-widest uppercase">⭐ Captain</span>
              )}
            </div>
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mt-0.5 capitalize">{data.player?.role}</p>
          </div>

          {/* Divider */}
          <div className="mx-6 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }} />

          {/* Team + price */}
          <div className="px-6 py-4 flex flex-col items-center gap-3">
            <div className="w-full rounded-2xl px-4 py-3 text-center sc-shine-wrap" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-0.5">Bought by</p>
              <p className="text-white font-black text-lg leading-tight">{data.teamName}</p>
            </div>
            <div className="sc-price w-full rounded-2xl px-4 py-3 text-center" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(239,68,68,0.15))', border: '1px solid rgba(245,158,11,0.4)' }}>
              <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-0.5">Final Price</p>
              <p className="font-black tabular-nums" style={{ fontSize: 32, color: '#fbbf24', textShadow: '0 0 20px rgba(245,158,11,0.6)' }}>
                ₹{data.soldPrice?.toLocaleString()}
              </p>
              {data.soldPrice > data.basePrice && (
                <p className="text-[11px] text-amber-400/70 mt-0.5">
                  Base ₹{data.basePrice?.toLocaleString()} · {Math.round((data.soldPrice / data.basePrice - 1) * 100)}% above base
                </p>
              )}
            </div>
          </div>

          {/* Recording progress bar — shown while video is being captured */}
          {recording && (
            <div className="px-6 pb-4">
              <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-white/50 font-semibold">Generating animated GIF…</p>
                  <p className="text-[11px] text-emerald-400 font-bold tabular-nums">{pct}%</p>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #f59e0b)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={() => {
                if (exportUrl) shareExport(exportUrl, exportMimeType ?? 'image/png', data.player?.name);
                else if (!recording) onGenerateGif?.();
              }}
              disabled={recording}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
            >
              <Share2 size={16} />
              {recording ? `Generating… ${pct}%` : exportUrl ? shareLabel : 'Share GIF'}
            </button>
            {exportUrl && (
              <a
                href={exportUrl}
                download={`${data.player?.name ?? 'player'}-sold.${isGif ? 'gif' : 'png'}`}
                className="p-3 flex items-center justify-center rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <Download size={18} className="text-white/70" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-3 flex items-center justify-center rounded-2xl text-white/60 text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function BidLogStrip({ bids, teams }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 120, behavior: 'smooth' });
  };

  return (
    <div className="card px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Bid History</p>
        {bids?.length > 0 && (
          <div className="flex gap-1">
            <button onClick={() => scroll(-1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-300 active:scale-90 transition-transform">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => scroll(1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-300 active:scale-90 transition-transform">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-2 min-h-[52px] items-center"
        style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {bids?.length > 0 ? bids.map((bid, i) => {
          const teamName = bid.auction_team?.name
            ?? teams?.find(t => t.id === bid.auction_team_id)?.name
            ?? '—';
          const isLatest = i === 0;
          return (
            <div key={bid.id ?? i} className={`shrink-0 flex flex-col items-center rounded-xl px-3 py-2 gap-0.5 min-w-[80px] ${isLatest ? 'bg-brand-green/10 ring-1 ring-brand-green/30' : 'bg-ink-50 dark:bg-white/5'}`}>
              <span className={`text-xs font-extrabold tabular-nums ${isLatest ? 'text-brand-green' : 'text-ink-600 dark:text-ink-300'}`}>
                ₹{bid.amount?.toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-ink-600 dark:text-ink-300 whitespace-nowrap truncate max-w-[90px]">{teamName}</span>
            </div>
          );
        }) : (
          <p className="text-[11px] text-ink-300 dark:text-ink-600">No bids yet</p>
        )}
      </div>
    </div>
  );
}

export default function AuctionRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, userId } = useRole();
  const [actionLoading, setActionLoading] = useState(false);
  const [heldSheetOpen, setHeldSheetOpen] = useState(false);
  const [poolSheetOpen, setPoolSheetOpen] = useState(false);
  const [soldSheetOpen, setSoldSheetOpen] = useState(false);
  const [topDealsSheetOpen, setTopDealsSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [activeCareerStats, setActiveCareerStats] = useState(null);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const [soldCardData, setSoldCardData] = useState(null);   // { player, teamName, basePrice, soldPrice }
  const soldCardDataRef = useRef(null); // mirror for use inside async callbacks
  const soldCardGenRef = useRef(0); // incremented per openSoldCard call; stale GIF results are ignored
  const [exportUrl, setExportUrl] = useState(null);
  const [exportMimeType, setExportMimeType] = useState(null);
  const [recordingCard, setRecordingCard] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  function openSoldCard(ap) {
    const soldTeam = teams.find(t => t.id === ap.sold_to_team_id);
    const isCaptain = !!(soldTeam?.captain_id && ap.player?.user_id && soldTeam.captain_id === ap.player.user_id);
    const data = {
      player: ap.player,
      teamName: soldTeam?.name ?? '—',
      basePrice: ap.base_price,
      soldPrice: ap.sold_price ?? ap.base_price,
      isCaptain,
    };

    // Stamp this generation — any previous in-flight GIF that finishes later will be ignored
    const genId = ++soldCardGenRef.current;

    setSoldCardData(data);
    soldCardDataRef.current = data;
    setExportUrl(null);
    setExportMimeType(null);
    setRecordingCard(false);
    setRecordingProgress(0);
  }

  function startGifGeneration() {
    const data = soldCardDataRef.current;
    if (!data || recordingCard) return;
    const genId = soldCardGenRef.current;
    setRecordingCard(true);
    setRecordingProgress(0);

    generateSoldCardGif(data, p => {
      if (soldCardGenRef.current === genId) setRecordingProgress(p);
    })
      .then(blob => {
        if (soldCardGenRef.current !== genId) return;
        setExportUrl(URL.createObjectURL(blob));
        setExportMimeType('image/gif');
        setRecordingCard(false);
      })
      .catch((err) => {
        if (soldCardGenRef.current !== genId) return;
        console.error('[SoldCard] GIF generation failed, falling back to PNG:', err);
        generateAuctionSoldCard({ ...data, auctionName: auction?.name })
          .then(blob => {
            if (soldCardGenRef.current !== genId) return;
            setExportUrl(URL.createObjectURL(blob));
            setExportMimeType('image/png');
          })
          .catch(() => {})
          .finally(() => { if (soldCardGenRef.current === genId) setRecordingCard(false); });
      });
  }

  const { isRealtimeLive } = useAuctionRoom(id, userId);

  const {
    auction, teams, players, bids, isLoading, error, reset,
    _patchPlayer, _appendBid, loadAuction,
    viewerDraw, soldFlash, viewerCount,
    _startViewerDraw, _clearViewerDraw, _clearSoldFlash,
  } = useAuctionStore();

  // Clear stale auction data when leaving the room
  useEffect(() => () => reset(), []);


  const activePlayer = players.find(p => p.status === 'active') ?? null;
  const poolPlayers  = players.filter(p => p.status === 'pool');
  const heldPlayers  = players.filter(p => p.status === 'held').sort((a, b) => new Date(a.held_at) - new Date(b.held_at));
  const soldPlayers  = players.filter(p => p.status === 'sold');

  // Auto-dismiss SOLD! overlay after 4 seconds
  useEffect(() => {
    if (!soldFlash) return;
    const t = setTimeout(_clearSoldFlash, 4000);
    return () => clearTimeout(t);
  }, [soldFlash]);

  // Fetch career stats whenever a new player becomes active
  useEffect(() => {
    if (!activePlayer?.player_id) { setActiveCareerStats(null); return; }
    playerService.getCareerStats(activePlayer.player_id)
      .then(setActiveCareerStats)
      .catch(() => setActiveCareerStats(null));
  }, [activePlayer?.player_id]);

  // Compute max allowable bid per team (purse minus reserve for remaining squad slots)
  const [teamMaxBids, setTeamMaxBids] = useState({});
  useEffect(() => {
    if (!activePlayer || !teams.length) { setTeamMaxBids({}); return; }
    Promise.all(
      teams.map(t =>
        auctionService.computeMinReserve(id, t.id, activePlayer.id)
          .then(reserve => ({ id: t.id, maxBid: (t.budget_remaining ?? 0) - reserve }))
          .catch(() => ({ id: t.id, maxBid: t.budget_remaining ?? 0 }))
      )
    ).then(results => {
      const map = {};
      results.forEach(r => { map[r.id] = r.maxBid; });
      setTeamMaxBids(map);
    });
  }, [activePlayer?.id, teams.map(t => t.budget_remaining).join(',')]);

  // Determine role in this auction
  const myAuctionTeam = teams.find(t => t.captain_id === userId);
  const isAuctioneer = isAdmin;
  const isCaptain = !!myAuctionTeam && !isAdmin;

  // Pass state for captain's own team
  const myPassColumn = useMemo(() => {
    if (!myAuctionTeam || !activePlayer) return null;
    const idx = teams.findIndex(t => t.id === myAuctionTeam.id);
    return idx === 0 ? 'pass_team1' : 'pass_team2';
  }, [myAuctionTeam, teams, activePlayer]);

  const hasPassed = activePlayer && myPassColumn ? !!activePlayer[myPassColumn] : false;
  const bothPassing = !!(activePlayer?.pass_team1 && activePlayer?.pass_team2);
  const leadingTeam = activePlayer?.leading_team_id ? teams.find(t => t.id === activePlayer.leading_team_id) : null;
  const teamNames = teams.map(t => t.name ?? '—');

  // Sold players grouped by team
  const soldByTeam = useMemo(() => {
    const map = {};
    for (const ap of soldPlayers) {
      const tid = ap.sold_to_team_id ?? 'unknown';
      if (!map[tid]) map[tid] = [];
      map[tid].push(ap);
    }
    return map;
  }, [soldPlayers]);

  // Refresh bids for active player
  async function refreshBids(playerRowId) {
    try {
      const fresh = await auctionService.getBidsForPlayer(playerRowId);
      // Replace bids in store
      useAuctionStore.setState({ bids: fresh });
    } catch {}
  }

  // ── Auctioneer handlers ────────────────────────────────────────────────────

  async function handleNextPlayer() {
    if (actionLoading || activePlayer) return;
    setActionLoading(true);
    try {
      // Snapshot pool before draw so animation has players to cycle through
      const poolSnapshot = players.filter(p => p.status === 'pool');
      const drawn = await auctionService.drawNextPlayer(id);
      if (drawn) {
        // Optimistically start animation — realtime will also fire but _patchPlayer skips if already set
        const winner = { ...drawn, player: drawn.player ?? poolSnapshot.find(p => p.id === drawn.id)?.player };
        _startViewerDraw(poolSnapshot, winner);
        _patchPlayer(drawn);
        useAuctionStore.setState({ bids: [] });
      } else {
        toast('Auction complete!', { icon: '🏆' });
        loadAuction(id);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  // teamId now passed from AuctioneerControls team selector
  async function handleRaise(amount, teamId) {
    if (!activePlayer) return;
    const targetTeamId = teamId || activePlayer.leading_team_id || teams[0]?.id;
    if (!targetTeamId) return;

    // Budget + reserve guard
    const team = teams.find(t => t.id === targetTeamId);
    const teamMax = teamMaxBids[targetTeamId] ?? team?.budget_remaining ?? Infinity;
    if (team && amount > team.budget_remaining) {
      toast.error(`Exceeds ${team.name} purse (₹${team.budget_remaining?.toLocaleString()})`);
      return;
    }
    if (amount > teamMax) {
      toast.error(`Max bid for ${team?.name} is ₹${teamMax.toLocaleString()} — reserve needed for remaining squad slots`);
      return;
    }

    setActionLoading(true);
    try {
      const updated = await auctionService.raiseAuctioneerBid(activePlayer.id, targetTeamId, amount);
      _patchPlayer(updated);
      await refreshBids(activePlayer.id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeal() {
    if (!activePlayer) return;
    setActionLoading(true);
    try {
      await auctionService.dealPlayer(activePlayer.id);
      // Capture sold details before clearing activePlayer
      const soldTeam = teams.find(t => t.id === activePlayer.leading_team_id);
      const data = {
        player: activePlayer.player,
        teamName: soldTeam?.name ?? '—',
        basePrice: activePlayer.base_price,
        soldPrice: activePlayer.current_bid ?? activePlayer.base_price,
      };
      openSoldCard({ player: data.player, sold_to_team_id: activePlayer.leading_team_id, base_price: data.basePrice, sold_price: data.soldPrice });
      loadAuction(id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReturnToPool(auctionPlayerId) {
    setActionLoading(true);
    try {
      const updated = await auctionService.returnToPool(auctionPlayerId);
      _patchPlayer(updated);
      toast.success('Player returned to pool');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleHold() {
    if (!activePlayer) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.holdPlayer(activePlayer.id);
      _patchPlayer(updated);
      useAuctionStore.setState({ bids: [] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUndoBid() {
    if (!activePlayer || actionLoading) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.undoLastBid(activePlayer.id);
      _patchPlayer(updated);
      await refreshBids(activePlayer.id);
      toast('Last bid undone', { icon: '↩' });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnsold() {
    if (!activePlayer) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.markUnsold(activePlayer.id);
      _patchPlayer(updated);
      useAuctionStore.setState({ bids: [] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    try {
      const updated = await auctionService.updateAuctionStatus(id, 'paused');
      useAuctionStore.getState()._onAuctionUpdate(updated);
    } catch (e) { toast.error(e.message); }
  }

  async function handleResume() {
    try {
      const updated = await auctionService.updateAuctionStatus(id, 'live');
      useAuctionStore.getState()._onAuctionUpdate(updated);
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await auctionService.deleteAuction(id);
      navigate('/auctions', { replace: true });
    } catch (e) {
      toast.error(e.message);
      setDeleting(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      const updated = await auctionService.updateAuctionStatus(id, 'completed');
      useAuctionStore.getState()._onAuctionUpdate(updated);
      try {
        await auctionService.createTeamsFromAuction(id);
      } catch (teamErr) {
        // Non-fatal — auction is completed; teams can be synced manually via /teams
        toast.error('Auction completed, but team roster sync failed: ' + teamErr.message);
      }
      navigate(`/auctions/${id}/summary`, { replace: true });
    } catch (e) {
      toast.error(e.message);
      setCompleting(false);
    }
  }

  // ── Captain handlers ───────────────────────────────────────────────────────

  async function handleBid(amount) {
    if (!activePlayer || !myAuctionTeam) return;

    // Budget + reserve guard
    const myMaxBid = teamMaxBids[myAuctionTeam.id] ?? (myAuctionTeam.budget_remaining ?? 0);
    if (amount > (myAuctionTeam.budget_remaining ?? 0)) {
      toast.error('Bid exceeds your remaining purse');
      return;
    }
    if (amount > myMaxBid) {
      toast.error(`Max bid is ₹${myMaxBid.toLocaleString()} — need to keep purse for remaining squad slots`);
      return;
    }

    setActionLoading(true);
    try {
      const updated = await auctionService.placeBid(activePlayer.id, myAuctionTeam.id, amount);
      _patchPlayer(updated);
      await refreshBids(activePlayer.id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePass() {
    if (!activePlayer || !myPassColumn) return;
    setActionLoading(true);
    try {
      const updated = await auctionService.signalPass(activePlayer.id, myPassColumn);
      _patchPlayer(updated);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div className="p-4"><p className="text-center py-12 text-ink-400">Loading…</p></div>;
  }

  if (error || !auction) {
    const isMigrationMissing = error?.includes('relation') || error?.includes('does not exist');
    const isNotFound = !auction || error?.includes('rows returned') || error?.includes('PGRST116') || error?.includes('no rows');
    const headline = isMigrationMissing
      ? 'Setup required'
      : isNotFound
        ? 'Auction not found'
        : 'Unable to load auction';
    const detail = isMigrationMissing
      ? 'Run migration 030_auctions.sql in Supabase SQL Editor first.'
      : isNotFound
        ? 'This auction may have been deleted or moved.'
        : "Check your connection and try again.";
    return (
      <div className="p-4 space-y-4 page-transition">
        <button onClick={() => navigate('/auctions')} className="flex items-center gap-2 text-sm text-ink-500">
          <ArrowLeft size={16} /> Back to Auctions
        </button>
        <div className="card p-6 text-center space-y-2">
          <p className="text-2xl">{isMigrationMissing ? '🛠️' : isNotFound ? '🗑️' : '⚠️'}</p>
          <p className="font-semibold text-ink-700 dark:text-ink-200">{headline}</p>
          <p className="text-xs text-ink-400">{detail}</p>
        </div>
      </div>
    );
  }

  // Completed auctions are read-only — redirect to summary page
  if (auction.status === 'completed') {
    navigate(`/auctions/${id}/summary`, { replace: true });
    return null;
  }

  // ── Shared pieces ──────────────────────────────────────────────────────────

  const header = (
    <div className="flex items-center gap-3 px-4 pt-safe pt-3 pb-2">
      <button onClick={() => navigate('/auctions')} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10 shrink-0">
        <ArrowLeft size={18} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink-900 dark:text-white truncate text-sm">{auction.name}</p>
      </div>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${auction.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-ink-100 text-ink-400'}`}>
        {auction.status.toUpperCase()}
      </span>
      {viewerCount > 1 && (
        <span className="text-[11px] text-ink-400 shrink-0">👁 {viewerCount}</span>
      )}
      {/* Realtime connection indicator */}
      <span className={`flex items-center gap-1 text-[10px] font-semibold shrink-0 ${isRealtimeLive ? 'text-green-500' : 'text-amber-500'}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${isRealtimeLive ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
        {isRealtimeLive ? 'Live' : 'Sync…'}
      </span>
      {isAdmin && (
        <button onClick={() => setDeleteConfirmOpen(true)} className="p-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 shrink-0">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  // Complete Auction button — shown to admin when nothing left to sell
  const canComplete = isAdmin
    && auction.status === 'live'
    && poolPlayers.length === 0
    && heldPlayers.length === 0
    && !activePlayer;

  // captain_id on auction_teams is a user_id — match against player.user_id to identify captains
  const captainUserIds = new Set(teams.map(t => t.captain_id).filter(Boolean));
  const isCaptainPlayer = (ap) => !!(ap.player?.user_id && captainUserIds.has(ap.player.user_id));

  // Highest Bid: exclude captain auto-sells (they're pre-assigned at base price, not bid on)
  const biddedSoldPlayers = soldPlayers.filter(ap => !isCaptainPlayer(ap));
  const topSoldPlayer = biddedSoldPlayers.length > 0
    ? biddedSoldPlayers.reduce((best, ap) => (ap.sold_price ?? 0) > (best.sold_price ?? 0) ? ap : best)
    : null;

  const counterRow = (
    <div className="flex gap-2 px-4">
      {[
        { label: 'Pool', count: poolPlayers.length, onClick: () => setPoolSheetOpen(true) },
        { label: 'Held', count: heldPlayers.length, onClick: () => setHeldSheetOpen(true) },
        { label: 'Sold', count: soldPlayers.length, onClick: () => setSoldSheetOpen(true) },
      ].map(({ label, count, onClick }) => (
        <button key={label} onClick={onClick}
          className="flex-1 card py-2 flex flex-col items-center gap-0.5 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
          <span className="text-base font-extrabold text-ink-900 dark:text-white tabular-nums">{count}</span>
          <span className="text-[10px] text-ink-400 uppercase tracking-wider font-semibold">{label}</span>
        </button>
      ))}
      <button onClick={() => setTopDealsSheetOpen(true)}
        className="flex-1 card py-2 flex flex-col items-center gap-0.5 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors">
        <span className="text-base">🏆</span>
        <span className="text-[10px] text-amber-500 uppercase tracking-wider font-semibold">Deals</span>
      </button>
    </div>
  );

  const topDealsSheet = (
    <BottomSheet open={topDealsSheetOpen} onClose={() => setTopDealsSheetOpen(false)} title="Top Deals">
      {soldPlayers.length === 0 ? (
        <p className="text-sm text-ink-400 text-center py-6">No players sold yet</p>
      ) : (
        <div className="space-y-4">
          {/* Highest bid hero card */}
          {topSoldPlayer && (() => {
            const heroTeam = teams.find(t => t.id === topSoldPlayer.sold_to_team_id);
            return (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)' }}>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">👑 Highest Bid</p>
                </div>
                <div className="flex items-center gap-3 px-4 pb-4">
                  <PlayerAvatar player={topSoldPlayer.player} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-extrabold text-base leading-tight truncate">{topSoldPlayer.player?.name}</p>
                    <p className="text-amber-300 text-[11px] capitalize">{topSoldPlayer.player?.role}</p>
                    {heroTeam && <p className="text-amber-200 text-[11px] mt-0.5 truncate">→ {heroTeam.name}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-amber-300 text-[10px] font-semibold">SOLD FOR</p>
                    <p className="text-white font-extrabold text-xl tabular-nums">₹{topSoldPlayer.sold_price?.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Per-team top 5 */}
          {teams.map(t => {
            const teamSold = (soldByTeam[t.id] ?? [])
              .slice()
              .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))
              .slice(0, 5);
            if (teamSold.length === 0) return null;
            return (
              <div key={t.id}>
                <p className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">{t.name}</p>
                <div className="space-y-1.5">
                  {teamSold.map((ap, i) => {
                    const isCapt = isCaptainPlayer(ap);
                    return (
                      <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-ink-50 dark:bg-white/5">
                        <span className="w-5 text-center text-xs font-bold tabular-nums text-ink-400">#{i + 1}</span>
                        <PlayerAvatar player={ap.player} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                            {isCapt && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">(C)</span>}
                          </div>
                          <p className="text-[11px] text-ink-400 capitalize">{ap.player?.role}</p>
                        </div>
                        <span className="text-sm font-bold text-brand-green tabular-nums shrink-0">₹{ap.sold_price?.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );

  // ── AUCTIONEER layout: compact no-scroll design ─────────────────────────────
  if (isAuctioneer) {
    const p = activePlayer?.player;
    const hasBid = activePlayer?.current_bid != null;
    const bidAmount = activePlayer?.current_bid ?? activePlayer?.base_price;

    return (
      <div className="p-4 pb-24 space-y-3 page-transition">
        {/* Header */}
        {header}

        {/* Budget bars */}
        <BudgetBars teams={teams} budgetPerTeam={auction.budget_per_team} />

        {/* Draw animation — shown while next player is being selected */}
        {viewerDraw && (
          <PlayerDrawAnimation
            poolPlayers={viewerDraw.pool}
            winner={viewerDraw.winner}
            onComplete={_clearViewerDraw}
          />
        )}

        {/* Compact player banner — tap to open full card in sheet */}
        {!viewerDraw && activePlayer ? (
          <button
            onClick={() => setPlayerSheetOpen(true)}
            className="w-full card px-3 py-3 flex items-center gap-3 text-left"
          >
            <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 56, height: 68 }}>
              {p?.photo_url ? (
                <img src={p.photo_url} alt={p?.name} className="w-full h-full object-cover object-top" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center text-white font-extrabold text-sm">
                  {(p?.name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-ink-900 dark:text-white text-base leading-tight truncate">{p?.name ?? '—'}</p>
              <p className="text-xs text-ink-400 capitalize mt-0.5">{p?.role ?? ''}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-ink-400 uppercase tracking-wider">Base</span>
                <span className="text-sm font-semibold text-ink-400 tabular-nums">₹{activePlayer.base_price?.toLocaleString()}</span>
              </div>
              {hasBid && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-ink-400 uppercase tracking-wider">Bid</span>
                  <span className="text-base font-extrabold text-brand-green tabular-nums">₹{activePlayer.current_bid?.toLocaleString()}</span>
                  {leadingTeam && <span className="text-xs text-ink-500">· {leadingTeam.name}</span>}
                </div>
              )}
            </div>
            <span className="shrink-0 text-[10px] text-ink-300 font-semibold leading-tight text-center">Tap<br/>card</span>
          </button>
        ) : !viewerDraw ? (
          <div className="card px-4 py-4 text-center">
            <p className="text-sm text-ink-400">🎲 Tap "Next Player" to begin</p>
          </div>
        ) : null}

        {/* Pass indicator */}
        {activePlayer && <PassIndicator passTeam1={activePlayer.pass_team1} passTeam2={activePlayer.pass_team2} teamNames={teamNames} />}

        {/* Bid log — horizontal scroll strip */}
        <BidLogStrip bids={bids} teams={teams} />

        {/* Auctioneer controls */}
        <AuctioneerControls
          auctionId={id}
          activePlayer={activePlayer}
          bothPassing={bothPassing}
          onNextPlayer={handleNextPlayer}
          onRaise={handleRaise}
          onUndoBid={handleUndoBid}
          onDeal={handleDeal}
          onHold={handleHold}
          onUnsold={handleUnsold}
          onPause={handlePause}
          onResume={handleResume}
          auctionStatus={auction.status}
          bidIncrements={auction.bid_increments ?? [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]}
          teams={teams}
          teamMaxBids={teamMaxBids}
          loading={actionLoading}
        />

        {/* Counter row */}
        {counterRow}

        {/* Complete Auction — shown when nothing left to sell */}
        {canComplete && (
          <button
            onClick={() => setCompleteConfirmOpen(true)}
            className="mx-4 w-[calc(100%-2rem)] py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #065f46, #047857)' }}
          >
            🏁 Complete Auction
          </button>
        )}

        {/* Player full card sheet */}
        <BottomSheet open={playerSheetOpen} onClose={() => setPlayerSheetOpen(false)} title={p?.name ?? 'Player'}>
          <ActivePlayerSpotlight
            player={activePlayer}
            leadingTeam={leadingTeam}
            careerStats={activeCareerStats}
            onViewProfile={activePlayer?.player_id ? () => { setPlayerSheetOpen(false); navigate(`/players/${activePlayer.player_id}`); } : null}
          />
        </BottomSheet>

        {/* Held / Pool / Sold sheets */}
        <BottomSheet open={heldSheetOpen} onClose={() => setHeldSheetOpen(false)} title="Held Queue">
          <HeldQueue heldPlayers={heldPlayers} isAdmin={isAdmin} onReturnToPool={handleReturnToPool} />
        </BottomSheet>
        <BottomSheet open={poolSheetOpen} onClose={() => setPoolSheetOpen(false)} title="Player Pool">
          <div className="space-y-1.5">
            {poolPlayers.length === 0
              ? <p className="text-sm text-ink-400 text-center py-4">Pool is empty</p>
              : poolPlayers.map(ap => (
                <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-ink-50 dark:bg-white/5">
                  <PlayerAvatar player={ap.player} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                    <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">Available</span>
                </div>
              ))
            }
          </div>
        </BottomSheet>
        <BottomSheet open={soldSheetOpen} onClose={() => setSoldSheetOpen(false)} title="Sold Players">
          {soldPlayers.length === 0
            ? <p className="text-sm text-ink-400 text-center py-4">No players sold yet</p>
            : (
              <div className="space-y-4">
                {teams.map(t => {
                  const teamSold = soldByTeam[t.id] ?? [];
                  const spent = teamSold.reduce((s, ap) => s + (ap.sold_price ?? 0), 0);
                  return (
                    <div key={t.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold text-ink-500 uppercase tracking-wider">{t.name}</p>
                        <span className="text-xs tabular-nums text-ink-400">{teamSold.length} players · ₹{spent.toLocaleString()} spent</span>
                      </div>
                      {teamSold.length === 0
                        ? <p className="text-xs text-ink-300 py-1 px-2">None yet</p>
                        : teamSold.map(ap => (
                          <button key={ap.id} onClick={() => { setSoldSheetOpen(false); openSoldCard(ap); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10 mb-1 text-left active:scale-[0.98] transition-transform">
                            <PlayerAvatar player={ap.player} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                                {isCaptainPlayer(ap) && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">(C)</span>}
                              </div>
                              <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green">Sold</span>
                              <span className="text-xs font-bold text-brand-green tabular-nums">₹{ap.sold_price?.toLocaleString()}</span>
                            </div>
                          </button>
                        ))
                      }
                    </div>
                  );
                })}
              </div>
            )
          }
        </BottomSheet>
        {topDealsSheet}
        <ConfirmDialog
          open={completeConfirmOpen}
          title="Complete Auction"
          message="Mark this auction as completed? This will lock the results and everyone will be taken to the summary view."
          confirmLabel="Complete"
          disabled={completing}
          onConfirm={handleComplete}
          onCancel={() => setCompleteConfirmOpen(false)}
        />
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Delete Auction"
          message={`Permanently delete "${auction.name}"? All bids and player data will be lost.`}
          confirmLabel="Delete"
          danger
          disabled={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmOpen(false)}
        />

        {/* Sold card sheet */}
        <SoldCardModal
          data={soldCardData}
          exportUrl={exportUrl}
          exportMimeType={exportMimeType}
          recording={recordingCard}
          recordingProgress={recordingProgress}
          onClose={() => setSoldCardData(null)}
          onGenerateGif={startGifGeneration}
        />

        {/* 🔨 SOLD! overlay */}
        {soldFlash && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
            onClick={_clearSoldFlash}
          >
            <div
              className="mx-6 rounded-3xl overflow-hidden text-center shadow-2xl animate-[draw-land_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
              style={{ background: 'linear-gradient(160deg,#064e3b 0%,#065f46 50%,#047857 100%)', boxShadow: '0 0 60px rgba(16,185,129,0.4)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-8 pt-7 pb-4">
                <p className="text-3xl font-black text-white mb-5">🔨 SOLD!</p>
                <div className="rounded-full overflow-hidden w-24 h-24 mx-auto ring-4 ring-emerald-400 ring-offset-2 ring-offset-emerald-900">
                  <PlayerAvatar name={soldFlash.player?.name} photoUrl={soldFlash.player?.photo_url} size={96} />
                </div>
                <p className="text-xl font-extrabold text-white mt-4 leading-tight">{soldFlash.player?.name ?? '—'}</p>
                <p className="text-sm text-emerald-300 mt-1 capitalize">{soldFlash.player?.role ?? ''}</p>
              </div>
              <div className="px-8 py-5 mt-1" style={{ background: 'rgba(0,0,0,0.25)' }}>
                <p className="text-[11px] text-emerald-400 uppercase tracking-[0.2em] font-semibold">Sold to</p>
                <p className="text-2xl font-extrabold text-white mt-0.5">{soldFlash.teamName}</p>
                <p className="text-3xl font-black mt-2" style={{ color: '#34d399' }}>₹{soldFlash.soldPrice?.toLocaleString()}</p>
              </div>
              <p className="text-[10px] text-emerald-500/60 py-3">Tap anywhere to dismiss</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CAPTAIN / VIEWER layout: full card ─────────────────────────────────────
  return (
    <div className="p-4 pb-24 space-y-3 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/auctions')} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink-900 dark:text-white truncate">{auction.name}</p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${auction.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300' : 'bg-ink-100 text-ink-400'}`}>
          {auction.status.toUpperCase()}
        </span>
        {viewerCount > 1 && (
          <span className="text-[11px] text-ink-400 shrink-0">👁 {viewerCount}</span>
        )}
        <span className={`flex items-center gap-1 text-[10px] font-semibold shrink-0 ${isRealtimeLive ? 'text-green-500' : 'text-amber-500'}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${isRealtimeLive ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
          {isRealtimeLive ? 'Live' : 'Sync…'}
        </span>
      </div>

      {/* Budget bars */}
      <BudgetBars teams={teams} budgetPerTeam={auction.budget_per_team} />

      {/* Draw animation or active player spotlight */}
      {viewerDraw ? (
        <PlayerDrawAnimation
          poolPlayers={viewerDraw.pool}
          winner={viewerDraw.winner}
          onComplete={_clearViewerDraw}
        />
      ) : (
        <ActivePlayerSpotlight
          player={activePlayer}
          leadingTeam={leadingTeam}
          careerStats={activeCareerStats}
          onViewProfile={activePlayer?.player_id ? () => navigate(`/players/${activePlayer.player_id}`) : null}
        />
      )}

      {/* Pass indicator */}
      {activePlayer && <PassIndicator passTeam1={activePlayer.pass_team1} passTeam2={activePlayer.pass_team2} teamNames={teamNames} />}

      {isCaptain && (
        <CaptainControls
          auctionTeamId={myAuctionTeam?.id}
          activePlayer={activePlayer}
          bidIncrements={auction.bid_increments ?? [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]}
          budgetRemaining={myAuctionTeam?.budget_remaining ?? 0}
          maxBid={myAuctionTeam ? (teamMaxBids[myAuctionTeam.id] ?? myAuctionTeam.budget_remaining ?? 0) : 0}
          hasPassed={hasPassed}
          onBid={handleBid}
          onPass={handlePass}
          loading={actionLoading}
        />
      )}

      {/* Bid log — same horizontal strip as auctioneer view */}
      <BidLogStrip bids={bids} teams={teams} />

      {/* Pool / Held / Sold / Deals counters */}
      {counterRow}

      {/* Held Queue sheet */}
      <BottomSheet open={heldSheetOpen} onClose={() => setHeldSheetOpen(false)} title="Held Queue">
        <HeldQueue heldPlayers={heldPlayers} isAdmin={isAdmin} onReturnToPool={handleReturnToPool} />
      </BottomSheet>

      {/* Pool sheet */}
      <BottomSheet open={poolSheetOpen} onClose={() => setPoolSheetOpen(false)} title="Player Pool">
        <div className="space-y-1.5">
          {poolPlayers.length === 0
            ? <p className="text-sm text-ink-400 text-center py-4">Pool is empty</p>
            : poolPlayers.map(ap => (
              <div key={ap.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-ink-50 dark:bg-white/5">
                <PlayerAvatar player={ap.player} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                  <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">Available</span>
              </div>
            ))
          }
        </div>
      </BottomSheet>

      {/* Sold sheet — grouped by team */}
      <BottomSheet open={soldSheetOpen} onClose={() => setSoldSheetOpen(false)} title="Sold Players">
        {soldPlayers.length === 0
          ? <p className="text-sm text-ink-400 text-center py-4">No players sold yet</p>
          : (
            <div className="space-y-4">
              {teams.map(t => {
                const teamSold = soldByTeam[t.id] ?? [];
                const spent = teamSold.reduce((s, ap) => s + (ap.sold_price ?? 0), 0);
                return (
                  <div key={t.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold text-ink-500 uppercase tracking-wider">{t.name}</p>
                      <span className="text-xs tabular-nums text-ink-400">{teamSold.length} players · ₹{spent.toLocaleString()} spent</span>
                    </div>
                    {teamSold.length === 0
                      ? <p className="text-xs text-ink-300 py-1 px-2">None yet</p>
                      : teamSold.map(ap => (
                        <button key={ap.id} onClick={() => { setSoldSheetOpen(false); openSoldCard(ap); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-500/10 mb-1 text-left active:scale-[0.98] transition-transform">
                          <PlayerAvatar player={ap.player} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                              {isCaptainPlayer(ap) && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">(C)</span>}
                            </div>
                            <p className="text-[11px] text-ink-400">{ap.player?.role}</p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green">Sold</span>
                            <span className="text-xs font-bold text-brand-green tabular-nums">₹{ap.sold_price?.toLocaleString()}</span>
                          </div>
                        </button>
                      ))
                    }
                  </div>
                );
              })}
            </div>
          )
        }
      </BottomSheet>
      {topDealsSheet}

      {/* Complete Auction button — admin only, nothing left to sell */}
      {canComplete && (
        <button
          onClick={() => setCompleteConfirmOpen(true)}
          className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #065f46, #047857)' }}
        >
          🏁 Complete Auction
        </button>
      )}

      <ConfirmDialog
        open={completeConfirmOpen}
        title="Complete Auction"
        message="Mark this auction as completed? This will lock the results and everyone will be taken to the summary view."
        confirmLabel="Complete"
        disabled={completing}
        onConfirm={handleComplete}
        onCancel={() => setCompleteConfirmOpen(false)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Auction"
        message={`Permanently delete "${auction.name}"? All bids and player data will be lost.`}
        confirmLabel="Delete"
        danger
        disabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {/* Sold card modal */}
      <SoldCardModal
        data={soldCardData}
        exportUrl={exportUrl}
        exportMimeType={exportMimeType}
        recording={recordingCard}
        recordingProgress={recordingProgress}
        onClose={() => setSoldCardData(null)}
      />

      {/* 🔨 SOLD! overlay — appears for all viewers when a deal is struck */}
      {soldFlash && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={_clearSoldFlash}
        >
          <div
            className="mx-6 rounded-3xl overflow-hidden text-center shadow-2xl animate-[draw-land_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
            style={{ background: 'linear-gradient(160deg,#064e3b 0%,#065f46 50%,#047857 100%)', boxShadow: '0 0 60px rgba(16,185,129,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-8 pt-7 pb-4">
              <p className="text-3xl font-black text-white mb-5">🔨 SOLD!</p>
              <div className="rounded-full overflow-hidden w-24 h-24 mx-auto ring-4 ring-emerald-400 ring-offset-2 ring-offset-emerald-900">
                <PlayerAvatar name={soldFlash.player?.name} photoUrl={soldFlash.player?.photo_url} size={96} />
              </div>
              <p className="text-xl font-extrabold text-white mt-4 leading-tight">{soldFlash.player?.name ?? '—'}</p>
              <p className="text-sm text-emerald-300 mt-1 capitalize">{soldFlash.player?.role ?? ''}</p>
            </div>
            <div className="px-8 py-5 mt-1" style={{ background: 'rgba(0,0,0,0.25)' }}>
              <p className="text-[11px] text-emerald-400 uppercase tracking-[0.2em] font-semibold">Sold to</p>
              <p className="text-2xl font-extrabold text-white mt-0.5">{soldFlash.teamName}</p>
              <p className="text-3xl font-black mt-2" style={{ color: '#34d399' }}>₹{soldFlash.soldPrice?.toLocaleString()}</p>
            </div>
            <p className="text-[10px] text-emerald-500/60 py-3">Tap anywhere to dismiss</p>
          </div>
        </div>
      )}
    </div>
  );
}

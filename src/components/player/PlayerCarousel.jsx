import { useState, useRef, useEffect, useCallback } from 'react';
import PlayerAvatar from './PlayerAvatar';
import * as playerService from '../../services/playerService';

const ROLE_LABELS = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  allrounder: 'All-rounder',
  wicket_keeper: 'Wicket Keeper',
};

const ROLE_COLORS = {
  batsman:       'bg-blue-500/20 text-blue-600 dark:text-blue-300',
  bowler:        'bg-red-500/20 text-red-600 dark:text-red-300',
  allrounder:    'bg-purple-500/20 text-purple-600 dark:text-purple-300',
  wicket_keeper: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
};

// Card dimensions — bigger for a proper mobile experience
const CARD_W = 260;
const CARD_H = 360;
const CARD_SPACING_PX = 155;

function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch {}
}

function fmtN(n) { return n != null && n > 0 ? n : '—'; }
function fmt1(n) { return n != null && isFinite(n) && n > 0 ? n.toFixed(1) : '—'; }

function getCardStyle(offset, dragFrac = 0, transitionMs = 350) {
  const vOffset = offset + dragFrac;
  const absV = Math.abs(vOffset);

  if (Math.abs(offset) > 2) return { display: 'none' };
  if (absV > 2.8) return { opacity: 0, pointerEvents: 'none', transition: 'none' };

  const opacity = absV >= 2 ? Math.max(0, 0.45 - (absV - 2) * 0.45)
    : absV >= 1 ? 0.45 + (2 - absV) * 0.3
    : 1 - absV * 0.25;

  return {
    transform: `perspective(1100px) rotateY(${vOffset * 16}deg) scale(${1 - absV * 0.11}) translateX(${vOffset * 62}%)`,
    opacity: Math.max(0, Math.min(1, opacity)),
    zIndex: Math.max(1, 20 - Math.round(absV)),
    transition: dragFrac !== 0
      ? 'opacity 60ms'
      : `all ${transitionMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
  };
}

export default function PlayerCarousel({ players, activeIndex, onChangeIndex, onSelect, statsMap = {} }) {
  const dragStartX = useRef(null);
  const dragStartTime = useRef(null);
  const isDragging = useRef(false);
  const isAnimating = useRef(false);

  const [dragFrac, setDragFrac] = useState(0);
  const [transitionMs, setTransitionMs] = useState(350);
  const [flipped, setFlipped] = useState(false);
  const [detailCache, setDetailCache] = useState({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  const n = players.length;

  useEffect(() => { setFlipped(false); }, [activeIndex]);

  function wrap(idx) { return ((idx % n) + n) % n; }
  function prev() { haptic(); onChangeIndex(wrap(activeIndex - 1)); }
  function next() { haptic(); onChangeIndex(wrap(activeIndex + 1)); }

  // Circular offset: shortest path around the loop
  function circularOffset(idx) {
    let off = idx - activeIndex;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    return off;
  }

  const flyToIndex = useCallback((startIdx, targetIdx, count) => {
    const steps = count;
    if (steps === 0) return;
    const direction = targetIdx > startIdx ? 1 : -1;
    isAnimating.current = true;
    const baseInterval = Math.max(30, Math.min(110, 190 / steps));
    setTransitionMs(Math.max(35, baseInterval * 0.7));
    let i = 1;
    function tick() {
      haptic(6);
      onChangeIndex(wrap(startIdx + direction * i));
      i++;
      if (i <= steps) {
        const progress = i / steps;
        const ease = progress < 0.65 ? 1 : 1 + (progress - 0.65) * 2.2;
        setTimeout(tick, baseInterval * ease);
      } else {
        isAnimating.current = false;
        setTransitionMs(350);
      }
    }
    setTimeout(tick, baseInterval * 0.4);
  }, [onChangeIndex, n]);

  async function flipActive(playerId) {
    if (flipped) { setFlipped(false); return; }
    if (detailCache[playerId] === undefined) {
      setLoadingDetail(true);
      try {
        const stats = await playerService.getCareerStats(playerId);
        setDetailCache(prev => ({ ...prev, [playerId]: stats || null }));
      } catch {
        setDetailCache(prev => ({ ...prev, [playerId]: null }));
      } finally {
        setLoadingDetail(false);
      }
    }
    setFlipped(true);
  }

  function handlePointerDown(e) {
    if (isAnimating.current) return;
    dragStartX.current = e.clientX ?? e.touches?.[0]?.clientX;
    dragStartTime.current = Date.now();
    isDragging.current = false;
  }

  function handlePointerMove(e) {
    if (dragStartX.current === null) return;
    const x = e.clientX ?? e.touches?.[0]?.clientX;
    const delta = x - dragStartX.current;
    if (Math.abs(delta) > 6) isDragging.current = true;
    let frac = -delta / CARD_SPACING_PX;
    // Circular — no boundaries, just soft resistance past snap threshold
    const THRESHOLD = 0.75;
    if (Math.abs(frac) > THRESHOLD) {
      const sign = frac > 0 ? 1 : -1;
      frac = sign * (THRESHOLD + (Math.abs(frac) - THRESHOLD) * 0.15);
    }
    setDragFrac(frac);
  }

  function handlePointerUp(e) {
    if (dragStartX.current === null) return;
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const delta = x - dragStartX.current;
    const elapsed = Math.max(1, Date.now() - (dragStartTime.current ?? Date.now()));
    setDragFrac(0);
    if (Math.abs(delta) > 30) {
      const velocity = Math.abs(delta) / elapsed;
      const direction = delta < 0 ? 1 : -1;
      let skip;
      if (velocity >= 2.0)      skip = Math.min(Math.floor(n / 2), Math.round(velocity * 4));
      else if (velocity >= 1.2) skip = Math.min(4, Math.round(velocity * 2.5));
      else if (velocity >= 0.6) skip = 2;
      else                      skip = 1;
      const targetIdx = wrap(activeIndex + direction * skip);
      const wouldCrossWrap = direction === 1
        ? activeIndex + skip >= n
        : activeIndex - skip < 0;
      if (skip <= 1 || wouldCrossWrap) {
        haptic(); onChangeIndex(targetIdx);
      } else {
        flyToIndex(activeIndex, targetIdx, skip);
      }
    }
    dragStartX.current = null;
    dragStartTime.current = null;
    setTimeout(() => { isDragging.current = false; }, 50);
  }

  function handlePointerCancel() {
    setDragFrac(0);
    dragStartX.current = null;
    dragStartTime.current = null;
    isDragging.current = false;
  }

  function handleCardClick(offset, playerId) {
    if (isDragging.current) return;
    if (offset !== 0) { haptic(); onChangeIndex(wrap(activeIndex + offset)); return; }
    flipActive(playerId);
  }

  if (!players.length) return null;

  const showDots = players.length > 1;
  const maxDots = 7;

  return (
    <div className="select-none">
      {/* Card stage */}
      <div
        className="relative flex items-center justify-center"
        style={{ height: CARD_H + 24 }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerCancel}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerCancel}
      >
        {players.map((player, idx) => {
          const offset = circularOffset(idx);
          if (Math.abs(offset) > 2) return null;
          const isActive = offset === 0;
          const frontStats = statsMap[player.id] || null;
          const backStats = detailCache[player.id];

          const styleStr = [
            player.batting_style?.replace('-hand', ''),
            player.bowling_style?.replace(/-/g, ' '),
          ].filter(Boolean).join(' · ');

          // Back face detailed stats
          const batAvg  = backStats?.bat_innings > backStats?.bat_not_outs
            ? fmt1(backStats.bat_runs / (backStats.bat_innings - backStats.bat_not_outs)) : '—';
          const sr      = backStats?.bat_balls > 0 ? fmt1((backStats.bat_runs / backStats.bat_balls) * 100) : '—';
          const bowlAvg = backStats?.bowl_wickets > 0 ? fmt1(backStats.bowl_runs / backStats.bowl_wickets) : '—';
          const eco     = backStats?.bowl_legal_balls > 0 ? fmt1((backStats.bowl_runs / backStats.bowl_legal_balls) * 6) : '—';
          const best    = backStats?.bowl_best_wickets > 0 ? `${backStats.bowl_best_wickets}/${backStats.bowl_best_runs}` : '—';

          return (
            <div
              key={player.id}
              onClick={() => handleCardClick(offset, player.id)}
              style={{
                ...getCardStyle(offset, dragFrac, transitionMs),
                width: CARD_W,
                height: CARD_H,
                boxShadow: isActive
                  ? '0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.12)'
                  : '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
              }}
              className="absolute rounded-3xl overflow-hidden cursor-pointer"
            >
              {/* Flip wrapper */}
              <div style={{
                transformStyle: 'preserve-3d',
                transform: isActive && flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                position: 'relative',
                width: '100%',
                height: '100%',
              }}>

                {/* ── FRONT FACE ── */}
                <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  className="absolute inset-0 flex flex-col bg-white dark:bg-ink-800">

                  {/* Avatar zone */}
                  <div className="flex items-center justify-center bg-gradient-to-br from-brand-green to-brand-teal relative"
                    style={{ height: 160 }}>
                    <div style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }} className="rounded-full">
                      <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={96} />
                    </div>
                    {!player.is_active && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold bg-black/40 text-white px-1.5 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Info zone */}
                  <div className="flex flex-col flex-1 px-3 pt-2.5 pb-2">
                    <p className="text-[13px] font-bold text-ink-900 dark:text-white text-center leading-tight truncate">
                      {player.name}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      {player.role && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[player.role] || ''}`}>
                          {ROLE_LABELS[player.role] || player.role}
                        </span>
                      )}
                    </div>
                    {styleStr ? (
                      <p className="text-[10px] text-ink-400 text-center mt-1 truncate capitalize">{styleStr}</p>
                    ) : null}

                    {/* Stats strip */}
                    <div className="flex mt-auto pt-2 border-t border-ink-100 dark:border-white/8 text-center">
                      {[
                        { label: 'Runs',    value: fmtN(frontStats?.bat_runs) },
                        { label: 'Wkts',    value: fmtN(frontStats?.bowl_wickets) },
                        { label: 'Matches', value: fmtN(frontStats?.bat_matches || frontStats?.bowl_matches) },
                      ].map((s, i, arr) => (
                        <div key={s.label} className={`flex-1 ${i < arr.length - 1 ? 'border-r border-ink-100 dark:border-white/8' : ''}`}>
                          <p className="text-[9px] text-ink-400 uppercase tracking-widest">{s.label}</p>
                          <p className="text-sm font-bold text-ink-900 dark:text-white mt-0.5">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── BACK FACE ── */}
                <div style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
                }}
                  className="absolute inset-0 rounded-3xl flex flex-col">
                  {loadingDetail && isActive ? (
                    <div className="flex-1 flex items-center justify-center text-white/40 text-xs animate-pulse">Loading stats…</div>
                  ) : (
                    <>
                      {/* Back header */}
                      <div className="px-5 pt-5 pb-3 border-b border-white/10">
                        <p className="text-white font-bold text-sm text-center truncate">{player.name}</p>
                        {player.role && (
                          <p className="text-white/40 text-[11px] text-center mt-0.5">{ROLE_LABELS[player.role] || player.role}</p>
                        )}
                      </div>

                      {/* Stats grid */}
                      <div className="flex-1 px-4 py-4 space-y-3">
                        {/* Batting */}
                        <div>
                          <p className="text-[10px] font-bold text-brand-green uppercase tracking-widest mb-2">Batting</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[['Average', batAvg], ['Strike Rate', sr], ['Highest', fmtN(backStats?.bat_highest_score)]].map(([l, v]) => (
                              <div key={l} className="rounded-xl py-2.5 px-1 text-center"
                                style={{ background: 'rgba(255,255,255,0.06)' }}>
                                <p className="text-white font-bold text-base leading-none">{v}</p>
                                <p className="text-white/40 text-[9px] mt-1 leading-none">{l}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Bowling */}
                        <div>
                          <p className="text-[10px] font-bold text-brand-teal uppercase tracking-widest mb-2">Bowling</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[['Average', bowlAvg], ['Economy', eco], ['Best', best]].map(([l, v]) => (
                              <div key={l} className="rounded-xl py-2.5 px-1 text-center"
                                style={{ background: 'rgba(255,255,255,0.06)' }}>
                                <p className="text-white font-bold text-base leading-none">{v}</p>
                                <p className="text-white/40 text-[9px] mt-1 leading-none">{l}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* View Profile CTA */}
                      <div className="px-4 pb-5">
                        <button
                          onClick={e => { e.stopPropagation(); onSelect(player.id); }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-green text-white text-sm font-bold"
                          style={{ boxShadow: '0 4px 16px rgba(34,197,94,0.4)' }}
                        >
                          View Profile →
                        </button>
                      </div>
                    </>
                  )}
                </div>

              </div>
            </div>
          );
        })}

      </div>

      {/* Dots */}
      {showDots && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {players.length <= maxDots ? (
            players.map((_, i) => (
              <button key={i} onClick={() => { haptic(); onChangeIndex(i); }}
                className={`rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? 'w-5 h-1.5 bg-brand-green'
                    : 'w-1.5 h-1.5 bg-ink-200 dark:bg-white/20'
                }`} />
            ))
          ) : (
            <span className="text-xs text-ink-400 tabular-nums">{activeIndex + 1} / {players.length}</span>
          )}
        </div>
      )}
    </div>
  );
}

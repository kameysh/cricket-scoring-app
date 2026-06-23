import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import * as playerService from '../../services/playerService';
import { computeBadges, displayName } from '../../lib/cricketUtils';

const ROLE_LABELS = {
  batsman:       'Batsman',
  bowler:        'Bowler',
  allrounder:    'All-rounder',
  wicket_keeper: 'Wicket Keeper',
};

const ROLE_COLORS = {
  batsman:       'bg-blue-500/20 text-blue-600 dark:text-blue-300',
  bowler:        'bg-red-500/20 text-red-600 dark:text-red-300',
  allrounder:    'bg-purple-500/20 text-purple-600 dark:text-purple-300',
  wicket_keeper: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
};

const CARD_W         = 260;
const CARD_H         = 420;
const CARD_SPACING   = 150; // px per card-width of drag to shift one card
const COMMIT_PX      = 20;  // min drag to commit a swipe

function haptic(ms = 8) { try { navigator.vibrate?.(ms); } catch {} }
function fmtN(n) { return n != null && n > 0 ? n : '—'; }
function fmt1(n) { return n != null && isFinite(n) && n > 0 ? n.toFixed(1) : '—'; }

function getCardStyle(offset, dragFrac = 0, transitionMs = 350) {
  const v    = offset + dragFrac;
  const absV = Math.abs(v);

  if (Math.abs(offset) > 2) return { display: 'none' };
  if (absV > 2.8)           return { opacity: 0, pointerEvents: 'none', transition: 'none' };

  const opacity =
    absV >= 2   ? Math.max(0, 0.45 - (absV - 2) * 0.45) :
    absV >= 1   ? 0.45 + (2 - absV) * 0.3               :
                  1 - absV * 0.25;

  return {
    transform:  `perspective(1100px) rotateY(${v * 16}deg) scale(${1 - absV * 0.11}) translateX(${v * 62}%)`,
    opacity:    Math.max(0, Math.min(1, opacity)),
    zIndex:     Math.max(1, 20 - Math.round(absV)),
    transition: dragFrac !== 0
      ? 'none'                                                          // 1:1 during drag — no lag
      : `all ${transitionMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`, // spring on release
  };
}

export default function PlayerCarousel({ players, activeIndex, onChangeIndex, onSelect, statsMap = {}, onDelete, compareMode = false, selectedIds = [] }) {
  const containerRef   = useRef(null);
  const dragStartX     = useRef(null);
  const dragStartY     = useRef(null);
  const dragStartTime  = useRef(null);
  const gestureDir     = useRef(null);   // 'h' | 'v' | null — locked after first 5px
  const isDragging     = useRef(false);
  const isAnimating    = useRef(false);
  const activeFrac     = useRef(0);      // mirrors dragFrac for the native handler

  const [dragFrac,     setDragFrac]     = useState(0);
  const [transitionMs, setTransitionMs] = useState(350);
  const [flipped,      setFlipped]      = useState(false);
  const [detailCache,  setDetailCache]  = useState({});
  const [loadingDetail,setLoadingDetail]= useState(false);
  const [activeBadge,  setActiveBadge]  = useState(null); // { emoji, label, hint, earned, count }

  const n = players.length;

  useEffect(() => { setFlipped(false); setActiveBadge(null); }, [activeIndex]);
  useEffect(() => { if (compareMode) { setFlipped(false); setActiveBadge(null); } }, [compareMode]);

  function wrap(idx) { return ((idx % n) + n) % n; }

  function circularOffset(idx) {
    let off = idx - activeIndex;
    if (off >  n / 2) off -= n;
    if (off < -n / 2) off += n;
    return off;
  }

  const commitSwipe = useCallback((delta) => {
    const elapsed   = Math.max(1, Date.now() - (dragStartTime.current ?? Date.now()));
    const velocity  = Math.abs(delta) / elapsed;           // px/ms
    const direction = delta < 0 ? 1 : -1;

    let skip =
      velocity >= 1.8 ? Math.min(Math.floor(n / 2), Math.round(velocity * 4)) :
      velocity >= 1.0 ? Math.min(4, Math.round(velocity * 2.5))               :
      velocity >= 0.5 ? 2                                                      : 1;

    const targetIdx      = wrap(activeIndex + direction * skip);
    const wouldCrossWrap = direction === 1 ? activeIndex + skip >= n : activeIndex - skip < 0;

    if (skip <= 1 || wouldCrossWrap) {
      haptic(); onChangeIndex(targetIdx);
    } else {
      // Animated multi-step fly
      isAnimating.current = true;
      const base = Math.max(30, Math.min(110, 190 / skip));
      setTransitionMs(Math.max(35, base * 0.7));
      let i = 1;
      const tick = () => {
        haptic(6);
        onChangeIndex(wrap(activeIndex + direction * i));
        i++;
        if (i <= skip) {
          const ease = i / skip < 0.65 ? 1 : 1 + (i / skip - 0.65) * 2.2;
          setTimeout(tick, base * ease);
        } else {
          isAnimating.current = false;
          setTransitionMs(350);
        }
      };
      setTimeout(tick, base * 0.4);
    }
  }, [activeIndex, n, onChangeIndex]);

  // ── Native non-passive touchmove — required to call preventDefault on mobile ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onNativeMove(e) {
      if (dragStartX.current === null || isAnimating.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartX.current;
      const dy = touch.clientY - dragStartY.current;

      // Determine gesture direction after first 5px
      if (!gestureDir.current) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        gestureDir.current = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
      }

      if (gestureDir.current !== 'h') return; // vertical — let browser scroll

      e.preventDefault(); // block page scroll for horizontal swipe
      isDragging.current = true;

      const frac = -dx / CARD_SPACING; // pure 1:1, no damping
      activeFrac.current = frac;
      setDragFrac(frac);
    }

    function onNativeEnd(e) {
      if (dragStartX.current === null) return;
      const dx = activeFrac.current * -CARD_SPACING; // reconstruct delta
      const committed = isDragging.current && Math.abs(dx) > COMMIT_PX;
      setDragFrac(0);
      activeFrac.current = 0;
      if (committed) commitSwipe(dx);
      dragStartX.current    = null;
      dragStartY.current    = null;
      dragStartTime.current = null;
      gestureDir.current    = null;
      setTimeout(() => { isDragging.current = false; }, 50);
    }

    el.addEventListener('touchmove',   onNativeMove, { passive: false });
    el.addEventListener('touchend',    onNativeEnd,  { passive: true  });
    el.addEventListener('touchcancel', onNativeEnd,  { passive: true  });
    return () => {
      el.removeEventListener('touchmove',   onNativeMove);
      el.removeEventListener('touchend',    onNativeEnd);
      el.removeEventListener('touchcancel', onNativeEnd);
    };
  }, [commitSwipe]);

  // ── Mouse handlers (desktop only) ──
  function handleMouseDown(e) {
    if (isAnimating.current) return;
    dragStartX.current    = e.clientX;
    dragStartY.current    = e.clientY;
    dragStartTime.current = Date.now();
    isDragging.current    = false;
    gestureDir.current    = 'h';
  }

  function handleMouseMove(e) {
    if (dragStartX.current === null || gestureDir.current !== 'h') return;
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 4) isDragging.current = true;
    const frac = -dx / CARD_SPACING;
    activeFrac.current = frac;
    setDragFrac(frac);
  }

  function handleMouseUp(e) {
    if (dragStartX.current === null) return;
    const dx        = e.clientX - dragStartX.current;
    const committed = isDragging.current && Math.abs(dx) > COMMIT_PX;
    setDragFrac(0);
    activeFrac.current = 0;
    if (committed) commitSwipe(dx);
    dragStartX.current    = null;
    dragStartY.current    = null;
    dragStartTime.current = null;
    gestureDir.current    = null;
    setTimeout(() => { isDragging.current = false; }, 50);
  }

  // Touch start — just record starting position (touchmove handled natively above)
  function handleTouchStart(e) {
    if (isAnimating.current) return;
    const t = e.touches[0];
    dragStartX.current    = t.clientX;
    dragStartY.current    = t.clientY;
    dragStartTime.current = Date.now();
    isDragging.current    = false;
    gestureDir.current    = null;
    activeFrac.current    = 0;
  }

  async function flipActive(playerId) {
    if (flipped) { setFlipped(false); return; }
    if (detailCache[playerId] === undefined) {
      setLoadingDetail(true);
      try {
        const stats = await playerService.getCareerStats(playerId);
        setDetailCache(p => ({ ...p, [playerId]: stats || null }));
      } catch {
        setDetailCache(p => ({ ...p, [playerId]: null }));
      } finally {
        setLoadingDetail(false);
      }
    }
    setFlipped(true);
  }

  function handleCardClick(offset, playerId) {
    if (isDragging.current) return;
    if (offset !== 0) { haptic(); onChangeIndex(wrap(activeIndex + offset)); return; }
    if (activeBadge) { setActiveBadge(null); return; }
    if (compareMode) { onSelect(playerId); return; }
    flipActive(playerId);
  }

  if (!players.length) return null;

  const showDots = players.length > 1;
  const maxDots  = 7;

  function goLeft()  { if (!isAnimating.current) { haptic(); onChangeIndex(wrap(activeIndex - 1)); } }
  function goRight() { if (!isAnimating.current) { haptic(); onChangeIndex(wrap(activeIndex + 1)); } }

  return (
    <div className="select-none touch-pan-y">
      <div className="relative flex items-center justify-center" style={{ height: CARD_H + 24 }}>
        {/* Left arrow */}
        {n > 1 && (
          <button
            onClick={goLeft}
            className="absolute left-0 z-30 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-ink-800 shadow-md text-ink-600 dark:text-ink-200 active:scale-90 transition-transform"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {/* Right arrow */}
        {n > 1 && (
          <button
            onClick={goRight}
            className="absolute right-0 z-30 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-ink-800 shadow-md text-ink-600 dark:text-ink-200 active:scale-90 transition-transform"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <ChevronRight size={20} />
          </button>
        )}
        <div
          ref={containerRef}
          className="relative flex items-center justify-center w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
        >

        {players.map((player, idx) => {
          const offset    = circularOffset(idx);
          if (Math.abs(offset) > 2) return null;
          const isActive  = offset === 0;
          const frontStats = statsMap[player.id] || null;
          const backStats  = detailCache[player.id];

          const styleStr = [
            player.batting_style?.replace('-hand', ''),
            player.bowling_style?.replace(/-/g, ' '),
          ].filter(Boolean).join(' · ');

          const batAvg  = backStats?.bat_innings > backStats?.bat_not_outs
            ? fmt1(backStats.bat_runs / (backStats.bat_innings - backStats.bat_not_outs)) : '—';
          const sr      = backStats?.bat_balls > 0
            ? fmt1((backStats.bat_runs / backStats.bat_balls) * 100) : '—';
          const bowlAvg = backStats?.bowl_wickets > 0
            ? fmt1(backStats.bowl_runs / backStats.bowl_wickets) : '—';
          const eco     = backStats?.bowl_legal_balls > 0
            ? fmt1((backStats.bowl_runs / backStats.bowl_legal_balls) * 6) : '—';
          const best    = backStats?.bowl_best_wickets > 0
            ? `${backStats.bowl_best_wickets}/${backStats.bowl_best_runs}` : '—';

          return (
            <div
              key={player.id}
              onClick={() => handleCardClick(offset, player.id)}
              style={{
                ...getCardStyle(offset, dragFrac, transitionMs),
                width:  CARD_W,
                height: CARD_H,
                boxShadow: isActive
                  ? '0 8px 24px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)'
                  : '0 4px 12px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
              }}
              className={`absolute rounded-3xl overflow-hidden cursor-pointer ${compareMode && selectedIds.includes(player.id) ? 'ring-4 ring-brand-green ring-offset-2' : ''}`}
            >
              {/* Flip wrapper */}
              <div style={{
                transformStyle: 'preserve-3d',
                transform:  isActive && flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                position: 'relative', width: '100%', height: '100%',
              }}>

                {/* ── FRONT FACE ── */}
                <div
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  className="absolute inset-0 flex flex-col bg-white dark:bg-ink-800"
                >
                  {/* Avatar zone */}
                  <div
                    className="flex items-center justify-center bg-gradient-to-br from-brand-green to-brand-teal relative"
                    style={{ height: 230 }}
                  >
                    {!player.is_active && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold bg-black/30 text-white px-1.5 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                    {player.is_guest && (
                      <span className="absolute top-2 left-2 text-[9px] font-bold bg-amber-500/80 text-white px-1.5 py-0.5 rounded-full">
                        Guest
                      </span>
                    )}
                    <div style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }} className="rounded-full">
                      <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={110} />
                    </div>
                  </div>

                  {/* Compare mode indicator — top-right corner badge */}
                  {compareMode && isActive && (
                    selectedIds.includes(player.id) ? (
                      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-brand-green text-white rounded-full px-2.5 py-1 shadow-md pointer-events-none">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        <span className="text-[10px] font-bold leading-none">Selected</span>
                      </div>
                    ) : (
                      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 bg-black/50 text-white rounded-full px-2.5 py-1 pointer-events-none">
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><circle cx="4.5" cy="4.5" r="3.5" stroke="white" strokeWidth="1.2"/><path d="M4.5 2.5v2l1 1" stroke="white" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        <span className="text-[10px] font-semibold leading-none">Tap</span>
                      </div>
                    )
                  )}

                  {/* Info zone */}
                  <div className="relative flex flex-col flex-1 px-3 pt-4 pb-3">
                    {/* Badge popover overlay — inside card, never overflows */}
                    {activeBadge && isActive && (
                      <div
                        className="absolute inset-x-0 top-0 bottom-0 z-20 flex flex-col items-center justify-center rounded-b-3xl px-4"
                        style={{ background: activeBadge.earned ? 'linear-gradient(135deg,#166534ee,#15803dee)' : 'rgba(15,23,42,0.93)' }}
                        onClick={e => { e.stopPropagation(); setActiveBadge(null); }}
                      >
                        <p className="text-4xl leading-none mb-2">{activeBadge.emoji}</p>
                        <p className="text-white text-[13px] font-bold text-center leading-tight">{activeBadge.label}</p>
                        {activeBadge.earned ? (
                          <p className="text-green-300 text-[11px] mt-1.5">✓ Earned{activeBadge.count > 1 ? ` ×${activeBadge.count}` : ''}!</p>
                        ) : (
                          <p className="text-white/60 text-[11px] mt-1.5 text-center leading-snug">{activeBadge.hint}</p>
                        )}
                        <p className="text-white/30 text-[10px] mt-3">Tap to close</p>
                      </div>
                    )}

                    <p className="text-[15px] font-bold text-ink-900 dark:text-white text-center leading-tight truncate">
                      {player.name}
                    </p>
                    {player.nickname?.trim() && (
                      <p className="text-[11px] text-ink-400 dark:text-ink-500 text-center truncate mt-0.5">"{player.nickname.trim()}"</p>
                    )}
                    <div className="flex items-center justify-center mt-2">
                      {player.role && (
                        <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${ROLE_COLORS[player.role] || ''}`}>
                          {ROLE_LABELS[player.role] || player.role}
                        </span>
                      )}
                    </div>
                    {styleStr ? (
                      <p className="text-[11px] text-ink-400 text-center mt-2 truncate capitalize">{styleStr}</p>
                    ) : null}

                    {/* Badge strip */}
                    {(() => {
                      const allStatsArr = Object.values(statsMap);
                      const badges = computeBadges(frontStats || {}, 0, allStatsArr);
                      return (
                        <div className="flex items-center justify-center flex-wrap gap-1 mt-3">
                          {badges.map(b => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setActiveBadge(prev => prev?.id === b.id ? null : b);
                              }}
                              className={`text-base leading-none transition-all active:scale-125 ${b.earned ? '' : 'grayscale opacity-25'}`}
                            >
                              {b.emoji}
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Stats strip */}
                    <div className="flex mt-auto pt-3 border-t border-ink-100 dark:border-white/10 text-center">
                      {[
                        { label: 'Runs',    value: fmtN(frontStats?.bat_runs) },
                        { label: 'Wkts',    value: fmtN(frontStats?.bowl_wickets) },
                        { label: 'Matches', value: fmtN(frontStats?.bat_matches || frontStats?.bowl_matches) },
                      ].map((s, i, arr) => (
                        <div key={s.label} className={`flex-1 ${i < arr.length - 1 ? 'border-r border-ink-100 dark:border-white/10' : ''}`}>
                          <p className="text-[10px] text-ink-400 uppercase tracking-widest">{s.label}</p>
                          <p className="text-base font-bold text-ink-900 dark:text-white mt-0.5">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── BACK FACE ── */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
                  }}
                  className="absolute inset-0 rounded-3xl flex flex-col"
                >
                  {loadingDetail && isActive ? (
                    <div className="flex-1 flex items-center justify-center text-white/40 text-xs animate-pulse">
                      Loading stats…
                    </div>
                  ) : (
                    <>
                      <div className="px-5 pt-5 pb-3 border-b border-white/10">
                        <p className="text-white font-bold text-sm text-center truncate">{player.name}</p>
                        {player.nickname?.trim() && (
                          <p className="text-white/60 text-[11px] text-center truncate">"{player.nickname.trim()}"</p>
                        )}
                        {player.role && (
                          <p className="text-white/40 text-[11px] text-center mt-0.5">
                            {ROLE_LABELS[player.role] || player.role}
                          </p>
                        )}
                      </div>

                      <div className="flex-1 px-4 py-4 space-y-3">
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
      </div>

      {/* Dots + delete */}
      <div className="flex items-center justify-center gap-3 mt-2">
        {showDots && (
          <div className="flex items-center gap-1.5">
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
        {onDelete && (
          <button
            onClick={() => { haptic(); onDelete(players[activeIndex]); }}
            className="p-1.5 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="Delete player"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import * as playerService from '../../services/playerService';

const ROLE_LABELS = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  allrounder: 'All-rounder',
  wicket_keeper: 'WK',
};

const ROLE_COLORS = {
  batsman: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  bowler: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  allrounder: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  wicket_keeper: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

// Each card is w-36 (144px) and spaced at 62% = ~89px apart
const CARD_SPACING_PX = 89;

function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch {}
}

function getCardStyle(offset, dragFrac = 0, transitionMs = 350) {
  // Use dragFrac to continuously interpolate position during live drag
  const vOffset = offset + dragFrac;
  const absV = Math.abs(vOffset);

  // Don't render cards that are structurally far away
  if (Math.abs(offset) > 2) return { display: 'none' };
  // Fade out cards that drift too far due to drag
  if (absV > 2.8) return { opacity: 0, pointerEvents: 'none', transition: 'none' };

  const opacity = absV >= 2 ? Math.max(0, 0.45 - (absV - 2) * 0.45)
    : absV >= 1 ? 0.45 + (2 - absV) * 0.3
    : 1 - absV * 0.25;

  return {
    transform: `perspective(900px) rotateY(${vOffset * 18}deg) scale(${1 - absV * 0.12}) translateX(${vOffset * 62}%)`,
    opacity: Math.max(0, Math.min(1, opacity)),
    zIndex: Math.max(1, 20 - Math.round(absV)),
    // No transition while dragging (cards must follow finger instantly)
    // Re-enable on release so the snap/fly animates smoothly
    transition: dragFrac !== 0
      ? 'opacity 60ms'
      : `all ${transitionMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
  };
}

export default function PlayerCarousel({ players, activeIndex, onChangeIndex, onSelect }) {
  const dragStartX = useRef(null);
  const dragStartTime = useRef(null);
  const isDragging = useRef(false);
  const isAnimating = useRef(false);

  const [dragFrac, setDragFrac] = useState(0);   // live drag fraction (-1..1)
  const [transitionMs, setTransitionMs] = useState(350);
  const [flipped, setFlipped] = useState(false);
  const [statsCache, setStatsCache] = useState({});
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => { setFlipped(false); }, [activeIndex]);

  function prev() { if (activeIndex > 0) { haptic(); onChangeIndex(activeIndex - 1); } }
  function next() { if (activeIndex < players.length - 1) { haptic(); onChangeIndex(activeIndex + 1); } }

  // Fly-through: rapidly step through cards with haptic on each step
  const flyToIndex = useCallback((startIdx, targetIdx) => {
    const steps = Math.abs(targetIdx - startIdx);
    if (steps === 0) return;
    const direction = targetIdx > startIdx ? 1 : -1;
    isAnimating.current = true;

    const baseInterval = Math.max(30, Math.min(110, 190 / steps));
    setTransitionMs(Math.max(35, baseInterval * 0.7));

    let i = 1;
    function tick() {
      haptic(6);
      onChangeIndex(startIdx + direction * i);
      i++;
      if (i <= steps) {
        // Ease: constant speed through middle, slightly slower toward end
        const progress = i / steps;
        const ease = progress < 0.65 ? 1 : 1 + (progress - 0.65) * 2.2;
        setTimeout(tick, baseInterval * ease);
      } else {
        isAnimating.current = false;
        setTransitionMs(350);
      }
    }
    setTimeout(tick, baseInterval * 0.4);
  }, [onChangeIndex]);

  async function flipActive(playerId) {
    if (flipped) { setFlipped(false); return; }
    if (statsCache[playerId] === undefined) {
      setLoadingStats(true);
      try {
        const stats = await playerService.getCareerStats(playerId);
        setStatsCache(prev => ({ ...prev, [playerId]: stats || null }));
      } catch {
        setStatsCache(prev => ({ ...prev, [playerId]: null }));
      } finally {
        setLoadingStats(false);
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

    // Convert pixel delta to card-fraction offset
    // Negative because dragging left (negative delta) = moving toward next card (positive vOffset)
    let frac = -delta / CARD_SPACING_PX;

    // Rubber-band resistance past ±0.65 cards
    const THRESHOLD = 0.65;
    if (Math.abs(frac) > THRESHOLD) {
      const sign = frac > 0 ? 1 : -1;
      frac = sign * (THRESHOLD + (Math.abs(frac) - THRESHOLD) * 0.25);
    }

    // Clamp at edges (can't drag past first/last player)
    if (activeIndex === 0 && frac < 0) frac = frac * 0.2;
    if (activeIndex === players.length - 1 && frac > 0) frac = frac * 0.2;

    setDragFrac(frac);
  }

  function handlePointerUp(e) {
    if (dragStartX.current === null) return;
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
    const delta = x - dragStartX.current;
    const elapsed = Math.max(1, Date.now() - (dragStartTime.current ?? Date.now()));

    // Reset drag fraction first — the snap animation will kick in
    setDragFrac(0);

    if (Math.abs(delta) > 30) {
      const velocity = Math.abs(delta) / elapsed; // px/ms
      const direction = delta < 0 ? 1 : -1;

      let skip;
      if (velocity >= 2.0)      skip = Math.min(players.length - 1, Math.round(velocity * 5));
      else if (velocity >= 1.2) skip = Math.min(6, Math.round(velocity * 3));
      else if (velocity >= 0.6) skip = 2;
      else                      skip = 1;

      const targetIdx = Math.max(0, Math.min(players.length - 1, activeIndex + direction * skip));

      if (skip <= 1 || Math.abs(targetIdx - activeIndex) <= 1) {
        haptic();
        onChangeIndex(targetIdx);
      } else {
        flyToIndex(activeIndex, targetIdx);
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
    if (offset !== 0) { haptic(); onChangeIndex(activeIndex + offset); return; }
    flipActive(playerId);
  }

  if (!players.length) return null;

  const showDots = players.length > 1;
  const maxDots = 7;

  return (
    <div className="select-none">
      {/* Card stage */}
      <div
        className="relative h-52 flex items-center justify-center"
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
          const offset = idx - activeIndex;
          if (Math.abs(offset) > 2) return null;
          const isActive = offset === 0;
          const stats = statsCache[player.id];

          return (
            <div
              key={player.id}
              onClick={() => handleCardClick(offset, player.id)}
              style={getCardStyle(offset, dragFrac, transitionMs)}
              className="absolute w-36 h-48 rounded-2xl overflow-hidden shadow-lg cursor-pointer"
            >
              {/* Flip inner wrapper */}
              <div
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isActive && flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                {/* Front face */}
                <div
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  className="absolute inset-0 flex flex-col"
                >
                  <div className="h-28 bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center relative">
                    <div className="ring-4 ring-white/30 rounded-full">
                      <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={72} />
                    </div>
                    {!player.is_active && (
                      <span className="absolute top-2 right-2 text-[9px] font-bold bg-black/40 text-white px-1.5 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="h-20 bg-white dark:bg-gray-900 flex flex-col items-center justify-center px-2 gap-1">
                    <p className="text-xs font-bold text-ink-900 dark:text-white text-center leading-tight line-clamp-2 w-full">
                      {player.name}
                    </p>
                    {player.role && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[player.role] || 'bg-ink-100 text-ink-500'}`}>
                        {ROLE_LABELS[player.role] || player.role}
                      </span>
                    )}
                  </div>
                </div>

                {/* Back face */}
                <div
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-green to-brand-teal flex flex-col p-3"
                >
                  {loadingStats && isActive ? (
                    <div className="flex-1 flex items-center justify-center text-white/70 text-xs animate-pulse">Loading…</div>
                  ) : (
                    <>
                      <p className="text-white font-bold text-[11px] leading-tight truncate text-center mb-2">{player.name}</p>
                      <div className="flex-1 flex flex-col justify-center gap-1.5">
                        {[
                          { label: 'Runs', value: stats?.bat_runs },
                          { label: 'Wickets', value: stats?.bowl_wickets },
                          { label: 'Matches', value: stats?.bat_matches },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between bg-white/15 rounded-lg px-2.5 py-1">
                            <span className="text-white/75 text-[10px]">{label}</span>
                            <span className="text-white font-bold text-sm">{value ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); onSelect(player.id); }}
                        className="mt-2.5 w-full text-[11px] font-bold bg-white text-brand-green py-1.5 rounded-xl shadow"
                      >
                        View Profile →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Chevron buttons */}
        {activeIndex > 0 && (
          <button
            onClick={prev}
            className="absolute left-0 z-30 p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 shadow text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {activeIndex < players.length - 1 && (
          <button
            onClick={next}
            className="absolute right-0 z-30 p-1.5 rounded-full bg-white/80 dark:bg-gray-800/80 shadow text-ink-500 hover:text-ink-900 dark:hover:text-white transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* Dot indicators */}
      {showDots && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {players.length <= maxDots ? (
            players.map((_, i) => (
              <button
                key={i}
                onClick={() => { haptic(); onChangeIndex(i); }}
                className={`rounded-full transition-all duration-300 ${
                  i === activeIndex
                    ? 'w-4 h-1.5 bg-brand-green'
                    : 'w-1.5 h-1.5 bg-ink-200 dark:bg-white/20 hover:bg-ink-300'
                }`}
              />
            ))
          ) : (
            <span className="text-xs text-ink-400 tabular-nums">
              {activeIndex + 1} / {players.length}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

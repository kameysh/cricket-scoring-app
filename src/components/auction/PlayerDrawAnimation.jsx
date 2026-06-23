import { useState, useEffect, useRef } from 'react';
import PlayerAvatar from '../player/PlayerAvatar';
import { displayName } from '../../lib/cricketUtils';

const FAST_MS = 80;
const SLOW_STEPS = [160, 250, 370, 510, 680];
const MIN_SPIN_MS = 1600;

export default function PlayerDrawAnimation({ poolPlayers, winner, onComplete }) {
  const list = useRef([...poolPlayers].sort(() => Math.random() - 0.5));
  const startTime = useRef(Date.now());
  const winnerHandled = useRef(false);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('spinning'); // 'spinning' | 'slowing' | 'done'
  const [revealed, setRevealed] = useState(false);

  const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch {} };

  // Fast spin
  useEffect(() => {
    if (phase !== 'spinning') return;
    const iv = setInterval(() => {
      setIdx(i => (i + 1) % list.current.length);
      vibrate(18);
    }, FAST_MS);
    return () => clearInterval(iv);
  }, [phase]);

  // Transition to slowdown once winner is known + minimum spin time elapsed
  useEffect(() => {
    if (!winner || phase !== 'spinning' || winnerHandled.current) return;
    winnerHandled.current = true;
    const elapsed = Date.now() - startTime.current;
    const wait = Math.max(0, MIN_SPIN_MS - elapsed);
    setTimeout(() => setPhase('slowing'), wait);
  }, [winner, phase]);

  // Slow-down ticks then reveal — haptic pulses get heavier as it decelerates
  useEffect(() => {
    if (phase !== 'slowing') return;
    const hapticPulses = [25, 35, 50, 70, 90];
    let step = 0;
    function tick() {
      setIdx(i => (i + 1) % list.current.length);
      vibrate(hapticPulses[step] ?? 90);
      step++;
      if (step < SLOW_STEPS.length) {
        setTimeout(tick, SLOW_STEPS[step]);
      } else {
        setPhase('done');
      }
    }
    setTimeout(tick, SLOW_STEPS[0]);
  }, [phase]);

  // Reveal winner — strong double-buzz on selection
  useEffect(() => {
    if (phase !== 'done' || !winner) return;
    const t1 = setTimeout(() => {
      vibrate([100, 60, 180]);
      setRevealed(true);
      const t2 = setTimeout(onComplete, 1000);
      return () => clearTimeout(t2);
    }, 80);
    return () => clearTimeout(t1);
  }, [phase, winner, onComplete]);

  const spinning = phase === 'spinning';
  const slowing = phase === 'slowing';
  const displayAp = revealed && winner ? winner : list.current[idx % Math.max(list.current.length, 1)];
  const displayPlayer = displayAp?.player ?? displayAp;

  return (
    <div
      className="overflow-hidden rounded-2xl relative"
      style={{
        background: revealed
          ? 'linear-gradient(160deg, #064e3b 0%, #065f46 40%, #047857 100%)'
          : 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        transition: 'background 0.8s ease',
        boxShadow: revealed
          ? '0 0 40px rgba(16,185,129,0.35), 0 4px 24px rgba(0,0,0,0.5)'
          : '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Animated radial glow behind the content */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: revealed
            ? 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(16,185,129,0.25) 0%, transparent 70%)'
            : spinning
              ? 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 70%)'
              : 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,158,11,0.18) 0%, transparent 70%)',
          transition: 'background 0.5s ease',
        }}
      />

      {/* Top scanline strip */}
      <div
        className="px-4 py-2 text-center relative z-10 border-b"
        style={{ borderColor: revealed ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.25)' }}
      >
        <p
          className="text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ color: revealed ? '#6ee7b7' : spinning ? '#a5b4fc' : '#fcd34d' }}
        >
          {revealed ? '🎉 Player Selected!' : spinning ? '🎲 Drawing…' : '⏳ Locking in…'}
        </p>
      </div>

      {/* Player slot */}
      <div className="relative flex flex-col items-center justify-center px-4 py-6 min-h-[160px] z-10">
        {/* Top + bottom gradient fade for reel illusion */}
        {!revealed && (
          <>
            <div
              className="absolute inset-x-0 top-0 h-12 pointer-events-none z-20"
              style={{ background: 'linear-gradient(to bottom, #0f172a, transparent)' }}
            />
            <div
              className="absolute inset-x-0 bottom-0 h-12 pointer-events-none z-20"
              style={{ background: 'linear-gradient(to top, #0f172a, transparent)' }}
            />
          </>
        )}

        {/* Avatar + name — keyed to trigger re-animation on change */}
        <div
          key={`${displayName(displayPlayer)}-${idx}`}
          className={`flex flex-col items-center gap-2.5 relative z-10 ${
            spinning ? 'animate-[draw-roll_0.08s_ease-out]' : revealed ? 'animate-[draw-land_0.5s_cubic-bezier(0.34,1.56,0.64,1)_forwards]' : ''
          }`}
        >
          {/* Avatar with glow ring */}
          <div
            className="rounded-full p-0.5 transition-all duration-500"
            style={{
              background: revealed
                ? 'linear-gradient(135deg, #34d399, #059669)'
                : slowing
                  ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: revealed
                ? '0 0 20px rgba(52,211,153,0.6)'
                : slowing
                  ? '0 0 16px rgba(251,191,36,0.5)'
                  : '0 0 12px rgba(99,102,241,0.4)',
            }}
          >
            <div className="rounded-full overflow-hidden" style={{ width: 72, height: 72 }}>
              <PlayerAvatar name={displayPlayer?.name} photoUrl={displayPlayer?.photo_url} size={72} />
            </div>
          </div>

          {/* Name + role */}
          <div className="text-center">
            <p
              className={`font-extrabold text-lg leading-tight transition-all duration-300 ${spinning ? 'opacity-70' : 'opacity-100'}`}
              style={{ color: revealed ? '#ecfdf5' : '#f8fafc' }}
            >
              {displayName(displayPlayer) || '…'}
            </p>
            {displayPlayer?.role && (
              <p
                className="text-[11px] capitalize mt-0.5 font-medium"
                style={{ color: revealed ? '#6ee7b7' : '#94a3b8' }}
              >
                {displayPlayer.role}
              </p>
            )}
            {revealed && displayAp?.base_price && (
              <p className="text-[12px] mt-1.5 font-semibold" style={{ color: '#a7f3d0' }}>
                Base ₹{displayAp.base_price.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="pb-3 pt-1 text-center relative z-10 border-t"
        style={{ borderColor: revealed ? 'rgba(52,211,153,0.3)' : 'rgba(99,102,241,0.2)' }}
      >
        {revealed ? (
          <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse" style={{ color: '#34d399' }}>
            Opening bidding…
          </p>
        ) : (
          <p className="text-[10px]" style={{ color: '#475569' }}>
            {poolPlayers.length} player{poolPlayers.length !== 1 ? 's' : ''} in pool
          </p>
        )}
      </div>
    </div>
  );
}

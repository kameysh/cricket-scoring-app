import { useState, useEffect, useRef } from 'react';

const ROLE_COLORS = {
  batsman:       'bg-blue-500/20 text-blue-200',
  bowler:        'bg-red-500/20 text-red-200',
  'all-rounder': 'bg-purple-500/20 text-purple-200',
  allrounder:    'bg-purple-500/20 text-purple-200',
  keeper:        'bg-amber-500/20 text-amber-200',
  wicket_keeper: 'bg-amber-500/20 text-amber-200',
};

const ROLE_LABEL = {
  batsman: 'Batsman 🏏',
  bowler: 'Bowler 🎳',
  'all-rounder': 'All-rounder ⚡',
  allrounder: 'All-rounder ⚡',
  keeper: 'Keeper 🧤',
  wicket_keeper: 'Wicket Keeper 🧤',
};

function fmt1(n) { return n != null && isFinite(n) && n > 0 ? n.toFixed(1) : '—'; }

// Viewport-aware card height: tall enough to show the face, short enough to leave
// room for bid controls without scrolling on a typical phone.
function getCardH() {
  if (typeof window === 'undefined') return 400;
  // ~42% of viewport height, clamped between 300px and 420px
  return Math.min(420, Math.max(300, Math.round(window.innerHeight * 0.42)));
}

export default function ActivePlayerSpotlight({ player, leadingTeam, careerStats, onViewProfile }) {
  const [flipped, setFlipped] = useState(false);
  const [cardH, setCardH] = useState(getCardH);
  const prevIdRef = useRef(null);

  useEffect(() => {
    function onResize() { setCardH(getCardH()); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Reset flip whenever a new player comes on stage
  useEffect(() => {
    if (player?.id && player.id !== prevIdRef.current) {
      prevIdRef.current = player.id;
      setFlipped(false);
    }
  }, [player?.id]);

  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-3 py-12 card">
        <p className="text-5xl">🏏</p>
        <p className="text-sm text-ink-400">Waiting for auctioneer to call next player…</p>
      </div>
    );
  }

  const p = player.player;
  const hasBid = player.current_bid != null;
  const bidAmount = player.current_bid ?? player.base_price;
  const photoUrl = p?.photo_url ?? null;

  // Career stat derived values
  const runs    = careerStats?.bat_runs ?? null;
  const wickets = careerStats?.bowl_wickets ?? null;
  const matches = careerStats?.matches_played ?? null;
  const batAvg  = careerStats?.bat_innings > (careerStats?.bat_not_outs ?? 0)
    ? fmt1(careerStats.bat_runs / (careerStats.bat_innings - careerStats.bat_not_outs)) : '—';
  const batSR   = careerStats?.bat_balls > 0
    ? fmt1((careerStats.bat_runs / careerStats.bat_balls) * 100) : '—';
  const batHS   = careerStats?.bat_highest_score ?? '—';
  const bowlAvg = careerStats?.bowl_wickets > 0
    ? fmt1(careerStats.bowl_runs / careerStats.bowl_wickets) : '—';
  const bowlEco = careerStats?.bowl_legal_balls > 0
    ? fmt1((careerStats.bowl_runs / careerStats.bowl_legal_balls) * 6) : '—';
  const bowlBest = careerStats?.bowl_best_wickets > 0
    ? `${careerStats.bowl_best_wickets}/${careerStats.bowl_best_runs}` : '—';

  const styleStr = [
    p?.batting_style?.replace('-hand', ''),
    p?.bowling_style?.replace(/-/g, ' '),
  ].filter(Boolean).join(' · ');

  return (
    <div
      className="w-full"
      style={{ height: cardH, perspective: '1200px' }}
    >
      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          position: 'relative',
          cursor: 'pointer',
        }}
      >

        {/* ── FRONT FACE — full-bleed photo ── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={p?.name}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-green to-brand-teal" />
          )}

          {/* Dark vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />

          {/* Top badges */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            {p?.role && (
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-sm ${ROLE_COLORS[p.role] ?? 'bg-white/20 text-white'}`}>
                {ROLE_LABEL[p.role] ?? p.role}
              </span>
            )}
            <span className="text-[9px] font-semibold bg-black/30 backdrop-blur-sm text-white/70 rounded-full px-2 py-0.5 ml-auto">
              Tap for stats
            </span>
          </div>

          {/* Initials fallback when no photo */}
          {!photoUrl && (
            <div className="absolute inset-0 flex items-center justify-center pb-24">
              <div
                className="rounded-full bg-white/20 flex items-center justify-center text-white font-extrabold shadow-lg"
                style={{ width: 90, height: 90, fontSize: 34 }}
              >
                {(p?.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            </div>
          )}

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 space-y-1.5">
            <p className="text-white font-extrabold text-xl leading-tight drop-shadow-md">
              {p?.name || '—'}
            </p>
            {styleStr && (
              <p className="text-white/55 text-[11px] capitalize">{styleStr}</p>
            )}

            {/* Quick stats */}
            <div className="flex gap-4 pt-0.5">
              {[
                { label: 'RUNS', value: runs },
                { label: 'WKTS', value: wickets },
                { label: 'M', value: matches },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col items-center gap-0">
                  <span className="text-white font-extrabold text-base tabular-nums leading-none">{value ?? '—'}</span>
                  <span className="text-white/45 text-[9px] font-semibold uppercase tracking-wider">{label}</span>
                </div>
              ))}
            </div>

            {/* Bid row */}
            <div className="border-t border-white/20 pt-2 flex items-end justify-between">
              <div>
                <p className="text-white/50 text-[9px] font-semibold uppercase tracking-wider">
                  {hasBid ? 'Current Bid' : 'Base Price'}
                </p>
                <p className="text-white font-extrabold text-2xl tabular-nums leading-tight">
                  ₹{bidAmount?.toLocaleString()}
                </p>
                {leadingTeam
                  ? <p className="text-brand-green text-[11px] font-semibold">{leadingTeam.name}</p>
                  : <p className="text-white/40 text-[11px]">No bids yet</p>
                }
              </div>
              <span className={`text-[9px] font-semibold border rounded-full px-2 py-0.5 ${
                hasBid && leadingTeam
                  ? 'text-brand-green border-brand-green/40 bg-brand-green/10'
                  : 'text-white/40 border-white/20'
              }`}>
                {hasBid ? 'Leading' : 'Opening'}
              </span>
            </div>
          </div>
        </div>

        {/* ── BACK FACE — stats ── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
          }}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-2.5 border-b border-white/10 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white font-extrabold text-base leading-tight truncate">{p?.name || '—'}</p>
              {p?.role && (
                <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[p.role] ?? 'bg-white/20 text-white'}`}>
                  {ROLE_LABEL[p.role] ?? p.role}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-white/40 text-[9px] uppercase tracking-wider">{hasBid ? 'Bid' : 'Base'}</p>
              <p className="text-brand-green font-extrabold text-lg tabular-nums leading-tight">
                ₹{bidAmount?.toLocaleString()}
              </p>
              {leadingTeam && (
                <p className="text-white/50 text-[10px] leading-tight">{leadingTeam.name}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 px-4 py-3 space-y-3 overflow-hidden">
            <div>
              <p className="text-[10px] font-bold text-brand-green uppercase tracking-widest mb-1.5">🏏 Batting</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Avg', value: batAvg },
                  { label: 'SR', value: batSR },
                  { label: 'HS', value: batHS },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl px-2 py-2 flex flex-col items-center gap-0.5">
                    <span className="text-white font-extrabold text-base tabular-nums leading-none">{value}</span>
                    <span className="text-white/40 text-[9px] font-semibold uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1.5">🎳 Bowling</p>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: 'Avg', value: bowlAvg },
                  { label: 'Eco', value: bowlEco },
                  { label: 'Best', value: bowlBest },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/5 rounded-xl px-2 py-2 flex flex-col items-center gap-0.5">
                    <span className="text-white font-extrabold text-base tabular-nums leading-none">{value}</span>
                    <span className="text-white/40 text-[9px] font-semibold uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2">
              <span className="text-white/50 text-xs font-semibold">Matches Played</span>
              <span className="text-white font-extrabold tabular-nums text-sm">{matches ?? '—'}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 pb-4 flex items-center justify-between">
            <p className="text-white/25 text-[10px]">Tap to flip back</p>
            {onViewProfile && (
              <button
                onClick={e => { e.stopPropagation(); onViewProfile(); }}
                className="px-3 py-1.5 rounded-xl bg-brand-green text-white text-xs font-bold hover:opacity-90"
              >
                View Profile →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

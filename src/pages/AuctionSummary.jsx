import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import * as auctionService from '../services/auctionService';
import PlayerAvatar from '../components/player/PlayerAvatar';

function StatChip({ label, value }) {
  return (
    <div className="flex flex-col items-center bg-ink-50 dark:bg-white/5 rounded-xl px-4 py-3 gap-0.5">
      <span className="text-base font-extrabold text-ink-900 dark:text-white tabular-nums">{value}</span>
      <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function AuctionSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      auctionService.getAuction(id),
      auctionService.listAuctionTeams(id),
      auctionService.listAuctionPlayers(id),
    ])
      .then(([a, t, p]) => { setAuction(a); setTeams(t); setPlayers(p); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4"><p className="text-center py-12 text-ink-400">Loading…</p></div>;

  if (error || !auction) {
    return (
      <div className="p-4 space-y-4">
        <button onClick={() => navigate('/auctions')} className="flex items-center gap-2 text-sm text-ink-500">
          <ArrowLeft size={16} /> Back to Auctions
        </button>
        <div className="card p-6 text-center space-y-2">
          <p className="text-2xl">⚠️</p>
          <p className="font-semibold text-ink-700 dark:text-ink-200">Auction not found</p>
        </div>
      </div>
    );
  }

  const soldPlayers  = players.filter(p => p.status === 'sold');
  const unsoldPlayers = players.filter(p => p.status === 'unsold');

  const captainUserIds = new Set(teams.map(t => t.captain_id).filter(Boolean));
  const isCaptain = (ap) => !!(ap.player?.user_id && captainUserIds.has(ap.player.user_id));

  const totalSpent = soldPlayers.reduce((s, ap) => s + (ap.sold_price ?? 0), 0);
  const topDeal = soldPlayers
    .filter(ap => !isCaptain(ap))
    .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0))[0] ?? null;

  const soldAt = auction.completed_at
    ? new Date(auction.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="p-4 pb-24 space-y-5 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3 pt-safe">
        <button onClick={() => navigate('/auctions')} className="p-2 rounded-xl bg-ink-100 dark:bg-white/10 shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink-900 dark:text-white truncate">{auction.name}</p>
          {soldAt && <p className="text-[11px] text-ink-400">Completed {soldAt}</p>}
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-400 shrink-0">
          🏁 Completed
        </span>
      </div>

      {/* Top stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <StatChip label="Teams" value={teams.length} />
        <StatChip label="Sold" value={soldPlayers.length} />
        <StatChip label="Total Spent" value={`₹${totalSpent.toLocaleString()}`} />
      </div>

      {/* Top deal hero */}
      {topDeal && (() => {
        const heroTeam = teams.find(t => t.id === topDeal.sold_to_team_id);
        return (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)' }}>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">👑 Highest Bid</p>
            </div>
            <div className="flex items-center gap-3 px-4 pb-4">
              <PlayerAvatar player={topDeal.player} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-extrabold text-base leading-tight truncate">{topDeal.player?.name}</p>
                <p className="text-amber-300 text-[11px] capitalize">{topDeal.player?.role}</p>
                {heroTeam && <p className="text-amber-200 text-[11px] mt-0.5 truncate">→ {heroTeam.name}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-amber-300 text-[10px] font-semibold">SOLD FOR</p>
                <p className="text-white font-extrabold text-xl tabular-nums">₹{topDeal.sold_price?.toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Per-team squads */}
      {teams.map(t => {
        const squad = soldPlayers
          .filter(ap => ap.sold_to_team_id === t.id)
          .sort((a, b) => (b.sold_price ?? 0) - (a.sold_price ?? 0));
        const spent = squad.reduce((s, ap) => s + (ap.sold_price ?? 0), 0);
        const remaining = (t.budget_remaining ?? 0);

        return (
          <div key={t.id} className="card overflow-hidden">
            {/* Team header */}
            <div className="px-4 py-3 border-b border-ink-100 dark:border-white/10 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-bold text-ink-900 dark:text-white truncate">{t.name}</p>
                <p className="text-[11px] text-ink-400">{squad.length} player{squad.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-brand-green tabular-nums">₹{spent.toLocaleString()} spent</p>
                <p className="text-[11px] text-ink-400 tabular-nums">₹{remaining.toLocaleString()} left</p>
              </div>
            </div>

            {/* Squad list */}
            {squad.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-4">No players bought</p>
            ) : (
              <div className="divide-y divide-ink-50 dark:divide-white/5">
                {squad.map((ap, i) => {
                  const cap = isCaptain(ap);
                  return (
                    <div key={ap.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="w-5 text-center text-xs font-bold tabular-nums text-ink-300">#{i + 1}</span>
                      <PlayerAvatar player={ap.player} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                          {cap && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">(C)</span>}
                        </div>
                        <p className="text-[11px] text-ink-400 capitalize">{ap.player?.role}</p>
                      </div>
                      <span className="text-sm font-bold text-brand-green tabular-nums shrink-0">
                        ₹{ap.sold_price?.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Unsold players */}
      {unsoldPlayers.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-ink-100 dark:border-white/10">
            <p className="font-bold text-ink-900 dark:text-white">Unsold Players</p>
            <p className="text-[11px] text-ink-400">{unsoldPlayers.length} player{unsoldPlayers.length !== 1 ? 's' : ''} went unsold</p>
          </div>
          <div className="divide-y divide-ink-50 dark:divide-white/5">
            {unsoldPlayers.map(ap => (
              <div key={ap.id} className="flex items-center gap-3 px-4 py-2.5">
                <PlayerAvatar player={ap.player} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
                  <p className="text-[11px] text-ink-400 capitalize">{ap.player?.role}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-ink-100 dark:bg-white/10 text-ink-400">Unsold</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

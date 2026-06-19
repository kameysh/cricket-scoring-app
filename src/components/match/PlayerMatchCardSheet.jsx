import { useRef, useState } from 'react';
import { Share2, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import BottomSheet from '../shared/BottomSheet';
import BatterSRChart from '../player/BatterSRChart';
import { calcStrikeRate, calcEconomy, formatOvers, fmt } from '../../lib/cricketUtils';

function roleLabel(role) {
  if (!role) return '';
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function dismissalLabel(dis) {
  if (!dis) return 'Not Out';
  switch (dis.type) {
    case 'bowled':      return `b ${dis.bowlerName}`.trim();
    case 'caught':      return `c ${dis.fielderName} b ${dis.bowlerName}`.trim();
    case 'lbw':         return `lbw b ${dis.bowlerName}`.trim();
    case 'run_out':     return `run out${dis.fielderName ? ` (${dis.fielderName})` : ''}`;
    case 'stumped':     return `st ${dis.fielderName} b ${dis.bowlerName}`.trim();
    case 'hit_wicket':  return `hit wkt b ${dis.bowlerName}`.trim();
    case 'retired_hurt': return 'Retired Hurt';
    case 'retired_out':  return 'Retired Out';
    default: return dis.type?.replace(/_/g, ' ') || 'Out';
  }
}

// Stat column used inside batting/bowling sections
function StatCol({ label, value }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
      <p style={{ fontSize: '28px', fontWeight: 900, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</p>
      <p style={{ fontSize: '10px', fontWeight: 600, opacity: 0.55, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
    </div>
  );
}

// The actual share card — rendered off-screen for html2canvas AND as inline preview
function PerformanceCard({ player, match, inningsList, batStats, dismissal, bowlStats, bowlMaidens }) {
  const inn1 = inningsList[0];
  const inn2 = inningsList[1];
  const sr = batStats?.balls > 0 ? fmt(calcStrikeRate(batStats.runs, batStats.balls)) : '—';
  const econ = bowlStats?.legal_balls > 0 ? fmt(calcEconomy(bowlStats.runs, bowlStats.legal_balls)) : '—';
  const hasBowled = bowlStats && bowlStats.legal_balls > 0;
  const initials = (player.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const section = {
    margin: '0 16px 10px',
    background: 'rgba(0,0,0,0.18)',
    borderRadius: '14px',
    padding: '12px 16px',
  };
  const sectionLabel = {
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', opacity: 0.55, margin: '0 0 10px',
  };
  const divider = {
    height: '1px', background: 'rgba(255,255,255,0.15)', margin: '10px 0',
  };

  return (
    <div
      style={{
        width: '360px',
        height: '640px',
        background: 'linear-gradient(160deg, #166534 0%, #0f766e 45%, #1e3a8a 100%)',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '16px',
      }}
    >
      {/* Header strip */}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.02em' }}>🏏 Cricket Scorer</span>
        <span style={{ fontSize: '10px', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Performance</span>
      </div>

      {/* Player identity */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px 12px', gap: '14px' }}>
        <div style={{
          width: '68px', height: '68px', borderRadius: '50%', flexShrink: 0,
          overflow: 'hidden', background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2.5px solid rgba(255,255,255,0.5)',
        }}>
          {player.photo_url
            ? <img src={player.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            : <span style={{ fontSize: '24px', fontWeight: 800 }}>{initials}</span>
          }
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '22px', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>{player.name}</p>
          <p style={{ fontSize: '11px', opacity: 0.55, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{roleLabel(player.role)}</p>
        </div>
      </div>

      {/* Match context */}
      <div style={{ ...section, padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Team 1 */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '11px', fontWeight: 600, opacity: 0.6, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.team1_name}</p>
            <p style={{ fontSize: '20px', fontWeight: 900, margin: 0, lineHeight: 1 }}>{inn1?.total_runs ?? '—'}/{inn1?.total_wickets ?? '—'}</p>
            <p style={{ fontSize: '10px', opacity: 0.45, marginTop: '2px' }}>{inn1 ? `(${formatOvers(inn1.total_legal_balls)} ov)` : ''}</p>
          </div>
          {/* VS divider */}
          <div style={{ padding: '0 12px', textAlign: 'center' }}>
            <p style={{ fontSize: '11px', fontWeight: 900, opacity: 0.4, margin: 0 }}>VS</p>
          </div>
          {/* Team 2 */}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, opacity: 0.6, margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.team2_name}</p>
            <p style={{ fontSize: '20px', fontWeight: 900, margin: 0, lineHeight: 1 }}>{inn2 ? `${inn2.total_runs}/${inn2.total_wickets}` : '—'}</p>
            <p style={{ fontSize: '10px', opacity: 0.45, marginTop: '2px' }}>{inn2 ? `(${formatOvers(inn2.total_legal_balls)} ov)` : ''}</p>
          </div>
        </div>
        {match.result_summary && (
          <>
            <div style={divider} />
            <p style={{ fontSize: '11px', textAlign: 'center', opacity: 0.65, margin: 0 }}>
              {match.result_summary}
            </p>
          </>
        )}
      </div>

      {/* Batting stats */}
      {batStats && (
        <div style={section}>
          <p style={sectionLabel}>🏏 Batting</p>
          <div style={{ display: 'flex', margin: '0 -4px 10px' }}>
            <StatCol label="Runs" value={batStats.runs} />
            <StatCol label="Balls" value={batStats.balls} />
            <StatCol label="4s" value={batStats.fours} />
            <StatCol label="6s" value={batStats.sixes} />
          </div>
          <div style={divider} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
            <span style={{ opacity: 0.65 }}>{dismissalLabel(dismissal)}</span>
            <span style={{ fontWeight: 700, fontSize: '13px' }}>SR {sr}</span>
          </div>
        </div>
      )}

      {/* Bowling stats */}
      {hasBowled && (
        <div style={section}>
          <p style={sectionLabel}>🎳 Bowling</p>
          <div style={{ display: 'flex', margin: '0 -4px 10px' }}>
            <StatCol label="Overs" value={formatOvers(bowlStats.legal_balls)} />
            <StatCol label="Mdns" value={bowlMaidens} />
            <StatCol label="Runs" value={bowlStats.runs} />
            <StatCol label="Wkts" value={bowlStats.wickets} />
          </div>
          <div style={divider} />
          <p style={{ fontSize: '13px', fontWeight: 700, textAlign: 'right', margin: 0 }}>Econ {econ}</p>
        </div>
      )}

      {/* Watermark */}
      <div style={{ marginTop: 'auto', textAlign: 'center', padding: '6px 16px 12px', opacity: 0.3, fontSize: '10px', letterSpacing: '0.04em' }}>
        🏏 Cricket Scoring App
      </div>
    </div>
  );
}

export default function PlayerMatchCardSheet({ open, onClose, player, match, inningsList, batStats, dismissal, bowlStats, bowlMaidens, deliveries }) {
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [srOpen, setSrOpen] = useState(false);

  async function shareCard() {
    if (sharing) return;
    setSharing(true);
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          s.onload = resolve;
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      const canvas = await window.html2canvas(cardRef.current, { useCORS: true, scale: 3, backgroundColor: null });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
      const fileName = `${(player.name || 'player').replace(/\s+/g, '-')}-performance.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `${player.name}'s performance` });
          return;
        } catch { /* user cancelled — fall through */ }
      }
      if (navigator.clipboard?.write) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Copied to clipboard!');
          return;
        } catch { /* permission denied — fall through */ }
      }
      const link = document.createElement('a');
      link.download = fileName;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Could not generate share image');
    } finally {
      setSharing(false);
    }
  }

  if (!open) return null;

  // Scale: preview fits within ~330px width → 330/360 ≈ 0.9 but 640*0.9=576 is still tall.
  // Use 0.72 → 259px wide, 461px tall — comfortable in an 85vh sheet.
  const SCALE = 0.72;
  const PREVIEW_H = Math.round(640 * SCALE); // 461px

  const cardProps = { player, match, inningsList, batStats, dismissal, bowlStats, bowlMaidens };

  return (
    <>
      {/* Off-screen card for html2canvas capture */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <div ref={cardRef}>
          <PerformanceCard {...cardProps} />
        </div>
      </div>

      <BottomSheet open onClose={onClose} title={`${player.name} — Performance`} heightClass="h-[85vh]">
        {/* Scaled preview */}
        <div style={{ height: `${PREVIEW_H}px`, overflow: 'hidden', display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{ width: '360px', transform: `scale(${SCALE})`, transformOrigin: 'top center', flexShrink: 0 }}>
            <PerformanceCard {...cardProps} />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pb-2">
          <button
            onClick={shareCard}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2 bg-brand-green text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-60"
          >
            <Share2 size={16} />
            {sharing ? 'Generating…' : 'Share Performance'}
          </button>
          <button
            onClick={() => setSrOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-ink-50 dark:bg-white/10 text-ink-700 dark:text-white font-medium py-3 rounded-xl text-sm"
          >
            <BarChart2 size={16} />
            View SR Chart
          </button>
        </div>
      </BottomSheet>

      {/* Nested SR Chart sheet */}
      <BottomSheet
        open={srOpen}
        onClose={() => setSrOpen(false)}
        title={`${player.name} — SR by Over`}
        heightClass="h-[50vh]"
      >
        {srOpen && deliveries && (
          <BatterSRChart deliveries={deliveries} batsmanId={player.id} />
        )}
      </BottomSheet>
    </>
  );
}

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

// The actual share card — green top zone + white bottom zone, matching player carousel card style
function PerformanceCard({ player, match, inningsList, batStats, dismissal, bowlStats, bowlMaidens }) {
  const inn1 = inningsList[0];
  const inn2 = inningsList[1];
  const sr = batStats?.balls > 0 ? fmt(calcStrikeRate(batStats.runs, batStats.balls)) : '—';
  const econ = bowlStats?.legal_balls > 0 ? fmt(calcEconomy(bowlStats.runs, bowlStats.legal_balls)) : '—';
  const hasBowled = bowlStats && bowlStats.legal_balls > 0;
  const initials = (player.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Stat cell reused in batting + bowling rows
  const StatCell = ({ label, value, last }) => (
    <div style={{ flex: 1, textAlign: 'center', borderRight: last ? 'none' : '1px solid #e2e8f0' }}>
      <p style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
    </div>
  );

  return (
    <div style={{
      width: '360px', height: '640px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', borderRadius: '24px',
    }}>

      {/* ── GREEN TOP ZONE (avatar + identity) ── */}
      <div style={{
        flex: '0 0 260px',
        background: 'linear-gradient(145deg, #4ade80 0%, #22c55e 30%, #16a34a 70%, #15803d 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', padding: '0 24px 16px',
      }}>
        {/* App label top-left */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.05em' }}>🏏 CRICKET SCORER</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Performance</span>
        </div>

        {/* Avatar */}
        <div style={{
          width: '96px', height: '96px', borderRadius: '50%',
          overflow: 'hidden', background: 'rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '3px solid rgba(255,255,255,0.55)',
          marginBottom: '14px', marginTop: '24px',
        }}>
          {player.photo_url
            ? <img src={player.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            : <span style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>{initials}</span>
          }
        </div>

        {/* Name */}
        <p style={{ fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 0 8px', textAlign: 'center', lineHeight: 1.1 }}>
          {player.name}
        </p>

        {/* Role pill */}
        <div style={{ background: 'rgba(255,255,255,0.22)', borderRadius: '20px', padding: '4px 16px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {roleLabel(player.role) || 'Player'}
          </span>
        </div>
      </div>

      {/* ── WHITE BOTTOM ZONE (stats) ── */}
      <div style={{
        flex: 1, background: '#fff',
        display: 'flex', flexDirection: 'column',
        padding: '16px 20px 14px',
        overflow: 'hidden',
      }}>

        {/* Match scores row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.team1_name}</p>
            <p style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1 }}>{inn1?.total_runs ?? '—'}/{inn1?.total_wickets ?? '—'}</p>
            <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0 0' }}>{inn1 ? `${formatOvers(inn1.total_legal_balls)} ov` : ''}</p>
          </div>
          <p style={{ fontSize: '11px', fontWeight: 800, color: '#cbd5e1', margin: '0 10px' }}>VS</p>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.team2_name}</p>
            <p style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1 }}>{inn2 ? `${inn2.total_runs}/${inn2.total_wickets}` : '—'}</p>
            <p style={{ fontSize: '10px', color: '#94a3b8', margin: '2px 0 0' }}>{inn2 ? `${formatOvers(inn2.total_legal_balls)} ov` : ''}</p>
          </div>
        </div>

        {/* Batting */}
        {batStats && (
          <div style={{ marginBottom: hasBowled ? '12px' : 0 }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>🏏 Batting</p>
            <div style={{ display: 'flex', marginBottom: '8px' }}>
              <StatCell label="Runs" value={batStats.runs} />
              <StatCell label="Balls" value={batStats.balls} />
              <StatCell label="4s" value={batStats.fours} />
              <StatCell label="6s" value={batStats.sixes} />
              <StatCell label="SR" value={sr} last />
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{dismissalLabel(dismissal)}</p>
          </div>
        )}

        {/* Bowling */}
        {hasBowled && (
          <>
            <div style={{ height: '1px', background: '#f1f5f9', margin: '0 0 12px' }} />
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>🎳 Bowling</p>
              <div style={{ display: 'flex' }}>
                <StatCell label="Overs" value={formatOvers(bowlStats.legal_balls)} />
                <StatCell label="Mdns" value={bowlMaidens} />
                <StatCell label="Runs" value={bowlStats.runs} />
                <StatCell label="Wkts" value={bowlStats.wickets} />
                <StatCell label="Econ" value={econ} last />
              </div>
            </div>
          </>
        )}

        {/* Result + watermark */}
        <div style={{ marginTop: 'auto' }}>
          {match.result_summary && (
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', textAlign: 'center', margin: '10px 0 4px' }}>
              {match.result_summary}
            </p>
          )}
          <p style={{ fontSize: '9px', color: '#e2e8f0', textAlign: 'center', margin: 0, letterSpacing: '0.04em' }}>
            🏏 Cricket Scoring App
          </p>
        </div>
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
      const canvas = await window.html2canvas(cardRef.current, { useCORS: true, scale: 3, backgroundColor: null, logging: false, windowWidth: 360, windowHeight: 640 });
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
      {/* Off-screen card for html2canvas capture — portalled to body to avoid inherited transforms */}
      {createPortal(
        <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
          <div ref={cardRef}>
            <PerformanceCard {...cardProps} />
          </div>
        </div>,
        document.body
      )}

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

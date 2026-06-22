import satori from 'satori';
import { formatOvers } from './cricketUtils';

// ── Font cache ────────────────────────────────────────────────────────────────
let _fonts = null;

async function loadFonts() {
  if (_fonts) return _fonts;
  const [regular, bold] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/files/inter-latin-400-normal.woff').then(r => r.arrayBuffer()),
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/inter@5.1.0/files/inter-latin-700-normal.woff').then(r => r.arrayBuffer()),
  ]);
  _fonts = [
    { name: 'Inter', data: regular, weight: 400, style: 'normal' },
    { name: 'Inter', data: bold,    weight: 700, style: 'normal' },
  ];
  return _fonts;
}

// ── Image cache ───────────────────────────────────────────────────────────────
const _photoCache = {};

async function fetchPhotoAsDataUrl(url) {
  if (!url) return null;
  if (_photoCache[url]) return _photoCache[url];
  try {
    const blob = await fetch(url).then(r => r.blob());
    const dataUrl = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
    _photoCache[url] = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────
export function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function calcSR(runs, balls) {
  return balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';
}

export function calcEcon(runs, legalBalls) {
  return legalBalls > 0 ? ((runs / legalBalls) * 6).toFixed(1) : '0.0';
}

export function dismissalText(dismissal) {
  if (!dismissal) return 'Not Out';
  switch (dismissal.type) {
    case 'bowled':       return `b ${dismissal.bowlerName || ''}`.trim();
    case 'caught':       return `c ${dismissal.fielderName || ''} b ${dismissal.bowlerName || ''}`.trim();
    case 'lbw':          return `lbw b ${dismissal.bowlerName || ''}`.trim();
    case 'run_out':      return `run out${dismissal.fielderName ? ` (${dismissal.fielderName})` : ''}`;
    case 'stumped':      return `st ${dismissal.fielderName || ''} b ${dismissal.bowlerName || ''}`.trim();
    case 'hit_wicket':   return `hit wkt b ${dismissal.bowlerName || ''}`.trim();
    case 'retired_hurt': return 'Retired Hurt';
    case 'retired_out':  return 'Retired Out';
    default:             return dismissal.type?.replace(/_/g, ' ') || 'Out';
  }
}

// ── SVG → PNG blob ────────────────────────────────────────────────────────────
function svgToPng(svg, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const GREEN  = '#16a34a';
const GREEN_LIGHT = '#dcfce7';
const GREEN_MID   = '#4ade80';
const TEAL   = '#0d9488';
const SKY    = '#0284c7';
const GOLD   = '#d97706';
const CARD_BG     = '#ffffff';
const SURFACE     = '#f8fafc';
const SURFACE2    = '#f1f5f9';
const INK_900     = '#0f172a';
const INK_600     = '#475569';
const INK_400     = '#94a3b8';
const INK_200     = '#e2e8f0';

// Gold trophy icon as an SVG data URI — Satori has no emoji font, so emoji/star
// glyphs render as tofu; an <img> data URI renders reliably.
const TROPHY_DATA_URL =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d97706"><path d="M18 2H6v2H2v3a4 4 0 0 0 4 4 6 6 0 0 0 5 5.91V20H8v2h8v-2h-3v-3.09A6 6 0 0 0 18 11a4 4 0 0 0 4-4V4h-4V2zM4 7V6h2v3a2 2 0 0 1-2-2zm16 0a2 2 0 0 1-2 2V6h2v1z"/></svg>`
  );

// ── Card JSX ──────────────────────────────────────────────────────────────────
function buildCardElement({ player, match, inningsList, batStats, dismissal, bowlStats, photoDataUrl }) {
  const initials   = getInitials(player.name);
  const hasBowled  = bowlStats && (bowlStats.legal_balls || 0) > 0;
  const inn1       = inningsList?.[0];
  const inn2       = inningsList?.[1];

  // Which team number (1 or 2) is the player on?
  const playerTeamNum = player.team ?? null;

  const teamName = (teamNum) => {
    if (!match || !teamNum) return '';
    return teamNum === 1 ? (match.team1_name || '') : (match.team2_name || '');
  };

  const playerTeamName = teamName(playerTeamNum);

  const winnerName = match?.winning_team_name || null;

  // Which innings did this player bat in? Derive batting_team for inn1/inn2.
  const inn1Team = inn1 ? (inn1.batting_team === 1 ? match?.team1_name : match?.team2_name) : null;
  const inn2Team = inn2 ? (inn2.batting_team === 1 ? match?.team1_name : match?.team2_name) : null;

  const roleLabel = player.role
    ? player.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null;

  const isMotm = !!(match?.man_of_match?.id && player?.id && match.man_of_match.id === player.id);

  // ── Shared sub-components ──────────────────────────────────────────────────

  const Divider = () => (
    <div style={{ display: 'flex', height: 2, background: INK_200, margin: '0 72px' }} />
  );

  // Single stat cell: big number + small label underneath
  // flexShrink:0 is critical — without it Satori shrinks cells and the columns drift
  const StatCell = ({ val, label, color = INK_900, labelColor = INK_400, size = 88, width = 450 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width, flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', fontSize: size, fontWeight: 700, color, lineHeight: '1' }}>
        {String(val)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%', fontSize: 24, color: labelColor, marginTop: 12, letterSpacing: '1px', fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );

  // Section header: coloured left bar + uppercase label
  const SectionLabel = ({ text, color = GREEN }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40 }}>
      <div style={{ display: 'flex', width: 8, height: 44, background: color, borderRadius: 4 }} />
      <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color, letterSpacing: '3px' }}>
        {text}
      </div>
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: 1080, height: 1920,
      background: CARD_BG,
      fontFamily: 'Inter',
    }}>

      {/* ── Top accent band ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '44px 72px',
        background: `linear-gradient(120deg, ${GREEN} 0%, ${TEAL} 100%)`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
            Cricket Scoring
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.7)' }}>
            Player Performance
          </div>
        </div>
        {/* Team badge */}
        {playerTeamName ? (
          <div style={{
            display: 'flex', padding: '14px 36px',
            background: 'rgba(255,255,255,0.18)',
            border: '2px solid rgba(255,255,255,0.45)',
            borderRadius: 100, fontSize: 28, fontWeight: 700, color: '#fff',
          }}>
            {playerTeamName}
          </div>
        ) : null}
      </div>

      {/* ── Player identity ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 52,
        padding: '64px 72px 56px',
        background: SURFACE,
        borderBottom: `2px solid ${INK_200}`,
      }}>
        {/* Avatar */}
        {photoDataUrl ? (
          <img src={photoDataUrl} style={{
            width: 180, height: 180, borderRadius: '50%',
            objectFit: 'cover',
            border: `5px solid ${GREEN}`,
            flexShrink: 0,
          }} />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 180, height: 180, borderRadius: '50%',
            background: `linear-gradient(135deg, ${GREEN} 0%, ${TEAL} 100%)`,
            border: `5px solid ${GREEN_MID}`,
            fontSize: 72, fontWeight: 700, color: '#fff',
            flexShrink: 0,
          }}>
            {initials}
          </div>
        )}

        {/* Name + role + Man of the Match */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, color: INK_900, letterSpacing: '-1px', lineHeight: '1' }}>
            {player.name || ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {roleLabel && (
              <div style={{
                display: 'flex',
                padding: '10px 32px',
                background: GREEN_LIGHT,
                borderRadius: 100, fontSize: 26, fontWeight: 600, color: GREEN,
              }}>
                {roleLabel}
              </div>
            )}
            {isMotm && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 30px',
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: 100, fontSize: 26, fontWeight: 700, color: '#b45309',
              }}>
                <img src={TROPHY_DATA_URL} width={30} height={30} style={{ display: 'flex' }} />
                Man of the Match
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Match scores ──────────────────────────────────────────────────────── */}
      {(inn1 || inn2) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 72px', gap: 0,
          background: CARD_BG,
          borderBottom: `2px solid ${INK_200}`,
        }}>
          {/* Inn1 team */}
          {inn1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 8 }}>
              <div style={{
                display: 'flex', fontSize: 26, fontWeight: 700,
                color: winnerName && inn1Team === winnerName ? GREEN : INK_600,
                letterSpacing: '-0.2px',
              }}>
                {inn1Team || ''}
              </div>
              <div style={{
                display: 'flex', fontSize: 52, fontWeight: 700,
                color: winnerName && inn1Team === winnerName ? INK_900 : INK_600,
              }}>
                {inn1.total_runs}/{inn1.total_wickets}
              </div>
              <div style={{ display: 'flex', fontSize: 24, color: INK_400 }}>
                {formatOvers(inn1.total_legal_balls || 0)} ov
              </div>
            </div>
          )}

          {/* VS divider */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '0 40px',
          }}>
            <div style={{ display: 'flex', width: 2, height: 60, background: INK_200 }} />
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: INK_400 }}>VS</div>
            <div style={{ display: 'flex', width: 2, height: 60, background: INK_200 }} />
          </div>

          {/* Inn2 team */}
          {inn2 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 8 }}>
              <div style={{
                display: 'flex', fontSize: 26, fontWeight: 700,
                color: winnerName && inn2Team === winnerName ? GREEN : INK_600,
                letterSpacing: '-0.2px',
              }}>
                {inn2Team || ''}
              </div>
              <div style={{
                display: 'flex', fontSize: 52, fontWeight: 700,
                color: winnerName && inn2Team === winnerName ? INK_900 : INK_600,
              }}>
                {inn2.total_runs}/{inn2.total_wickets}
              </div>
              <div style={{ display: 'flex', fontSize: 24, color: INK_400 }}>
                {formatOvers(inn2.total_legal_balls || 0)} ov
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Match result strip ────────────────────────────────────────────────── */}
      {winnerName && (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16,
          padding: '24px 72px',
          background: GREEN_LIGHT,
          borderBottom: `2px solid #bbf7d0`,
        }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: GREEN }}>
            {match?.result_summary || `${winnerName} won`}
          </div>
        </div>
      )}

      {/* ── Batting ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 72px 0' }}>
        <SectionLabel text="BATTING" color={GREEN} />

        {/* Runs / Balls / SR — 3 equal columns (310 + 2 + 312 + 2 + 310 = 936) */}
        <div style={{ display: 'flex', width: 936 }}>
          <StatCell val={batStats?.runs ?? 0} label="RUNS" color={GREEN} labelColor={INK_400} width={310} />
          <div style={{ display: 'flex', flexShrink: 0, width: 2, background: INK_200, alignSelf: 'stretch' }} />
          <StatCell val={batStats?.balls ?? 0} label="BALLS" color={INK_900} labelColor={INK_400} width={312} />
          <div style={{ display: 'flex', flexShrink: 0, width: 2, background: INK_200, alignSelf: 'stretch' }} />
          <StatCell
            val={calcSR(batStats?.runs ?? 0, batStats?.balls ?? 0)}
            label="STRIKE RATE" color={INK_900} labelColor={INK_400} size={72} width={310}
          />
        </div>

        {/* Boundaries row — 2 equal halves, each 467px */}
        <div style={{
          display: 'flex', width: 936,
          marginTop: 36,
          background: SURFACE, borderRadius: 20, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: 467, padding: '26px 0',
          }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, color: GOLD, lineHeight: '1' }}>
              {batStats?.fours ?? 0}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: INK_400, fontWeight: 600, marginTop: 10 }}>FOURS</div>
          </div>
          <div style={{ display: 'flex', width: 2, background: INK_200 }} />
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            width: 467, padding: '26px 0',
          }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 700, color: '#ea580c', lineHeight: '1' }}>
              {batStats?.sixes ?? 0}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: INK_400, fontWeight: 600, marginTop: 10 }}>SIXES</div>
          </div>
        </div>

        {/* Dismissal */}
        <div style={{
          display: 'flex', justifyContent: 'center', marginTop: 22,
          fontSize: 28, color: INK_400, fontWeight: 400,
        }}>
          {dismissalText(dismissal)}
        </div>
      </div>

      {/* ── Bowling ───────────────────────────────────────────────────────────── */}
      {/* NB: must be a single <div>, NOT a React Fragment — Satori does not flatten
          Fragments and would indent the whole section, breaking column alignment. */}
      {hasBowled && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', height: 2, background: INK_200, margin: '36px 72px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', padding: '36px 72px 0' }}>
            <SectionLabel text="BOWLING" color={SKY} />

            {/* justifyContent space-between pins the two value cells to the row
                edges -> OVERS centred at 227 (under RUNS) and WICKETS at 853
                (under STRIKE RATE). Robust against Satori cell-collapse quirks. */}
            <div style={{ display: 'flex', width: 936, justifyContent: 'space-between', alignItems: 'center' }}>
              <StatCell val={formatOvers(bowlStats.legal_balls)} label="OVERS" color={SKY} labelColor={INK_400} width={310} />
              <div style={{ display: 'flex', flexShrink: 0, width: 2, height: 130, background: INK_200 }} />
              <StatCell val={bowlStats.wickets ?? 0} label="WICKETS" color={SKY} labelColor={INK_400} width={310} />
            </div>
            <div style={{ display: 'flex', width: 936, marginTop: 32, justifyContent: 'space-between', alignItems: 'center' }}>
              <StatCell val={bowlStats.runs ?? 0} label="RUNS" color={INK_900} labelColor={INK_400} width={310} />
              <div style={{ display: 'flex', flexShrink: 0, width: 2, height: 130, background: INK_200 }} />
              <StatCell val={calcEcon(bowlStats.runs, bowlStats.legal_balls)} label="ECONOMY" color={INK_900} labelColor={INK_400} width={310} />
            </div>
          </div>
        </div>
      )}

      {/* ── Spacer ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1 }} />

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: '32px 72px',
        borderTop: `2px solid ${INK_200}`,
        background: SURFACE,
      }}>
        <div style={{ display: 'flex', fontSize: 24, color: INK_400, fontWeight: 600, letterSpacing: '3px' }}>
          CRICKET SCORING APP
        </div>
      </div>
    </div>
  );
}

// ── Auction sold card ─────────────────────────────────────────────────────────
function buildAuctionSoldElement({ player, teamName, basePrice, soldPrice, auctionName, photoDataUrl }) {
  const initials = getInitials(player?.name);
  const HAMMER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff"><path d="M9.5 8L5 3.5 3.5 5l4.5 4.5-1.5 1.5L2 6.5 1 7.5 5.5 12H7l1-1 7 7 .5.5a2 2 0 002.83 0l1.17-1.17a2 2 0 000-2.83L10 8H9.5z"/><path d="M19 3l-8 8 1.5 1.5 8-8L22 3z"/></svg>`
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: 1080, height: 1080,
      background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0f2d1f 100%)',
      fontFamily: 'Inter', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background accent circle */}
      <div style={{
        position: 'absolute', top: -200, right: -200,
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(22,163,74,0.2) 0%, transparent 70%)',
        display: 'flex',
      }} />

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '48px 64px 0',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.4)', fontWeight: 400, letterSpacing: 3 }}>
            AUCTION
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
            {auctionName || 'Player Auction'}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: GREEN, borderRadius: 40, padding: '12px 28px',
        }}>
          <img src={HAMMER} width={28} height={28} style={{ display: 'flex' }} />
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: '#fff' }}>SOLD</div>
        </div>
      </div>

      {/* Player section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 56, padding: '56px 64px 0' }}>
        {/* Photo / initials */}
        <div style={{
          display: 'flex', width: 220, height: 260, borderRadius: 24, overflow: 'hidden',
          background: 'linear-gradient(135deg, #16a34a, #0d9488)',
          flexShrink: 0, position: 'relative',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {photoDataUrl ? (
            <img src={photoDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'flex' }} />
          ) : (
            <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 80, fontWeight: 800, color: '#fff' }}>
              {initials}
            </div>
          )}
        </div>

        {/* Name + role */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#fff', lineHeight: 1.05, letterSpacing: -1 }}>
            {player?.name ?? '—'}
          </div>
          {player?.role && (
            <div style={{
              display: 'flex', marginTop: 16,
              background: 'rgba(255,255,255,0.1)', borderRadius: 40,
              padding: '8px 24px', alignSelf: 'flex-start',
            }}>
              <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'capitalize' }}>
                {player.role.replace(/-/g, ' ')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', height: 2, background: 'rgba(255,255,255,0.08)', margin: '48px 64px 0' }} />

      {/* Price details */}
      <div style={{ display: 'flex', gap: 0, padding: '48px 64px 0' }}>
        {/* Sold to */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
            Sold to
          </div>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: GREEN_MID, marginTop: 8 }}>
            {teamName ?? '—'}
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{ display: 'flex', width: 2, background: 'rgba(255,255,255,0.08)', margin: '0 48px' }} />

        {/* Base price */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
            Base Price
          </div>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
            Rs.{basePrice?.toLocaleString() ?? '—'}
          </div>
        </div>
      </div>

      {/* Bought for — hero number */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        margin: '40px 64px 0',
        background: 'rgba(22,163,74,0.15)',
        border: '2px solid rgba(22,163,74,0.4)',
        borderRadius: 24, padding: '32px 48px',
      }}>
        <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
          Bought For
        </div>
        <div style={{ display: 'flex', fontSize: 100, fontWeight: 800, color: GREEN_MID, lineHeight: 1, marginTop: 8, letterSpacing: -2 }}>
          Rs.{soldPrice?.toLocaleString() ?? '—'}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 'auto', padding: '32px 64px 48px',
      }}>
        <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
          SIR Cricket Scorer
        </div>
      </div>
    </div>
  );
}

export async function generateAuctionSoldCard({ player, teamName, basePrice, soldPrice, auctionName }) {
  const [fonts, photoDataUrl] = await Promise.all([
    loadFonts(),
    fetchPhotoAsDataUrl(player?.photo_url),
  ]);
  const element = buildAuctionSoldElement({ player, teamName, basePrice, soldPrice, auctionName, photoDataUrl });
  const svg = await satori(element, { width: 1080, height: 1080, fonts });
  return svgToPng(svg, 1080, 1080);
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generatePlayerCard({ player, match, inningsList, batStats, dismissal, bowlStats }) {
  const [fonts, photoDataUrl] = await Promise.all([
    loadFonts(),
    fetchPhotoAsDataUrl(player?.photo_url),
  ]);

  const element = buildCardElement({ player, match, inningsList, batStats, dismissal, bowlStats, photoDataUrl });
  const svg     = await satori(element, { width: 1080, height: 1920, fonts });
  return svgToPng(svg, 1080, 1920);
}

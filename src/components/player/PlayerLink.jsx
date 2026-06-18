import { Link } from 'react-router-dom';
import { useMatchStore } from '../../stores/matchStore';

/**
 * Renders a player's name as a tappable link.
 * - Default: navigates to /players/:id
 * - liveScoring=true: opens the PlayerStatsDrawer instead (keeps scoring state intact)
 * - newTab=true: opens /players/:id in a new tab (used inside live-scoring modals)
 */
export default function PlayerLink({ id, name, liveScoring = false, newTab = false, className = '' }) {
  const setStatsDrawerPlayer = useMatchStore(s => s.setStatsDrawerPlayer);

  if (!id || !name) return <span className={className}>{name || '—'}</span>;

  const base = 'text-cricket-green dark:text-cricket-gold hover:underline';

  if (liveScoring) {
    return (
      <button type="button" onClick={() => setStatsDrawerPlayer(id)} className={`${base} ${className}`}>
        {name}
      </button>
    );
  }

  return (
    <Link to={`/players/${id}`} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined} className={`${base} ${className}`}>
      {name}
    </Link>
  );
}

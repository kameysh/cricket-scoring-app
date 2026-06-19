import { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import BottomNav from './components/shared/BottomNav';
import ProtectedRoute from './components/shared/ProtectedRoute';
import { useAuthStore } from './stores/authStore';

import Login from './pages/Login';
import Home from './pages/Home';
import Players from './pages/Players';
import PlayerNew from './pages/PlayerNew';
import PlayerProfile from './pages/PlayerProfile';
import PlayerEdit from './pages/PlayerEdit';
import Venues from './pages/Venues';
import VenueNew from './pages/VenueNew';
import VenueEdit from './pages/VenueEdit';
import Tournaments from './pages/Tournaments';
import TournamentNew from './pages/TournamentNew';
import TournamentDetail from './pages/TournamentDetail';
import TournamentEdit from './pages/TournamentEdit';
import TournamentStats from './pages/TournamentStats';
import TournamentSetup from './pages/TournamentSetup';
import Matches from './pages/Matches';
import MatchSetup from './pages/MatchSetup';
import LiveScoring from './pages/LiveScoring';
import Scorecard from './pages/Scorecard';
import MatchSummary from './pages/MatchSummary';
import AdminUsers from './pages/AdminUsers';
import Teams from './pages/Teams';
import Leaderboard from './pages/Leaderboard';
import HeadToHead from './pages/HeadToHead';
import AcceptInvite from './pages/AcceptInvite';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  const location = useLocation();
  const init = useAuthStore(s => s.init);

  const navigate = useNavigate();

  useEffect(() => { init(); }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    if (hash.includes('type=invite')) {
      navigate('/accept-invite' + hash, { replace: true });
    } else if (hash.includes('type=recovery')) {
      navigate('/reset-password' + hash, { replace: true });
    } else if (hash.includes('access_token')) {
      // Unknown token type — send to login to avoid being stuck
      navigate('/login', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#fafafb] dark:bg-ink-900 text-ink-900 dark:text-ink-50 font-sans">
      <main className="max-w-2xl mx-auto pb-16" key={location.pathname}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/matches/:id/scorecard" element={<Scorecard />} />
          <Route path="/matches/:id/summary" element={<MatchSummary />} />
          <Route path="/players/:id" element={<PlayerProfile />} />
          <Route path="/tournaments/:id" element={<TournamentDetail />} />
          <Route path="/tournaments/:id/stats" element={<TournamentStats />} />

          {/* Any logged-in user */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/players" element={<Players />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/venues" element={<Venues />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/h2h" element={<HeadToHead />} />
          </Route>

          {/* Admin + Scorer */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'scorer']} />}>
            <Route path="/matches/new" element={<MatchSetup />} />
            <Route path="/matches/:id" element={<LiveScoring />} />
          </Route>

          {/* Admin + Captain + Player (PlayerEdit enforces own-profile check for player role) */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'captain', 'player']} />}>
            <Route path="/players/new" element={<PlayerNew />} />
            <Route path="/players/:id/edit" element={<PlayerEdit />} />
          </Route>

          {/* Admin only */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/venues/new" element={<VenueNew />} />
            <Route path="/venues/:id/edit" element={<VenueEdit />} />
            <Route path="/tournaments/new" element={<TournamentNew />} />
            <Route path="/tournaments/:id/edit" element={<TournamentEdit />} />
            <Route path="/tournaments/:id/setup" element={<TournamentSetup />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/teams" element={<Teams />} />
          </Route>
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

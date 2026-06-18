import { useAuthStore } from '../stores/authStore';

export function useRole() {
  const role = useAuthStore(s => s.role);
  const user = useAuthStore(s => s.user);
  return {
    role,
    userId: user?.id || null,
    isAdmin: role === 'admin',
    isPlayer: role === 'player',
    canScore: ['admin', 'scorer'].includes(role),
    canManagePlayers: ['admin', 'captain'].includes(role),
    canManageOwnProfile: ['admin', 'captain', 'player'].includes(role),
    canManageVenues: role === 'admin',
    canManageTournaments: role === 'admin',
  };
}

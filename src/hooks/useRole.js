import { useAuthStore } from '../stores/authStore';

export function useRole() {
  const role = useAuthStore(s => s.role);
  const user = useAuthStore(s => s.user);
  return {
    role,
    userId: user?.id || null,
    isAdmin: role === 'admin',
    isPlayer: role === 'player',
    canScore: ['admin', 'scorer', 'captain', 'player'].includes(role),
    canManagePlayers: role === 'admin',
    canCreatePlayer: ['admin', 'scorer', 'captain', 'player'].includes(role),
    canManageOwnProfile: ['admin', 'scorer', 'captain', 'player'].includes(role),
    canManageVenues: role === 'admin',
    canManageTournaments: role === 'admin',
    canManageAuctions: role === 'admin',
  };
}

import { useAuthStore } from '../stores/authStore';

export function useRole() {
  const role = useAuthStore(s => s.role);
  return {
    role,
    isAdmin: role === 'admin',
    canScore: ['admin', 'scorer'].includes(role),
    canManagePlayers: ['admin', 'captain'].includes(role),
    canManageVenues: role === 'admin',
    canManageTournaments: role === 'admin',
  };
}

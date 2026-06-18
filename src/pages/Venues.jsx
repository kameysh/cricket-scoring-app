import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin } from 'lucide-react';
import * as venueService from '../services/venueService';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';

import { useRole } from '../hooks/useRole';

export default function Venues() {
  const navigate = useNavigate();
  const { canManageVenues } = useRole();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { venueService.listVenues().then(setVenues).finally(() => setLoading(false)); }, []);

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Venues</h1>
        {canManageVenues && (
          <button onClick={() => navigate('/venues/new')} className="btn-chip">
            <Plus size={16} /> Add
          </button>
        )}
      </div>
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : venues.length === 0 ? (
        <EmptyState icon={MapPin} title="No venues yet" message="Add a venue to assign it to matches." />
      ) : (
        <div className="space-y-2">
          {venues.map(v => (
            <button key={v.id} onClick={() => navigate(`/venues/${v.id}/edit`)} className="w-full text-left card p-4">
              <p className="font-semibold text-gray-900 dark:text-white">{v.name}</p>
              <p className="text-xs text-gray-500">{v.city}, {v.country}{v.capacity ? ` · Cap. ${v.capacity}` : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

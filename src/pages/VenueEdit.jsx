import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import * as venueService from '../services/venueService';
import { useRole } from '../hooks/useRole';
import ConfirmDialog from '../components/shared/ConfirmDialog';

export default function VenueEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const [form, setForm] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!isAdmin) { navigate('/'); return null; }

  useEffect(() => { venueService.getVenue(id).then(setForm); }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await venueService.updateVenue(id, { ...form, capacity: form.capacity ? Number(form.capacity) : null });
      toast.success('Venue updated');
      navigate('/venues');
    } catch (e2) {
      toast.error(e2.message || 'Failed to update venue');
    }
  }

  async function handleDelete() {
    try {
      await venueService.deleteVenue(id);
      toast.success('Venue deleted');
      navigate('/venues');
    } catch (e2) {
      toast.error(e2.message || 'Failed to delete venue');
    }
  }

  if (!form) return null;

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Venue</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="field-input" />
        <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="field-input" />
        <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="field-input" />
        <input type="number" value={form.capacity || ''} onChange={e => setForm({ ...form, capacity: e.target.value })} className="field-input" />
        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="field-input" />
        <button type="submit" className="btn-primary w-full">Save Changes</button>
        {isAdmin && (
          <button type="button" onClick={() => setConfirmOpen(true)} className="w-full py-3 rounded-lg border border-red-300 text-red-600 font-semibold flex items-center justify-center gap-2">
            <Trash2 size={16} /> Delete Venue
          </button>
        )}
      </form>
      <ConfirmDialog open={confirmOpen} title="Delete venue?" message="This cannot be undone." confirmLabel="Delete" danger onConfirm={handleDelete} onCancel={() => setConfirmOpen(false)} />
    </div>
  );
}

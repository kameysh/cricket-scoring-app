import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as venueService from '../services/venueService';

export default function VenueNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', city: '', country: '', capacity: '', notes: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim() || !form.country.trim()) {
      toast.error('Name, city and country are required');
      return;
    }
    try {
      await venueService.createVenue({ ...form, capacity: form.capacity ? Number(form.capacity) : null });
      toast.success('Venue added');
      navigate('/venues');
    } catch (e2) {
      toast.error(e2.message || 'Failed to add venue');
    }
  }

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Venue</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="field-input" />
        <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="field-input" />
        <input placeholder="Country" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className="field-input" />
        <input type="number" placeholder="Capacity (optional)" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="field-input" />
        <textarea placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="field-input" />
        <button type="submit" className="btn-primary w-full">Add Venue</button>
      </form>
    </div>
  );
}

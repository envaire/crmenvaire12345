import React, { useState } from 'react';
import { X, Save, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface LeadFormProps {
  onClose: () => void;
  onSuccess: () => void;
  lead?: any;
}

const LeadForm: React.FC<LeadFormProps> = ({ onClose, onSuccess, lead }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: lead?.name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    company: lead?.company || '',
    position: lead?.position || '',
    status: lead?.status || 'prospect',
    value: lead?.value || 0,
    notes: lead?.notes || '',
    call_status: lead?.call_status || 'not_called',
    industry: lead?.industry || '',
    website: lead?.website || '',
    ceo: lead?.ceo || '',
    revenue: lead?.revenue || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const leadData = {
        ...formData,
        user_id: user.id,
      };

      if (lead) {
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', lead.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leads')
          .insert([leadData]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving lead:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="absolute inset-0 data-grid"></div>
      <div className="relative tech-card rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto glow-green">
        <div className="flex items-center justify-between p-6 border-b border-green-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-900 rounded-lg flex items-center justify-center glow-green">
              <User className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-green-300">
              {lead ? 'Edit Lead' : 'Add New Lead'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Position
            </label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300"
            >
              <option value="prospect">Prospect</option>
              <option value="qualified">Qualified</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
              <option value="closed-won">Closed Won</option>
              <option value="closed-lost">Closed Lost</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Call Status
            </label>
            <select
              value={formData.call_status}
              onChange={(e) => setFormData({ ...formData, call_status: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300"
            >
              <option value="not_called">Not Called</option>
              <option value="answered">Answered</option>
              <option value="no_response">No Response</option>
              <option value="voicemail">Voicemail</option>
              <option value="busy">Busy</option>
              <option value="wrong_number">Wrong Number</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Industry
            </label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
              placeholder="e.g., HENKILÖSTÖVUOKRAUS"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              CEO
            </label>
            <input
              type="text"
              value={formData.ceo}
              onChange={(e) => setFormData({ ...formData, ceo: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Revenue
            </label>
            <input
              type="text"
              value={formData.revenue}
              onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
              placeholder="e.g., 500k, 1.2M"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Value ($)
            </label>
            <input
              type="number"
              min="0"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Notes
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 tech-border text-green-300 rounded-lg hover:bg-green-800 hover:bg-opacity-30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 tech-button text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{lead ? 'Update' : 'Create'} Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadForm;
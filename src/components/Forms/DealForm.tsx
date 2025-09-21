import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Deal } from '../../types';

interface DealFormProps {
  onClose: () => void;
  onSuccess: () => void;
  deal?: Deal | null;
}

// Predefined salesmen list
const SALESMEN = [
  { name: 'Tuomas', email: 'tuomas@envaire.com' },
  { name: 'Jukka', email: 'jukka@envaire.com' },
  { name: 'Jesse', email: 'jesse@envaire.com' },
  { name: 'Tuukka', email: 'tuukka@envaire.com' },
  { name: 'Ilia', email: 'ilia@envaire.com' },
  { name: 'Javier', email: 'javier@envaire.com' },
];
const DealForm: React.FC<DealFormProps> = ({ onClose, onSuccess, deal }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: deal?.title || '',
    company: deal?.company || '',
    description: deal?.description || '',
    deal_value: deal?.deal_value || 0,
    payment_type: deal?.payment_type || 'one_time',
    monthly_amount: deal?.monthly_amount || 0,
    installation_fee: deal?.installation_fee || 0,
    contract_length_months: deal?.contract_length_months || 0,
    closed_date: deal?.closed_date || new Date().toISOString().split('T')[0],
    status: deal?.status || 'active',
    lead_id: deal?.lead_id || '',
    salesman_name: deal?.salesman_name || '',
    salesman_email: deal?.salesman_email || '',
  });

  useEffect(() => {
    fetchLeads();
    // Auto-select current user if they're in the salesmen list
    if (user?.email && !deal) {
      const currentSalesman = SALESMEN.find(s => s.email === user.email);
      if (currentSalesman) {
        setFormData(prev => ({
          ...prev,
          salesman_name: currentSalesman.name,
          salesman_email: currentSalesman.email
        }));
      }
    }
  }, []);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, company')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dealData = {
        ...formData,
        user_id: user.id,
        lead_id: formData.lead_id || null,
        deal_value: Number(formData.deal_value),
        monthly_amount: Number(formData.monthly_amount),
        installation_fee: Number(formData.installation_fee),
        contract_length_months: Number(formData.contract_length_months),
        salesman_name: formData.salesman_name,
        salesman_email: formData.salesman_email,
      };

      if (deal) {
        const { error } = await supabase
          .from('deals')
          .update(dealData)
          .eq('id', deal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('deals')
          .insert([dealData]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving deal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalesmanChange = (email: string) => {
    const selectedSalesman = SALESMEN.find(s => s.email === email);
    if (selectedSalesman) {
      setFormData(prev => ({
        ...prev,
        salesman_name: selectedSalesman.name,
        salesman_email: selectedSalesman.email
      }));
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="absolute inset-0 data-grid"></div>
      <div className="relative tech-card rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto glow-green">
        <div className="flex items-center justify-between p-6 border-b border-green-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-900 rounded-lg flex items-center justify-center glow-green">
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-green-300">
              {deal ? 'Edit Deal' : 'Add New Deal'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Deal Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
                placeholder="e.g., AI Lead Generation System"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Company *
              </label>
              <input
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
                placeholder="e.g., RGT Henkilöstöpalvelut Oy"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Salesman *
            </label>
            <select
              required
              value={formData.salesman_email}
              onChange={(e) => handleSalesmanChange(e.target.value)}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300"
            >
              <option value="">Select a salesman</option>
              {SALESMEN.map((salesman) => (
                <option key={salesman.email} value={salesman.email}>
                  {salesman.name} - {salesman.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
              placeholder="Describe the deal details..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Payment Structure *
              </label>
              <select
                value={formData.payment_type}
                onChange={(e) => setFormData({ ...formData, payment_type: e.target.value as 'one_time' | 'monthly' })}
                className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300"
              >
                <option value="one_time">One-time Payment Only</option>
                <option value="monthly">Monthly Recurring + Setup</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {formData.payment_type === 'one_time' 
                  ? 'Single payment with optional installation fee'
                  : 'Monthly recurring payments with optional setup fee'
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Deal Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Deal['status'] })}
                className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Deal Value (€) *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.deal_value}
                onChange={(e) => setFormData({ ...formData, deal_value: Number(e.target.value) })}
                className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">Total deal value</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                {formData.payment_type === 'monthly' ? 'Setup Fee (€)' : 'Installation Fee (€)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.installation_fee}
                onChange={(e) => setFormData({ ...formData, installation_fee: Number(e.target.value) })}
                className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500 mt-1">
                One-time setup/installation cost
              </p>
            </div>
          </div>

          {formData.payment_type === 'monthly' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Monthly Amount (€) *
                </label>
                <input
                  type="number"
                  required={formData.payment_type === 'monthly'}
                  min="0"
                  step="0.01"
                  value={formData.monthly_amount}
                  onChange={(e) => setFormData({ ...formData, monthly_amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Contract Length (Months)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.contract_length_months}
                  onChange={(e) => setFormData({ ...formData, contract_length_months: Number(e.target.value) })}
                  className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
                  placeholder="12"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Closed Date *
            </label>
            <input
              type="date"
              required
              value={formData.closed_date}
              onChange={(e) => setFormData({ ...formData, closed_date: e.target.value })}
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
                  <span>{deal ? 'Update' : 'Create'} Deal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DealForm;
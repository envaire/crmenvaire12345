import React, { useState, useEffect } from 'react';
import { X, Save, Target } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ProjectFormProps {
  onClose: () => void;
  onSuccess: () => void;
  project?: any;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ onClose, onSuccess, project }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: project?.title || '',
    company: project?.company || '',
    description: project?.description || '',
    deadline: project?.deadline || '',
    notes: project?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const projectData = {
        ...formData,
        user_id: user.id,
      };

      if (project) {
        const { error } = await supabase
          .from('projects')
          .update(projectData)
          .eq('id', project.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([projectData]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving project:', error);
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
              <Target className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-green-300">
              {project ? 'Edit Project' : 'Add New Project'}
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
              Solution Title *
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

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Solution Description *
            </label>
            <textarea
              rows={4}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 tech-border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-300 placeholder-green-500"
              placeholder="Describe what solution you're building for this client..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Deadline *
            </label>
            <input
              type="date"
              required
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
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
                  <span>{project ? 'Update' : 'Create'} Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectForm;
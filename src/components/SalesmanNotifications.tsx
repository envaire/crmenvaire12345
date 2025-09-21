import React, { useState, useEffect } from 'react';
import { Bell, X, Phone, Clock, User, CheckCircle, AlertTriangle, Building } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Lead {
  id: string;
  name: string;
  company: string;
  phone: string;
  last_contact: string;
  days_overdue: number;
  status?: string;
  call_status?: string;
}

interface SalesmanNotification {
  id: string;
  type: 'overdue_calls' | 'stale_leads';
  title: string;
  message: string;
  lead_count: number;
  leads: Lead[];
  created_at: string;
  is_read: boolean;
}

interface SalesmanNotificationsProps {
  onClose: () => void;
}

const SalesmanNotifications: React.FC<SalesmanNotificationsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SalesmanNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      generateNotifications();
    }
  }, [user]);

  const generateNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get leads that haven't been contacted in 4+ days
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      
      // Also check for leads that are really stale (2+ weeks)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      // Get leads not contacted in 4+ days (regular follow-up)
      const { data: recentOverdueLeads, error: recentError } = await supabase
        .from('leads')
        .select('id, name, company, phone, last_contact, call_status, status')
        .eq('user_id', user.id)
        .lt('last_contact', fourDaysAgo.toISOString())
        .neq('status', 'closed-won')
        .neq('status', 'closed-lost')
        .order('last_contact', { ascending: true });

      // Get leads not contacted in 2+ weeks (critical follow-up)
      const { data: criticalOverdueLeads, error: criticalError } = await supabase
        .from('leads')
        .select('id, name, company, phone, last_contact, call_status, status')
        .eq('user_id', user.id)
        .lt('last_contact', twoWeeksAgo.toISOString())
        .neq('status', 'closed-won')
        .neq('status', 'closed-lost')
        .order('last_contact', { ascending: true });

      if (recentError || criticalError) {
        console.error('Error fetching overdue leads:', recentError || criticalError);
        return;
      }

      const notifications: SalesmanNotification[] = [];

      // Create notification for 4+ day overdue leads (regular follow-up)
      if (recentOverdueLeads && recentOverdueLeads.length > 0) {
        const recentLeadsWithDays = recentOverdueLeads.map(lead => {
          const lastContact = new Date(lead.last_contact);
          const now = new Date();
          const daysOverdue = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            id: lead.id,
            name: lead.name,
            company: lead.company,
            phone: lead.phone || 'No phone',
            last_contact: lead.last_contact,
            days_overdue: daysOverdue,
            status: lead.status,
            call_status: lead.call_status
          };
        });

        notifications.push({
          id: 'recent-overdue-' + Date.now(),
          type: 'overdue_calls',
          title: `${recentOverdueLeads.length} Leads Need Follow-up (4+ Days)`,
          message: `You have ${recentOverdueLeads.length} leads that haven't been contacted in 4+ days. Regular follow-up is important to keep leads warm!`,
          lead_count: recentOverdueLeads.length,
          leads: recentLeadsWithDays,
          created_at: new Date().toISOString(),
          is_read: false
        });
      }

      // Create notification for 2+ week overdue leads (critical follow-up)
      if (criticalOverdueLeads && criticalOverdueLeads.length > 0) {
        const criticalLeadsWithDays = criticalOverdueLeads.map(lead => {
          const lastContact = new Date(lead.last_contact);
          const now = new Date();
          const daysOverdue = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            id: lead.id,
            name: lead.name,
            company: lead.company,
            phone: lead.phone || 'No phone',
            last_contact: lead.last_contact,
            days_overdue: daysOverdue,
            status: lead.status,
            call_status: lead.call_status
          };
        });

        notifications.push({
          id: 'critical-overdue-' + Date.now(),
          type: 'stale_leads',
          title: `🚨 ${criticalOverdueLeads.length} CRITICAL Leads Need Immediate Attention`,
          message: `You have ${criticalOverdueLeads.length} leads that haven't been contacted in over 2 weeks! These leads are at risk of going cold. Call them TODAY!`,
          lead_count: criticalOverdueLeads.length,
          leads: criticalLeadsWithDays,
          created_at: new Date().toISOString(),
          is_read: false
        });
      }

      setNotifications(notifications);
    } catch (error) {
      console.error('Error generating notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    setMarkingRead(notificationId);
    
    // Simulate marking as read (you could store this in localStorage or database)
    setTimeout(() => {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setMarkingRead(null);
    }, 500);
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleStatusUpdate = async (leadId: string, field: 'status' | 'call_status', value: string) => {
    try {
      const updateData: any = { [field]: value };
      
      // If updating call_status to answered, also update last_contact
      if (field === 'call_status' && value === 'answered') {
        updateData.last_contact = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) {
        console.error('Error updating lead:', error);
        return;
      }

      // Immediately refresh notifications to reflect changes
      await generateNotifications();
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 data-grid"></div>
      <div className="relative tech-card rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden glow-green">
        <div className="flex items-center justify-between p-6 border-b border-green-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-900 rounded-lg flex items-center justify-center glow-green">
              <Bell className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-300">Your Notifications</h2>
              <p className="text-sm text-green-400">Stay on top of your leads and follow-ups</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="text-green-400 hover:text-green-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-green-400">Loading your notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-green-300 mb-2">All caught up! 🎉</h3>
              <p className="text-green-400">You're doing great! All your leads have been contacted recently.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border rounded-lg p-6 transition-all duration-200 ${
                    notification.is_read 
                      ? 'border-green-800 bg-green-900 bg-opacity-20 opacity-75' 
                      : 'border-orange-500 bg-orange-900 bg-opacity-30 shadow-md glow-green-intense'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-900 bg-opacity-30 rounded-lg flex items-center justify-center glow-green">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-300 flex items-center space-x-2">
                          <span>{notification.title}</span>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                          )}
                        </h3>
                        <p className="text-green-400 text-sm mt-1">{notification.message}</p>
                      </div>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        disabled={markingRead === notification.id}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        {markingRead === notification.id ? (
                          <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium text-green-300 text-sm">Leads needing attention:</h4>
                    <div className="grid gap-3 max-h-96 overflow-y-auto">
                      {notification.leads.slice(0, 10).map((lead) => (
                        <div
                          key={lead.id}
                          className="tech-card border border-green-800 rounded-lg p-4 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-green-900 bg-opacity-30 rounded-full flex items-center justify-center glow-green">
                              <User className="w-4 h-4 text-green-400" />
                            </div>
                            <div>
                              <h5 className="font-medium text-green-300">{lead.name}</h5>
                              <p className="text-sm text-green-400">{lead.company}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Clock className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-green-500">
                                  {lead.days_overdue} days overdue
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <select
                              value={lead.status || 'prospect'}
                              onChange={(e) => handleStatusUpdate(lead.id, 'status', e.target.value)}
                              className="px-2 py-1 text-xs tech-border rounded focus:ring-2 focus:ring-green-500 text-green-300"
                            >
                              <option value="prospect">Prospect</option>
                              <option value="qualified">Qualified</option>
                              <option value="proposal">Proposal</option>
                              <option value="negotiation">Negotiation</option>
                              <option value="closed-won">Closed Won</option>
                              <option value="closed-lost">Closed Lost</option>
                            </select>
                            <select
                              value={lead.call_status || 'not_called'}
                              onChange={(e) => handleStatusUpdate(lead.id, 'call_status', e.target.value)}
                              className="px-2 py-1 text-xs tech-border rounded focus:ring-2 focus:ring-green-500 text-green-300"
                            >
                              <option value="not_called">Not Called</option>
                              <option value="answered">Answered</option>
                              <option value="no_response">No Response</option>
                              <option value="voicemail">Voicemail</option>
                              <option value="busy">Busy</option>
                              <option value="wrong_number">Wrong Number</option>
                            </select>
                          </div>
                        </div>
                      ))}
                      {notification.leads.length > 10 && (
                        <div className="border-t border-green-800 pt-3">
                          <p className="text-sm text-green-400 font-medium mb-2">
                            Additional {notification.leads.length - 10} leads:
                          </p>
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {notification.leads.slice(10).map((lead) => (
                              <div
                                key={lead.id}
                                className="bg-green-900 bg-opacity-20 border border-green-800 rounded-lg p-3 flex items-center justify-between"
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 bg-green-900 bg-opacity-30 rounded-full flex items-center justify-center">
                                    <User className="w-3 h-3 text-green-400" />
                                  </div>
                                  <div>
                                    <h5 className="font-medium text-green-300 text-sm">{lead.name}</h5>
                                    <p className="text-xs text-green-400">{lead.company}</p>
                                    <div className="flex items-center space-x-1 mt-1">
                                      <Clock className="w-3 h-3 text-green-500" />
                                      <span className="text-xs text-green-500">
                                        {lead.days_overdue} days overdue
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <select
                                    value={lead.status || 'prospect'}
                                    onChange={(e) => handleStatusUpdate(lead.id, 'status', e.target.value)}
                                    className="px-1 py-0.5 text-xs tech-border rounded focus:ring-1 focus:ring-green-500 text-green-300 mr-1"
                                  >
                                    <option value="prospect">Prospect</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="proposal">Proposal</option>
                                    <option value="negotiation">Negotiation</option>
                                    <option value="closed-won">Closed Won</option>
                                    <option value="closed-lost">Closed Lost</option>
                                  </select>
                                  <select
                                    value={lead.call_status || 'not_called'}
                                    onChange={(e) => handleStatusUpdate(lead.id, 'call_status', e.target.value)}
                                    className="px-1 py-0.5 text-xs tech-border rounded focus:ring-1 focus:ring-green-500 text-green-300"
                                  >
                                    <option value="not_called">Not Called</option>
                                    <option value="answered">Answered</option>
                                    <option value="no_response">No Response</option>
                                    <option value="voicemail">Voicemail</option>
                                    <option value="busy">Busy</option>
                                    <option value="wrong_number">Wrong Number</option>
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesmanNotifications;
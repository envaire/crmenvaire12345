import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Clock, Phone, User, X, CheckCircle, Eye } from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import ConfirmationCard from './ConfirmationCard';

interface Notification {
  id: string;
  type: 'stale_lead' | 'no_calls' | 'inactive_salesman';
  title: string;
  message: string;
  lead_id?: string;
  salesman_id: string;
  salesman_email: string;
  created_at: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high';
  data: any;
}

interface AdminNotificationsProps {
  onClose: () => void;
}

const AdminNotifications: React.FC<AdminNotificationsProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('unread');
  const [confirmDelete, setConfirmDelete] = useState<{ notificationId: string; title: string } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchNotifications();
      generateNotifications();
    }
  }, [isAdmin]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateNotifications = async () => {
    try {
      setLoading(true);
      
      console.log('🧹 Clearing old admin notifications...');
      
      // First, clear ALL existing notifications
      await supabase
        .from('admin_notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      console.log('✅ Cleared old notifications');
      
      // Now generate fresh notifications
      console.log('🔄 Generating fresh notifications...');
      
      // Get all users who have leads
      const { data: userIds, error: userIdsError } = await supabase
        .from('leads')
        .select('user_id')
        .not('user_id', 'is', null);

      if (userIdsError) throw userIdsError;

      const uniqueUserIds = [...new Set(userIds?.map(l => l.user_id) || [])];
      console.log(`👥 Processing ${uniqueUserIds.length} users`);

      const now = new Date();
      const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const notifications = [];

      // Process each user
      for (const userId of uniqueUserIds) {
        try {
          // Get user email
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('email')
            .eq('user_id', userId)
            .single();

          const userEmail = userRole?.email || `user-${userId}@unknown.com`;

          // Get overdue leads (4+ days)
          const { data: overdueLeads } = await supabase
            .from('leads')
            .select('id, name, company, last_contact')
            .eq('user_id', userId)
            .lt('last_contact', fourDaysAgo.toISOString())
            .neq('status', 'closed-won')
            .neq('status', 'closed-lost');

          // Get stale leads (2+ weeks)
          const { data: staleLeads } = await supabase
            .from('leads')
            .select('id, name, company, last_contact')
            .eq('user_id', userId)
            .lt('last_contact', twoWeeksAgo.toISOString())
            .neq('status', 'closed-won')
            .neq('status', 'closed-lost');

          // Create notifications if needed
          if (overdueLeads && overdueLeads.length > 0) {
            notifications.push({
              type: 'stale_lead',
              title: `${overdueLeads.length} Overdue Leads - ${userEmail}`,
              message: `${userEmail} has ${overdueLeads.length} leads not contacted in 4+ days`,
              salesman_id: userId,
              salesman_email: userEmail,
              priority: overdueLeads.length > 10 ? 'high' : 'medium',
              data: { leads: overdueLeads.slice(0, 5) }
            });
          }

          if (staleLeads && staleLeads.length > 0) {
            notifications.push({
              type: 'stale_lead',
              title: `🚨 CRITICAL: ${staleLeads.length} Stale Leads - ${userEmail}`,
              message: `${userEmail} has ${staleLeads.length} leads not contacted in 2+ weeks`,
              salesman_id: userId,
              salesman_email: userEmail,
              priority: 'high',
              data: { leads: staleLeads.slice(0, 5) }
            });
          }

        } catch (error) {
          console.error(`Error processing user ${userId}:`, error);
        }
      }

      // Insert notifications
      if (notifications.length > 0) {
        const { error: insertError } = await supabase
          .from('admin_notifications')
          .insert(notifications.map(n => ({ ...n, is_read: false })));

        if (insertError) {
          console.error('Error inserting notifications:', insertError);
        } else {
          console.log(`✅ Created ${notifications.length} notifications`);
        }
      } else {
        console.log('ℹ️ No notifications needed - all leads are up to date!');
      }
      
      // Refresh notifications from database
      await fetchNotifications();
    } catch (error) {
      console.error('Error generating notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('admin_notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    setConfirmDelete({ notificationId, title: notification?.title || 'this notification' });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;

    try {
      await supabase
        .from('admin_notifications')
        .delete()
        .eq('id', confirmDelete.notificationId);

      setNotifications(prev => prev.filter(n => n.id !== confirmDelete.notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    } finally {
      setConfirmDelete(null);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'high') return n.priority === 'high';
    return true;
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stale_lead': return Clock;
      case 'no_calls': return Phone;
      case 'inactive_salesman': return User;
      default: return Bell;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 data-grid"></div>
      <div className="relative tech-card rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden glow-green">
        <div className="flex items-center justify-between p-6 border-b border-green-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-900 bg-opacity-30 rounded-lg flex items-center justify-center glow-green">
              <Bell className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-300">Admin Notifications</h2>
              <p className="text-sm text-green-400">Monitor salesman activity and lead management</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  filter === 'all' ? 'bg-green-900 bg-opacity-30 text-green-300 border border-green-500' : 'text-green-400 hover:bg-green-800 hover:bg-opacity-30'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  filter === 'unread' ? 'bg-green-900 bg-opacity-30 text-green-300 border border-green-500' : 'text-green-400 hover:bg-green-800 hover:bg-opacity-30'
                }`}
              >
                Unread ({notifications.filter(n => !n.is_read).length})
              </button>
              <button
                onClick={() => setFilter('high')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  filter === 'high' ? 'bg-green-900 bg-opacity-30 text-green-300 border border-green-500' : 'text-green-400 hover:bg-green-800 hover:bg-opacity-30'
                }`}
              >
                High Priority ({notifications.filter(n => n.priority === 'high').length})
              </button>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  generateNotifications();
                }}
                className="px-3 py-1 text-sm tech-button text-white rounded-lg transition-colors"
              >
                Refresh
              </button>
              <button
                onClick={markAllAsRead}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Mark All Read
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-green-400">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-green-400">No notifications found</p>
              </div>
            ) : (
              filteredNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`border-l-4 p-4 rounded-lg tech-card border border-green-800 ${
                      !notification.is_read ? 'shadow-md' : 'opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          notification.priority === 'high' ? 'bg-red-100' :
                          notification.priority === 'medium' ? 'bg-yellow-100' : 'bg-green-900 bg-opacity-30'
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            notification.priority === 'high' ? 'text-red-600' :
                            notification.priority === 'medium' ? 'text-yellow-600' : 'text-green-400'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-green-300">{notification.title}</h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              notification.priority === 'high' ? 'bg-red-100 text-red-700' :
                              notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-900 bg-opacity-30 text-green-300 border border-green-500'
                            }`}>
                              {notification.priority}
                            </span>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                          </div>
                          <p className="text-green-400 text-sm mb-2">{notification.message}</p>
                          <div className="flex items-center space-x-4 text-xs text-green-500">
                            <span>Salesman: {notification.salesman_email}</span>
                            <span>{new Date(notification.created_at).toLocaleDateString()}</span>
                          </div>
                          {notification.data?.leads && (
                            <div className="mt-2 text-xs text-green-400">
                              <p className="font-medium text-green-300">Sample leads:</p>
                              <ul className="list-disc list-inside ml-2">
                                {notification.data.leads.slice(0, 3).map((lead: any, i: number) => (
                                  <li key={i}>{lead.name} - {lead.company}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 text-green-400 hover:text-green-300 transition-colors"
                            title="Mark as read"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 text-green-400 hover:text-red-400 transition-colors"
                          title="Delete notification"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {notification.data?.leads && (
                      <div className="mt-3 ml-11">
                        <ul className="space-y-1">
                          {notification.data.leads.slice(0, 5).map((lead: any, i: number) => (
                            <li key={i} className="text-xs">
                              <span className="font-medium">{lead.name}</span> - {lead.company}
                              {notification.data.notification_type === 'stale_leads' && (
                                <span className="text-red-600 ml-1">
                                  (Last contact: {new Date(lead.last_contact).toLocaleDateString()})
                                </span>
                              )}
                              {notification.data.notification_type === 'uncalled_leads' && (
                                <span className="text-orange-600 ml-1">
                                  (Created: {new Date(lead.created_at).toLocaleDateString()})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {notification.data.leads.length > 5 && (
                          <p className="text-xs text-gray-500 mt-1">
                            ... and {notification.data.leads.length - 5} more leads
                          </p>
                        )}
                      </div>
                    )}
                    {notification.data?.notification_type === 'no_login_activity' && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                        <p className="font-medium text-red-800">⚠️ Critical: Salesman Missing</p>
                        <p className="text-red-700">No system activity detected. Requires immediate manager intervention.</p>
                      </div>
                    )}
                    {notification.data?.notification_type === 'no_lead_activity' && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                        <p className="font-medium text-yellow-800">⚠️ Warning: Not Working Leads</p>
                        <p className="text-yellow-700">Salesman is active but not managing leads. May need coaching.</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmationCard
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Notification"
        message={`Are you sure you want to delete "${confirmDelete?.title}"?`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
};

export default AdminNotifications;
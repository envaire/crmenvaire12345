import React, { useState, useEffect } from 'react';
import { Monitor, User, X, Eye, Clock, MousePointer, Phone, Mail, Edit, Plus, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';

interface ActivityLog {
  id: string;
  user_id: string;
  user_email: string;
  action_type: string;
  action_details: string;
  target_type: string;
  target_id?: string;
  target_name?: string;
  metadata: any;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

interface Salesman {
  user_id: string;
  email: string;
  last_activity: string;
  total_actions: number;
  online_status: 'online' | 'idle' | 'afk' | 'offline';
}

interface MonitoringRoomProps {
  onClose: () => void;
}

const MonitoringRoom: React.FC<MonitoringRoomProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [selectedSalesman, setSelectedSalesman] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'hour'>('today');

  // AFK Detection - 10 minutes of inactivity
  const AFK_THRESHOLD = 10 * 60 * 1000; // 10 minutes in milliseconds
  const IDLE_THRESHOLD = 30 * 60 * 1000; // 30 minutes in milliseconds

  // Set up real-time subscription for activity logs
  useEffect(() => {
    if (!isAdmin) return;

    const subscription = supabase
      .channel('activity_logs')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'activity_logs' },
        (payload) => {
          console.log('Real-time activity update:', payload);
          // Immediately refresh salesmen status when new activity is detected
          fetchSalesmen();
          if (selectedSalesman) {
            fetchActivities(selectedSalesman);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [isAdmin, selectedSalesman]);

  useEffect(() => {
    if (isAdmin) {
      fetchSalesmen();
      if (selectedSalesman) {
        fetchActivities(selectedSalesman);
      }
      
      // Auto-refresh salesmen status every 30 seconds for immediate AFK recovery detection
      const statusInterval = setInterval(() => {
        fetchSalesmen();
      }, 30000); // 30 seconds
      
      // If real-time is enabled, refresh activities more frequently
      let activityInterval: NodeJS.Timeout | null = null;
      if (realTimeEnabled && selectedSalesman) {
        activityInterval = setInterval(() => fetchActivities(selectedSalesman), 2000);
      }
      
      return () => {
        clearInterval(statusInterval);
        if (activityInterval) {
          clearInterval(activityInterval);
        }
      };
    }
  }, [isAdmin, selectedSalesman, realTimeEnabled, filter]);

  const fetchSalesmen = async () => {
    try {
      console.log('Fetching specific salesmen...');
      
      const salesmenEmails = [
        'jukka@envaire.com',
        'tuomas@envaire.com', 
        'jesse@envaire.com',
        'tuukka@envaire.com'
      ];

      const salesmenWithStats = [];

      for (const email of salesmenEmails) {
        let userId = `demo-${email.split('@')[0]}`;
        let isOnline = false;
        let lastActivity = null;
        let activityCount = 0;

        // Check if user is actually logged in by checking user_roles
        try {
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('user_id, created_at')
            .eq('email', email)
            .maybeSingle();
          
          if (userRole) {
            userId = userRole.user_id;
            isOnline = true; // If they have a user_roles entry, they're logged in
            console.log(`${email} is logged in with user ID:`, userId);
          } else {
            console.log(`${email} is not logged in (no user_roles entry)`);
          }
        } catch (err) {
          console.log(`Error checking login status for ${email}:`, err);
        }

        // Get most recent activity for this email
        try {
          const { data: recentActivity } = await supabase
            .from('activity_logs')
            .select('timestamp, action_details')
            .eq('user_email', email)
            .order('timestamp', { ascending: false })
            .limit(1);
          
          if (recentActivity && recentActivity.length > 0) {
            lastActivity = recentActivity[0].timestamp;
            console.log(`Last activity for ${email}:`, lastActivity, recentActivity[0].action_details);
          }
        } catch (err) {
          console.log(`Error fetching recent activity for ${email}:`, err);
        }

        // Get activity count for today
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const { count } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_email', email)
            .gte('timestamp', today.toISOString());
            
          activityCount = count || 0;
          console.log(`Activity count for ${email} today:`, activityCount);
        } catch (err) {
          console.log(`Error fetching activity count for ${email}:`, err);
        }

        // Determine online status
        let onlineStatus: 'online' | 'idle' | 'afk' | 'offline' = 'offline';
        let displayLastActivity = lastActivity; // Always use the actual last activity
        
        if (isOnline && lastActivity) {
          const lastActivityTime = new Date(lastActivity).getTime();
          const now = Date.now();
          const timeDiff = now - lastActivityTime;
          
          if (timeDiff < 5 * 60 * 1000) { // 5 minutes - active
            onlineStatus = 'online';
          } else if (timeDiff < AFK_THRESHOLD) { // 10 minutes - idle
            onlineStatus = 'idle';
          } else if (timeDiff < IDLE_THRESHOLD) { // 30 minutes - AFK
            onlineStatus = 'afk';
          } else {
            onlineStatus = 'idle'; // Still logged in but very inactive
          }
        } else if (isOnline && !lastActivity) {
          onlineStatus = 'online'; // Logged in but no activity yet
        } else if (!isOnline && lastActivity) {
          onlineStatus = 'offline'; // Not logged in but has historical activity
        }

        salesmenWithStats.push({
          user_id: userId,
          email: email,
          last_activity: displayLastActivity,
          total_actions: activityCount,
          online_status: onlineStatus
        });
      }

      console.log('Salesmen with real status:', salesmenWithStats);
      setSalesmen(salesmenWithStats);
    } catch (error) {
      console.error('Error fetching salesmen:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate AFK notifications for admin
  const generateAFKNotifications = async () => {
    if (!isAdmin) return;

    try {
      const afkSalesmen = salesmen.filter(s => s.online_status === 'afk');
      
      if (afkSalesmen.length > 0) {
        console.log(`🚨 Found ${afkSalesmen.length} AFK salesmen:`, afkSalesmen.map(s => s.email));
        
        // Create notifications for each AFK salesman
        const notifications = afkSalesmen.map(salesman => ({
          type: 'inactive_salesman',
          title: `🚨 AFK Alert: ${salesman.email}`,
          message: `${salesman.email} has been inactive for over 10 minutes. They may need attention.`,
          salesman_id: salesman.user_id,
          salesman_email: salesman.email,
          priority: 'medium',
          data: {
            last_activity: salesman.last_activity,
            total_actions_today: salesman.total_actions,
            notification_type: 'afk_detection'
          }
        }));

        // Insert AFK notifications
        const { error } = await supabase
          .from('admin_notifications')
          .insert(notifications.map(n => ({ ...n, is_read: false })));

        if (error) {
          console.error('Error creating AFK notifications:', error);
        } else {
          console.log(`✅ Created ${notifications.length} AFK notifications`);
        }
      }
    } catch (error) {
      console.error('Error generating AFK notifications:', error);
    }
  };

  // Check for AFK users every 2 minutes
  useEffect(() => {
    if (!isAdmin) return;

    const afkCheckInterval = setInterval(() => {
      generateAFKNotifications();
    }, 2 * 60 * 1000); // Check every 2 minutes

    return () => clearInterval(afkCheckInterval);
  }, [isAdmin, salesmen]);

  const fetchActivities = async (userId: string) => {
    try {
      const salesman = salesmen.find(s => s.user_id === userId);
      if (!salesman) return;
      
      console.log(`Fetching activities for ${salesman.email}`);
      
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('user_email', salesman.email)
        .order('timestamp', { ascending: false });

      // Apply time filter
      if (filter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('timestamp', today.toISOString());
      } else if (filter === 'hour') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        query = query.gte('timestamp', oneHourAgo.toISOString());
      }

      const { data, error } = await query.limit(100);
      if (error) {
        console.error('Error fetching activities:', error);
        setActivities([]);
        return;
      }
      
      console.log(`Found ${data?.length || 0} activities for ${salesman.email}`);
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setActivities([]);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'click': return MousePointer;
      case 'view': return Eye;
      case 'edit': return Edit;
      case 'create': return Plus;
      case 'delete': return Trash2;
      case 'call': return Phone;
      case 'email': return Mail;
      default: return Clock;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'click': return 'bg-blue-100 text-blue-600';
      case 'view': return 'bg-green-100 text-green-600';
      case 'edit': return 'bg-yellow-100 text-yellow-600';
      case 'create': return 'bg-purple-100 text-purple-600';
      case 'delete': return 'bg-red-100 text-red-600';
      case 'call': return 'bg-orange-100 text-orange-600';
      case 'email': return 'bg-indigo-100 text-indigo-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getOnlineStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'afk': return 'bg-orange-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    return date.toLocaleString();
  };

  if (!isAdmin) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 data-grid"></div>
      <div className="relative tech-card rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden glow-green">
        <div className="flex items-center justify-between p-6 border-b border-green-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-900 bg-opacity-30 rounded-lg flex items-center justify-center glow-green">
              <Monitor className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-300">Monitoring Room</h2>
              <p className="text-sm text-green-400">Real-time salesman activity tracking</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={realTimeEnabled}
                onChange={(e) => setRealTimeEnabled(e.target.checked)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-green-400">Real-time</span>
            </label>
            <button
              onClick={onClose}
              className="text-green-400 hover:text-green-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Salesmen List */}
          <div className="w-80 border-r border-green-800 bg-green-900 bg-opacity-10">
            <div className="p-4 border-b border-green-800">
              <h3 className="font-semibold text-green-300 mb-3">Salesmen ({salesmen.length})</h3>
              <button
                onClick={fetchSalesmen}
                className="w-full tech-button text-white px-3 py-2 rounded-lg transition-colors text-sm flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
            </div>
            <div className="overflow-y-auto h-full">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-green-400 text-sm">Loading salesmen...</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {salesmen.map((salesman) => (
                    <div
                      key={salesman.user_id}
                      onClick={() => setSelectedSalesman(salesman.user_id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedSalesman === salesman.user_id
                          ? 'bg-green-900 bg-opacity-30 border-2 border-green-500 glow-green'
                          : 'tech-card hover:bg-green-800 hover:bg-opacity-20 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-green-900 bg-opacity-30 rounded-full flex items-center justify-center glow-green">
                            <User className="w-4 h-4 text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-green-300 text-sm truncate">
                              {salesman.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-green-500 truncate">{salesman.email}</p>
                          </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${getOnlineStatusColor(salesman.online_status)}`}></div>
                      </div>
                      <div className="flex justify-between text-xs text-green-500">
                        <span>{salesman.total_actions} actions today</span>
                        <span className="capitalize">{salesman.online_status}</span>
                      </div>
                      {salesman.last_activity && (
                        <p className="text-xs text-green-400 mt-1">
                          Last activity: {formatTimestamp(salesman.last_activity)}
                        </p>
                      )}
                      {!salesman.last_activity && salesman.online_status === 'online' && (
                        <p className="text-xs text-green-400 mt-1">
                          Just logged in
                        </p>
                      )}
                      {!salesman.last_activity && salesman.online_status === 'offline' && (
                        <p className="text-xs text-green-400 mt-1">
                          No activity recorded
                        </p>
                      )}
                      {salesman.online_status === 'afk' && (
                        <p className="text-xs text-orange-400 mt-1 font-medium animate-pulse">
                          ⚠️ AFK - Admin notified
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="flex-1 flex flex-col">
            {selectedSalesman ? (
              <>
                <div className="p-4 border-b border-green-800 tech-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-green-300">
                        Activity Feed - {salesmen.find(s => s.user_id === selectedSalesman)?.email}
                      </h3>
                      <p className="text-sm text-green-400">
                        {activities.length} activities {filter === 'today' ? 'today' : filter === 'hour' ? 'in last hour' : 'total'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="px-3 py-1 tech-border rounded-lg text-sm focus:ring-2 focus:ring-green-500 text-green-300"
                      >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="hour">Last Hour</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activities.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="w-12 h-12 text-green-400 mx-auto mb-4" />
                      <p className="text-green-400">No activity found for selected time period</p>
                    </div>
                  ) : (
                    activities.map((activity) => {
                      const ActionIcon = getActionIcon(activity.action_type);
                      return (
                        <div
                          key={activity.id}
                          className="tech-card border border-green-800 rounded-lg p-4 hover:glow-green transition-all duration-200"
                        >
                          <div className="flex items-start space-x-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActionColor(activity.action_type)}`}>
                              <ActionIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="font-medium text-green-300 text-sm">
                                  {activity.action_details}
                                </h4>
                                <span className="text-xs text-green-500">
                                  {formatTimestamp(activity.timestamp)}
                                </span>
                              </div>
                              <div className="flex items-center space-x-4 text-xs text-green-500 mb-2">
                                <span className="capitalize">{activity.action_type}</span>
                                <span>{activity.target_type}</span>
                                {activity.target_name && (
                                  <span>→ {activity.target_name}</span>
                                )}
                              </div>
                              {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                                <div className="bg-green-900 bg-opacity-20 rounded p-2 mt-2 border border-green-800">
                                  <p className="text-xs text-green-400 font-medium mb-1">Details:</p>
                                  <div className="text-xs text-green-500 space-y-1">
                                    {Object.entries(activity.metadata).map(([key, value]) => (
                                      <div key={key} className="flex">
                                        <span className="font-medium mr-2">{key}:</span>
                                        <span>{String(value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <User className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-green-300 mb-2">Select a Salesman</h3>
                  <p className="text-green-400">Choose a salesman from the list to view their activity</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringRoom;
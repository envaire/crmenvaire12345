import React from 'react';
import { useState, useEffect } from 'react';
import { Users, Target, Monitor, BarChart3, Settings, LogOut, Eye, Bell, AlertTriangle, DollarSign, Vault } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useUserRole } from '../hooks/useUserRole';
import { supabase } from '../lib/supabase';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onShowSettings: () => void;
  onShowMonitoring: () => void;
  onShowNotifications: () => void;
  onShowSalesmanNotifications: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onTabChange, 
  onShowSettings, 
  onShowMonitoring, 
  onShowNotifications, 
  onShowSalesmanNotifications 
}) => {
  const { signOut, user } = useAuth();
  const { userRole, isAdmin, isSalesman } = useUserRole();
  const [notificationCount, setNotificationCount] = useState(0);
  const [adminNotificationCount, setAdminNotificationCount] = useState(0);

  // Check for salesman notifications count
  useEffect(() => {
    const checkNotifications = async () => {
      if (!user) return;

      try {
        console.log('🔔 Checking notifications for:', user.email);
        
        // Get leads that haven't been contacted in 4+ days for current user
        const fourDaysAgo = new Date();
        fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
        
        const { data: overdueLeads, error } = await supabase
          .from('leads')
          .select('id')
          .eq('user_id', user.id)
          .lt('last_contact', fourDaysAgo.toISOString())
          .neq('status', 'closed-won')
          .neq('status', 'closed-lost');

        if (error) throw error;
        
        const count = overdueLeads?.length || 0;
        console.log(`🔔 Found ${count} overdue leads for ${user.email}`);
        setNotificationCount(count);
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    checkNotifications();
    // Check every 30 seconds for more responsive updates
    const interval = setInterval(checkNotifications, 30 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Check for admin notifications count
  useEffect(() => {
    const checkAdminNotifications = async () => {
      if (!isAdmin) return;

      try {
        console.log('🔔 Checking admin notifications...');
        
        const { count, error } = await supabase
          .from('admin_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false);

        if (error) throw error;
        
        const adminCount = count || 0;
        console.log(`🔔 Found ${adminCount} unread admin notifications`);
        setAdminNotificationCount(adminCount);
      } catch (error) {
        console.error('Error checking admin notifications:', error);
        setAdminNotificationCount(0); // Reset count on error
      }
    };

    if (isAdmin) {
      checkAdminNotifications();
      // Check every 30 seconds for more responsive updates
      const interval = setInterval(checkAdminNotifications, 30 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  // Set up real-time subscriptions for notifications
  useEffect(() => {
    if (!user) return;

    console.log('🔔 Setting up real-time notification subscriptions for:', user.email);

    // Subscribe to leads changes for salesman notifications
    const leadsSubscription = supabase
      .channel('leads-notifications')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'leads', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('🔔 Leads changed, rechecking notifications:', payload);
          // Immediately recheck notifications when leads change
          const checkNotifications = async () => {
            try {
              const fourDaysAgo = new Date();
              fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
              
              const { data: overdueLeads, error } = await supabase
                .from('leads')
                .select('id')
                .eq('user_id', user.id)
                .lt('last_contact', fourDaysAgo.toISOString())
                .neq('status', 'closed-won')
                .neq('status', 'closed-lost');

              if (!error) {
                const count = overdueLeads?.length || 0;
                console.log(`🔔 Real-time update: ${count} overdue leads`);
                setNotificationCount(count);
              }
            } catch (error) {
              console.error('Error in real-time notification check:', error);
            }
          };
          checkNotifications();
        }
      )
      .subscribe();

    // Subscribe to admin notifications for admins
    let adminSubscription = null;
    if (isAdmin) {
      adminSubscription = supabase
        .channel('admin-notifications')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'admin_notifications' },
          (payload) => {
            console.log('🔔 Admin notifications changed:', payload);
            // Immediately recheck admin notifications
            const checkAdminNotifications = async () => {
              try {
                const { count, error } = await supabase
                  .from('admin_notifications')
                  .select('*', { count: 'exact', head: true })
                  .eq('is_read', false);

                if (!error) {
                  const adminCount = count || 0;
                  console.log(`🔔 Real-time admin update: ${adminCount} notifications`);
                  setAdminNotificationCount(adminCount);
                } else {
                  console.error('Error in real-time admin check:', error);
                  setAdminNotificationCount(0);
                }
              } catch (error) {
                console.error('Error in real-time admin notification check:', error);
                setAdminNotificationCount(0);
              }
            };
            checkAdminNotifications();
          }
        )
        .subscribe();
    }

    return () => {
      console.log('🔔 Cleaning up notification subscriptions');
      leadsSubscription.unsubscribe();
      if (adminSubscription) {
        adminSubscription.unsubscribe();
      }
    };
  }, [user, isAdmin]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'projects', label: 'Projects', icon: Target },
    { id: 'demos', label: 'Demos', icon: Monitor },
    { id: 'deals', label: 'Deals', icon: DollarSign },
  ];

  const adminMenuItems = [
    { id: 'treasury', label: 'Treasury', icon: Vault },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="w-full lg:w-64 tech-card shadow-lg h-auto lg:h-full flex flex-col circuit-pattern">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-center">
          <img 
            src="/ENVAIRE LOGO.png" 
            alt="Envaire Logo" 
            className="w-16 h-16 lg:w-20 lg:h-20 object-contain"
          />
        </div>
        {user?.email && (
          <p className="text-xs lg:text-sm text-green-300 mt-2 truncate text-center lg:text-left">{user.email}</p>
        )}
        {userRole && (
          <div className="mt-2">
            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
              isAdmin 
                ? 'bg-red-900 text-red-300 border border-red-500' 
                : 'bg-green-900 text-green-300 border border-green-500'
            }`}>
              {userRole.role}
            </span>
          </div>
        )}
      </div>
      
      <nav className="flex-1 p-2 lg:p-4 data-grid">
        <ul className="space-y-1 lg:space-y-2 flex lg:flex-col overflow-x-auto lg:overflow-x-visible">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className="flex-shrink-0 lg:flex-shrink">
                <button
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-center lg:justify-start space-x-2 lg:space-x-3 px-2 lg:px-4 py-2 lg:py-3 rounded-lg transition-all duration-200 text-xs lg:text-base ${
                    activeTab === item.id
                      ? 'bg-green-900 text-green-400 border-r-2 border-green-500 glow-green'
                      : 'text-green-300 hover:bg-green-800 hover:text-green-200'
                  }`}
                >
                  <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span className="font-medium hidden lg:inline">{item.label}</span>
                  <span className="font-medium lg:hidden text-xs">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        
        {/* Admin-only menu items */}
        {isAdmin && (
          <>
            <div className="mt-4 lg:mt-6 pt-2 lg:pt-4 border-t border-gray-200">
              <div className="text-xs text-green-500 px-2 lg:px-4 py-1 mb-2 hidden lg:block">
                Admin Only
              </div>
              <ul className="space-y-1 lg:space-y-2">
                {adminMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => onTabChange(item.id)}
                        className={`w-full flex items-center justify-center lg:justify-start space-x-2 lg:space-x-3 px-2 lg:px-4 py-2 lg:py-3 rounded-lg transition-all duration-200 text-xs lg:text-base ${
                          activeTab === item.id
                            ? 'bg-purple-900 text-purple-400 border-r-2 border-purple-500 glow-green'
                            : 'text-green-300 hover:bg-green-800 hover:text-green-200'
                        }`}
                      >
                        <Icon className="w-4 h-4 lg:w-5 lg:h-5" />
                        <span className="font-medium hidden lg:inline">{item.label}</span>
                        <span className="font-medium lg:hidden text-xs">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </nav>
      
      <div className="p-2 lg:p-4 border-t border-green-800">
        {/* Show My Notifications for ALL users (both admin and salesman) */}
        {user && (
          <>
            <div className="text-xs text-gray-500 px-2 lg:px-4 py-1 mb-2 hidden lg:block">
              My Notifications
            </div>
            <button
              onClick={onShowSalesmanNotifications}
              className={`w-full flex items-center justify-center lg:justify-between px-2 lg:px-4 py-2 lg:py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded-lg transition-all duration-200 mb-2 relative group ${
                notificationCount > 0 ? 'bg-orange-900 border border-orange-500 animate-pulse glow-green-intense' : 'hover:bg-green-800'
              }`}
            >
              <div className="flex items-center space-x-2 lg:space-x-3">
                <AlertTriangle className={`w-4 h-4 lg:w-5 lg:h-5 transition-colors duration-200 ${
                  notificationCount > 0 ? 'text-orange-400 animate-bounce' : 'text-green-400 group-hover:text-green-300'
                }`} />
                <span className="font-medium text-green-300 hidden lg:inline text-xs lg:text-sm">My Notifications</span>
              </div>
              {notificationCount > 0 && (
                <div className="relative flex items-center">
                  <div className="w-5 h-5 lg:w-6 lg:h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce shadow-lg glow-green">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </div>
                  <div className="absolute inset-0 w-5 h-5 lg:w-6 lg:h-6 bg-red-500 rounded-full animate-ping opacity-75"></div>
                </div>
              )}
            </button>
          </>
        )}
        {isAdmin && (
          <>
            <div className="text-xs text-gray-500 px-2 lg:px-4 py-1 mb-2 hidden lg:block">
              <span className="text-green-500">Admin Tools</span>
            </div>
            <button 
              onClick={onShowNotifications}
              className={`w-full flex items-center justify-center lg:justify-between px-2 lg:px-4 py-2 lg:py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded-lg transition-all duration-200 mb-2 relative group ${
                adminNotificationCount > 0 ? 'bg-red-900 border border-red-500 animate-pulse glow-green-intense' : 'hover:bg-green-800'
              }`}
            >
              <div className="flex items-center space-x-2 lg:space-x-3">
                <Bell className={`w-4 h-4 lg:w-5 lg:h-5 transition-colors duration-200 ${
                  adminNotificationCount > 0 ? 'text-red-400 animate-bounce' : 'text-green-400 group-hover:text-green-300'
                }`} />
                <span className="font-medium text-green-300 hidden lg:inline text-xs lg:text-sm">Admin Alerts</span>
              </div>
              {adminNotificationCount > 0 && (
                <div className="relative flex items-center">
                  <div className="w-5 h-5 lg:w-6 lg:h-6 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce shadow-lg glow-green">
                    {adminNotificationCount > 99 ? '99+' : adminNotificationCount}
                  </div>
                  <div className="absolute inset-0 w-5 h-5 lg:w-6 lg:h-6 bg-red-500 rounded-full animate-ping opacity-75"></div>
                </div>
              )}
            </button>
            <button 
              onClick={onShowMonitoring}
              className="w-full flex items-center justify-center lg:justify-start space-x-2 lg:space-x-3 px-2 lg:px-4 py-2 lg:py-3 text-green-300 hover:bg-green-800 hover:text-green-200 rounded-lg transition-all duration-200 mb-2 text-xs lg:text-sm"
            >
              <Eye className="w-4 h-4 lg:w-5 lg:h-5 text-green-400" />
              <span className="font-medium hidden lg:inline">Monitoring Room</span>
            </button>
          </>
        )}
        <button 
          onClick={handleSignOut}
          className="w-full flex items-center justify-center lg:justify-start space-x-2 lg:space-x-3 px-2 lg:px-4 py-2 lg:py-3 text-green-300 hover:bg-green-800 hover:text-green-200 rounded-lg transition-all duration-200 mb-2 text-xs lg:text-sm"
        >
          <LogOut className="w-4 h-4 lg:w-5 lg:h-5 text-green-400" />
          <span className="font-medium hidden lg:inline">Sign Out</span>
        </button>
        <button 
          onClick={onShowSettings}
          className="w-full flex items-center justify-center lg:justify-start space-x-2 lg:space-x-3 px-2 lg:px-4 py-2 lg:py-3 text-green-300 hover:bg-green-800 hover:text-green-200 rounded-lg transition-all duration-200 text-xs lg:text-sm"
        >
          <Settings className="w-4 h-4 lg:w-5 lg:h-5 text-green-400" />
          <span className="font-medium hidden lg:inline">Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
import React, { useState } from 'react';
import { TestTube, Plus, Calendar, User, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const TestNotifications: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');

  const createTestLeads = async () => {
    if (!user) return;
    
    setLoading(true);
    setMessage('Creating test leads...');
    
    try {
      const now = new Date();
      
      // Create leads with different overdue periods
      const testLeads = [
        {
          user_id: user.id,
          name: 'Test Lead - 5 Days Overdue',
          company: 'Test Company A',
          email: 'test1@example.com',
          phone: '+1234567890',
          status: 'prospect',
          call_status: 'not_called',
          industry: 'Testing',
          last_contact: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          user_id: user.id,
          name: 'Test Lead - 1 Week Overdue',
          company: 'Test Company B',
          email: 'test2@example.com',
          phone: '+1234567891',
          status: 'qualified',
          call_status: 'answered',
          industry: 'Testing',
          last_contact: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
          created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          user_id: user.id,
          name: 'Test Lead - 2 Weeks Overdue (CRITICAL)',
          company: 'Test Company C',
          email: 'test3@example.com',
          phone: '+1234567892',
          status: 'proposal',
          call_status: 'voicemail',
          industry: 'Testing',
          last_contact: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
          created_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          user_id: user.id,
          name: 'Test Lead - 3 Weeks Overdue (CRITICAL)',
          company: 'Test Company D',
          email: 'test4@example.com',
          phone: '+1234567893',
          status: 'negotiation',
          call_status: 'no_response',
          industry: 'Testing',
          last_contact: new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000).toISOString(), // 22 days ago
          created_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          user_id: user.id,
          name: 'Test Lead - Never Called (2+ weeks old)',
          company: 'Test Company E',
          email: 'test5@example.com',
          phone: '+1234567894',
          status: 'prospect',
          call_status: 'not_called',
          industry: 'Testing',
          last_contact: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString(), // 16 days ago
          created_at: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000).toISOString() // Created 16 days ago, never called
        }
      ];

      const { error } = await supabase
        .from('leads')
        .insert(testLeads);

      if (error) throw error;

      setMessage('✅ Test leads created successfully! Now check your notifications.');
    } catch (error) {
      console.error('Error creating test leads:', error);
      setMessage('❌ Error creating test leads: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createTestActivityLogs = async () => {
    if (!user) return;
    
    setLoading(true);
    setMessage('Creating test activity logs...');
    
    try {
      const now = new Date();
      
      // Create some old activity to simulate inactive salesman
      const testActivities = [
        {
          user_id: user.id,
          user_email: user.email || '',
          action_type: 'view',
          action_details: 'Viewed leads page',
          target_type: 'page',
          timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
        },
        {
          user_id: user.id,
          user_email: user.email || '',
          action_type: 'edit',
          action_details: 'Updated lead status',
          target_type: 'lead',
          timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
        }
      ];

      const { error } = await supabase
        .from('activity_logs')
        .insert(testActivities);

      if (error) throw error;

      setMessage('✅ Test activity logs created! Admins should see inactive salesman notifications.');
    } catch (error) {
      console.error('Error creating test activities:', error);
      setMessage('❌ Error creating test activities: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const cleanupTestData = async () => {
    if (!user) return;
    
    setLoading(true);
    setMessage('Cleaning up test data...');
    
    try {
      // Delete test leads
      await supabase
        .from('leads')
        .delete()
        .eq('user_id', user.id)
        .eq('industry', 'Testing');

      // Delete test activities (optional, they don't hurt to keep)
      await supabase
        .from('activity_logs')
        .delete()
        .eq('user_id', user.id)
        .like('action_details', '%test%');

      setMessage('✅ Test data cleaned up successfully!');
    } catch (error) {
      console.error('Error cleaning up test data:', error);
      setMessage('❌ Error cleaning up: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
          <TestTube className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Test Notification System</h3>
          <p className="text-sm text-gray-500">Generate test data to verify notifications work</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={createTestLeads}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <User className="w-4 h-4" />
                <span>Create Test Leads</span>
              </>
            )}
          </button>

          <button
            onClick={createTestActivityLogs}
            disabled={loading}
            className="bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                <span>Create Old Activity</span>
              </>
            )}
          </button>

          <button
            onClick={cleanupTestData}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <TestTube className="w-4 h-4" />
                <span>Cleanup Test Data</span>
              </>
            )}
          </button>
        </div>

        {message && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">{message}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">How to Test:</h4>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li><strong>Create Test Leads</strong> - Generates leads with different overdue periods</li>
            <li><strong>Check Salesman Notifications</strong> - Click "My Notifications" in sidebar</li>
            <li><strong>Check Admin Notifications</strong> - Admins can see "Admin Alerts" in sidebar</li>
            <li><strong>Test Call Actions</strong> - Click "Call Now" buttons to update lead status</li>
            <li><strong>Create Old Activity</strong> - Simulates inactive salesman for admin alerts</li>
            <li><strong>Cleanup</strong> - Remove all test data when done</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default TestNotifications;
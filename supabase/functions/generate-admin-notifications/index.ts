import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Starting admin notification generation...')

    // Clear old notifications (last 24 hours)
    const { error: deleteError } = await supabaseClient
      .from('admin_notifications')
      .delete()
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (deleteError) {
      console.error('Error clearing old notifications:', deleteError)
    }

    // Get all unique user IDs from leads table
    const { data: userIds, error: userIdsError } = await supabaseClient
      .from('leads')
      .select('user_id')
      .not('user_id', 'is', null)

    if (userIdsError) {
      throw userIdsError
    }

    const uniqueUserIds = [...new Set(userIds?.map(l => l.user_id) || [])]
    console.log(`📊 Found ${uniqueUserIds.length} unique users with leads`)

    const notifications = []

    // Process each user
    for (const userId of uniqueUserIds) {
      try {
        // Get user email from user_roles
        const { data: userRole } = await supabaseClient
          .from('user_roles')
          .select('email')
          .eq('user_id', userId)
          .single()

        const userEmail = userRole?.email || `user-${userId}@unknown.com`
        console.log(`🔍 Processing user: ${userEmail}`)

        const now = new Date()
        const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

        // Get overdue leads (4+ days)
        const { data: overdueLeads, error: overdueError } = await supabaseClient
          .from('leads')
          .select('id, name, company, last_contact, call_status')
          .eq('user_id', userId)
          .lt('last_contact', fourDaysAgo.toISOString())
          .neq('status', 'closed-won')
          .neq('status', 'closed-lost')

        if (overdueError) {
          console.error(`Error fetching overdue leads for ${userEmail}:`, overdueError)
          continue
        }

        // Get stale leads (2+ weeks)
        const { data: staleLeads, error: staleError } = await supabaseClient
          .from('leads')
          .select('id, name, company, last_contact, call_status')
          .eq('user_id', userId)
          .lt('last_contact', twoWeeksAgo.toISOString())
          .neq('status', 'closed-won')
          .neq('status', 'closed-lost')

        if (staleError) {
          console.error(`Error fetching stale leads for ${userEmail}:`, staleError)
          continue
        }

        // Get uncalled leads (2+ weeks old)
        const { data: uncalledLeads, error: uncalledError } = await supabaseClient
          .from('leads')
          .select('id, name, company, created_at')
          .eq('user_id', userId)
          .eq('call_status', 'not_called')
          .lt('created_at', twoWeeksAgo.toISOString())

        if (uncalledError) {
          console.error(`Error fetching uncalled leads for ${userEmail}:`, uncalledError)
          continue
        }

        console.log(`📊 ${userEmail}: ${overdueLeads?.length || 0} overdue, ${staleLeads?.length || 0} stale, ${uncalledLeads?.length || 0} uncalled`)

        // Create notification for overdue leads (4+ days)
        if (overdueLeads && overdueLeads.length > 0) {
          notifications.push({
            type: 'stale_lead',
            title: `📈 ${overdueLeads.length} Overdue Leads (4+ Days) - ${userEmail}`,
            message: `${userEmail} has ${overdueLeads.length} leads not contacted in 4+ days. Regular follow-up needed to keep leads warm.`,
            salesman_id: userId,
            salesman_email: userEmail,
            priority: overdueLeads.length > 20 ? 'high' : overdueLeads.length > 10 ? 'medium' : 'low',
            data: {
              count: overdueLeads.length,
              leads: overdueLeads.slice(0, 10),
              days_overdue: 4,
              notification_type: 'overdue_leads'
            }
          })
        }

        // Create notification for stale leads (2+ weeks)
        if (staleLeads && staleLeads.length > 0) {
          notifications.push({
            type: 'stale_lead',
            title: `🚨 CRITICAL: ${staleLeads.length} Stale Leads (2+ Weeks) - ${userEmail}`,
            message: `${userEmail} has ${staleLeads.length} leads not contacted in 2+ weeks. URGENT: These leads are at high risk of being lost!`,
            salesman_id: userId,
            salesman_email: userEmail,
            priority: 'high',
            data: {
              count: staleLeads.length,
              leads: staleLeads.slice(0, 10),
              days_overdue: 14,
              notification_type: 'stale_leads'
            }
          })
        }

        // Create notification for uncalled leads
        if (uncalledLeads && uncalledLeads.length > 0) {
          notifications.push({
            type: 'no_calls',
            title: `📞 ${uncalledLeads.length} Uncalled Leads - ${userEmail}`,
            message: `${userEmail} has ${uncalledLeads.length} leads that have never been called (2+ weeks old). Initial contact is critical.`,
            salesman_id: userId,
            salesman_email: userEmail,
            priority: uncalledLeads.length > 5 ? 'high' : uncalledLeads.length > 2 ? 'medium' : 'low',
            data: {
              count: uncalledLeads.length,
              leads: uncalledLeads.slice(0, 10),
              days_old: 14,
              notification_type: 'uncalled_leads'
            }
          })
        }

      } catch (error) {
        console.error(`Error processing user ${userId}:`, error)
      }
    }

    // Insert all notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('admin_notifications')
        .insert(notifications.map(n => ({ ...n, is_read: false })))

      if (insertError) {
        console.error('Error inserting notifications:', insertError)
        throw insertError
      }

      console.log(`✅ Created ${notifications.length} admin notifications`)
    } else {
      console.log('ℹ️ No notifications to create')
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notifications.length,
        users_processed: uniqueUserIds.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in generate-admin-notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
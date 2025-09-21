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

    console.log('🤖 Auto-generating notifications...')

    // Get all users who have leads
    const { data: userIds, error: userIdsError } = await supabaseClient
      .from('leads')
      .select('user_id')
      .not('user_id', 'is', null)

    if (userIdsError) {
      throw userIdsError
    }

    const uniqueUserIds = [...new Set(userIds?.map(l => l.user_id) || [])]
    console.log(`👥 Processing ${uniqueUserIds.length} users`)

    const now = new Date()
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Clear old admin notifications (older than 24 hours)
    await supabaseClient
      .from('admin_notifications')
      .delete()
      .lt('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())

    const notifications = []

    // Process each user
    for (const userId of uniqueUserIds) {
      try {
        // Get user email
        const { data: userRole } = await supabaseClient
          .from('user_roles')
          .select('email')
          .eq('user_id', userId)
          .single()

        const userEmail = userRole?.email || `user-${userId}@unknown.com`

        // Get overdue leads (4+ days)
        const { data: overdueLeads } = await supabaseClient
          .from('leads')
          .select('id, name, company, last_contact')
          .eq('user_id', userId)
          .lt('last_contact', fourDaysAgo.toISOString())
          .neq('status', 'closed-won')
          .neq('status', 'closed-lost')

        // Get stale leads (2+ weeks)
        const { data: staleLeads } = await supabaseClient
          .from('leads')
          .select('id, name, company, last_contact')
          .eq('user_id', userId)
          .lt('last_contact', twoWeeksAgo.toISOString())
          .neq('status', 'closed-won')
          .neq('status', 'closed-lost')

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
          })
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
          })
        }

      } catch (error) {
        console.error(`Error processing user ${userId}:`, error)
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('admin_notifications')
        .insert(notifications.map(n => ({ ...n, is_read: false })))

      if (insertError) {
        console.error('Error inserting notifications:', insertError)
      } else {
        console.log(`✅ Created ${notifications.length} notifications`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_created: notifications.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error in auto-generate-notifications:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
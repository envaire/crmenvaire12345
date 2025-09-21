import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, Project, Demo, Activity, Deal } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const useSupabaseData = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [demos, setDemos] = useState<Demo[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch projects with lead names
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch demos
      const { data: demosData, error: demosError } = await supabase
        .from('demos')
        .select('*')
        .order('created_at', { ascending: false });

      if (demosError) throw demosError;

      // Fetch activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false });

      if (activitiesError) throw activitiesError;

      // Fetch deals for current user
      const { data: dealsData, error: dealsError } = await supabase
        .from('deals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (dealsError) throw dealsError;
      // Transform data to match frontend types
      const transformedLeads: Lead[] = leadsData?.map(lead => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone || '',
        company: lead.company || '',
        position: lead.position || '',
        status: lead.status as Lead['status'],
        call_status: lead.call_status as Lead['call_status'],
        industry: lead.industry || '',
        value: lead.value || 0,
        createdAt: new Date(lead.created_at).toLocaleDateString(),
        lastContact: new Date(lead.last_contact).toLocaleDateString(),
        notes: lead.notes || '',
        website: lead.website || '',
        revenue: lead.revenue || '',
        ceo: lead.ceo || '',
        whose_phone: lead.whose_phone || '',
        go_skip: lead.go_skip || '',
      })) || [];

      const transformedProjects: Project[] = projectsData?.map(project => ({
        id: project.id,
        title: project.title,
        company: project.company,
        description: project.description,
        expectedCloseDate: new Date(project.deadline).toLocaleDateString(),
        createdAt: new Date(project.created_at).toLocaleDateString(),
        notes: project.notes || '',
      })) || [];

      const transformedDemos: Demo[] = demosData?.map(demo => ({
        id: demo.id,
        title: demo.title,
        description: demo.description || '',
        leadId: demo.lead_id,
        projectId: demo.project_id,
        priority: demo.priority as Demo['priority'],
        status: demo.status as Demo['status'],
        dueDate: new Date(demo.due_date).toLocaleDateString(),
        createdAt: new Date(demo.created_at).toLocaleDateString(),
      })) || [];

      const transformedActivities: Activity[] = activitiesData?.map(activity => ({
        id: activity.id,
        type: activity.type as Activity['type'],
        title: activity.title,
        description: activity.description || '',
        leadId: activity.lead_id,
        projectId: activity.project_id,
        createdAt: new Date(activity.created_at).toLocaleDateString(),
      })) || [];

      const transformedDeals: Deal[] = dealsData?.map(deal => ({
        id: deal.id,
        user_id: deal.user_id,
        lead_id: deal.lead_id,
        title: deal.title,
        company: deal.company,
        description: deal.description,
        deal_value: deal.deal_value,
        payment_type: deal.payment_type,
        monthly_amount: deal.monthly_amount,
        installation_fee: deal.installation_fee,
        contract_length_months: deal.contract_length_months,
        closed_date: deal.closed_date,
        status: deal.status,
        salesman_name: deal.salesman_name,
        salesman_email: deal.salesman_email,
        created_at: deal.created_at,
        updated_at: deal.updated_at,
      })) || [];
      setLeads(transformedLeads);
      setProjects(transformedProjects);
      setDemos(transformedDemos);
      setActivities(transformedActivities);
      setDeals(transformedDeals);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  return {
    leads,
    projects,
    demos,
    activities,
    deals,
    loading,
    refetch: fetchData,
  };
};
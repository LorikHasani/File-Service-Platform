import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { 
  Job, 
  JobWithDetails, 
  Service, 
  ServiceCategory, 
  JobMessage,
  Transaction,
  CreditPackage,
  Profile,
  JobStatus 
} from '@/types/database';

// ============================================================================
// JOBS HOOKS
// ============================================================================

export function useJobs(status?: JobStatus) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const fetchJobs = async () => {
      try {
        let query = supabase
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isAdmin) {
          query = query.eq('client_id', profile.id);
        }

        if (status) {
          query = query.eq('status', status);
        }

        const { data, error } = await query;
        
        if (!isActive) return;
        
        if (error) throw error;
        setJobs(data || []);
        setLoading(false);
      } catch (err) {
        if (isActive) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchJobs();

    return () => {
      isActive = false;
    };
  }, [profile?.id, isAdmin, status]);

  return { jobs, loading, error };
}

export function useJob(jobId: string | undefined) {
  const [job, setJob] = useState<JobWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [counter, setCounter] = useState(0);
  const profile = useAuthStore((s) => s.profile);

  const refetch = () => setCounter(c => c + 1);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const fetchJob = async () => {
      try {
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (!isActive) return;
        if (jobError) throw jobError;

        const { data: services } = await supabase
          .from('job_services')
          .select('*')
          .eq('job_id', jobId);

        const { data: files } = await supabase
          .from('files')
          .select('*')
          .eq('job_id', jobId);

        const { data: client } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', jobData.client_id)
          .single();

        if (isActive) {
          setJob({
            ...jobData,
            services: services || [],
            files: files || [],
            client: client || undefined,
          });
          setLoading(false);
        }
      } catch (err) {
        if (isActive) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchJob();

    // Unique channel name per user + job to avoid conflicts
    const uniqueId = profile?.id || Math.random().toString(36).substring(7);
    const channelName = `job-${jobId}-${uniqueId}`;
    
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `job_id=eq.${jobId}` }, () => {
        if (isActive) fetchJob();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` }, () => {
        if (isActive) fetchJob();
      })
      .subscribe();

    return () => { 
      isActive = false;
      supabase.removeChannel(channel); 
    };
  }, [jobId, counter, profile?.id]);

  return { job, loading, error, refetch };
}

// Create job with services
export async function createJob(
  vehicleData: {
    vehicle_brand: string;
    vehicle_model: string;
    vehicle_year: number;
    engine_type: string;
    engine_power_hp?: number;
    ecu_type?: string;
    gearbox_type?: string;
    vin?: string;
    mileage?: number;
    fuel_type?: string;
    client_notes?: string;
  },
  serviceCodes: string[]
): Promise<{ jobId: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('create_job_with_services', {
      p_vehicle_brand: vehicleData.vehicle_brand,
      p_vehicle_model: vehicleData.vehicle_model,
      p_vehicle_year: vehicleData.vehicle_year,
      p_engine_type: vehicleData.engine_type,
      p_service_codes: serviceCodes,
      p_engine_power_hp: vehicleData.engine_power_hp || null,
      p_ecu_type: vehicleData.ecu_type || null,
      p_gearbox_type: vehicleData.gearbox_type || null,
      p_vin: vehicleData.vin || null,
      p_mileage: vehicleData.mileage || null,
      p_fuel_type: vehicleData.fuel_type || null,
      p_client_notes: vehicleData.client_notes || null,
    });

    if (error) throw error;
    
    // Refresh profile to update credit balance
    await useAuthStore.getState().fetchProfile();
    
    return { jobId: data, error: null };
  } catch (err) {
    return { jobId: null, error: err as Error };
  }
}

// Update job status (admin)
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  adminNotes?: string
): Promise<{ error: Error | null }> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
      assigned_admin_id: user.id,
    };

    if (status === 'in_progress') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

// Request revision
export async function requestRevision(
  jobId: string,
  reason: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('request_job_revision', {
      p_job_id: jobId,
      p_reason: reason,
    });

    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

// ============================================================================
// SERVICES HOOKS
// ============================================================================

export function useServices() {
  const [categories, setCategories] = useState<(ServiceCategory & { services: Service[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      const { data: cats } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      const { data: servs } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      const categoriesWithServices = (cats || []).map(cat => ({
        ...cat,
        services: (servs || []).filter(s => s.category_id === cat.id),
      }));

      setCategories(categoriesWithServices);
      setLoading(false);
    };

    fetchServices();
  }, []);

  return { categories, loading };
}

// ============================================================================
// FILES
// ============================================================================

export async function uploadFile(
  jobId: string,
  file: File,
  fileType: 'original' | 'modified'
): Promise<{ error: Error | null }> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    const filePath = `${jobId}/${fileType}/${Date.now()}_${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('ecu-files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase.from('files').insert({
      job_id: jobId,
      file_type: fileType,
      original_name: file.name,
      storage_path: filePath,
      file_size: file.size,
      uploaded_by: user.id,
    });

    if (dbError) throw dbError;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

export async function downloadFile(storagePath: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from('ecu-files')
    .download(storagePath);

  if (error) throw error;

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// MESSAGES HOOKS - SIMPLE VERSION
// ============================================================================

export function useJobMessages(jobId: string | undefined) {
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!jobId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let isActive = true;

    const fetchMessages = async () => {
      try {
        const { data } = await supabase
          .from('job_messages')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });

        if (isActive) {
          setMessages(data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
        if (isActive) setLoading(false);
      }
    };

    setLoading(true);
    fetchMessages();

    // Unique channel name per user + job
    const uniqueId = profile?.id || Math.random().toString(36).substring(7);
    const channelName = `messages-${jobId}-${uniqueId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'job_messages', filter: `job_id=eq.${jobId}` },
        (payload) => {
          if (isActive) {
            // Add new message to state directly
            const newMsg = payload.new as JobMessage;
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [jobId, profile?.id]);

  // Send message function
  const sendMessage = async (message: string, isInternal = false): Promise<{ error: Error | null }> => {
    const user = useAuthStore.getState().user;
    if (!user || !jobId) {
      return { error: new Error('Not authenticated') };
    }

    try {
      const { data, error } = await supabase
        .from('job_messages')
        .insert({
          job_id: jobId,
          sender_id: user.id,
          message,
          is_internal: isInternal,
        })
        .select()
        .single();

      if (error) {
        console.error('Send message error:', error);
        return { error };
      }

      // Optimistically add message to state (realtime might also add it, but we check for duplicates)
      if (data) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.id)) return prev;
          return [...prev, data];
        });
      }
      
      return { error: null };
    } catch (err) {
      console.error('sendMessage error:', err);
      return { error: err as Error };
    }
  };

  const refetch = async () => {
    if (!jobId) return;
    const { data } = await supabase
      .from('job_messages')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  return { messages, loading, sendMessage, refetch };
}

// ============================================================================
// TRANSACTIONS HOOKS
// ============================================================================

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      setTransactions(data || []);
      setLoading(false);
    };

    fetchTransactions();
  }, [profile?.id]);

  return { transactions, loading };
}

// ============================================================================
// CREDIT PACKAGES
// ============================================================================

export function useCreditPackages() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      const { data } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      setPackages(data || []);
      setLoading(false);
    };

    fetchPackages();
  }, []);

  return { packages, loading };
}

// ============================================================================
// ADMIN HOOKS
// ============================================================================

export function useAllJobs() {
  const [jobs, setJobs] = useState<(Job & { client?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const fetchJobs = async () => {
      try {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isActive) return;

        if (jobsError) throw jobsError;

        if (!jobsData || jobsData.length === 0) {
          setJobs([]);
          setLoading(false);
          return;
        }

        // Fetch client profiles
        const jobsWithClients = await Promise.all(
          jobsData.map(async (job) => {
            const { data: clientData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', job.client_id)
              .single();
            return { ...job, client: clientData || undefined };
          })
        );

        if (isActive) {
          setJobs(jobsWithClients);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (isActive) {
          setError(String(err));
          setLoading(false);
        }
      }
    };

    setLoading(true);
    fetchJobs();

    // Unique channel per user
    const channelName = `admin-jobs-${profile.id}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        if (isActive) fetchJobs();
      })
      .subscribe();

    return () => { 
      isActive = false;
      supabase.removeChannel(channel); 
    };
  }, [profile?.id]);

  return { jobs, loading, error };
}

export function useAllUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(data || []);
      setLoading(false);
    };

    fetchUsers();
  }, [profile?.id]);

  const addCredits = async (userId: string, amount: number, description: string) => {
    try {
      // Direct update instead of RPC
      const { data: currentUser } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single();

      if (!currentUser) throw new Error('User not found');

      const newBalance = (currentUser.credit_balance || 0) + amount;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credit_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log transaction
      const user = useAuthStore.getState().user;
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'admin_adjustment',
        amount,
        balance_before: currentUser.credit_balance || 0,
        balance_after: newBalance,
        description,
        processed_by: user?.id,
      });

      // Refresh users list
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setUsers(data || []);

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return { users, loading, addCredits };
}

// Dashboard stats
export function useAdminStats() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    inProgressJobs: 0,
    completedToday: 0,
    totalRevenue: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      setLoading(true);
      try {
        const { count: totalJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true });

        const { count: pendingJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: inProgressJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'in_progress');

        const today = new Date().toISOString().split('T')[0];
        const { count: completedToday } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('completed_at', today);

        const { data: revenueData } = await supabase
          .from('jobs')
          .select('credits_used');
        
        const totalRevenue = (revenueData || []).reduce((sum, j) => sum + (j.credits_used || 0), 0);

        const { count: totalUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'client');

        setStats({
          totalJobs: totalJobs || 0,
          pendingJobs: pendingJobs || 0,
          inProgressJobs: inProgressJobs || 0,
          completedToday: completedToday || 0,
          totalRevenue,
          totalUsers: totalUsers || 0,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile?.id]);

  return { stats, loading };
}

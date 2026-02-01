import { useState, useEffect, useCallback } from 'react';
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
    // Always set loading false if no profile yet
    if (!profile) {
      // Check if we're still initializing
      const isLoading = useAuthStore.getState().isLoading;
      if (!isLoading) {
        setLoading(false);
      }
      return;
    }

    let isMounted = true;

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

        if (!isMounted) return;

        if (error) throw error;
        setJobs(data || []);
        setError(null);
      } catch (err) {
        if (isMounted) setError(err as Error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchJobs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`jobs-list-${profile.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          if (isMounted) fetchJobs();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [profile?.id, isAdmin, status]);

  const refetch = () => {
    if (profile) {
      setLoading(true);
      // Re-trigger effect by updating state
    }
  };

  return { jobs, loading, error, refetch };
}

export function useJob(jobId: string | undefined) {
  const [job, setJob] = useState<JobWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      setJob(null);
      return;
    }

    let isMounted = true;

    const fetchJob = async () => {
      try {
        // Fetch job
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (!isMounted) return;
        if (jobError) throw jobError;

        // Fetch services
        const { data: services } = await supabase
          .from('job_services')
          .select('*')
          .eq('job_id', jobId);

        // Fetch files
        const { data: files } = await supabase
          .from('files')
          .select('*')
          .eq('job_id', jobId);

        // Fetch client profile
        const { data: client } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', jobData.client_id)
          .single();

        if (isMounted) {
          setJob({
            ...jobData,
            services: services || [],
            files: files || [],
            client: client || undefined,
          });
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching job:', err);
        if (isMounted) setError(err as Error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchJob();

    // Subscribe to job updates
    const jobChannel = supabase
      .channel(`job-detail-${jobId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        () => { if (isMounted) fetchJob(); }
      )
      .subscribe();

    // Subscribe to file updates
    const filesChannel = supabase
      .channel(`files-detail-${jobId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'files', filter: `job_id=eq.${jobId}` },
        () => { if (isMounted) fetchJob(); }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(jobChannel);
      supabase.removeChannel(filesChannel);
    };
  }, [jobId, refreshKey]);

  const refetch = () => setRefreshKey(k => k + 1);

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
    return { jobId: data, error: null };
  } catch (err) {
    return { jobId: null, error: err as Error };
  }
}

// Update job status (admin) - using direct update instead of RPC
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  adminNotes?: string
): Promise<{ error: Error | null }> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    console.log('Updating job status:', { jobId, status, adminNotes });

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
      assigned_admin_id: user.id,
    };

    // Add timestamps based on status
    if (status === 'in_progress') {
      updateData.started_at = new Date().toISOString();
    } else if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Add admin notes if provided
    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    const { error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', jobId);

    if (error) {
      console.error('Update job status error:', error);
      throw error;
    }

    console.log('Job status updated successfully');
    return { error: null };
  } catch (err) {
    console.error('updateJobStatus error:', err);
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
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        // Fetch categories
        const { data: cats, error: catError } = await supabase
          .from('service_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (catError) throw catError;

        // Fetch services
        const { data: services, error: svcError } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (svcError) throw svcError;

        // Group services by category
        const categoriesWithServices = (cats || []).map((cat) => ({
          ...cat,
          services: (services || []).filter((s) => s.category_id === cat.id),
        }));

        setCategories(categoriesWithServices);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  return { categories, loading, error };
}

// ============================================================================
// FILES HOOKS
// ============================================================================

export async function uploadFile(
  jobId: string,
  file: File,
  fileType: 'original' | 'modified'
): Promise<{ error: Error | null }> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    // Upload to Supabase Storage
    const filePath = `${jobId}/${fileType}/${Date.now()}_${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('ecu-files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Create file record
    const { error: dbError } = await supabase.from('files').insert({
      job_id: jobId,
      file_type: fileType,
      original_name: file.name,
      storage_path: filePath,
      file_size: file.size,
      uploaded_by: user.id,
    });

    if (dbError) throw dbError;

    // If admin uploads modified file, optionally mark job as completed
    // This is handled in the UI now

    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

export async function downloadFile(storagePath: string, fileName: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from('ecu-files')
    .download(storagePath);

  if (error) throw error;

  // Create download link
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
// MESSAGES HOOKS
// ============================================================================

export function useJobMessages(jobId: string | undefined) {
  const [messages, setMessages] = useState<(JobMessage & { sender?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch messages
  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      setMessages([]);
      return;
    }

    let isMounted = true;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('job_messages')
          .select('*')
          .eq('job_id', jobId)
          .order('created_at', { ascending: true });

        if (!isMounted) return;

        if (error) {
          console.error('Error fetching messages:', error);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          // Fetch sender profiles
          const messagesWithSenders = await Promise.all(
            data.map(async (msg) => {
              const { data: sender } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', msg.sender_id)
                .single();
              return { ...msg, sender: sender || undefined };
            })
          );
          if (isMounted) setMessages(messagesWithSenders);
        } else {
          if (isMounted) setMessages([]);
        }
      } catch (err) {
        console.error('fetchMessages error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchMessages();

    // Subscribe to realtime changes
    const channelName = `messages-${jobId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_messages', filter: `job_id=eq.${jobId}` },
        () => {
          if (isMounted) fetchMessages();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [jobId, refreshKey]);

  // Send message function - simple, no useCallback
  const sendMessage = async (message: string, isInternal = false): Promise<{ error: Error | null }> => {
    const user = useAuthStore.getState().user;
    if (!user || !jobId) {
      return { error: new Error('Not authenticated') };
    }

    try {
      const { error } = await supabase.from('job_messages').insert({
        job_id: jobId,
        sender_id: user.id,
        message,
        is_internal: isInternal,
      });

      if (error) {
        console.error('Send message error:', error);
        return { error };
      }

      // Trigger a refresh
      setRefreshKey(k => k + 1);
      return { error: null };
    } catch (err) {
      console.error('sendMessage error:', err);
      return { error: err as Error };
    }
  };

  const refetch = () => setRefreshKey(k => k + 1);

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
    if (!profile) return;

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
  }, [profile]);

  return { transactions, loading };
}

// ============================================================================
// CREDIT PACKAGES HOOKS
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
      // Check if auth is still loading
      const isAuthLoading = useAuthStore.getState().isLoading;
      if (!isAuthLoading) {
        setLoading(false);
      }
      return;
    }

    let isMounted = true;

    const fetchJobs = async () => {
      try {
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isMounted) return;

        if (jobsError) {
          console.error('Error fetching jobs:', jobsError);
          setError(jobsError.message);
          setLoading(false);
          return;
        }

        if (!jobsData || jobsData.length === 0) {
          setJobs([]);
          setLoading(false);
          return;
        }

        // Fetch client profiles for each job
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

        if (isMounted) {
          setJobs(jobsWithClients);
          setError(null);
        }
      } catch (err) {
        console.error('Error in fetchJobs:', err);
        if (isMounted) setError(String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchJobs();

    // Subscribe to changes
    const channel = supabase
      .channel(`admin-all-jobs-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => { if (isMounted) fetchJobs(); }
      )
      .subscribe();

    return () => {
      isMounted = false;
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
      const isAuthLoading = useAuthStore.getState().isLoading;
      if (!isAuthLoading) {
        setLoading(false);
      }
      return;
    }

    let isMounted = true;

    const fetchUsers = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (isMounted) {
          setUsers(data || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    setLoading(true);
    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  const addCredits = async (userId: string, amount: number, description: string) => {
    const { error } = await supabase.rpc('admin_add_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
    });

    if (!error) {
      // Refresh users
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      setUsers(data || []);
    }

    return { error };
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
      try {
        // Get job counts
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

        // Get total revenue
        const { data: revenueData } = await supabase
          .from('jobs')
          .select('credits_used');
        
        const totalRevenue = (revenueData || []).reduce((sum, j) => sum + (j.credits_used || 0), 0);

        // Get user count
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

    setLoading(true);
    fetchStats();
  }, [profile?.id]);

  return { stats, loading };
}

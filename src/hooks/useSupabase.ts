import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type { 
  Job, 
  JobWithDetails, 
  JobWithClient,
  Service, 
  ServiceCategory, 
  JobMessage,
  Transaction,
  CreditPackage,
  Profile,
  JobStatus,
  JobService,
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

  const fetchJobs = useCallback(async () => {
    if (!profile) return;
    
    setLoading(true);
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

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;
      setJobs(data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, status]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!profile) return;

    // Build the subscription — filter must be a valid string, not undefined
    const channelConfig: {
      event: '*';
      schema: 'public';
      table: 'jobs';
      filter?: string;
    } = {
      event: '*',
      schema: 'public',
      table: 'jobs',
    };

    // Only apply client filter for non-admin users
    if (!isAdmin) {
      channelConfig.filter = `client_id=eq.${profile.id}`;
    }

    const channel = supabase
      .channel('jobs-changes')
      .on('postgres_changes', channelConfig, () => {
        fetchJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, isAdmin, fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}

export function useJob(jobId: string | undefined) {
  const [job, setJob] = useState<JobWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch job
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

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

      setJob({
        ...jobData,
        services: services || [],
        files: files || [],
        client: client || undefined,
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Subscribe to job updates
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        () => {
          fetchJob();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, fetchJob]);

  return { job, loading, error };
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
      p_engine_power_hp: vehicleData.engine_power_hp,
      p_ecu_type: vehicleData.ecu_type,
      p_gearbox_type: vehicleData.gearbox_type,
      p_vin: vehicleData.vin,
      p_mileage: vehicleData.mileage,
      p_fuel_type: vehicleData.fuel_type,
      p_client_notes: vehicleData.client_notes,
      p_service_codes: serviceCodes,
    });

    if (error) throw error;
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
    const { error } = await supabase.rpc('update_job_status', {
      p_job_id: jobId,
      p_status: status,
      p_admin_notes: adminNotes,
    });

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

  const fetchMessages = useCallback(async () => {
    if (!jobId) return;

    const { data } = await supabase
      .from('job_messages')
      .select('*, sender:profiles(*)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_messages',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, fetchMessages]);

  const sendMessage = async (message: string, isInternal = false) => {
    const user = useAuthStore.getState().user;
    if (!user || !jobId) return { error: new Error('Not authenticated') };

    const { error } = await supabase.from('job_messages').insert({
      job_id: jobId,
      sender_id: user.id,
      message,
      is_internal: isInternal,
    });

    return { error };
  };

  return { messages, loading, sendMessage };
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
  const [jobs, setJobs] = useState<JobWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const fetchJobs = useCallback(async () => {
    if (!isAdmin) return;

    const { data } = await supabase
      .from('jobs')
      .select('*, client:profiles!client_id(*)')
      .order('created_at', { ascending: false });

    // Cast the joined result to our expected type
    setJobs((data as unknown as JobWithClient[]) || []);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchJobs();

    if (!isAdmin) return;

    // Subscribe to changes
    const channel = supabase
      .channel('admin-jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => fetchJobs()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, fetchJobs]);

  return { jobs, loading };
}

// Fetch all jobs with services (for stats page)
export function useAllJobsWithServices() {
  const [jobs, setJobs] = useState<(JobWithClient & { services: JobService[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchJobs = async () => {
      // Fetch jobs with client
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, client:profiles!client_id(*)')
        .order('created_at', { ascending: false });

      if (!jobsData) {
        setJobs([]);
        setLoading(false);
        return;
      }

      // Fetch all job_services in one query
      const jobIds = jobsData.map((j: any) => j.id);
      const { data: servicesData } = await supabase
        .from('job_services')
        .select('*')
        .in('job_id', jobIds);

      // Merge services into jobs
      const jobsWithServices = (jobsData as unknown as JobWithClient[]).map((job) => ({
        ...job,
        services: (servicesData || []).filter((s) => s.job_id === job.id),
      }));

      setJobs(jobsWithServices);
      setLoading(false);
    };

    fetchJobs();
  }, [isAdmin]);

  return { jobs, loading };
}

export function useAllUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    setUsers(data || []);
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const addCredits = async (userId: string, amount: number, description: string) => {
    const { error } = await supabase.rpc('admin_add_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
    });

    if (!error) {
      // Refresh users
      await fetchUsers();
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
  const isAdmin = useAuthStore((s) => s.isAdmin);

  useEffect(() => {
    if (!isAdmin) return;

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
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin]);

  return { stats, loading };
}

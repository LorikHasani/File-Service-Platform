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

  // Subscribe to PRIMITIVES so the effect re-runs when auth state changes,
  // but without causing re-runs on object reference changes.
  // profile?.id: null → "uuid" when profile loads (triggers fetch)
  // isAdmin: boolean, stable
  // refreshKey: bumped after tab-focus session refresh
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!profileId) {
      // Profile not loaded yet — stay in loading state so it retries
      // when profileId changes from null to a real value.
      return;
    }

    setLoading(true);
    const run = async () => {
      try {
        let query = supabase
          .from('jobs')
          .select('*')
          .order('created_at', { ascending: false });

        if (!isAdmin) {
          query = query.eq('client_id', profileId);
        }
        if (status) {
          query = query.eq('status', status);
        }

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        if (!cancelled) setJobs(data || []);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [profileId, isAdmin, status, refreshKey]);

  return { jobs, loading, error };
}

export function useJob(jobId: string | undefined) {
  const [job, setJob] = useState<JobWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!jobId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const run = async () => {
      try {
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', jobId)
          .single();

        if (jobError) throw jobError;

        const [{ data: services }, { data: files }, { data: client }] = await Promise.all([
          supabase.from('job_services').select('*').eq('job_id', jobId),
          supabase.from('files').select('*').eq('job_id', jobId),
          supabase.from('profiles').select('*').eq('id', jobData.client_id).single(),
        ]);

        if (!cancelled) {
          setJob({
            ...jobData,
            services: services || [],
            files: files || [],
            client: client || undefined,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [jobId, refreshKey]);

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
    job_type?: string;
    tcu_type?: string;
  },
  serviceCodes: string[]
): Promise<{ jobId: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('create_job_with_services', {
      p_vehicle_brand: vehicleData.vehicle_brand,
      p_vehicle_model: vehicleData.vehicle_model,
      p_vehicle_year: vehicleData.vehicle_year,
      p_engine_type: vehicleData.engine_type,
      p_engine_power_hp: vehicleData.engine_power_hp ?? null,
      p_ecu_type: vehicleData.ecu_type ?? null,
      p_gearbox_type: vehicleData.gearbox_type ?? null,
      p_vin: vehicleData.vin ?? null,
      p_mileage: vehicleData.mileage ?? null,
      p_fuel_type: vehicleData.fuel_type ?? null,
      p_client_notes: vehicleData.client_notes ?? null,
      p_service_codes: serviceCodes,
    });
    if (error) throw error;

    const jobId = data as string;

    // Set job_type and tcu_type if provided
    if (jobId && (vehicleData.job_type || vehicleData.tcu_type)) {
      await supabase
        .from('jobs')
        .update({
          job_type: vehicleData.job_type || 'ecu',
          tcu_type: vehicleData.tcu_type || null,
        })
        .eq('id', jobId);
    }

    return { jobId, error: null };
  } catch (err) {
    return { jobId: null, error: err as Error };
  }
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  adminNotes?: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.rpc('update_job_status', {
      p_job_id: jobId,
      p_status: status,
      p_admin_notes: adminNotes ?? null,
    });
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

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
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data: cats, error: catError } = await supabase
          .from('service_categories')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (catError) throw catError;

        const { data: services, error: svcError } = await supabase
          .from('services')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        if (svcError) throw svcError;

        if (!cancelled) {
          const typedCats = cats || [];
          const typedServices = services || [];
          setCategories(
            typedCats.map((cat) => ({
              ...cat,
              services: typedServices.filter((s) => s.category_id === cat.id),
            }))
          );
        }
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { categories, loading, error };
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

export async function downloadFile(storagePath: string, fileName: string): Promise<void> {
  const { data, error } = await supabase.storage.from('ecu-files').download(storagePath);
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
// MESSAGES HOOKS
// ============================================================================

export function useJobMessages(jobId: string | undefined) {
  const [messages, setMessages] = useState<(JobMessage & { sender?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  const fetchMessages = useCallback(async () => {
    if (!jobId) return;

    try {
      const { data } = await supabase
        .from('job_messages')
        .select('*, sender:profiles(*)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true });

      setMessages((data as (JobMessage & { sender?: Profile })[]) || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    fetchMessages();
  }, [jobId, refreshKey, fetchMessages]);

  // Poll every 10s
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
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

    if (!error) await fetchMessages();
    return { error };
  };

  return { messages, loading, sendMessage };
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!profileId) {
      return; // Stay loading — will re-run when profileId appears
    }

    const run = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setTransactions(data || []);
        setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [profileId, refreshKey]);

  return { transactions, loading };
}

// ============================================================================
// CREDIT PACKAGES
// ============================================================================

export function useCreditPackages() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      setPackages(data || []);
      setLoading(false);
    };

    run();
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
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!isAdmin) {
      return; // Stay loading — will re-run if isAdmin changes
    }

    const run = async () => {
      try {
        const { data } = await supabase
          .from('jobs')
          .select('*, client:profiles!client_id(*)')
          .order('created_at', { ascending: false });

        if (!cancelled) setJobs((data as unknown as JobWithClient[]) || []);
      } catch (err) {
        console.error('Error fetching all jobs:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isAdmin, refreshKey]);

  return { jobs, loading };
}

export function useAllJobsWithServices() {
  const [jobs, setJobs] = useState<(JobWithClient & { services: JobService[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!isAdmin) {
      return;
    }

    const run = async () => {
      try {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('*, client:profiles!client_id(*)')
          .order('created_at', { ascending: false });

        if (!jobsData) {
          if (!cancelled) { setJobs([]); setLoading(false); }
          return;
        }

        const typedJobs = jobsData as unknown as JobWithClient[];
        const { data: servicesData } = await supabase
          .from('job_services')
          .select('*')
          .in('job_id', typedJobs.map((j) => j.id));

        if (!cancelled) {
          setJobs(
            typedJobs.map((job) => ({
              ...job,
              services: (servicesData || []).filter((s) => s.job_id === job.id),
            }))
          );
        }
      } catch (err) {
        console.error('Error fetching jobs with services:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isAdmin, refreshKey]);

  return { jobs, loading };
}

export function useAllUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, refreshKey]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();
  }, [fetchUsers, isAdmin]);

  const addCredits = async (userId: string, amount: number, description: string) => {
    const { error } = await supabase.rpc('admin_add_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
    });
    if (!error) await fetchUsers();
    return { error };
  };

  return { users, loading, addCredits };
}

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
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!isAdmin) {
      return;
    }

    const run = async () => {
      try {
        const [
          { count: totalJobs },
          { count: pendingJobs },
          { count: inProgressJobs },
          { count: completedToday },
          { data: revenueData },
          { count: totalUsers },
        ] = await Promise.all([
          supabase.from('jobs').select('*', { count: 'exact', head: true }),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
          supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed')
            .gte('completed_at', new Date().toISOString().split('T')[0]),
          supabase.from('jobs').select('credits_used'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        ]);

        if (!cancelled) {
          setStats({
            totalJobs: totalJobs || 0,
            pendingJobs: pendingJobs || 0,
            inProgressJobs: inProgressJobs || 0,
            completedToday: completedToday || 0,
            totalRevenue: (revenueData || []).reduce((sum, j) => sum + (j.credits_used || 0), 0),
            totalUsers: totalUsers || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [isAdmin, refreshKey]);

  return { stats, loading };
}

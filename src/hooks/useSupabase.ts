import { useState, useEffect, useCallback, useRef } from 'react';
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
  FileRecord,
  Ticket,
  TicketWithClient,
  TicketMessage,
  TicketMessageWithSender,
  TicketStatus,
  Announcement,
  Notification,
  JobRating,
  JobRatingWithUser,
  AdminAuditEntryWithAdmin,
  SavedVehicle,
} from '@/types/database';

// ============================================================================
// JOBS HOOKS
// ============================================================================

export function useJobs(status?: JobStatus) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasLoaded = useRef(false);

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

    // Only show loading spinner on initial fetch.
    // On tab-focus re-fetches (refreshKey change), keep stale data visible
    // so the user doesn't see a flash of "no data".
    if (!hasLoaded.current) {
      setLoading(true);
    }

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
        if (!cancelled) {
          setJobs(data || []);
          hasLoaded.current = true;
        }
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
  const hasLoaded = useRef(false);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!jobId) {
      setLoading(false);
      return;
    }

    if (!hasLoaded.current) {
      setLoading(true);
    }

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
          hasLoaded.current = true;
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
    vehicle_year: string;
    engine_type: string;
    ecu_type?: string;
    gearbox_type?: string;
    vin?: string;
    client_notes?: string;
    job_type?: string;
  },
  serviceCodes: string[]
): Promise<{ jobId: string | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('create_job_with_services', {
      p_vehicle_brand: vehicleData.vehicle_brand,
      p_vehicle_model: vehicleData.vehicle_model,
      p_vehicle_year: vehicleData.vehicle_year,
      p_engine_type: vehicleData.engine_type,
      p_engine_power_hp: null,
      p_ecu_type: vehicleData.ecu_type ?? null,
      p_gearbox_type: vehicleData.gearbox_type ?? null,
      p_vin: vehicleData.vin ?? null,
      p_mileage: null,
      p_fuel_type: null,
      p_client_notes: vehicleData.client_notes ?? null,
      p_service_codes: serviceCodes,
    });
    if (error) throw error;

    const jobId = data as string;

    // Set job_type if provided
    if (jobId && vehicleData.job_type) {
      await supabase
        .from('jobs')
        .update({ job_type: vehicleData.job_type })
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
  const hasLoaded = useRef(false);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!hasLoaded.current) {
      setLoading(true);
    }

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
          hasLoaded.current = true;
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
  fileType: 'original' | 'modified',
  revisionNote?: string | null
): Promise<{ error: Error | null; version?: number }> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    // Reserve the next version number for this (job, file_type) pair.
    // Falls back to 1 if the RPC isn't available yet (migration 011 not run).
    let version = 1;
    const { data: nextVersion, error: versionError } = await supabase.rpc(
      'next_file_version',
      { p_job_id: jobId, p_file_type: fileType }
    );
    if (!versionError && typeof nextVersion === 'number') {
      version = nextVersion;
    }

    const filePath = `${jobId}/${fileType}/v${version}_${Date.now()}_${file.name}`;

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
      version,
      revision_note: revisionNote ?? null,
    });
    if (dbError) throw dbError;

    return { error: null, version };
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
  const hasLoaded = useRef(false);
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!profileId) {
      return; // Stay loading — will re-run when profileId appears
    }

    if (!hasLoaded.current) {
      setLoading(true);
    }

    const run = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setTransactions(data || []);
        hasLoaded.current = true;
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
  const hasLoaded = useRef(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!isAdmin) {
      return; // Stay loading — will re-run if isAdmin changes
    }

    if (!hasLoaded.current) {
      setLoading(true);
    }

    const run = async () => {
      try {
        const { data } = await supabase
          .from('jobs')
          .select('*, client:profiles!client_id(*)')
          .order('created_at', { ascending: false });

        if (!cancelled) {
          setJobs((data as unknown as JobWithClient[]) || []);
          hasLoaded.current = true;
        }
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
  const hasLoaded = useRef(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!isAdmin) {
      return;
    }

    if (!hasLoaded.current) {
      setLoading(true);
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
          hasLoaded.current = true;
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

// Admin: issue a refund (creates a `refund` transaction and reduces balance)
export async function adminRefundCredits(params: {
  userId: string;
  amount: number;
  reason: string;
  jobId?: string | null;
  originalTransactionId?: string | null;
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('admin_refund_credits', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_reason: params.reason,
    p_job_id: params.jobId ?? null,
    p_original_transaction_id: params.originalTransactionId ?? null,
  });
  return { error: error as Error | null };
}

export function useUserDetail(userId: string | undefined) {
  const [user, setUser] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<(Job & { services: JobService[] })[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  const fetchUser = useCallback(async () => {
    if (!userId || !isAdmin) return;

    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setUser(profile);

      // Fetch jobs, transactions, and files in parallel
      const [jobsRes, transRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('client_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      const userJobs = jobsRes.data || [];
      setTransactions(transRes.data || []);

      // Fetch job services and files for all jobs
      if (userJobs.length > 0) {
        const jobIds = userJobs.map((j) => j.id);
        const [servicesRes, filesRes] = await Promise.all([
          supabase.from('job_services').select('*').in('job_id', jobIds),
          supabase.from('files').select('*').in('job_id', jobIds).order('created_at', { ascending: false }),
        ]);

        setJobs(
          userJobs.map((job) => ({
            ...job,
            services: (servicesRes.data || []).filter((s) => s.job_id === job.id),
          }))
        );
        setFiles(filesRes.data || []);
      } else {
        setJobs([]);
        setFiles([]);
      }

      hasLoaded.current = true;
    } catch (err) {
      console.error('Error fetching user detail:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin, refreshKey]);

  useEffect(() => {
    if (!userId || !isAdmin) {
      setLoading(false);
      return;
    }
    if (!hasLoaded.current) {
      setLoading(true);
    }
    fetchUser();
  }, [fetchUser, userId, isAdmin]);

  return { user, jobs, transactions, files, loading, refetch: fetchUser };
}

// Transaction joined with the client profile (for the admin transactions page)
export type TransactionWithClient = Transaction & {
  client: Pick<Profile, 'id' | 'contact_name' | 'email' | 'company_name' | 'country'> | null;
};

export function useAllTransactions() {
  const [transactions, setTransactions] = useState<TransactionWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*, client:profiles!user_id(id, contact_name, email, company_name, country)')
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) throw error;
        if (!cancelled) {
          setTransactions((data || []) as TransactionWithClient[]);
        }
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, refreshKey]);

  return { transactions, loading };
}

export function useAdminStats() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    pendingJobs: 0,
    inProgressJobs: 0,
    completedToday: 0,
    totalRevenue: 0,
    grossRevenue: 0,
    totalRefunds: 0,
    totalUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;

    if (!isAdmin) {
      return;
    }

    if (!hasLoaded.current) {
      setLoading(true);
    }

    const run = async () => {
      try {
        const [
          { count: totalJobs },
          { count: pendingJobs },
          { count: inProgressJobs },
          { count: completedToday },
          { data: revenueTxs },
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
          // Pull purchases and refunds — revenue = purchases − refunds.
          // Admin adjustments are intentionally NOT subtracted here: they
          // are used for ad-hoc balance corrections / promos, not refunds.
          // Real refunds go through admin_refund_credits which creates a
          // `refund`-type transaction.
          supabase
            .from('transactions')
            .select('type, amount')
            .in('type', ['credit_purchase', 'refund']),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        ]);

        let grossRevenue = 0;
        let totalRefunds = 0;
        for (const tx of revenueTxs || []) {
          const amount = Number(tx.amount) || 0;
          if (tx.type === 'credit_purchase' && amount > 0) {
            grossRevenue += amount;
          } else if (tx.type === 'refund') {
            totalRefunds += Math.abs(amount);
          }
        }

        if (!cancelled) {
          setStats({
            totalJobs: totalJobs || 0,
            pendingJobs: pendingJobs || 0,
            inProgressJobs: inProgressJobs || 0,
            completedToday: completedToday || 0,
            grossRevenue,
            totalRefunds,
            totalRevenue: grossRevenue - totalRefunds,
            totalUsers: totalUsers || 0,
          });
          hasLoaded.current = true;
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

// ============================================================================
// TICKETS HOOKS
// ============================================================================

export function useTickets() {
  const [tickets, setTickets] = useState<(Ticket | TicketWithClient)[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  const fetchTickets = useCallback(async () => {
    if (!profileId) return;

    try {
      if (isAdmin) {
        const { data } = await supabase
          .from('tickets')
          .select('*, client:profiles!client_id(*)')
          .order('updated_at', { ascending: false });
        setTickets((data as unknown as TicketWithClient[]) || []);
      } else {
        const { data } = await supabase
          .from('tickets')
          .select('*')
          .eq('client_id', profileId)
          .order('updated_at', { ascending: false });
        setTickets(data || []);
      }
      hasLoaded.current = true;
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [profileId, isAdmin, refreshKey]);

  useEffect(() => {
    if (!profileId) return;
    if (!hasLoaded.current) setLoading(true);
    fetchTickets();
  }, [fetchTickets, profileId]);

  return { tickets, loading, refetch: fetchTickets };
}

export function useTicket(ticketId: string | undefined) {
  const [ticket, setTicket] = useState<TicketWithClient | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;
    if (!ticketId) { setLoading(false); return; }
    if (!hasLoaded.current) setLoading(true);

    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, client:profiles!client_id(*)')
          .eq('id', ticketId)
          .single();
        if (error) throw error;
        if (!cancelled) {
          setTicket(data as unknown as TicketWithClient);
          hasLoaded.current = true;
        }
      } catch (err) {
        console.error('Error fetching ticket:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [ticketId, refreshKey]);

  return { ticket, loading };
}

export function useTicketMessages(ticketId: string | undefined) {
  const [messages, setMessages] = useState<TicketMessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!ticketId) return;
    try {
      const { data } = await supabase
        .from('ticket_messages')
        .select('*, sender:profiles(*)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      setMessages((data as unknown as TicketMessageWithSender[]) || []);
    } catch (err) {
      console.error('Error fetching ticket messages:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) { setLoading(false); return; }
    fetchMessages();
  }, [ticketId, fetchMessages]);

  // Poll every 10s
  useEffect(() => {
    if (!ticketId) return;
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [ticketId, fetchMessages]);

  const sendMessage = async (message: string) => {
    const user = useAuthStore.getState().user;
    if (!user || !ticketId) return { error: new Error('Not authenticated') };

    const { error } = await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_id: user.id,
      message,
    });

    if (!error) {
      // Also update ticket's updated_at
      await supabase.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
      await fetchMessages();
    }
    return { error };
  };

  return { messages, loading, sendMessage };
}

export async function createTicket(
  subject: string,
  message: string
): Promise<{ ticketId: string | null; error: Error | null }> {
  try {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Not authenticated');

    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({ client_id: user.id, subject })
      .select()
      .single();
    if (ticketError) throw ticketError;

    const { error: msgError } = await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      message,
    });
    if (msgError) throw msgError;

    return { ticketId: ticket.id, error: null };
  } catch (err) {
    return { ticketId: null, error: err as Error };
  }
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', ticketId);
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

// ============================================================================
// ANNOUNCEMENTS HOOKS
// ============================================================================

export function useAnnouncements(activeOnly = true) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  const fetchAnnouncements = useCallback(async () => {
    try {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data } = await query;
      setAnnouncements(data || []);
      hasLoaded.current = true;
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOnly, refreshKey]);

  useEffect(() => {
    if (!hasLoaded.current) setLoading(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  return { announcements, loading, refetch: fetchAnnouncements };
}

export async function createAnnouncement(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'success',
  imageUrl?: string | null
): Promise<{ error: Error | null }> {
  try {
    const user = useAuthStore.getState().user;
    const { error } = await supabase.from('announcements').insert({
      title,
      message,
      type,
      image_url: imageUrl || null,
      created_by: user?.id || null,
    });
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

export async function updateAnnouncement(
  id: string,
  updates: { title?: string; message?: string; type?: 'info' | 'warning' | 'success'; is_active?: boolean; image_url?: string | null }
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from('announcements')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

export async function deleteAnnouncement(id: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

// ============================================================================
// NOTIFICATIONS HOOKS
// ============================================================================

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const profileId = useAuthStore((s) => s.profile?.id ?? null);

  const fetchNotifications = useCallback(async () => {
    if (!profileId) return;

    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(50);

      const items = data || [];
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.is_read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // Initial fetch
  useEffect(() => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    fetchNotifications();
  }, [profileId, fetchNotifications]);

  // Supabase Realtime: instant notification when a new row is inserted for this user
  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        () => {
          // Refetch on updates (mark as read, etc.)
          fetchNotifications();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profileId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id?: string })?.id;
          if (!deletedId) return;
          setNotifications((prev) => {
            const target = prev.find((n) => n.id === deletedId);
            if (target && !target.is_read) {
              setUnreadCount((c) => Math.max(0, c - 1));
            }
            return prev.filter((n) => n.id !== deletedId);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchNotifications]);

  // Fallback poll every 30s in case realtime connection drops
  useEffect(() => {
    if (!profileId) return;
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [profileId, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!profileId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profileId)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (notificationId: string) => {
    // Optimistic update
    let wasUnread = false;
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === notificationId);
      wasUnread = !!(target && !target.is_read);
      return prev.filter((n) => n.id !== notificationId);
    });
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Failed to delete notification:', error);
      // Roll back on failure
      fetchNotifications();
    }
  };

  const clearAll = async () => {
    if (!profileId) return;
    setNotifications([]);
    setUnreadCount(0);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', profileId);
    if (error) {
      console.error('Failed to clear notifications:', error);
      fetchNotifications();
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refetch: fetchNotifications,
  };
}

// Helper: call the server-side notification API (uses service role → bypasses RLS)
async function callNotificationApi(body: Record<string, unknown>): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch('/api/create-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      console.error('Notification API error:', data.error);
    }
  } catch (err) {
    console.error('Failed to call notification API:', err);
  }
}

// Helper to create a notification for a specific user
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  linkType?: string,
  linkId?: string
): Promise<void> {
  await callNotificationApi({
    action: 'notify_user',
    userId,
    title,
    message,
    linkType: linkType || null,
    linkId: linkId || null,
  });
}

// Helper to notify all admins
export async function notifyAdmins(
  title: string,
  message: string,
  linkType?: string,
  linkId?: string
): Promise<void> {
  await callNotificationApi({
    action: 'notify_admins',
    title,
    message,
    linkType: linkType || null,
    linkId: linkId || null,
  });
}

// ============================================================================
// JOB RATINGS (feature: ratings/reviews after completion)
// ============================================================================

// Returns the current user's rating for a given job (or null if none).
export function useJobRating(jobId: string | undefined) {
  const [rating, setRating] = useState<JobRating | null>(null);
  const [loading, setLoading] = useState(true);
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  const fetch = useCallback(async () => {
    if (!jobId || !profileId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('job_ratings')
      .select('*')
      .eq('job_id', jobId)
      .eq('user_id', profileId)
      .maybeSingle();
    setRating((data as JobRating) || null);
    setLoading(false);
  }, [jobId, profileId]);

  useEffect(() => {
    setLoading(true);
    fetch();
  }, [fetch, refreshKey]);

  return { rating, loading, refetch: fetch };
}

// Admin version: fetches ANY rating for a job (not filtered by current user).
// RLS policy "Admins can view all ratings" grants access.
export function useJobRatingAdmin(jobId: string | undefined) {
  const [rating, setRating] = useState<JobRating | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;
    if (!jobId || !isAdmin) {
      setLoading(false);
      return;
    }
    const run = async () => {
      const { data } = await supabase
        .from('job_ratings')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();
      if (!cancelled) {
        setRating((data as JobRating) || null);
        setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [jobId, isAdmin, refreshKey]);

  return { rating, loading };
}

export async function submitJobRating(params: {
  jobId: string;
  rating: number;
  comment?: string;
  isPublic?: boolean;
}): Promise<{ error: Error | null }> {
  const user = useAuthStore.getState().user;
  if (!user) return { error: new Error('Not authenticated') };

  const { error } = await supabase.from('job_ratings').insert({
    job_id: params.jobId,
    user_id: user.id,
    rating: params.rating,
    comment: params.comment || null,
    is_public: params.isPublic ?? true,
  });
  return { error: error as Error | null };
}

// Publicly-visible ratings for the landing page carousel.
// RLS policy "Anyone can view public ratings" permits anon SELECT.
export function usePublicRatings(limit = 20) {
  const [ratings, setRatings] = useState<JobRatingWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data, error } = await supabase
        .from('job_ratings')
        .select(
          '*, user:profiles!user_id(id, contact_name, company_name, country), job:jobs!job_id(vehicle_brand, vehicle_model, engine_type)'
        )
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!cancelled && !error) {
        setRatings((data as unknown as JobRatingWithUser[]) || []);
      }
      if (!cancelled) setLoading(false);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { ratings, loading };
}

// ============================================================================
// ADMIN AUDIT LOG
// ============================================================================

// Fire-and-forget helper. Errors are logged but never propagated — audit
// failures should never block the primary admin action.
export async function logAdminAction(
  action: string,
  targetType?: string | null,
  targetId?: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_admin_action', {
      p_action: action,
      p_target_type: targetType ?? null,
      p_target_id: targetId ?? null,
      p_metadata: (metadata ?? {}) as unknown as undefined,
    });
    if (error) console.error('logAdminAction failed:', error);
  } catch (err) {
    console.error('logAdminAction threw:', err);
  }
}

export function useAdminAuditLog(limit = 200) {
  const [entries, setEntries] = useState<AdminAuditEntryWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  useEffect(() => {
    let cancelled = false;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const run = async () => {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*, admin:profiles!admin_id(id, contact_name, email)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (!cancelled) {
        if (!error) {
          setEntries((data as unknown as AdminAuditEntryWithAdmin[]) || []);
        }
        setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, refreshKey, limit]);

  return { entries, loading };
}

// ============================================================================
// SAVED VEHICLES
// ============================================================================

export function useSavedVehicles() {
  const [vehicles, setVehicles] = useState<SavedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const refreshKey = useAuthStore((s) => s.refreshKey);

  const fetch = useCallback(async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('saved_vehicles')
      .select('*')
      .eq('user_id', profileId)
      .order('created_at', { ascending: false });
    setVehicles((data as SavedVehicle[]) || []);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetch();
  }, [fetch, refreshKey]);

  const save = async (payload: {
    nickname?: string | null;
    vehicle_brand: string;
    vehicle_model: string;
    vehicle_generation?: string | null;
    vehicle_year?: string | null;
    engine_type: string;
    ecu_type?: string | null;
    gearbox_type?: string | null;
    vin?: string | null;
  }): Promise<{ error: Error | null }> => {
    const user = useAuthStore.getState().user;
    if (!user) return { error: new Error('Not authenticated') };
    const { error } = await supabase.from('saved_vehicles').insert({
      user_id: user.id,
      nickname: payload.nickname ?? null,
      vehicle_brand: payload.vehicle_brand,
      vehicle_model: payload.vehicle_model,
      vehicle_generation: payload.vehicle_generation ?? null,
      vehicle_year: payload.vehicle_year ?? null,
      engine_type: payload.engine_type,
      ecu_type: payload.ecu_type ?? null,
      gearbox_type: payload.gearbox_type ?? null,
      vin: payload.vin ?? null,
    });
    if (!error) await fetch();
    return { error: error as Error | null };
  };

  const remove = async (id: string): Promise<{ error: Error | null }> => {
    const { error } = await supabase.from('saved_vehicles').delete().eq('id', id);
    if (!error) await fetch();
    return { error: error as Error | null };
  };

  return { vehicles, loading, save, remove, refetch: fetch };
}

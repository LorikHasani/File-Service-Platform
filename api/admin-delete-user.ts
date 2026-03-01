import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    // Verify caller is admin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.body;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Prevent self-deletion
    if (userId === caller.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Verify target user exists
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id, contact_name, role')
      .eq('id', userId)
      .single();

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all job IDs for this user
    const { data: userJobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('client_id', userId);

    const jobIds = (userJobs || []).map((j) => j.id);

    // Delete related data in order (respecting foreign keys)
    if (jobIds.length > 0) {
      // Delete files from storage
      const { data: fileRecords } = await supabase
        .from('files')
        .select('storage_path')
        .in('job_id', jobIds);

      if (fileRecords && fileRecords.length > 0) {
        const paths = fileRecords.map((f) => f.storage_path);
        await supabase.storage.from('ecu-files').remove(paths);
      }

      // Delete database records for jobs
      await supabase.from('job_messages').delete().in('job_id', jobIds);
      await supabase.from('files').delete().in('job_id', jobIds);
      await supabase.from('job_services').delete().in('job_id', jobIds);
    }

    // Delete user-level data
    await supabase.from('transactions').delete().eq('user_id', userId);
    await supabase.from('notifications').delete().eq('user_id', userId);

    // Delete jobs
    if (jobIds.length > 0) {
      await supabase.from('jobs').delete().eq('client_id', userId);
    }

    // Delete profile
    await supabase.from('profiles').delete().eq('id', userId);

    // Delete auth user
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Profile is already deleted, log but don't fail
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

import { supabase } from '@/lib/supabase';

export async function sendAdminEmail(
  to: string[],
  subject: string,
  body: string
): Promise<{ success: boolean; sent: number; failed?: number; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ to, subject, body }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to send email');
  }

  return data;
}

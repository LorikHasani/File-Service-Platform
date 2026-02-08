import { supabase } from '@/lib/supabase';

export async function sendNotification(type: 'file_delivered' | 'new_request', jobId: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, jobId }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('Notification failed:', data.error);
    }
  } catch (err) {
    // Don't block the main flow if email fails
    console.error('Failed to send notification:', err);
  }
}

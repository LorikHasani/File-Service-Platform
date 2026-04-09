import React, { useState, useEffect } from 'react';
import { User, Mail, Building, Phone, Bell, Save } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setContactName(profile.contact_name || '');
      setCompanyName(profile.company_name || '');
      setPhone(profile.phone || '');
      setEmailNotifications(profile.email_notifications);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!contactName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        contact_name: contactName.trim(),
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        email_notifications: emailNotifications,
      });
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <Layout title="Profile">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Profile">
      {/* Account Info (read-only) */}
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-700 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-2xl font-bold">
              {profile.contact_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.contact_name}</h2>
              <p className="text-zinc-400">{profile.email}</p>
              <p className="text-zinc-500 text-sm mt-1">
                Member since {format(new Date(profile.created_at), 'MMMM yyyy')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Editable Form */}
      <Card>
        <h2 className="text-lg font-semibold mb-6">Edit Profile</h2>

        <div className="space-y-5 max-w-lg">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              <User size={16} />
              Full Name *
            </label>
            <Input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              <Mail size={16} />
              Email
            </label>
            <Input value={profile.email} disabled className="opacity-60" />
            <p className="text-xs text-zinc-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              <Building size={16} />
              Company Name
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name (optional)"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              <Phone size={16} />
              Phone Number
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your phone number (optional)"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-zinc-500" />
              <div>
                <p className="font-medium text-sm">Email Notifications</p>
                <p className="text-xs text-zinc-500">Receive email updates about your jobs</p>
              </div>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailNotifications ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving} isLoading={saving}>
              <Save size={16} />
              Save Changes
            </Button>
          </div>
        </div>
      </Card>
    </Layout>
  );
};

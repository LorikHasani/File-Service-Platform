import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Share, Bell, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  isIos,
  isStandalone,
  sendTestPush,
  type PushStatus,
} from '@/lib/push';

interface GetAppModalProps {
  open: boolean;
  onClose: () => void;
}

export const GetAppModal: React.FC<GetAppModalProps> = ({ open, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const [pushStatus, setPushStatus] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const portalUrl = window.location.origin;
  const portalHost = portalUrl.replace(/^https?:\/\//, '');
  const iosNeedsInstall = isIos() && !isStandalone();

  useEffect(() => {
    if (open) getPushStatus(user?.id).then(setPushStatus);
  }, [open, user?.id]);

  if (!open) return null;

  const handleEnable = async () => {
    if (!user) return;
    setBusy(true);
    const result = await enablePushNotifications(user.id);
    setBusy(false);

    if (result === 'enabled') {
      setPushStatus('enabled');
      toast.success('Notifications enabled on this device!');
    } else if (result === 'denied') {
      setPushStatus('denied');
      toast.error('Notifications were blocked. Allow them in your browser settings.');
    } else if (result === 'unsupported') {
      toast.error('This browser does not support push notifications.');
    } else {
      toast.error('Could not enable notifications. Please try again.');
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    const ok = await disablePushNotifications();
    setBusy(false);

    if (ok) {
      setPushStatus('disabled');
      toast.success('Notifications disabled on this device.');
    } else {
      toast.error('Could not disable notifications. Please try again.');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await sendTestPush();
    setTesting(false);

    if (result === 'sent') {
      toast.success('Test sent — you should receive it in a few seconds!');
    } else if (result === 'no_subscription') {
      toast.error('No registered device found. Disable and re-enable notifications, then try again.');
    } else {
      toast.error('Could not send the test notification.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center bg-black/70 overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-zinc-900 text-white rounded-2xl border border-zinc-800 shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-600 rounded-xl">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Get the App</h2>
              <p className="text-sm text-zinc-400">Install portal + enable notifications</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* QR code */}
          <div className="text-center">
            <p className="text-sm text-zinc-300 mb-3">
              Scan this QR code with your phone to open the portal:
            </p>
            <div className="inline-block bg-white p-3 rounded-xl">
              <QRCodeSVG value={portalUrl} size={128} />
            </div>
            <p className="mt-2 text-xs text-zinc-500 font-mono">{portalUrl}</p>
          </div>

          {/* iOS */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
               iOS (iPhone / iPad) — requires iOS 16.4+
            </h3>
            <ol className="space-y-1.5 text-sm text-zinc-300 list-none">
              <li>Open this page in <strong>Safari</strong> <span className="text-zinc-500">(not Chrome)</span></li>
              <li>Tap the <strong>Share</strong> button <Share size={14} className="inline text-blue-400" /> at the bottom of the screen</li>
              <li>Tap <strong>"Add to Home Screen"</strong></li>
              <li>The name will show <strong>"{portalHost}"</strong> — keep it as-is, then tap <strong>Add</strong> ✅</li>
              <li><strong>Open the app from your Home Screen</strong> <span className="text-zinc-500">(not Safari!)</span> then tap Enable Notifications below</li>
            </ol>
          </div>

          {/* Android */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              🤖 Android
            </h3>
            <ol className="space-y-1.5 text-sm text-zinc-300 list-none">
              <li>Open this page in <strong>Chrome</strong></li>
              <li>Tap the <strong>⋮ menu</strong> <span className="text-zinc-500">(top right)</span></li>
              <li>Tap <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong></li>
              <li>Tap <strong>Install</strong> — done! ✅</li>
            </ol>
          </div>

          {/* Push notifications */}
          <div className="pt-4 border-t border-zinc-800">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Bell size={16} className="text-red-500" /> Push Notifications
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              Get notified on your phone when your file is ready or support has answered —
              even when you're not in the portal.
            </p>

            {pushStatus === 'enabled' ? (
              <div className="space-y-2">
                <button
                  onClick={handleDisable}
                  disabled={busy}
                  title="Tap to disable notifications on this device"
                  className="w-full py-3 rounded-xl bg-green-600/20 hover:bg-red-600/20 text-green-400 hover:text-red-400 disabled:opacity-60 font-semibold text-sm flex items-center justify-center gap-2 transition-colors group"
                >
                  <Check size={16} className="group-hover:hidden" />
                  <X size={16} className="hidden group-hover:block" />
                  <span className="group-hover:hidden">Notifications enabled — tap to disable</span>
                  <span className="hidden group-hover:block">Disable notifications on this device</span>
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing || busy}
                  className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Bell size={16} />
                  {testing ? 'Sending…' : 'Send Test Notification'}
                </button>
              </div>
            ) : pushStatus === 'denied' ? (
              <div className="w-full py-3 px-4 rounded-xl bg-zinc-800 text-zinc-400 text-sm text-center">
                Notifications are blocked. Allow them for this site in your browser settings, then try again.
              </div>
            ) : iosNeedsInstall ? (
              <div className="w-full py-3 px-4 rounded-xl bg-zinc-800 text-zinc-300 text-sm text-center">
                On iPhone: first add the portal to your Home Screen (steps above), open it from
                there, and this button will work.
              </div>
            ) : (
              <button
                onClick={handleEnable}
                disabled={busy || !user}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 font-semibold text-sm transition-colors"
              >
                {busy ? 'Enabling…' : 'Enable Notifications'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Layout, formatMinutes } from '@/components/Layout';
import { Card, Button, Spinner } from '@/components/ui';
import { useBusinessHours, updateBusinessHours } from '@/hooks/useSupabase';
import toast from 'react-hot-toast';
import type { BusinessHours } from '@/types/database';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Display Monday → Sunday to match the sidebar widget.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// "9:00 AM" style minutes → "HH:MM" value for <input type="time">.
function minutesToTimeValue(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function timeValueToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export const AdminSchedulePage: React.FC = () => {
  const { hours, loading, refetch } = useBusinessHours();
  // Local editable copy keyed by day_of_week.
  const [draft, setDraft] = useState<Record<number, BusinessHours>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const map: Record<number, BusinessHours> = {};
    hours.forEach((h) => {
      map[h.day_of_week] = { ...h };
    });
    setDraft(map);
  }, [hours]);

  const update = (dow: number, changes: Partial<BusinessHours>) => {
    setDraft((prev) => ({ ...prev, [dow]: { ...prev[dow], ...changes } }));
  };

  const isDirty = (dow: number): boolean => {
    const original = hours.find((h) => h.day_of_week === dow);
    const d = draft[dow];
    if (!original || !d) return false;
    return (
      original.is_closed !== d.is_closed ||
      original.open_minutes !== d.open_minutes ||
      original.close_minutes !== d.close_minutes
    );
  };

  const dirtyDays = DISPLAY_ORDER.filter(isDirty);

  const handleSave = async () => {
    // Validate open < close on any open day before saving.
    for (const dow of dirtyDays) {
      const d = draft[dow];
      if (!d.is_closed && d.close_minutes <= d.open_minutes) {
        toast.error(`${DAY_NAMES[dow]}: closing time must be after opening time`);
        return;
      }
    }

    setSaving(true);
    let failed = false;
    for (const dow of dirtyDays) {
      const d = draft[dow];
      const { error } = await updateBusinessHours(dow, {
        is_closed: d.is_closed,
        open_minutes: d.open_minutes,
        close_minutes: d.close_minutes,
      });
      if (error) {
        failed = true;
        break;
      }
    }
    setSaving(false);

    if (failed) {
      toast.error('Failed to save schedule');
    } else {
      toast.success('Schedule updated');
      refetch();
    }
  };

  if (loading) {
    return (
      <Layout title="Working Hours">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Working Hours">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-zinc-500">
          These hours power the "Working Hours" widget and the Portal Open/Closed status in the sidebar.
        </p>
        <Button onClick={handleSave} disabled={saving || dirtyDays.length === 0} isLoading={saving}>
          {dirtyDays.length > 0 ? `Save changes (${dirtyDays.length})` : 'Saved'}
        </Button>
      </div>

      <Card>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {DISPLAY_ORDER.map((dow) => {
            const d = draft[dow];
            if (!d) return null;
            return (
              <div key={dow} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="w-28 flex items-center gap-2 font-medium">
                  <Clock size={16} className="text-zinc-400" />
                  {DAY_NAMES[dow]}
                </div>

                {/* Open / Closed toggle */}
                <button
                  onClick={() => update(dow, { is_closed: !d.is_closed })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    !d.is_closed ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                  title={!d.is_closed ? 'Open — click to mark closed' : 'Closed — click to mark open'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      !d.is_closed ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>

                {d.is_closed ? (
                  <span className="text-sm font-medium text-red-500">Closed</span>
                ) : (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={minutesToTimeValue(d.open_minutes)}
                      onChange={(e) => update(dow, { open_minutes: timeValueToMinutes(e.target.value) })}
                      className="px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                    <span className="text-zinc-400">to</span>
                    <input
                      type="time"
                      value={minutesToTimeValue(d.close_minutes)}
                      onChange={(e) => update(dow, { close_minutes: timeValueToMinutes(e.target.value) })}
                      className="px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                    <span className="hidden sm:inline text-zinc-400 ml-1">
                      ({formatMinutes(d.open_minutes)} – {formatMinutes(d.close_minutes)})
                    </span>
                  </div>
                )}

                {isDirty(dow) && (
                  <span className="ml-auto text-xs text-amber-500 font-medium">Unsaved</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </Layout>
  );
};

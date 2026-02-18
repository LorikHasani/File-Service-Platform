import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Upload, FileText, X, Car, Settings, Check, Zap, Cpu, Gauge } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Textarea, Select, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useServices, createJob, uploadFile } from '@/hooks/useSupabase';
import { sendNotification } from '@/lib/notifications';
import { clsx } from 'clsx';

const optionalNumber = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().positive().optional()
);

const optionalNonNegativeNumber = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().nonnegative().optional()
);

const tcuSchema = z.object({
  vehicle_brand: z.string().min(1, 'Brand is required'),
  vehicle_model: z.string().min(1, 'Model is required'),
  vehicle_year: z.coerce.number().min(1950).max(new Date().getFullYear() + 1),
  engine_type: z.string().min(1, 'Engine type is required'),
  engine_power_hp: optionalNumber,
  ecu_type: z.string().optional(),
  gearbox_type: z.string().min(1, 'Gearbox type is required'),
  tcu_type: z.string().optional(),
  vin: z.string().max(17).optional(),
  mileage: optionalNonNegativeNumber,
  fuel_type: z.string().optional(),
  client_notes: z.string().max(2000).optional(),
});

type TcuFormData = z.infer<typeof tcuSchema>;

const vehicleBrands = [
  'Audi', 'BMW', 'Mercedes-Benz', 'Volkswagen', 'Porsche', 'Ford', 'Chevrolet',
  'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Volvo', 'Jaguar',
];

const gearboxTypes = [
  { value: 'dsg_dq200', label: 'DSG DQ200 (7-speed dry)' },
  { value: 'dsg_dq250', label: 'DSG DQ250 (6-speed wet)' },
  { value: 'dsg_dq381', label: 'DSG DQ381 (7-speed wet)' },
  { value: 'dsg_dq500', label: 'DSG DQ500 (7-speed wet)' },
  { value: 's_tronic_dl501', label: 'S tronic DL501 (7-speed)' },
  { value: 'zf_8hp', label: 'ZF 8HP' },
  { value: 'zf_9hp', label: 'ZF 9HP' },
  { value: 'pdk', label: 'Porsche PDK' },
  { value: 'dct_getrag', label: 'Getrag DCT' },
  { value: 'dct_other', label: 'DCT / Other' },
  { value: 'automatic_torque', label: 'Torque Converter Auto' },
  { value: 'cvt', label: 'CVT' },
  { value: 'smg', label: 'SMG / Automated Manual' },
  { value: 'other', label: 'Other' },
];

const fuelTypes = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'hybrid', label: 'Hybrid' },
];

// TCU-specific services the client can request
const tcuServiceOptions = [
  { code: 'tcu_stage1', name: 'TCU Stage 1', desc: 'Faster shift times, optimized shift points, improved torque handling.', price: 150 },
  { code: 'tcu_stage2', name: 'TCU Stage 2', desc: 'Aggressive shift strategy, raised torque limiter, launch control optimization.', price: 250 },
  { code: 'tcu_launch', name: 'Launch Control', desc: 'Optimized launch control with adjustable RPM and torque delivery.', price: 100 },
  { code: 'tcu_farts', name: 'Flat Shift / No-lift Shift', desc: 'Keep throttle open during gear changes for faster acceleration.', price: 100 },
  { code: 'tcu_torque_limit', name: 'Torque Limiter Increase', desc: 'Raise gearbox torque limits to handle more power from ECU tune.', price: 100 },
  { code: 'tcu_sport_mode', name: 'Sport Mode Enhancement', desc: 'More aggressive behavior in sport/dynamic modes.', price: 80 },
];

export const TcuStagePage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const { categories, loading: servicesLoading } = useServices();
  const [file, setFile] = useState<File | null>(null);
  const [selectedTcuServices, setSelectedTcuServices] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const { register, handleSubmit, formState: { errors } } = useForm<TcuFormData>({
    resolver: zodResolver(tcuSchema),
    defaultValues: { vehicle_year: new Date().getFullYear() },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]!);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.bin', '.ori', '.mod', '.ecu', '.tun', '.frf', '.sgo'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const toggleService = (code: string) => {
    setSelectedTcuServices((prev) => prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]);
  };

  // Use the first matching service from DB for pricing, or fallback to the hardcoded list
  const allDbServices = categories.flatMap((c) => c.services);

  const totalPrice = selectedTcuServices.reduce((sum, code) => {
    const dbService = allDbServices.find((s) => s.code === code);
    if (dbService) return sum + dbService.base_price;
    const localService = tcuServiceOptions.find((s) => s.code === code);
    return sum + (localService?.price || 0);
  }, 0);

  const creditBalance = profile?.credit_balance ?? 0;
  const hasEnoughCredits = creditBalance >= totalPrice;

  const onSubmit = async (data: TcuFormData) => {
    if (!file) {
      toast.error('Please upload a TCU file');
      return;
    }
    if (selectedTcuServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }
    if (!hasEnoughCredits) {
      toast.error('Insufficient credits');
      return;
    }

    setIsSubmitting(true);
    try {
      // Find which service codes exist in DB vs local-only
      const dbCodes = selectedTcuServices.filter((code) => allDbServices.some((s) => s.code === code));
      // For local-only TCU services, we'll pass them in client_notes
      const localCodes = selectedTcuServices.filter((code) => !allDbServices.some((s) => s.code === code));
      const localServiceNames = localCodes.map((code) => tcuServiceOptions.find((s) => s.code === code)?.name).filter(Boolean);

      const notes = [
        data.client_notes || '',
        localServiceNames.length > 0 ? `[TCU Services: ${localServiceNames.join(', ')}]` : '',
      ].filter(Boolean).join('\n');

      const { jobId, error } = await createJob({
        vehicle_brand: data.vehicle_brand,
        vehicle_model: data.vehicle_model,
        vehicle_year: data.vehicle_year,
        engine_type: data.engine_type,
        engine_power_hp: data.engine_power_hp,
        ecu_type: data.ecu_type,
        gearbox_type: data.gearbox_type,
        vin: data.vin,
        mileage: data.mileage,
        fuel_type: data.fuel_type,
        client_notes: notes,
        job_type: 'tcu',
        tcu_type: data.tcu_type,
      }, dbCodes.length > 0 ? dbCodes : selectedTcuServices);

      if (error) throw error;

      if (jobId) {
        const { error: uploadError } = await uploadFile(jobId, file, 'original');
        if (uploadError) console.error('File upload error:', uploadError);

        sendNotification('new_request', jobId);
      }

      await fetchProfile();
      toast.success('TCU job submitted successfully!');
      navigate('/jobs');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create job';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (servicesLoading) {
    return (
      <Layout title="TCU Stage">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="TCU Stage">
      <div className="max-w-4xl mx-auto">
        {/* Header badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="px-3 py-1 bg-blue-600/10 border border-blue-600/20 rounded-full">
            <span className="text-xs font-semibold text-blue-400">TCU / Transmission Tuning</span>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[{ num: 1, label: 'Vehicle' }, { num: 2, label: 'Services' }, { num: 3, label: 'Upload' }].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center">
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm',
                  step >= s.num ? 'bg-red-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                )}>
                  {step > s.num ? <Check size={20} /> : s.num}
                </div>
                <span className={clsx('ml-2 text-sm font-medium hidden sm:block', step >= s.num ? '' : 'text-zinc-500')}>
                  {s.label}
                </span>
              </div>
              {i < 2 && <div className={clsx('w-12 sm:w-24 h-1 mx-2 rounded', step > s.num ? 'bg-red-600' : 'bg-zinc-200 dark:bg-zinc-700')} />}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1: Vehicle + Transmission Info */}
          {step === 1 && (
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Cpu className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Vehicle & Transmission Info</h2>
                  <p className="text-sm text-zinc-500">Enter vehicle and gearbox details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Brand" placeholder="Select brand" options={vehicleBrands.map((b) => ({ value: b, label: b }))} error={errors.vehicle_brand?.message} {...register('vehicle_brand')} />
                <Input label="Model" placeholder="e.g. Golf GTI, A4 2.0 TFSI" error={errors.vehicle_model?.message} {...register('vehicle_model')} />
                <Input label="Year" type="number" error={errors.vehicle_year?.message} {...register('vehicle_year')} />
                <Input label="Engine" placeholder="e.g. EA888, N55" error={errors.engine_type?.message} {...register('engine_type')} />
                <Input label="Power (HP)" type="number" placeholder="Optional" {...register('engine_power_hp')} />
                <Select label="Fuel Type" placeholder="Select" options={fuelTypes} {...register('fuel_type')} />
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Cpu size={18} className="text-blue-500" />
                  Transmission Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select label="Gearbox Type *" placeholder="Select gearbox" options={gearboxTypes} error={errors.gearbox_type?.message} {...register('gearbox_type')} />
                  <Input label="TCU Type" placeholder="e.g. DQ250 02E, Mechatronic" {...register('tcu_type')} />
                  <Input label="ECU Type (if known)" placeholder="e.g. Bosch MED17" {...register('ecu_type')} />
                  <Input label="VIN (optional)" placeholder="17-character VIN" {...register('vin')} />
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button type="button" onClick={() => setStep(2)}>Next: Select Services</Button>
              </div>
            </Card>
          )}

          {/* Step 2: TCU Services */}
          {step === 2 && (
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Settings className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Select TCU Services</h2>
                  <p className="text-sm text-zinc-500">Choose the transmission tuning services you need</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {tcuServiceOptions.map((service) => {
                  const isSelected = selectedTcuServices.includes(service.code);
                  return (
                    <button
                      key={service.code}
                      type="button"
                      onClick={() => toggleService(service.code)}
                      className={clsx(
                        'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all',
                        isSelected
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      )}
                    >
                      <div className={clsx('p-2 rounded-lg', isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800')}>
                        <Cpu size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{service.name}</span>
                          <span className="text-sm font-semibold text-blue-600">{service.price} cr</span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-0.5">{service.desc}</p>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-blue-600" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Total</p>
                    <p className="text-xl font-bold">{totalPrice} Credits</p>
                  </div>
                  <Button type="button" onClick={() => setStep(3)} disabled={selectedTcuServices.length === 0}>Next</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Upload */}
          {step === 3 && (
            <div className="space-y-6">
              <Card>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Upload TCU File</h2>
                    <p className="text-sm text-zinc-500">Upload your original transmission control unit file</p>
                  </div>
                </div>

                <div
                  {...getRootProps()}
                  className={clsx(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                    isDragActive ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/20' : 'border-zinc-300 dark:border-zinc-700 hover:border-blue-600'
                  )}
                >
                  <input {...getInputProps()} />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-10 h-10 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
                      <p className="font-medium">Drop your TCU file here or click to browse</p>
                      <p className="text-sm text-zinc-500 mt-1">.bin, .ori, .mod, .frf, .sgo (max 50MB)</p>
                    </>
                  )}
                </div>

                <Textarea label="Additional Notes" placeholder="Any special requests about your transmission tune..." className="mt-4" rows={3} {...register('client_notes')} />
              </Card>

              <Card>
                <h3 className="font-semibold mb-4">Order Summary</h3>
                <div className="space-y-2">
                  {selectedTcuServices.map((code) => {
                    const service = tcuServiceOptions.find((s) => s.code === code);
                    return (
                      <div key={code} className="flex justify-between text-sm">
                        <span>{service?.name}</span>
                        <span>{service?.price} Credits</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{totalPrice} Credits</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Your Balance</span>
                    <span className={hasEnoughCredits ? 'text-green-600' : 'text-red-600'}>
                      {creditBalance.toFixed(2)} Credits
                    </span>
                  </div>
                  {!hasEnoughCredits && <p className="text-xs text-red-500 mt-1">Insufficient credits</p>}
                </div>
              </Card>

              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" onClick={() => setStep(2)}>Back</Button>
                <Button type="submit" size="lg" isLoading={isSubmitting} disabled={!file || !hasEnoughCredits}>
                  Submit TCU Job ({totalPrice} Credits)
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
};

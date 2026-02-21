import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { Upload, FileText, X, Car, Settings, Check, Zap, Wind, Droplet, Flame, Rocket, Gauge } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Textarea, Select, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useServices, createJob, uploadFile } from '@/hooks/useSupabase';
import { useVehicleApi } from '@/hooks/useVehicleApi';
import { sendNotification } from '@/lib/notifications';
import { clsx } from 'clsx';

// Fix: use z.preprocess to handle empty strings for optional number fields
const optionalNumber = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().positive().optional()
);

const optionalNonNegativeNumber = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().nonnegative().optional()
);

const jobSchema = z.object({
  vehicle_brand: z.string().min(1, 'Brand is required'),
  vehicle_model: z.string().min(1, 'Model is required'),
  vehicle_year: z.string().min(1, 'Generation is required'),
  engine_type: z.string().min(1, 'Engine type is required'),
  engine_power_hp: optionalNumber,
  ecu_type: z.string().optional(),
  gearbox_type: z.string().optional(),
  vin: z.string().max(17).optional(),
  mileage: optionalNonNegativeNumber,
  fuel_type: z.string().optional(),
  client_notes: z.string().max(2000).optional(),
});

type JobFormData = z.infer<typeof jobSchema>;

const gearboxTypes = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'dsg', label: 'DSG/DCT' },
  { value: 'cvt', label: 'CVT' },
];

const fuelTypes = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'hybrid', label: 'Hybrid' },
];

const serviceIcons: Record<string, React.ReactNode> = {
  stage1: <Zap size={20} />,
  stage2: <Rocket size={20} />,
  dpf_off: <Settings size={20} />,
  egr_off: <Wind size={20} />,
  adblue_off: <Droplet size={20} />,
  pops_bangs: <Flame size={20} />,
  launch_control: <Rocket size={20} />,
  speed_limiter: <Gauge size={20} />,
};

export const NewJobPage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const { categories, loading: servicesLoading } = useServices();
  const [file, setFile] = useState<File | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const vehicle = useVehicleApi();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]!);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/octet-stream': ['.bin', '.ori', '.mod', '.ecu', '.tun'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  const allServices = categories.flatMap((c) => c.services);
  const toggleService = (code: string) => {
    setSelectedServices((prev) => prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]);
  };

  const totalPrice = selectedServices.reduce((sum, code) => {
    const service = allServices.find((s) => s.code === code);
    return sum + (service?.base_price || 0);
  }, 0);

  const creditBalance = profile?.credit_balance ?? 0;
  const hasEnoughCredits = creditBalance >= totalPrice;

  const onSubmit = async (data: JobFormData) => {
    if (!file) {
      toast.error('Please upload an ECU file');
      return;
    }
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }
    if (!hasEnoughCredits) {
      toast.error('Insufficient credits');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create job
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
        client_notes: data.client_notes,
      }, selectedServices);

      if (error) throw error;

      // Upload file
      if (jobId) {
        const { error: uploadError } = await uploadFile(jobId, file, 'original');
        if (uploadError) console.error('File upload error:', uploadError);

        // Notify admin via email
        sendNotification('new_request', jobId);
      }

      // Refresh profile to get updated balance
      await fetchProfile();

      toast.success('Job created successfully!');
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
      <Layout title="ECU Stage">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="ECU Stage">
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[{ num: 1, label: 'Vehicle' }, { num: 2, label: 'Services' }, { num: 3, label: 'Upload' }].map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center">
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm',
                  step >= s.num ? 'bg-red-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
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
          {/* Step 1: Vehicle */}
          {step === 1 && (
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Car className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Vehicle Information</h2>
                  <p className="text-sm text-zinc-500">Enter your vehicle details</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Brand (Car) */}
                <Select
                  label="Brand *"
                  placeholder={vehicle.loadingMakes ? 'Loading brands...' : 'Select brand'}
                  options={vehicle.makes}
                  value={vehicle.selectedMake}
                  onChange={(e) => {
                    vehicle.setSelectedMake(e.target.value);
                    const display = vehicle.makes.find(m => m.value === e.target.value)?.label || e.target.value;
                    setValue('vehicle_brand', display);
                  }}
                  disabled={vehicle.loadingMakes}
                  error={errors.vehicle_brand?.message}
                />

                {/* 2. Model (Brand) */}
                <Select
                  label="Model *"
                  placeholder={vehicle.loadingModels ? 'Loading models...' : vehicle.selectedMake ? 'Select model' : 'Select brand first'}
                  options={vehicle.models}
                  value={vehicle.selectedModel}
                  onChange={(e) => {
                    vehicle.setSelectedModel(e.target.value);
                    const display = vehicle.models.find(m => m.value === e.target.value)?.label || e.target.value;
                    setValue('vehicle_model', display);
                  }}
                  disabled={!vehicle.selectedMake || vehicle.loadingModels}
                  error={errors.vehicle_model?.message}
                />

                {/* 3. Generation */}
                <Select
                  label="Generation *"
                  placeholder={vehicle.loadingGenerations ? 'Loading...' : vehicle.selectedModel ? 'Select generation' : 'Select model first'}
                  options={vehicle.generations}
                  value={vehicle.selectedGeneration}
                  onChange={(e) => {
                    vehicle.setSelectedGeneration(e.target.value);
                    const display = vehicle.generations.find(g => g.value === e.target.value)?.label || e.target.value;
                    setValue('vehicle_year', display);
                  }}
                  disabled={!vehicle.selectedModel || vehicle.loadingGenerations}
                  error={errors.vehicle_year?.message}
                />

                {/* 4. Engine */}
                <Select
                  label="Engine *"
                  placeholder={vehicle.loadingEngines ? 'Loading engines...' : vehicle.selectedGeneration ? 'Select engine' : 'Select generation first'}
                  options={vehicle.engines}
                  value={vehicle.selectedEngine}
                  onChange={(e) => {
                    vehicle.setSelectedEngine(e.target.value);
                    const display = vehicle.engines.find(en => en.value === e.target.value)?.label || e.target.value;
                    setValue('engine_type', display);
                  }}
                  disabled={!vehicle.selectedGeneration || vehicle.loadingEngines}
                  error={errors.engine_type?.message}
                />

                {/* 5. ECU — from API */}
                <Select
                  label="ECU Type"
                  placeholder={vehicle.loadingEcus ? 'Loading ECUs...' : vehicle.selectedEngine ? 'Select ECU' : 'Select engine first'}
                  options={vehicle.ecus}
                  value={vehicle.selectedEcu}
                  onChange={(e) => {
                    vehicle.setSelectedEcu(e.target.value);
                    setValue('ecu_type', e.target.value);
                  }}
                  disabled={!vehicle.selectedEngine || vehicle.loadingEcus}
                />

                <Input label="Power (HP)" type="number" placeholder="e.g. 150" {...register('engine_power_hp')} />

                <Select label="Gearbox" placeholder="Select" options={gearboxTypes} {...register('gearbox_type')} />
                <Select label="Fuel Type" placeholder="Select" options={fuelTypes} {...register('fuel_type')} />
              </div>

              <div className="flex justify-end mt-6">
                <Button type="button" onClick={() => setStep(2)}>Next: Select Services</Button>
              </div>
            </Card>
          )}

          {/* Step 2: Services */}
          {step === 2 && (
            <Card>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Settings className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Select Services</h2>
                  <p className="text-sm text-zinc-500">Choose the tuning services you need</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allServices.map((service) => (
                  <button
                    key={service.code}
                    type="button"
                    onClick={() => toggleService(service.code)}
                    className={clsx(
                      'flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all',
                      selectedServices.includes(service.code)
                        ? 'border-red-600 bg-red-50 dark:bg-red-950/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                    )}
                  >
                    <div className={clsx('p-2 rounded-lg', selectedServices.includes(service.code) ? 'bg-red-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800')}>
                      {serviceIcons[service.code] || <Settings size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{service.name}</span>
                        <span className="text-sm font-semibold text-red-600">{service.base_price} cr</span>
                      </div>
                      <p className="text-sm text-zinc-500 mt-0.5">{service.description}</p>
                    </div>
                    {selectedServices.includes(service.code) && <Check className="w-5 h-5 text-red-600" />}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Total</p>
                    <p className="text-xl font-bold">{totalPrice} Credits</p>
                  </div>
                  <Button type="button" onClick={() => setStep(3)} disabled={selectedServices.length === 0}>Next</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Upload */}
          {step === 3 && (
            <div className="space-y-6">
              <Card>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <Upload className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Upload ECU File</h2>
                    <p className="text-sm text-zinc-500">Upload your original ECU file</p>
                  </div>
                </div>

                <div
                  {...getRootProps()}
                  className={clsx(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                    isDragActive ? 'border-red-600 bg-red-50 dark:bg-red-950/20' : 'border-zinc-300 dark:border-zinc-700 hover:border-red-600'
                  )}
                >
                  <input {...getInputProps()} />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-10 h-10 text-red-600" />
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
                      <p className="font-medium">Drop your ECU file here or click to browse</p>
                      <p className="text-sm text-zinc-500 mt-1">.bin, .ori, .mod, .ecu, .tun (max 50MB)</p>
                    </>
                  )}
                </div>

                <Textarea label="Additional Notes" placeholder="Any special requests..." className="mt-4" rows={3} {...register('client_notes')} />
              </Card>

              <Card>
                <h3 className="font-semibold mb-4">Order Summary</h3>
                <div className="space-y-2">
                  {selectedServices.map((code) => {
                    const service = allServices.find((s) => s.code === code);
                    return (
                      <div key={code} className="flex justify-between text-sm">
                        <span>{service?.name}</span>
                        <span>{service?.base_price} Credits</span>
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
                  Submit Job ({totalPrice} Credits)
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </Layout>
  );
};

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import {
  Upload, FileText, X, Check, ChevronRight, ChevronLeft, Info,
  Cpu, Settings, Wrench, Car,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Input, Textarea, Select, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useServices, createJob, uploadFile } from '@/hooks/useSupabase';
import { useVehicleApi } from '@/hooks/useVehicleApi';
import { sendNotification } from '@/lib/notifications';
import { clsx } from 'clsx';

const readingTools = [
  { value: 'kess_v2', label: 'KESS V2' },
  { value: 'ktag', label: 'KTAG' },
  { value: 'autotuner', label: 'Autotuner' },
  { value: 'cmd_flash', label: 'CMD Flash' },
  { value: 'flex', label: 'Flex' },
  { value: 'trasdata', label: 'Trasdata' },
  { value: 'dimsport', label: 'Dimsport' },
  { value: 'magic_motorsport', label: 'Magic Motorsport' },
  { value: 'bitbox', label: 'BitBox' },
  { value: 'pcmflash', label: 'PCMFlash' },
  { value: 'mpps', label: 'MPPS' },
  { value: 'galletto', label: 'Galletto' },
  { value: 'other', label: 'Other' },
];

const toolTypes = [
  { value: 'master', label: 'Master' },
  { value: 'slave', label: 'Slave' },
];

const gearboxOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'dsg', label: 'DSG/DCT' },
  { value: 'cvt', label: 'CVT' },
  { value: 'robotic', label: 'Robotic/AMT' },
];

// ─── Stepper ─────────────────────────────────────────────────────────────────

const StepIndicator: React.FC<{ current: number }> = ({ current }) => {
  const steps = ['Upload File', 'Car Info', 'Services'];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done = current > stepNum;
        const active = current === stepNum;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div className={clsx('w-16 h-0.5 mx-1', done ? 'bg-green-500' : 'bg-zinc-700')} />
            )}
            <div className="flex items-center gap-2">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                done && 'bg-green-500 text-white',
                active && 'bg-blue-600 text-white',
                !done && !active && 'bg-zinc-700 text-zinc-400'
              )}>
                {done ? <Check size={16} /> : stepNum}
              </div>
              <span className={clsx(
                'text-sm font-medium hidden sm:inline',
                active ? 'text-zinc-100' : 'text-zinc-500'
              )}>
                {label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export const NewJobPage: React.FC = () => {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const { categories, loading: servicesLoading } = useServices();
  const vehicle = useVehicleApi();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1
  const [fileType, setFileType] = useState<'ecu' | 'gearbox'>('ecu');
  const [file, setFile] = useState<File | null>(null);

  // Step 2
  const [isOriginal, setIsOriginal] = useState(true);
  const [vin, setVin] = useState('');
  const [gearbox, setGearbox] = useState('');
  const [readingTool, setReadingTool] = useState('');
  const [toolType, setToolType] = useState('master');

  // Step 3
  const [selectedStage, setSelectedStage] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]!);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024,
    multiple: false,
  });

  // Split categories: selection_type='single' → stage cards, rest → option grid
  const stageCategories = useMemo(() =>
    categories.filter((c) => (c as any).selection_type === 'single'), [categories]);
  const optionCategories = useMemo(() =>
    categories.filter((c) => (c as any).selection_type !== 'single'), [categories]);

  const allStageServices = stageCategories.flatMap((c) => c.services);
  const allOptionServices = optionCategories.flatMap((c) => c.services);

  const totalCredits = useMemo(() => {
    let total = 0;
    if (selectedStage) {
      const s = allStageServices.find((x) => x.code === selectedStage);
      if (s) total += s.base_price;
    }
    for (const code of selectedOptions) {
      const s = allOptionServices.find((x) => x.code === code);
      if (s) total += s.base_price;
    }
    return total;
  }, [selectedStage, selectedOptions, allStageServices, allOptionServices]);

  const creditBalance = profile?.credit_balance ?? 0;
  const hasEnoughCredits = creditBalance >= totalCredits;

  const vehicleSummary = [
    vehicle.makes.find((m) => m.value === vehicle.selectedMake)?.label,
    vehicle.models.find((m) => m.value === vehicle.selectedModel)?.label,
    vehicle.engines.find((e) => e.value === vehicle.selectedEngine)?.label,
  ].filter(Boolean).join(' · ');

  const toggleOption = (code: string) => {
    setSelectedOptions((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  const canGoToStep2 = !!file;
  const canGoToStep3 = !!vehicle.selectedMake && !!vehicle.selectedModel
    && !!vehicle.selectedGeneration && !!vehicle.selectedEngine;

  // ─── Submit ──────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!file) return toast.error('Please upload a file');
    if (!hasEnoughCredits) return toast.error('Insufficient credits');
    if (!selectedStage && selectedOptions.length === 0) return toast.error('Select at least one service');

    setIsSubmitting(true);
    try {
      const serviceCodes = [...(selectedStage ? [selectedStage] : []), ...selectedOptions];
      const makeName = vehicle.makes.find((m) => m.value === vehicle.selectedMake)?.label || '';
      const modelName = vehicle.models.find((m) => m.value === vehicle.selectedModel)?.label || '';
      const genName = vehicle.generations.find((g) => g.value === vehicle.selectedGeneration)?.label || '';
      const engineName = vehicle.engines.find((e) => e.value === vehicle.selectedEngine)?.label || '';
      const ecuName = vehicle.ecus.find((e) => e.value === vehicle.selectedEcu)?.label || vehicle.selectedEcu || '';

      const { jobId, error } = await createJob({
        vehicle_brand: makeName,
        vehicle_model: modelName,
        vehicle_year: genName,
        engine_type: engineName,
        ecu_type: ecuName,
        gearbox_type: gearbox,
        vin: vin || undefined,
        job_type: fileType === 'gearbox' ? 'tcu' : 'ecu',
      }, serviceCodes);

      if (error) throw error;

      if (jobId) {
        const { supabase } = await import('@/lib/supabase');
        await supabase.from('jobs').update({
          file_type: fileType,
          is_original: isOriginal,
          reading_tool: readingTool || null,
          tool_type: toolType,
        }).eq('id', jobId);

        const { error: uploadError } = await uploadFile(jobId, file, 'original');
        if (uploadError) console.error('File upload error:', uploadError);
        sendNotification('new_request', jobId);
      }

      await fetchProfile();
      toast.success('Job submitted successfully!');
      navigate('/jobs');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!profile) {
    return <Layout title="Upload"><div className="flex justify-center py-20"><Spinner /></div></Layout>;
  }

  return (
    <Layout title="Upload File">
      <div className="max-w-4xl mx-auto">
        <StepIndicator current={step} />

        {/* ═══════════════════ STEP 1: Upload File ═══════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/20 rounded-lg"><Upload size={20} className="text-blue-400" /></div>
              <div>
                <h2 className="text-xl font-bold">Step 1: Upload Your File</h2>
                <p className="text-sm text-zinc-400">Select your ECU or Gearbox file</p>
              </div>
            </div>

            {/* File Type */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                <Car size={16} /> Select File Type
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'ecu' as const, label: 'ECU File', icon: <Cpu size={36} />, color: 'text-red-500' },
                  { id: 'gearbox' as const, label: 'Gearbox File', icon: <Settings size={36} />, color: 'text-zinc-400' },
                ].map((ft) => (
                  <button
                    key={ft.id}
                    type="button"
                    onClick={() => setFileType(ft.id)}
                    className={clsx(
                      'flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
                      fileType === ft.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                    )}
                  >
                    <div className={ft.color}>{ft.icon}</div>
                    <span className="font-semibold">{ft.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                <Upload size={16} /> Upload File
              </h3>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={clsx(
                    'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                    isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-500'
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload size={24} className="text-blue-400" />
                  </div>
                  <p className="font-semibold text-lg">Click to upload or drag and drop</p>
                  <p className="text-sm text-zinc-500 mt-2">All file types allowed except ZIP, RAR, PHP, EXE (max 50MB)</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-700 bg-zinc-800/50">
                  <FileText size={20} className="text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="p-1 hover:bg-zinc-700 rounded"><X size={16} className="text-zinc-400" /></button>
                </div>
              )}
            </div>

            {/* Bottom */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2 text-sm">
                <Info size={16} className="text-blue-400" />
                <span className="text-zinc-400">Your balance:</span>
                <span className="text-blue-400 font-semibold">{creditBalance} credits</span>
              </div>
              <Button onClick={() => setStep(2)} disabled={!canGoToStep2}>
                Next Step <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 2: Car Info ═══════════════════ */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/20 rounded-lg"><Car size={20} className="text-blue-400" /></div>
              <div>
                <h2 className="text-xl font-bold">Step 2: Vehicle Information</h2>
                <p className="text-sm text-zinc-400">Tell us about your vehicle</p>
              </div>
            </div>

            {/* File bar */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <FileText size={16} className="text-blue-400" />
              <span className="text-sm truncate flex-1">File: {file?.name}</span>
              <span className={clsx('text-xs px-2 py-0.5 rounded font-semibold',
                fileType === 'ecu' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white')}>
                {fileType.toUpperCase()}
              </span>
            </div>

            {/* Original / Modified */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                <Info size={16} /> Is this an original file?
              </h3>
              <div className="flex gap-3">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setIsOriginal(val)}
                    className={clsx(
                      'px-4 py-2.5 rounded-lg text-sm font-medium border transition-all',
                      isOriginal === val
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    )}
                  >
                    <span className={clsx(
                      'inline-block w-2.5 h-2.5 rounded-full mr-2',
                      isOriginal === val ? 'bg-blue-400' : 'bg-zinc-600'
                    )} />
                    {val ? 'Yes, Original' : 'No, Modified'}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                <Car size={16} /> Vehicle Details
              </h3>
              <div className="space-y-4">
                <Select label="Brand *" placeholder={vehicle.loadingMakes ? 'Loading brands...' : 'Select Brand'}
                  options={vehicle.makes} value={vehicle.selectedMake}
                  onChange={(e) => vehicle.setSelectedMake(e.target.value)} disabled={vehicle.loadingMakes} />
                <Select label="Model *" placeholder={vehicle.selectedMake ? 'Select Model' : 'Select Brand first'}
                  options={vehicle.models} value={vehicle.selectedModel}
                  onChange={(e) => vehicle.setSelectedModel(e.target.value)}
                  disabled={!vehicle.selectedMake || vehicle.loadingModels} />
                <Select label="Version/Generation *" placeholder={vehicle.selectedModel ? 'Select Version' : 'Select Model first'}
                  options={vehicle.generations} value={vehicle.selectedGeneration}
                  onChange={(e) => vehicle.setSelectedGeneration(e.target.value)}
                  disabled={!vehicle.selectedModel || vehicle.loadingGenerations} />
                <Select label="Engine *" placeholder={vehicle.selectedGeneration ? 'Select Engine' : 'Select Version first'}
                  options={vehicle.engines} value={vehicle.selectedEngine}
                  onChange={(e) => vehicle.setSelectedEngine(e.target.value)}
                  disabled={!vehicle.selectedGeneration || vehicle.loadingEngines} />
                <Select label="ECU" placeholder={vehicle.selectedEngine ? 'Select ECU' : 'Select Engine first'}
                  options={vehicle.ecus} value={vehicle.selectedEcu}
                  onChange={(e) => vehicle.setSelectedEcu(e.target.value)}
                  disabled={!vehicle.selectedEngine || vehicle.loadingEcus} />
                <Input label="VIN Number" placeholder="17 character VIN" maxLength={17} value={vin} onChange={(e) => setVin(e.target.value)} />
                <Select label="Gearbox" placeholder="Select Gearbox" options={gearboxOptions} value={gearbox} onChange={(e) => setGearbox(e.target.value)} />
              </div>
            </div>

            {/* Reading Tool */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                <Wrench size={16} /> Reading Tool
              </h3>
              <div className="space-y-4">
                <Select label="Select Tool *" placeholder="Select Your Tool" options={readingTools} value={readingTool} onChange={(e) => setReadingTool(e.target.value)} />
                <Select label="Tool Type *" options={toolTypes} value={toolType} onChange={(e) => setToolType(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft size={16} className="mr-1" /> Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canGoToStep3}>Next Step <ChevronRight size={16} className="ml-1" /></Button>
            </div>
          </div>
        )}

        {/* ═══════════════════ STEP 3: Services ═══════════════════ */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
              <div className="p-2 bg-blue-600/20 rounded-lg"><Settings size={20} className="text-blue-400" /></div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold">Select Services</h2>
                <p className="text-sm text-zinc-400 truncate">{vehicleSummary || 'Vehicle'}</p>
              </div>
              <span className={clsx('text-xs px-2.5 py-1 rounded font-semibold',
                fileType === 'ecu' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white')}>
                {fileType === 'ecu' ? 'ECU File' : 'Gearbox File'}
              </span>
              <span className="text-xs px-2.5 py-1 rounded font-semibold bg-zinc-700 text-zinc-300">
                {toolType === 'master' ? 'Master Tool' : 'Slave Tool'}
              </span>
            </div>

            {servicesLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : (
              <>
                {/* Tuning Stages — single select */}
                {stageCategories.map((cat) => (
                  <div key={cat.id}>
                    <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                      <Settings size={16} /> {cat.name} <span className="text-red-500">*</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {cat.services.map((svc) => {
                        const sel = selectedStage === svc.code;
                        return (
                          <button
                            key={svc.code} type="button"
                            onClick={() => setSelectedStage(sel ? '' : svc.code)}
                            className={clsx(
                              'flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all text-center',
                              sel ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                            )}
                          >
                            <Cpu size={24} className={sel ? 'text-blue-400' : 'text-zinc-500'} />
                            <span className="font-semibold text-sm">{svc.name}</span>
                            <span className={clsx('text-sm font-bold', sel ? 'text-blue-400' : 'text-zinc-500')}>
                              {svc.base_price} credits
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Additional Options — multi select */}
                {optionCategories.map((cat) => (
                  <div key={cat.id}>
                    <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white font-bold">+</span>
                      {cat.name}
                      <span className="text-zinc-600">({cat.services.length} available)</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {cat.services.map((svc) => {
                        const sel = selectedOptions.includes(svc.code);
                        return (
                          <button
                            key={svc.code} type="button"
                            onClick={() => toggleOption(svc.code)}
                            className={clsx(
                              'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center',
                              sel ? 'border-green-500 bg-green-500/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                            )}
                          >
                            <Settings size={20} className={sel ? 'text-green-400' : 'text-zinc-500'} />
                            <span className="text-xs font-medium leading-tight">{svc.name}</span>
                            <span className={clsx('text-xs font-bold', sel ? 'text-green-400' : 'text-blue-400')}>
                              +{svc.base_price}
                            </span>
                            {svc.description && (
                              <div className="absolute top-2 right-2">
                                <Info size={12} className="text-zinc-600 hover:text-zinc-400 cursor-help" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {categories.length === 0 && (
                  <Card><div className="text-center py-8 text-zinc-500">No services available yet. Ask the admin to add them.</div></Card>
                )}
              </>
            )}

            {/* Summary */}
            <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Selected services</span>
                <span className="font-semibold">{(selectedStage ? 1 : 0) + selectedOptions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total cost</span>
                <span className="text-xl font-bold text-blue-400">{totalCredits} credits</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Your balance</span>
                <span className={hasEnoughCredits ? 'text-green-400' : 'text-red-400'}>{creditBalance} credits</span>
              </div>
              {!hasEnoughCredits && <p className="text-xs text-red-400">Insufficient credits. Please top up.</p>}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
              <Button variant="ghost" onClick={() => setStep(2)}><ChevronLeft size={16} className="mr-1" /> Back</Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !hasEnoughCredits || (!selectedStage && selectedOptions.length === 0)}
                size="lg" isLoading={isSubmitting}
              >
                Submit Job ({totalCredits} Credits)
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

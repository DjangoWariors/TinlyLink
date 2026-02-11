/**
 * Create Serial Batch Page - Wizard for bulk QR code generation
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  Palette,
  Settings,
  CheckCircle,
  Info,
  Upload,
  Calendar,
  Tag,
  Link2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card, Badge, Modal } from '@/components/common';
import { serialAPI } from '@/services/api';
import type { CreateSerialBatchData } from '@/types';

// Form schema
const batchSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  prefix: z.string().max(20).optional(),
  quantity: z.number().min(1).max(100000),
  destination_url_template: z.string().min(1, 'URL is required').refine(
    (url) => url.includes('{serial}'),
    'URL must contain {serial} placeholder'
  ).refine(
    (url) => {
      try {
        new URL(url.replace('{serial}', 'TEST123'));
        return true;
      } catch {
        return false;
      }
    },
    'Must be a valid URL (with {serial} placeholder)'
  ),
  style: z.string().default('square'),
  frame: z.string().default('none'),
  foreground_color: z.string().default('#000000'),
  background_color: z.string().default('#FFFFFF'),
  eye_style: z.string().default('square'),
  eye_color: z.string().optional().default(''),
  gradient_enabled: z.boolean().default(false),
  gradient_start: z.string().optional().default(''),
  gradient_end: z.string().optional().default(''),
  gradient_direction: z.string().default('vertical'),
  product_name: z.string().max(200).optional(),
  product_sku: z.string().max(100).optional(),
  product_category: z.string().max(100).optional(),
  manufacture_date: z.string().optional(),
  expiry_date: z.string().optional(),
});

type BatchFormData = z.infer<typeof batchSchema>;

// Wizard steps
const STEPS = [
  { id: 'basics', title: 'Basics', icon: Package },
  { id: 'product', title: 'Product Info', icon: Tag },
  { id: 'styling', title: 'QR Styling', icon: Palette },
  { id: 'review', title: 'Review', icon: CheckCircle },
];

// Style options
const STYLE_OPTIONS = [
  { value: 'square', label: 'Square', preview: 'grid' },
  { value: 'dots', label: 'Dots', preview: 'dots' },
  { value: 'rounded', label: 'Rounded', preview: 'rounded' },
];

const FRAME_OPTIONS = [
  { value: 'none', label: 'No Frame' },
  { value: 'simple', label: 'Simple Border' },
  { value: 'scan_me', label: 'Scan Me Badge' },
  { value: 'badge', label: 'ID Badge' },
];

const EYE_STYLE_OPTIONS = [
  { value: 'square', label: 'Square' },
  { value: 'circle', label: 'Circle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'diamond', label: 'Diamond' },
];

const GRADIENT_DIRECTION_OPTIONS = [
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'radial', label: 'Radial' },
];

// Preset quantities
const QUANTITY_PRESETS = [100, 500, 1000, 5000, 10000, 50000];

export function CreateSerialBatchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      name: '',
      description: '',
      prefix: '',
      quantity: 1000,
      destination_url_template: 'https://yoursite.com/verify/{serial}',
      style: 'square',
      frame: 'none',
      foreground_color: '#000000',
      background_color: '#FFFFFF',
      eye_style: 'square',
      eye_color: '',
      gradient_enabled: false,
      gradient_start: '',
      gradient_end: '',
      gradient_direction: 'vertical',
      product_name: '',
      product_sku: '',
      product_category: '',
    },
    mode: 'onChange',
  });

  const watchedValues = watch();

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file must be less than 2MB');
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: BatchFormData) => {
      let batch;

      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        // Append all form fields
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            formData.append(key, String(value));
          }
        });
        batch = await serialAPI.batches.createWithLogo(formData);
      } else {
        const payload: CreateSerialBatchData = {
          ...data,
          manufacture_date: data.manufacture_date || undefined,
          expiry_date: data.expiry_date || undefined,
        };
        batch = await serialAPI.batches.create(payload);
      }
      // Automatically start generation
      await serialAPI.batches.generate(batch.id);
      return batch;
    },
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ['serial-batches'] });
      toast.success('Batch created and generation started!');
      navigate(`/dashboard/serial-batches/${batch.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create batch');
    },
  });

  const onSubmit = (data: BatchFormData) => {
    createMutation.mutate(data);
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Basics
        return watchedValues.name && watchedValues.quantity > 0 && watchedValues.destination_url_template?.includes('{serial}');
      case 1: // Product Info
        return true; // Optional step
      case 2: // Styling
        return true;
      case 3: // Review
        return isValid;
      default:
        return true;
    }
  };

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard/serial-batches')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Serial Batch</h1>
          <p className="text-gray-500 mt-1">Generate unique QR codes for product authentication</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => index <= currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : isComplete
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isComplete ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
                <span className="hidden sm:inline font-medium">{step.title}</span>
              </button>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${isComplete ? 'bg-green-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Basics */}
        {currentStep === 0 && (
          <Card>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Batch Details
            </h2>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Input
                    label="Batch Name"
                    placeholder="e.g., Summer 2026 Product Launch"
                    {...register('name')}
                    error={errors.name?.message}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Description (optional)</label>
                  <textarea
                    className="input min-h-20"
                    placeholder="Describe this batch..."
                    {...register('description')}
                  />
                </div>

                <div>
                  <Input
                    label="Serial Prefix"
                    placeholder="e.g., PRD-"
                    {...register('prefix')}
                    error={errors.prefix?.message}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional prefix for serial numbers (e.g., PRD-A1B2C3D4)
                  </p>
                </div>

                <div>
                  <label className="label">Quantity</label>
                  <div className="flex gap-2 mb-2">
                    {QUANTITY_PRESETS.slice(0, 4).map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setValue('quantity', qty)}
                        className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                          watchedValues.quantity === qty
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {qty.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    placeholder="1000"
                    {...register('quantity', { valueAsNumber: true })}
                    error={errors.quantity?.message}
                  />
                </div>
              </div>

              <div>
                <Input
                  label="Verification URL Template"
                  placeholder="https://yoursite.com/verify/{serial}"
                  leftIcon={<Link2 className="w-4 h-4" />}
                  {...register('destination_url_template')}
                  error={errors.destination_url_template?.message}
                />
                <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded-lg">
                  <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Use {'{serial}'} as placeholder</p>
                    <p className="text-blue-600">
                      Example: https://yoursite.com/verify/{'{serial}'} becomes
                      https://yoursite.com/verify/PRD-A1B2C3D4
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </Card>
        )}

        {/* Step 2: Product Info */}
        {currentStep === 1 && (
          <Card>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Product Information
            </h2>

            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Optional but recommended</p>
                  <p>
                    Adding product information helps customers verify authenticity and
                    provides better tracking in your dashboard.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Product Name"
                  placeholder="e.g., Premium Widget Pro"
                  {...register('product_name')}
                />

                <Input
                  label="Product SKU"
                  placeholder="e.g., WGT-PRO-001"
                  {...register('product_sku')}
                />

                <Input
                  label="Product Category"
                  placeholder="e.g., Electronics, Cosmetics"
                  {...register('product_category')}
                />

                <div>
                  <label className="label flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Manufacture Date
                  </label>
                  <Input
                    type="date"
                    {...register('manufacture_date')}
                  />
                </div>

                <div>
                  <label className="label flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Expiry Date
                  </label>
                  <Input
                    type="date"
                    {...register('expiry_date')}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Styling */}
        {currentStep === 2 && (
          <Card>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              QR Code Styling
            </h2>

            <div className="space-y-6">
              {/* Style Selection */}
              <div>
                <label className="label">QR Code Style</label>
                <Controller
                  name="style"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-3 gap-4">
                      {STYLE_OPTIONS.map((style) => (
                        <button
                          key={style.value}
                          type="button"
                          onClick={() => field.onChange(style.value)}
                          className={`p-4 rounded-lg border-2 text-center transition-all ${
                            field.value === style.value
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="w-16 h-16 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center">
                            {/* Simple QR preview representation */}
                            <div className={`w-10 h-10 ${
                              style.value === 'dots' ? 'rounded-full' :
                              style.value === 'rounded' ? 'rounded-lg' : ''
                            } border-4 border-gray-400`} />
                          </div>
                          <span className="font-medium">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Frame Selection */}
              <div>
                <label className="label">Frame Style</label>
                <Controller
                  name="frame"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {FRAME_OPTIONS.map((frame) => (
                        <button
                          key={frame.value}
                          type="button"
                          onClick={() => field.onChange(frame.value)}
                          className={`p-3 rounded-lg border-2 text-center transition-all ${
                            field.value === frame.value
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-sm font-medium">{frame.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Foreground Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      {...register('foreground_color')}
                      className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
                    />
                    <Input
                      {...register('foreground_color')}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      {...register('background_color')}
                      className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
                    />
                    <Input
                      {...register('background_color')}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Eye Style */}
              <div>
                <label className="label">Eye / Corner Style</label>
                <Controller
                  name="eye_style"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                      {EYE_STYLE_OPTIONS.map((eye) => (
                        <button
                          key={eye.value}
                          type="button"
                          onClick={() => field.onChange(eye.value)}
                          className={`p-3 rounded-lg border-2 text-center transition-all ${
                            field.value === eye.value
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-sm font-medium">{eye.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>

              {/* Eye Color */}
              <div>
                <label className="label">Eye Color (optional)</label>
                <p className="text-xs text-gray-500 mb-2">Leave empty to match foreground color</p>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="color"
                    {...register('eye_color')}
                    className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
                  />
                  <Input
                    {...register('eye_color')}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Gradient */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <label className="label mb-0">Enable Gradient</label>
                  <Controller
                    name="gradient_enabled"
                    control={control}
                    render={({ field }) => (
                      <button
                        type="button"
                        onClick={() => field.onChange(!field.value)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          field.value ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            field.value ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}
                  />
                </div>
                {watchedValues.gradient_enabled && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label">Gradient Start</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            {...register('gradient_start')}
                            className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
                          />
                          <Input
                            {...register('gradient_start')}
                            placeholder="#000000"
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="label">Gradient End</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            {...register('gradient_end')}
                            className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
                          />
                          <Input
                            {...register('gradient_end')}
                            placeholder="#FFFFFF"
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="label">Gradient Direction</label>
                      <Controller
                        name="gradient_direction"
                        control={control}
                        render={({ field }) => (
                          <div className="grid grid-cols-4 gap-3">
                            {GRADIENT_DIRECTION_OPTIONS.map((dir) => (
                              <button
                                key={dir.value}
                                type="button"
                                onClick={() => field.onChange(dir.value)}
                                className={`p-2 rounded-lg border-2 text-center transition-all ${
                                  field.value === dir.value
                                    ? 'border-primary bg-primary/5'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <span className="text-sm font-medium">{dir.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Logo Upload */}
              <div>
                <label className="label">Logo (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {logoPreview ? (
                  <div className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-12 h-12 object-contain rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {logoFile?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {logoFile && (logoFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-center"
                  >
                    <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                    <p className="text-sm text-gray-600">Click to upload logo</p>
                    <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 2MB. Square images work best.</p>
                  </button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Step 4: Review */}
        {currentStep === 3 && (
          <Card>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Review & Create
            </h2>

            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Batch Info */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Batch Details
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Name:</dt>
                      <dd className="font-medium">{watchedValues.name || 'Not set'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Quantity:</dt>
                      <dd className="font-medium">{watchedValues.quantity?.toLocaleString()}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Prefix:</dt>
                      <dd className="font-mono">{watchedValues.prefix || 'None'}</dd>
                    </div>
                  </dl>
                </div>

                {/* Product Info */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Product Info
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Product:</dt>
                      <dd className="font-medium">{watchedValues.product_name || 'Not set'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">SKU:</dt>
                      <dd className="font-mono">{watchedValues.product_sku || 'Not set'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Category:</dt>
                      <dd>{watchedValues.product_category || 'Not set'}</dd>
                    </div>
                  </dl>
                </div>

                {/* Styling */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Styling
                  </h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">Style:</dt>
                      <dd className="font-medium capitalize">{watchedValues.style}</dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">Frame:</dt>
                      <dd className="font-medium capitalize">{watchedValues.frame?.replace('_', ' ')}</dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">Eye Style:</dt>
                      <dd className="font-medium capitalize">{watchedValues.eye_style}</dd>
                    </div>
                    <div className="flex justify-between items-center">
                      <dt className="text-gray-500">Colors:</dt>
                      <dd className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded border"
                          style={{ backgroundColor: watchedValues.foreground_color }}
                        />
                        <span
                          className="w-5 h-5 rounded border"
                          style={{ backgroundColor: watchedValues.background_color }}
                        />
                        {watchedValues.eye_color && (
                          <span
                            className="w-5 h-5 rounded border"
                            style={{ backgroundColor: watchedValues.eye_color }}
                            title="Eye color"
                          />
                        )}
                      </dd>
                    </div>
                    {watchedValues.gradient_enabled && (
                      <div className="flex justify-between items-center">
                        <dt className="text-gray-500">Gradient:</dt>
                        <dd className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded border"
                            style={{ backgroundColor: watchedValues.gradient_start }}
                          />
                          <span className="text-gray-400">→</span>
                          <span
                            className="w-5 h-5 rounded border"
                            style={{ backgroundColor: watchedValues.gradient_end }}
                          />
                          <span className="text-xs capitalize">{watchedValues.gradient_direction}</span>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* URL Template */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Verification URL
                  </h3>
                  <p className="text-sm font-mono break-all text-gray-600">
                    {watchedValues.destination_url_template}
                  </p>
                </div>
              </div>

              {/* Important Notice */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">Before you proceed</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Generation will start immediately after creation</li>
                    <li>Large batches may take several minutes to complete</li>
                    <li>You can download the ZIP file once generation is complete</li>
                    <li>Each serial code is unique and cannot be duplicated</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Previous
          </Button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/dashboard/serial-batches')}
            >
              Cancel
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={!canProceed()}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!canProceed()}
                onClick={() => setConfirmModalOpen(true)}
                leftIcon={<CheckCircle className="w-4 h-4" />}
              >
                Create & Generate
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Batch Generation"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            You are about to generate <strong>{watchedValues.quantity?.toLocaleString()}</strong> unique serial QR codes.
            Generation will start immediately and may take several minutes for large batches.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConfirmModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setConfirmModalOpen(false);
                handleSubmit(onSubmit)();
              }}
              isLoading={createMutation.isPending}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              Confirm & Generate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CreateSerialBatchPage;

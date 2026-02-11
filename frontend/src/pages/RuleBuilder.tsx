/**
 * Rule Builder Page - Create and edit conditional redirect rules
 * Visual drag-and-drop style interface for building rules
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  Zap,
  Globe,
  Smartphone,
  Clock,
  MousePointer,
  Tag,
  ArrowRight,
  Shield,
  Link2,
  QrCode,
  HelpCircle,
  Play,
  Calendar,
  CheckCircle,
  XCircle,
  ChevronDown,
  Plus,
  X,
  FolderKanban,
  Package,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, Badge, Modal } from '@/components/common';
import { rulesAPI, linksAPI, qrCodesAPI, campaignsAPI, serialAPI, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Rule,
  CreateRuleData,
  RuleConditionType,
  RuleOperator,
  RuleActionType,
  Link,
  QRCode,
  Campaign,
  SerialBatch,
  TestRuleResult,
} from '@/types';

// Schema for form validation
const ruleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  priority: z.number().min(-1000).max(1000).default(0),
  target_type: z.enum(['link', 'qr_code', 'campaign', 'serial_batch']),
  link_id: z.string().optional(),
  qr_code_id: z.string().optional(),
  campaign_id: z.string().optional(),
  serial_batch_id: z.string().optional(),
  condition_type: z.string().min(1, 'Condition type is required'),
  condition_operator: z.string().min(1, 'Operator is required'),
  condition_value: z.unknown(),
  condition_key: z.string().optional(),
  action_type: z.string().min(1, 'Action type is required'),
  action_value: z.record(z.unknown()).default({}),
  is_active: z.boolean().default(true),
  schedule_start: z.string().optional().nullable(),
  schedule_end: z.string().optional().nullable(),
});

type RuleFormData = z.infer<typeof ruleSchema>;

// Condition types with details
const CONDITION_TYPES: Array<{
  value: RuleConditionType;
  label: string;
  icon: typeof Globe;
  description: string;
  category: string;
}> = [
  { value: 'country', label: 'Country', icon: Globe, description: 'Match by country code (e.g., US, UK)', category: 'Location' },
  { value: 'city', label: 'City', icon: Globe, description: 'Match by city name', category: 'Location' },
  { value: 'region', label: 'Region/State', icon: Globe, description: 'Match by region or state', category: 'Location' },
  { value: 'device', label: 'Device Type', icon: Smartphone, description: 'Mobile, tablet, or desktop', category: 'Device' },
  { value: 'os', label: 'Operating System', icon: Smartphone, description: 'iOS, Android, Windows, etc.', category: 'Device' },
  { value: 'browser', label: 'Browser', icon: Smartphone, description: 'Chrome, Safari, Firefox, etc.', category: 'Device' },
  { value: 'language', label: 'Language', icon: Globe, description: 'Browser language preference', category: 'User' },
  { value: 'referrer', label: 'Referrer', icon: MousePointer, description: 'Where the user came from', category: 'User' },
  { value: 'time', label: 'Time of Day', icon: Clock, description: 'Hour of the day (0-23)', category: 'Time' },
  { value: 'day_of_week', label: 'Day of Week', icon: Clock, description: 'Monday through Sunday', category: 'Time' },
  { value: 'date', label: 'Date', icon: Clock, description: 'Specific date', category: 'Time' },
  { value: 'scan_count', label: 'Click/Scan Count', icon: Zap, description: 'Number of previous visits', category: 'Engagement' },
  { value: 'is_first_scan', label: 'First Visit', icon: Zap, description: 'Is this the first visit?', category: 'Engagement' },
  { value: 'query_param', label: 'Query Parameter', icon: Tag, description: 'URL query string parameter', category: 'Advanced' },
];

// Operators by condition type
const OPERATORS: Record<string, Array<{ value: RuleOperator; label: string }>> = {
  text: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'in', label: 'is in list' },
    { value: 'not_in', label: 'is not in list' },
    { value: 'regex', label: 'matches regex' },
  ],
  number: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'gt', label: 'greater than' },
    { value: 'gte', label: 'greater than or equal' },
    { value: 'lt', label: 'less than' },
    { value: 'lte', label: 'less than or equal' },
    { value: 'between', label: 'between' },
  ],
  boolean: [
    { value: 'eq', label: 'is' },
  ],
  select: [
    { value: 'eq', label: 'is' },
    { value: 'neq', label: 'is not' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
  ],
};

// Get operator type for condition
const getOperatorType = (conditionType: RuleConditionType): string => {
  switch (conditionType) {
    case 'scan_count':
    case 'time':
      return 'number';
    case 'is_first_scan':
      return 'boolean';
    case 'device':
    case 'day_of_week':
      return 'select';
    default:
      return 'text';
  }
};

// Action types
const ACTION_TYPES: Array<{
  value: RuleActionType;
  label: string;
  icon: typeof ArrowRight;
  description: string;
}> = [
  { value: 'redirect', label: 'Redirect to URL', icon: ArrowRight, description: 'Send users to a different URL' },
  { value: 'add_utm', label: 'Add UTM Parameters', icon: Tag, description: 'Append tracking parameters' },
  { value: 'block', label: 'Block Access', icon: Shield, description: 'Show an access denied message' },
  { value: 'show_content', label: 'Show Content', icon: Zap, description: 'Display custom content' },
];

// Device options
const DEVICE_OPTIONS = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];

// Day of week options
const DAY_OPTIONS = [
  { value: 0, label: 'Monday' },
  { value: 1, label: 'Tuesday' },
  { value: 2, label: 'Wednesday' },
  { value: 3, label: 'Thursday' },
  { value: 4, label: 'Friday' },
  { value: 5, label: 'Saturday' },
  { value: 6, label: 'Sunday' },
];

export function RuleBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { subscription } = useAuth();
  const isEditing = Boolean(id);

  // State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestRuleResult | null>(null);
  const [listInput, setListInput] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const targetDropdownRef = useRef<HTMLDivElement>(null);

  // Form setup
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: '',
      description: '',
      priority: 0,
      target_type: 'link',
      condition_type: 'country',
      condition_operator: 'eq',
      condition_value: '',
      condition_key: '',
      action_type: 'redirect',
      action_value: {},
      is_active: true,
    },
  });

  const targetType = watch('target_type');
  const conditionType = watch('condition_type') as RuleConditionType;
  const conditionOperator = watch('condition_operator');
  const conditionValue = watch('condition_value');
  const actionType = watch('action_type') as RuleActionType;
  const actionValue = watch('action_value');
  const linkId = watch('link_id');

  // Fetch existing rule if editing
  const { data: existingRule, isLoading: ruleLoading } = useQuery({
    queryKey: ['rule', id],
    queryFn: () => rulesAPI.get(id!),
    enabled: isEditing,
  });

  // Fetch links for selection
  const { data: linksData } = useQuery({
    queryKey: ['links-select'],
    queryFn: () => linksAPI.getLinks({ page_size: 100 }),
  });

  // Fetch QR codes for selection
  const { data: qrCodesData } = useQuery({
    queryKey: ['qrcodes-select'],
    queryFn: () => qrCodesAPI.getQRCodes({ page_size: 100 }),
  });

  // Fetch campaigns for selection
  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns-select'],
    queryFn: () => campaignsAPI.getCampaigns(),
  });

  // Fetch serial batches for selection
  const { data: batchesData } = useQuery({
    queryKey: ['serial-batches-select'],
    queryFn: () => serialAPI.batches.list({ page_size: 100 }),
  });

  // Close target dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (targetDropdownRef.current && !targetDropdownRef.current.contains(e.target as Node)) {
        setTargetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered target items based on search
  const filteredTargetItems = useMemo(() => {
    const q = targetSearch.toLowerCase();
    if (targetType === 'link') {
      return (linksData?.results || []).filter((link: Link) =>
        !q || (link.title || '').toLowerCase().includes(q) ||
        (link.short_code || '').toLowerCase().includes(q) ||
        (link.short_url || '').toLowerCase().includes(q)
      );
    }
    if (targetType === 'qr_code') {
      return (qrCodesData?.results || []).filter((qr: QRCode) =>
        !q || (qr.title || '').toLowerCase().includes(q) ||
        (qr.short_code || '').toLowerCase().includes(q)
      );
    }
    if (targetType === 'campaign') {
      return (campaignsData || []).filter((c: Campaign) =>
        !q || c.name.toLowerCase().includes(q)
      );
    }
    if (targetType === 'serial_batch') {
      return (batchesData?.results || []).filter((b: SerialBatch) =>
        !q || b.name.toLowerCase().includes(q)
      );
    }
    return [];
  }, [targetType, targetSearch, linksData, qrCodesData, campaignsData, batchesData]);

  // Populate form when editing
  useEffect(() => {
    if (existingRule) {
      const targetType = existingRule.link ? 'link'
        : existingRule.qr_code ? 'qr_code'
        : existingRule.campaign ? 'campaign'
        : existingRule.serial_batch ? 'serial_batch'
        : 'link';

      reset({
        name: existingRule.name,
        description: existingRule.description || '',
        priority: existingRule.priority,
        target_type: targetType,
        link_id: existingRule.link || undefined,
        qr_code_id: existingRule.qr_code || undefined,
        campaign_id: existingRule.campaign || undefined,
        serial_batch_id: existingRule.serial_batch || undefined,
        condition_type: existingRule.condition_type,
        condition_operator: existingRule.condition_operator,
        condition_value: existingRule.condition_value,
        condition_key: existingRule.condition_key || '',
        action_type: existingRule.action_type,
        action_value: existingRule.action_value || {},
        is_active: existingRule.is_active,
        schedule_start: existingRule.schedule_start,
        schedule_end: existingRule.schedule_end,
      });
    }
  }, [existingRule, reset]);

  // Reset target search/dropdown when target type changes
  useEffect(() => {
    setTargetSearch('');
    setTargetDropdownOpen(false);
  }, [targetType]);

  // Update operators when condition type changes
  useEffect(() => {
    const operatorType = getOperatorType(conditionType);
    const validOperators = OPERATORS[operatorType] || OPERATORS.text;
    const currentOperator = conditionOperator;

    if (!validOperators.find(op => op.value === currentOperator)) {
      setValue('condition_operator', validOperators[0].value);
    }
  }, [conditionType, conditionOperator, setValue]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const payload: CreateRuleData = {
        name: data.name,
        description: data.description,
        priority: data.priority,
        link_id: data.target_type === 'link' ? data.link_id : undefined,
        qr_code_id: data.target_type === 'qr_code' ? data.qr_code_id : undefined,
        campaign_id: data.target_type === 'campaign' ? data.campaign_id : undefined,
        serial_batch_id: data.target_type === 'serial_batch' ? data.serial_batch_id : undefined,
        condition_type: data.condition_type as RuleConditionType,
        condition_operator: data.condition_operator as RuleOperator,
        condition_value: data.condition_value,
        condition_key: data.condition_key,
        action_type: data.action_type as RuleActionType,
        action_value: data.action_value,
        is_active: data.is_active,
        schedule_start: data.schedule_start || undefined,
        schedule_end: data.schedule_end || undefined,
      };

      if (isEditing) {
        return rulesAPI.update(id!, payload);
      }
      return rulesAPI.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success(isEditing ? 'Rule updated!' : 'Rule created!', { id: 'rule-save' });
      navigate('/dashboard/rules');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'rule-save' });
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const formValues = watch();
      const testData: any = {
        link_id: targetType === 'link' ? linkId : undefined,
        qr_code_id: targetType === 'qr_code' ? formValues.qr_code_id : undefined,
        condition_type: formValues.condition_type,
        condition_operator: formValues.condition_operator,
        condition_value: formValues.condition_value,
        action_type: formValues.action_type,
        action_value: formValues.action_value,
      };
      return rulesAPI.test(testData);
    },
    onSuccess: (result) => {
      setTestResult(result);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'rule-test' });
    },
  });

  const onSubmit = (data: RuleFormData) => {
    saveMutation.mutate(data);
  };

  // Handle list values (for "in" operator)
  const addToList = () => {
    if (!listInput.trim()) return;
    const currentList = Array.isArray(conditionValue) ? conditionValue : [];
    setValue('condition_value', [...currentList, listInput.trim()]);
    setListInput('');
  };

  const removeFromList = (index: number) => {
    const currentList = Array.isArray(conditionValue) ? conditionValue : [];
    setValue('condition_value', currentList.filter((_, i) => i !== index));
  };

  const operatorType = getOperatorType(conditionType);
  const availableOperators = OPERATORS[operatorType] || OPERATORS.text;
  const isListOperator = conditionOperator === 'in' || conditionOperator === 'not_in';
  const isBetweenOperator = conditionOperator === 'between';

  if (ruleLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard/rules')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Rule' : 'Create Rule'}
          </h1>
          <p className="text-gray-500 mt-1">
            Define conditions and actions for smart redirects
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Rule Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Rule Name"
                placeholder="e.g., Redirect US visitors to US site"
                {...register('name')}
                error={errors.name?.message}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Description (optional)</label>
              <textarea
                className="input min-h-20"
                placeholder="Describe what this rule does..."
                {...register('description')}
              />
            </div>

            <div>
              <label className="label">Priority</label>
              <Input
                type="number"
                placeholder="0"
                {...register('priority', { valueAsNumber: true })}
                error={errors.priority?.message}
              />
              <p className="text-xs text-gray-500 mt-1">Higher priority rules are evaluated first</p>
            </div>

            <div className="flex items-center gap-4">
              <Controller
                name="is_active"
                control={control}
                render={({ field }) => (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                )}
              />
            </div>
          </div>
        </Card>

        {/* Target Selection */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Apply To
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-colors ${targetType === 'link' ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  value="link"
                  {...register('target_type')}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <Link2 className="w-4 h-4" />
                <span className="text-sm font-medium">Link</span>
              </label>
              <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-colors ${targetType === 'qr_code' ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  value="qr_code"
                  {...register('target_type')}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <QrCode className="w-4 h-4" />
                <span className="text-sm font-medium">QR Code</span>
              </label>
              <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-colors ${targetType === 'campaign' ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  value="campaign"
                  {...register('target_type')}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <FolderKanban className="w-4 h-4" />
                <span className="text-sm font-medium">Campaign</span>
              </label>
              <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-colors ${targetType === 'serial_batch' ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input
                  type="radio"
                  value="serial_batch"
                  {...register('target_type')}
                  className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                />
                <Package className="w-4 h-4" />
                <span className="text-sm font-medium">Serial Batch</span>
              </label>
            </div>

            {/* Searchable target selector */}
            <Controller
              name={
                targetType === 'link' ? 'link_id' :
                targetType === 'qr_code' ? 'qr_code_id' :
                targetType === 'campaign' ? 'campaign_id' :
                'serial_batch_id'
              }
              control={control}
              render={({ field }) => {
                const selectedLabel = (() => {
                  if (!field.value) return '';
                  if (targetType === 'link') {
                    const link = linksData?.results?.find((l: Link) => l.id === field.value);
                    return link ? `${link.title || link.short_code} - ${link.short_url}` : '';
                  }
                  if (targetType === 'qr_code') {
                    const qr = qrCodesData?.results?.find((q: QRCode) => q.id === field.value);
                    return qr ? (qr.title || qr.short_code || qr.id.slice(0, 8)) : '';
                  }
                  if (targetType === 'campaign') {
                    const c = (campaignsData || []).find((c: Campaign) => c.id === field.value);
                    return c ? c.name : '';
                  }
                  if (targetType === 'serial_batch') {
                    const b = batchesData?.results?.find((b: SerialBatch) => b.id === field.value);
                    return b ? `${b.name} (${b.quantity.toLocaleString()} codes)` : '';
                  }
                  return '';
                })();

                return (
                  <div ref={targetDropdownRef} className="relative">
                    <label className="label">
                      Select {targetType === 'link' ? 'Link' : targetType === 'qr_code' ? 'QR Code' : targetType === 'campaign' ? 'Campaign' : 'Serial Batch'}
                    </label>
                    <div
                      className="input flex items-center gap-2 cursor-pointer"
                      onClick={() => {
                        setTargetDropdownOpen(!targetDropdownOpen);
                        setTargetSearch('');
                      }}
                    >
                      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className={`flex-1 truncate ${field.value ? 'text-gray-900' : 'text-gray-400'}`}>
                        {selectedLabel || `Search ${targetType === 'link' ? 'links' : targetType === 'qr_code' ? 'QR codes' : targetType === 'campaign' ? 'campaigns' : 'serial batches'}...`}
                      </span>
                      {field.value && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); field.onChange(''); }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${targetDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {targetDropdownOpen && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <input
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="Type to search..."
                            value={targetSearch}
                            onChange={(e) => setTargetSearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {filteredTargetItems.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">No results found</div>
                          ) : (
                            filteredTargetItems.map((item: any) => {
                              const itemId = item.id;
                              const itemLabel = targetType === 'link'
                                ? `${item.title || item.short_code} - ${item.short_url}`
                                : targetType === 'qr_code'
                                ? (item.title || item.short_code || item.id.slice(0, 8))
                                : targetType === 'campaign'
                                ? item.name
                                : `${item.name} (${item.quantity?.toLocaleString()} codes)`;

                              return (
                                <button
                                  key={itemId}
                                  type="button"
                                  onClick={() => {
                                    field.onChange(itemId);
                                    setTargetDropdownOpen(false);
                                    setTargetSearch('');
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                                    field.value === itemId ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700'
                                  }`}
                                >
                                  {itemLabel}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {targetType === 'campaign' && (
                      <p className="text-xs text-gray-500 mt-1">Rule applies to all links in this campaign</p>
                    )}
                    {targetType === 'serial_batch' && (
                      <p className="text-xs text-gray-500 mt-1">Rule applies to all QR codes in this batch</p>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </Card>

        {/* Condition Builder */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            When (Condition)
          </h2>

          <div className="space-y-4">
            {/* Condition Type */}
            <div>
              <label className="label">Condition Type</label>
              <Controller
                name="condition_type"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {CONDITION_TYPES.map((condition) => {
                      const Icon = condition.icon;
                      const isSelected = field.value === condition.value;
                      return (
                        <button
                          key={condition.value}
                          type="button"
                          onClick={() => {
                            field.onChange(condition.value);
                            setValue('condition_value', '');
                          }}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-gray-500'}`} />
                            <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                              {condition.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{condition.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            {/* Query Param Key */}
            {conditionType === 'query_param' && (
              <Input
                label="Parameter Name"
                placeholder="e.g., utm_source"
                {...register('condition_key')}
              />
            )}

            {/* Operator */}
            <div>
              <label className="label">Operator</label>
              <Controller
                name="condition_operator"
                control={control}
                render={({ field }) => (
                  <select className="input" {...field}>
                    {availableOperators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Condition Value */}
            <div>
              <label className="label">Value</label>

              {/* Boolean value */}
              {operatorType === 'boolean' && (
                <Controller
                  name="condition_value"
                  control={control}
                  render={({ field }) => (
                    <select className="input" value={String(field.value)} onChange={(e) => field.onChange(e.target.value === 'true')}>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  )}
                />
              )}

              {/* Select value (device, day of week) */}
              {operatorType === 'select' && !isListOperator && (
                <Controller
                  name="condition_value"
                  control={control}
                  render={({ field }) => (
                    <select className="input" {...field} value={String(field.value)}>
                      <option value="">Select...</option>
                      {conditionType === 'device' && DEVICE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                      {conditionType === 'day_of_week' && DAY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                />
              )}

              {/* Between value (two inputs) */}
              {isBetweenOperator && (
                <div className="flex items-center gap-2">
                  <Controller
                    name="condition_value"
                    control={control}
                    render={({ field }) => (
                      <>
                        <Input
                          type="number"
                          placeholder="Min"
                          value={Array.isArray(field.value) ? field.value[0] : ''}
                          onChange={(e) => {
                            const current = Array.isArray(field.value) ? field.value : [0, 0];
                            field.onChange([Number(e.target.value), current[1]]);
                          }}
                        />
                        <span className="text-gray-500">to</span>
                        <Input
                          type="number"
                          placeholder="Max"
                          value={Array.isArray(field.value) ? field.value[1] : ''}
                          onChange={(e) => {
                            const current = Array.isArray(field.value) ? field.value : [0, 0];
                            field.onChange([current[0], Number(e.target.value)]);
                          }}
                        />
                      </>
                    )}
                  />
                </div>
              )}

              {/* List value (chips) */}
              {isListOperator && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add value..."
                      value={listInput}
                      onChange={(e) => setListInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addToList();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addToList}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(conditionValue) && conditionValue.map((val, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
                      >
                        {String(val)}
                        <button
                          type="button"
                          onClick={() => removeFromList(idx)}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Text/Number value */}
              {operatorType !== 'boolean' && operatorType !== 'select' && !isListOperator && !isBetweenOperator && (
                <Controller
                  name="condition_value"
                  control={control}
                  render={({ field }) => (
                    <Input
                      type={operatorType === 'number' ? 'number' : 'text'}
                      placeholder={
                        conditionType === 'country' ? 'e.g., US, UK, DE' :
                        conditionType === 'city' ? 'e.g., New York' :
                        conditionType === 'time' ? 'e.g., 9 (for 9 AM)' :
                        'Enter value...'
                      }
                      {...field}
                      value={String(field.value || '')}
                      onChange={(e) => {
                        const val = operatorType === 'number' ? Number(e.target.value) : e.target.value;
                        field.onChange(val);
                      }}
                    />
                  )}
                />
              )}
            </div>
          </div>
        </Card>

        {/* Action Builder */}
        <Card>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-primary" />
            Then (Action)
          </h2>

          <div className="space-y-4">
            {/* Action Type */}
            <div>
              <label className="label">Action Type</label>
              <Controller
                name="action_type"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {ACTION_TYPES.map((action) => {
                      const Icon = action.icon;
                      const isSelected = field.value === action.value;
                      return (
                        <button
                          key={action.value}
                          type="button"
                          onClick={() => {
                            field.onChange(action.value);
                            setValue('action_value', {});
                          }}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-gray-500'}`} />
                            <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-gray-900'}`}>
                              {action.label}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{action.description}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </div>

            {/* Action Value - Redirect */}
            {actionType === 'redirect' && (
              <div>
                <Input
                  label="Redirect URL"
                  placeholder="https://example.com/special-page"
                  value={(actionValue as any)?.url || ''}
                  onChange={(e) => setValue('action_value', { ...actionValue, url: e.target.value })}
                />
              </div>
            )}

            {/* Action Value - Block */}
            {actionType === 'block' && (
              <div className="space-y-4">
                <Input
                  label="Block Message"
                  placeholder="Access denied"
                  value={(actionValue as any)?.message || ''}
                  onChange={(e) => setValue('action_value', { ...actionValue, message: e.target.value })}
                />
                <div>
                  <label className="label">HTTP Status Code</label>
                  <select
                    className="input"
                    value={(actionValue as any)?.status_code || 403}
                    onChange={(e) => setValue('action_value', { ...actionValue, status_code: Number(e.target.value) })}
                  >
                    <option value={403}>403 Forbidden</option>
                    <option value={404}>404 Not Found</option>
                    <option value={410}>410 Gone</option>
                    <option value={451}>451 Unavailable For Legal Reasons</option>
                  </select>
                </div>
              </div>
            )}

            {/* Action Value - Add UTM */}
            {actionType === 'add_utm' && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="UTM Source"
                  placeholder="e.g., google"
                  value={(actionValue as any)?.utm_source || ''}
                  onChange={(e) => setValue('action_value', { ...actionValue, utm_source: e.target.value })}
                />
                <Input
                  label="UTM Medium"
                  placeholder="e.g., cpc"
                  value={(actionValue as any)?.utm_medium || ''}
                  onChange={(e) => setValue('action_value', { ...actionValue, utm_medium: e.target.value })}
                />
                <Input
                  label="UTM Campaign"
                  placeholder="e.g., summer_sale"
                  value={(actionValue as any)?.utm_campaign || ''}
                  onChange={(e) => setValue('action_value', { ...actionValue, utm_campaign: e.target.value })}
                />
                <Input
                  label="UTM Term"
                  placeholder="e.g., running+shoes"
                  value={(actionValue as any)?.utm_term || ''}
                  onChange={(e) => setValue('action_value', { ...actionValue, utm_term: e.target.value })}
                />
                <Input
                  label="UTM Content"
                  placeholder="e.g., banner_ad"
                  value={(actionValue as any)?.utm_content || ''}
                  onChange={(e) => setValue('action_value', { ...actionValue, utm_content: e.target.value })}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule (Optional)
            </CardTitle>
            <CardDescription>Limit when this rule is active</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="datetime-local"
              {...register('schedule_start')}
            />
            <Input
              label="End Date"
              type="datetime-local"
              {...register('schedule_end')}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            leftIcon={<Play className="w-4 h-4" />}
            onClick={() => {
              setTestModalOpen(true);
              testMutation.mutate();
            }}
            disabled={!linkId && targetType === 'link'}
          >
            Test Rule
          </Button>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/dashboard/rules')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              leftIcon={<Save className="w-4 h-4" />}
              isLoading={isSubmitting || saveMutation.isPending}
            >
              {isEditing ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </form>

      {/* Test Result Modal */}
      <Modal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Test Rule Result"
        size="md"
      >
        {testMutation.isPending ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : testResult ? (
          <div className="space-y-4">
            <div className={`flex items-center gap-2 p-4 rounded-lg ${
              testResult.matched ? 'bg-green-50' : 'bg-gray-50'
            }`}>
              {testResult.matched ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <XCircle className="w-6 h-6 text-gray-400" />
              )}
              <div>
                <p className="font-medium">
                  {testResult.matched ? 'Rule Matched!' : 'No Match'}
                </p>
                <p className="text-sm text-gray-500">
                  {testResult.matched
                    ? `Action: ${testResult.rule?.action}`
                    : 'Default destination will be used'}
                </p>
              </div>
            </div>

            {testResult.matched && testResult.rule && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Matched Rule</h4>
                <p className="text-sm text-gray-600">{testResult.rule.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Result: {testResult.result.url || testResult.result.message}
                </p>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex justify-end mt-4">
          <Button variant="ghost" onClick={() => setTestModalOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default RuleBuilderPage;

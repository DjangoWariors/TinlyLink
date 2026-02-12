import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Link2, Calendar, Lock, QrCode,
  ChevronDown, ChevronUp, Wand2, FolderKanban, Plus, Globe,
  Square, Smartphone, Laptop, MessageSquare, User, Image, Monitor,
  Check, X as XIcon, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { Badge, Loading } from '@/components/common';
import { linksAPI, campaignsAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { Campaign, CustomDomain, QRFrame, QRStyle } from '@/types';
import { QRFramedRenderer } from '@/components/qr';

const FRAME_OPTIONS = [
  { id: 'none', label: 'None', icon: QrCode },
  { id: 'simple', label: 'Simple', icon: Square },
  { id: 'scan_me', label: 'Scan Me', icon: QrCode },
  { id: 'balloon', label: 'Balloon', icon: MessageSquare },
  { id: 'badge', label: 'Badge', icon: User },
  { id: 'phone', label: 'Phone', icon: Smartphone },
  { id: 'polaroid', label: 'Polaroid', icon: Image },
  { id: 'laptop', label: 'Laptop', icon: Laptop },
] as const;

const linkSchema = z.object({
  original_url: z.string().url('Please enter a valid URL'),
  custom_slug: z.string().optional(),
  title: z.string().optional(),
  domain_id: z.string().optional(),
  campaign_id: z.string().optional(),
  password: z.string().optional(),
  expires_at: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  create_qr: z.boolean().optional(),
  qr_style: z.enum(['square', 'dots', 'rounded']).optional().default('square'),
  qr_frame: z.string().optional().default('none'),
  qr_foreground_color: z.string().optional().default('#000000'),
  qr_background_color: z.string().optional().default('#FFFFFF'),
});

type LinkFormData = z.infer<typeof linkSchema>;

export function CreateLinkPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscription, refreshUser } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUTM, setShowUTM] = useState(false);

  const isEditing = !!id;
  const isPaidPlan = subscription?.plan !== 'free';

  // Slug availability check state
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [slugError, setSlugError] = useState<string | null>(null);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkSlugAvailability = useCallback((slug: string, domainId?: string) => {
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);

    if (!slug || slug.length < 4) {
      setSlugStatus(slug ? 'invalid' : 'idle');
      setSlugError(slug ? 'Slug must be at least 4 characters' : null);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      setSlugStatus('invalid');
      setSlugError('Only letters, numbers, hyphens, and underscores');
      return;
    }

    if (slug.length > 50) {
      setSlugStatus('invalid');
      setSlugError('Slug must be 50 characters or less');
      return;
    }

    setSlugStatus('checking');
    setSlugError(null);

    slugCheckTimer.current = setTimeout(async () => {
      try {
        const result = await linksAPI.checkSlug(slug, domainId || undefined);
        if (result.available) {
          setSlugStatus('available');
          setSlugError(null);
        } else {
          setSlugStatus('taken');
          setSlugError(result.error || 'This slug is already taken');
        }
      } catch {
        setSlugStatus('idle');
        setSlugError(null);
      }
    }, 500);
  }, []);

  // Fetch existing link if editing
  const { data: existingLink, isLoading: linkLoading } = useQuery({
    queryKey: ['link', id],
    queryFn: () => linksAPI.getLink(id!),
    enabled: isEditing,
  });

  // Fetch campaigns for dropdown (always fetch, show upgrade prompt for free users)
  const { data: campaigns, isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsAPI.getCampaigns(),
  });

  // Fetch custom domains
  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ['customDomains'],
    queryFn: () => linksAPI.getDomains(),
    enabled: isPaidPlan,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      create_qr: false,
      domain_id: '',
    },
  });

  // Watch for campaign selection
  const selectedCampaignId = watch('campaign_id');

  // Handle URL query param (from UTM Builder)
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam && !isEditing) {
      try {
        // If it comes from UTM builder, it might have params
        // We want to extract them into the form fields
        const urlObj = new URL(urlParam);
        const params = urlObj.searchParams;

        // Extract known UTM params
        const source = params.get('utm_source');
        const medium = params.get('utm_medium');
        const campaign = params.get('utm_campaign');
        const term = params.get('utm_term');
        const content = params.get('utm_content');

        if (source) setValue('utm_source', source);
        if (medium) setValue('utm_medium', medium);
        if (campaign) setValue('utm_campaign', campaign);
        if (term) setValue('utm_term', term);
        if (content) setValue('utm_content', content);

        // If we extracted UTMs, show the section
        if (source || medium || campaign || term || content) {
          setShowUTM(true);
          // Remove them from the original URL so they aren't duplicated
          params.delete('utm_source');
          params.delete('utm_medium');
          params.delete('utm_campaign');
          params.delete('utm_term');
          params.delete('utm_content');
        }

        setValue('original_url', urlObj.toString());
      } catch {
        // Fallback for simple string
        setValue('original_url', urlParam);
      }
    }
  }, [searchParams, isEditing, setValue]);

  // Auto-fill UTMs when campaign created
  useEffect(() => {
    if (selectedCampaignId && campaigns) {
      const campaign = campaigns.find(c => c.id === selectedCampaignId);
      if (campaign) {
        // Auto-fill logic: if campaign has defaults, use them
        if (campaign.default_utm_source) setValue('utm_source', campaign.default_utm_source);
        if (campaign.default_utm_medium) setValue('utm_medium', campaign.default_utm_medium);
        if (campaign.default_utm_campaign) setValue('utm_campaign', campaign.default_utm_campaign);
      }
    }
  }, [selectedCampaignId, campaigns, setValue]);

  // Populate form when editing
  useEffect(() => {
    if (existingLink) {
      setValue('original_url', existingLink.original_url);
      setValue('title', existingLink.title || '');
      setValue('campaign_id', existingLink.campaign || '');
      setValue('domain_id', existingLink.domain || '');
      setValue('utm_source', existingLink.utm_source || '');
      setValue('utm_medium', existingLink.utm_medium || '');
      setValue('utm_campaign', existingLink.utm_campaign || '');
      setValue('utm_term', existingLink.utm_term || '');
      setValue('utm_content', existingLink.utm_content || '');
      if (existingLink.expires_at) {
        setValue('expires_at', existingLink.expires_at.split('T')[0]);
      }
    }
  }, [existingLink, setValue]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: LinkFormData) => linksAPI.createLink(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      refreshUser(); // Sync usage counter in sidebar
      toast.success('Link created successfully!');
      navigate(`/dashboard/links`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create link');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: LinkFormData) => linksAPI.updateLink(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      queryClient.invalidateQueries({ queryKey: ['link', id] });
      toast.success('Link updated successfully!');
      navigate('/dashboard/links');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update link');
    },
  });

  const onSubmit = (data: LinkFormData) => {
    // Block submission while slug availability is being checked
    if (slugStatus === 'checking') {
      toast.error('Please wait for slug availability check to complete');
      return;
    }
    if (slugStatus === 'taken' || slugStatus === 'invalid') {
      toast.error('Please fix the custom slug before submitting');
      return;
    }

    // Clean up empty strings
    const cleanedData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== '' && v !== undefined)
    ) as LinkFormData;

    if (isEditing) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (isEditing && linkLoading) {
    return (
      <div className="py-12">
        <Loading />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/links"
          className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Link' : 'Create New Link'}
          </h1>
          <p className="text-gray-500 mt-1">
            {isEditing ? 'Update your shortened link' : 'Shorten a URL and track its performance'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Main Card */}
        <Card>
          <div className="space-y-4">
            {/* URL Input */}
            <Input
              label="Destination URL"
              placeholder="https://example.com/your-long-url"
              leftIcon={<Link2 className="w-4 h-4" />}
              error={errors.original_url?.message}
              {...register('original_url')}
            />

            {/* Domain and Slug Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Domain Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    Domain
                  </label>
                  {!isPaidPlan && <Badge variant="primary">Pro</Badge>}
                </div>
                {isPaidPlan ? (
                  domainsLoading ? (
                    <div className="input bg-gray-50 text-gray-400 flex items-center">
                      Loading...
                    </div>
                  ) : (
                    <select
                      className="input"
                      {...register('domain_id')}
                    >
                      <option value="">Default (tinlylink.com)</option>
                      {domains?.filter(d => d.is_verified).map((d: CustomDomain) => (
                        <option key={d.id} value={d.id}>
                          {d.domain}
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  <select className="input bg-gray-50" disabled>
                    <option>Default (tinlylink.com)</option>
                  </select>
                )}
              </div>

              {/* Custom Slug */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Custom Back-Half</label>
                  {!isPaidPlan && <Badge variant="primary">Pro</Badge>}
                </div>
                <div className="relative">
                  <Input
                    placeholder="my-custom-slug"
                    disabled={!isPaidPlan || isEditing}
                    {...register('custom_slug', {
                      onChange: (e) => {
                        if (isPaidPlan && !isEditing) {
                          checkSlugAvailability(e.target.value, watch('domain_id') || undefined);
                        }
                      },
                    })}
                    className={
                      slugStatus === 'available' ? 'border-green-500 focus:border-green-500 focus:ring-green-500 pr-9' :
                      slugStatus === 'taken' || slugStatus === 'invalid' ? 'border-red-500 focus:border-red-500 focus:ring-red-500 pr-9' :
                      slugStatus === 'checking' ? 'pr-9' : ''
                    }
                  />
                  {/* Status indicator icon */}
                  {slugStatus !== 'idle' && isPaidPlan && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {slugStatus === 'checking' && (
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                      )}
                      {slugStatus === 'available' && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                      {(slugStatus === 'taken' || slugStatus === 'invalid') && (
                        <XIcon className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                {/* Status message */}
                {isPaidPlan && slugStatus === 'available' && (
                  <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    This back-half is available
                  </p>
                )}
                {isPaidPlan && (slugStatus === 'taken' || slugStatus === 'invalid') && slugError && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {slugError}
                  </p>
                )}
                {isPaidPlan && slugStatus === 'idle' && !isEditing && (
                  <p className="mt-1 text-xs text-gray-400">4–50 characters: letters, numbers, hyphens, underscores</p>
                )}
              </div>
            </div>

            {/* Title */}
            <Input
              label="Title (optional)"
              placeholder="My Marketing Link"
              hint="A friendly name to help you identify this link"
              {...register('title')}
            />

            {/* Campaign Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0 flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-gray-400" />
                  Campaign
                </label>
                {!isPaidPlan && (
                  <Badge variant="primary">Pro Feature</Badge>
                )}
              </div>
              {isPaidPlan ? (
                campaigns && campaigns.length > 0 ? (
                  <select
                    className="input"
                    {...register('campaign_id')}
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((campaign: Campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                ) : campaignsLoading ? (
                  <div className="input bg-gray-50 text-gray-400 flex items-center">
                    Loading campaigns...
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">No campaigns yet</p>
                    <Link to="/dashboard/campaigns" className="text-sm text-primary hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" />
                      Create your first campaign
                    </Link>
                  </div>
                )
              ) : (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-500">
                    Organize links into campaigns with UTM tracking
                  </p>
                  <Link to="/dashboard/settings?tab=billing" className="text-sm text-primary hover:underline">
                    Upgrade to Pro →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Advanced Options */}
        <Card>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-gray-400" />
              <span className="font-medium text-gray-900">Advanced Options</span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
              {/* Password Protection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label mb-0">Password Protection</label>
                  {!isPaidPlan && <Badge variant="primary">Pro Feature</Badge>}
                </div>
                <Input
                  type="password"
                  placeholder="Enter password"
                  leftIcon={<Lock className="w-4 h-4" />}
                  disabled={!isPaidPlan}
                  hint={isPaidPlan ? 'Visitors will need this password to access the link' : 'Upgrade to Pro for password protection'}
                  {...register('password')}
                />
              </div>

              {/* Expiration */}
              <Input
                label="Expiration Date"
                type="date"
                leftIcon={<Calendar className="w-4 h-4" />}
                hint="Link will stop working after this date"
                {...register('expires_at')}
              />

              {/* Create QR */}
              {!isEditing && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      {...register('create_qr')}
                    />
                    <div className="flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">Also create a QR code</span>
                    </div>
                  </label>

                  {/* QR Design Section */}
                  {watch('create_qr') && (
                    <div className="pl-7 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          {/* Style Selector */}
                          <div>
                            <label className="text-xs font-medium text-gray-700 mb-2 block">Pattern Style</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['square', 'dots', 'rounded'] as const).map((style) => (
                                <button
                                  key={style}
                                  type="button"
                                  onClick={() => setValue('qr_style', style)}
                                  className={`p-2 border rounded text-xs text-center capitalize transition-colors ${watch('qr_style') === style
                                    ? 'border-primary bg-primary-50 text-primary-700'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                    }`}
                                >
                                  {style}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Color Selector */}
                          <div>
                            <label className="text-xs font-medium text-gray-700 mb-2 block">Color</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                {...register('qr_foreground_color')}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                              />
                              <div className="flex-1">
                                <Input
                                  className="h-8 text-xs font-mono"
                                  placeholder="#000000"
                                  {...register('qr_foreground_color')}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Small Preview */}
                        <div className="flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <QRFramedRenderer
                            value={watch('original_url') || 'https://tinlylink.com'}
                            size={120}
                            style={watch('qr_style') as QRStyle || 'square'}
                            frame={watch('qr_frame') as QRFrame || 'none'}
                            fgColor={watch('qr_foreground_color') || '#000000'}
                            bgColor="#FFFFFF"
                            level="M"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* UTM Parameters */}
        <Card>
          <button
            type="button"
            onClick={() => setShowUTM(!showUTM)}
            className="flex items-center justify-between w-full"
          >
            <div>
              <span className="font-medium text-gray-900">UTM Parameters</span>
              <p className="text-sm text-gray-500 mt-0.5">Add campaign tracking parameters</p>
            </div>
            {showUTM ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showUTM && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="utm_source"
                placeholder="google, newsletter, twitter"
                {...register('utm_source')}
              />
              <Input
                label="utm_medium"
                placeholder="cpc, email, social"
                {...register('utm_medium')}
              />
              <Input
                label="utm_campaign"
                placeholder="spring_sale, product_launch"
                {...register('utm_campaign')}
              />
              <Input
                label="utm_term"
                placeholder="keyword (for paid search)"
                {...register('utm_term')}
              />
              <Input
                label="utm_content"
                placeholder="banner_ad, text_link"
                className="sm:col-span-2"
                {...register('utm_content')}
              />
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          {(slugStatus === 'taken' || slugStatus === 'invalid') && (
            <p className="text-sm text-danger mr-2">
              {slugStatus === 'taken' ? 'Custom slug is already taken' : 'Custom slug contains invalid characters'}
            </p>
          )}
          <Link to="/dashboard/links">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button type="submit" isLoading={isLoading} disabled={slugStatus === 'checking' || slugStatus === 'taken' || slugStatus === 'invalid'}>
            {isEditing ? 'Save Changes' : 'Create Link'}
          </Button>
        </div>
      </form>
    </div>
  );
}

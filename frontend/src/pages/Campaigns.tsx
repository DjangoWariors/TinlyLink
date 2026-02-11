import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, FolderKanban, MoreVertical, Edit, Trash2, Link2, MousePointer,
  Search, BarChart3, TrendingUp, TrendingDown, Copy, ExternalLink, GitCompare
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Badge, Loading, EmptyState, Modal, Dropdown, DropdownItem } from '@/components/common';
import { campaignsAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Campaign } from '@/types';

// Template type for API response
type CampaignTemplate = {
  id: string;
  name: string;
  description: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

// Fallback templates if API fails
const FALLBACK_TEMPLATES: CampaignTemplate[] = [
  { id: 'social', name: 'Social Media', description: 'Social media campaigns', utm_source: 'social', utm_medium: 'post', utm_campaign: '' },
  { id: 'email', name: 'Email Marketing', description: 'Email campaigns', utm_source: 'email', utm_medium: 'newsletter', utm_campaign: '' },
  { id: 'ads', name: 'Paid Ads', description: 'Paid advertising', utm_source: 'google', utm_medium: 'cpc', utm_campaign: '' },
  { id: 'affiliate', name: 'Affiliate', description: 'Affiliate partnerships', utm_source: 'affiliate', utm_medium: 'partner', utm_campaign: '' },
];

export function CampaignsPage() {
  const queryClient = useQueryClient();
  const { subscription } = useAuth();
  const { isTeamMode, canEdit } = useTeam();
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [compareCampaigns, setCompareCampaigns] = useState<string[]>([]);
  const [comparePeriod, setComparePeriod] = useState<string>('30d');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const [formData, setFormData] = useState({
    name: '', description: '', default_utm_source: '', default_utm_medium: '', default_utm_campaign: '',
  });

  const isPaidPlan = subscription?.plan !== 'free';

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsAPI.getCampaigns(),
    enabled: isPaidPlan,
  });

  // Fetch campaign templates from API
  const { data: apiTemplates } = useQuery({
    queryKey: ['campaignTemplates'],
    queryFn: () => campaignsAPI.getCampaignTemplates(),
    enabled: isPaidPlan,
  });

  // Use API templates with fallback
  const templates = apiTemplates && apiTemplates.length > 0 ? apiTemplates : FALLBACK_TEMPLATES;

  // Fetch comparison data from API when modal opens
  const { data: comparisonApiData, isLoading: comparisonLoading, refetch: refetchComparison } = useQuery({
    queryKey: ['campaignComparison', compareCampaigns, comparePeriod],
    queryFn: () => campaignsAPI.getCampaignComparison(compareCampaigns, comparePeriod),
    enabled: compareModalOpen && compareCampaigns.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => campaignsAPI.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign created!', { id: 'campaign-create' });
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to create campaign', { id: 'campaign-create' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => campaignsAPI.updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign updated!', { id: 'campaign-update' });
      setEditModalOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to update campaign', { id: 'campaign-update' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => campaignsAPI.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted', { id: 'campaign-delete' });
      setDeleteModalOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to delete campaign', { id: 'campaign-delete' }),
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', default_utm_source: '', default_utm_medium: '', default_utm_campaign: '' });
    setSelectedTemplate('');
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        default_utm_source: template.utm_source,
        default_utm_medium: template.utm_medium,
        default_utm_campaign: template.utm_campaign || '',
      }));
      setSelectedTemplate(templateId);
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      default_utm_source: campaign.default_utm_source || '',
      default_utm_medium: campaign.default_utm_medium || '',
      default_utm_campaign: campaign.default_utm_campaign || '',
    });
    setEditModalOpen(true);
  };

  const toggleCompare = (id: string) => {
    setCompareCampaigns(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const filteredCampaigns = campaigns?.filter((c: Campaign) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Use API data or fallback to local data
  const comparisonData = comparisonApiData?.campaigns || compareCampaigns.map(id => {
    const camp = campaigns?.find((c: Campaign) => c.id === id);
    return { id, name: camp?.name || '', total_clicks: camp?.total_clicks || 0, unique_clicks: 0, links_count: camp?.links_count || 0, trend: 0 };
  });

  if (!isPaidPlan) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Campaigns</h1></div>
        <Card className="text-center py-12">
          <FolderKanban className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Upgrade to Pro</h2>
          <p className="text-gray-500 mb-4 max-w-md mx-auto">Organize your links into campaigns with UTM tracking and performance analytics.</p>
          <Button onClick={() => window.location.href = '/dashboard/settings?tab=billing'}>Upgrade Now</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 mt-1">{filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          {compareCampaigns.length >= 2 && (
            <Button variant="outline" leftIcon={<GitCompare className="w-4 h-4" />} onClick={() => setCompareModalOpen(true)}>
              Compare ({compareCampaigns.length})
            </Button>
          )}
          {(!isTeamMode || canEdit) && (
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateModalOpen(true)}>Create Campaign</Button>
          )}
        </div>
      </div>

      {/* Search */}
      <Card>
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </Card>

      {/* Campaign List */}
      {isLoading ? (
        <Loading />
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="w-6 h-6" />}
            title={search ? 'No campaigns found' : 'No campaigns yet'}
            description={search ? 'Try a different search term' : 'Campaigns help you group links, apply UTM tags, and track performance across marketing efforts'}
            action={!search && <Button onClick={() => setCreateModalOpen(true)}>Create Campaign</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map((campaign: Campaign) => (
            <Card key={campaign.id} className={`relative ${compareCampaigns.includes(campaign.id) ? 'ring-2 ring-primary' : ''}`}>
              {/* Compare checkbox */}
              <button
                onClick={() => toggleCompare(campaign.id)}
                className="absolute top-3 right-12 p-1 text-gray-400 hover:text-gray-600"
                title="Compare"
              >
                <GitCompare className={`w-4 h-4 ${compareCampaigns.includes(campaign.id) ? 'text-primary' : ''}`} />
              </button>

              <Dropdown
                trigger={<button className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>}
                align="right"
              >
                {(!isTeamMode || canEdit) && (
                  <DropdownItem onClick={() => handleEdit(campaign)}>
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </DropdownItem>
                )}
                {(!isTeamMode || canEdit) && (
                  <DropdownItem onClick={() => { setSelectedCampaign(campaign); setDeleteModalOpen(true); }} danger>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </DropdownItem>
                )}
              </Dropdown>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderKanban className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
                  {campaign.description && <p className="text-sm text-gray-500 truncate">{campaign.description}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                    <Link2 className="w-4 h-4" />
                    <span className="text-xs">Links</span>
                  </div>
                  <p className="text-xl font-bold">{campaign.links_count || 0}</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                    <MousePointer className="w-4 h-4" />
                    <span className="text-xs">Clicks</span>
                  </div>
                  <p className="text-xl font-bold">{(campaign.total_clicks || 0).toLocaleString()}</p>
                </div>
              </div>

              {campaign.default_utm_source && (
                <div className="flex flex-wrap gap-1 mb-3">
                  <Badge variant="default" className="text-xs">utm_source: {campaign.default_utm_source}</Badge>
                  {campaign.default_utm_medium && <Badge variant="default" className="text-xs">utm_medium: {campaign.default_utm_medium}</Badge>}
                </div>
              )}

              <p className="text-xs text-gray-400">
                Created {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                {isTeamMode && campaign.created_by_name && ` by ${campaign.created_by_name}`}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={createModalOpen} onClose={() => { setCreateModalOpen(false); resetForm(); }} title="Create Campaign" size="lg">
        <div className="space-y-4">
          {/* Templates */}
          <div>
            <label className="label">Quick Templates</label>
            <div className="grid grid-cols-2 gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  className={`p-3 border-2 rounded-lg text-left transition-all ${selectedTemplate === t.id ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.utm_source} / {t.utm_medium}</p>
                </button>
              ))}
            </div>
          </div>

          <Input label="Campaign Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Q4 Marketing Push" required />
          <Input label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description" />

          <div className="grid grid-cols-3 gap-3">
            <Input label="utm_source" value={formData.default_utm_source} onChange={(e) => setFormData({ ...formData, default_utm_source: e.target.value })} placeholder="google" />
            <Input label="utm_medium" value={formData.default_utm_medium} onChange={(e) => setFormData({ ...formData, default_utm_medium: e.target.value })} placeholder="cpc" />
            <Input label="utm_campaign" value={formData.default_utm_campaign} onChange={(e) => setFormData({ ...formData, default_utm_campaign: e.target.value })} placeholder="spring_sale" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => { setCreateModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(formData)} isLoading={createMutation.isPending} disabled={!formData.name}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModalOpen} onClose={() => { setEditModalOpen(false); resetForm(); }} title="Edit Campaign">
        <div className="space-y-4">
          <Input label="Campaign Name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <Input label="Description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="utm_source" value={formData.default_utm_source} onChange={(e) => setFormData({ ...formData, default_utm_source: e.target.value })} />
            <Input label="utm_medium" value={formData.default_utm_medium} onChange={(e) => setFormData({ ...formData, default_utm_medium: e.target.value })} />
            <Input label="utm_campaign" value={formData.default_utm_campaign} onChange={(e) => setFormData({ ...formData, default_utm_campaign: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => { setEditModalOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => selectedCampaign && updateMutation.mutate({ id: selectedCampaign.id, data: formData })} isLoading={updateMutation.isPending}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Campaign">
        <div className="space-y-4">
          <p className="text-gray-600">Delete "{selectedCampaign?.name}"? Links won't be deleted but will be unassigned.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => selectedCampaign && deleteMutation.mutate(selectedCampaign.id)} isLoading={deleteMutation.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Compare Modal */}
      <Modal isOpen={compareModalOpen} onClose={() => setCompareModalOpen(false)} title="Campaign Comparison" size="lg">
        <div className="space-y-4">
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Period:</span>
            <select
              value={comparePeriod}
              onChange={(e) => setComparePeriod(e.target.value)}
              className="input py-1 px-2 text-sm w-auto"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>

          {comparisonLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loading />
            </div>
          ) : (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData.map(c => ({ name: c.name, clicks: c.total_clicks, links: c.links_count }))}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="clicks" name="Total Clicks" fill="#f6821f" />
                    <Bar dataKey="links" name="Links" fill="#1e3a5f" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {comparisonData.map((c, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg text-center">
                    <p className="font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-2xl font-bold text-primary mt-1">{c.total_clicks.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">clicks</p>
                    {c.trend !== 0 && (
                      <div className={`flex items-center justify-center gap-1 mt-1 text-xs ${c.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {c.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(c.trend)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <Button variant="ghost" className="w-full" onClick={() => { setCompareCampaigns([]); setCompareModalOpen(false); }}>
            Clear Comparison
          </Button>
        </div>
      </Modal>
    </div>
  );
}

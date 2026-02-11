import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Copy, ExternalLink, QrCode, Edit, Trash2,
  MousePointer, Users, Globe, Calendar, Lock, MoreVertical,
  Monitor, Smartphone, Tablet, BarChart3, Link2, MapPin,
  TrendingUp, Share2, Shield
} from 'lucide-react';

import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Badge, Loading, StatCard, Modal, Dropdown, DropdownItem, CopyButton, SkeletonDashboard } from '@/components/common';
import { linksAPI, rulesAPI, getErrorMessage } from '@/services/api';
import type { TopCountry, LinkStats, Rule } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#f6821f', '#1e3a5f', '#0051c3', '#059669', '#d97706', '#6366f1'];

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  Desktop: <Monitor className="w-4 h-4" />,
  Mobile: <Smartphone className="w-4 h-4" />,
  Tablet: <Tablet className="w-4 h-4" />,
};

export function LinkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState('30d');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Fetch link details
  const { data: link, isLoading: linkLoading, isError: linkError } = useQuery({
    queryKey: ['link', id],
    queryFn: () => linksAPI.getLink(id!),
    enabled: !!id,
  });

  // Fetch link stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['linkStats', id, period],
    queryFn: () => linksAPI.getLinkStats(id!, period),
    enabled: !!id,
    staleTime: 60_000,
  });

  // Fetch rules associated with this link using getForLink
  const { data: linkedRules, isLoading: rulesLoading } = useQuery({
    queryKey: ['rulesForLink', id],
    queryFn: () => rulesAPI.getForLink(id!),
    enabled: !!id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => linksAPI.deleteLink(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      toast.success('Link deleted', { id: 'link-delete' });
      navigate('/dashboard/links');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'link-delete' });
    },
  });

  const handleCopy = async () => {
    if (link) {
      await navigator.clipboard.writeText(link.short_url);
      toast.success('Copied to clipboard!', { id: 'clipboard' });
    }
  };

  if (linkLoading) {
    return <SkeletonDashboard />;
  }

  if (linkError || !link) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <Link2 className="w-7 h-7 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Link not found</h2>
        <p className="text-gray-500 mt-2">The link you're looking for doesn't exist or has been deleted.</p>
        <Link to="/dashboard/links" className="mt-6 inline-block">
          <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>Back to Links</Button>
        </Link>
      </div>
    );
  }

  // Chart data
  const clicksData = stats?.clicks_by_day || [];

  const countries = (stats?.top_countries || []).map((c: TopCountry) => ({
    name: c.name || 'Unknown',
    clicks: c.clicks || 0,
    percentage: c.clicks && stats ? Math.round((c.clicks / stats.total_clicks) * 100) : 0,
  }));

  const totalDevices = stats?.devices
    ? (stats.devices.desktop || 0) + (stats.devices.mobile || 0) + (stats.devices.tablet || 0)
    : 0;

  const devices = stats?.devices ? [
    { name: 'Desktop', value: stats.devices.desktop || 0 },
    { name: 'Mobile', value: stats.devices.mobile || 0 },
    { name: 'Tablet', value: stats.devices.tablet || 0 },
  ].filter(d => d.value > 0) : [];

  const totalBrowserClicks = (stats?.browsers || []).reduce((sum, b) => sum + (b.clicks || 0), 0);
  const browsers = (stats?.browsers || []).map((b) => ({
    browser: b.browser || 'Unknown',
    clicks: b.clicks || 0,
    percentage: totalBrowserClicks ? Math.round((b.clicks / totalBrowserClicks) * 100) : 0,
  }));

  const referrers = (stats?.referrers || []).map((r) => ({
    referer: r.referer || 'Direct / Unknown',
    clicks: r.clicks || 0,
  }));

  const ctrPercent = link.total_clicks > 0 && link.unique_clicks > 0
    ? Math.round((link.unique_clicks / link.total_clicks) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <Link
            to="/dashboard/links"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 mt-1 flex-shrink-0"
            aria-label="Back to links"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {link.title || link.short_code}
              </h1>
              <Badge variant={link.is_active ? 'success' : 'danger'}>
                {link.is_active ? 'Active' : 'Inactive'}
              </Badge>
              {link.is_expired && (
                <Badge variant="warning">Expired</Badge>
              )}
              {link.is_password_protected && (
                <Badge variant="default">
                  <Lock className="w-3 h-3 mr-1" /> Protected
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <a
                href={link.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium text-sm sm:text-base truncate"
              >
                {link.short_url}
              </a>
              <CopyButton text={link.short_url} className="flex-shrink-0" />
              <a
                href={link.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors flex-shrink-0"
                aria-label="Open short URL"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-sm text-gray-500 mt-1 max-w-xl truncate" title={link.original_url}>
              <span className="text-gray-400">→</span> {link.original_url}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link to={`/dashboard/links/${id}/qr`}>
            <Button variant="ghost" leftIcon={<QrCode className="w-4 h-4" />}>
              QR Code
            </Button>
          </Link>
          <Link to={`/dashboard/links/${id}/edit`}>
            <Button variant="ghost" leftIcon={<Edit className="w-4 h-4" />}>
              Edit
            </Button>
          </Link>
          <Dropdown
            trigger={
              <Button variant="ghost" aria-label="More actions">
                <MoreVertical className="w-4 h-4" />
              </Button>
            }
          >
            <DropdownItem onClick={() => navigate(`/dashboard/links/new?duplicate=${id}`)}>
              Duplicate Link
            </DropdownItem>
            <DropdownItem onClick={() => setDeleteModalOpen(true)} danger>
              Delete Link
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Clicks"
          value={link.total_clicks.toLocaleString()}
          icon={<MousePointer className="w-5 h-5" />}
        />
        <StatCard
          title="Unique Visitors"
          value={link.unique_clicks.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="CTR"
          value={`${ctrPercent}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="Created"
          value={formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
          icon={<Calendar className="w-5 h-5" />}
        />
      </div>

      {/* Period Selector + Chart Title */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <CardTitle>Clicks Over Time</CardTitle>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[
              { value: '7d', label: '7d' },
              { value: '30d', label: '30d' },
              { value: '90d', label: '90d' },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === p.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5 h-72">
          {statsLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loading />
            </div>
          ) : clicksData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <BarChart3 className="w-10 h-10 mb-2" />
              <p className="text-sm font-medium">No click data yet</p>
              <p className="text-xs mt-1">Clicks will appear here once people visit your link</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={clicksData}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f6821f" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f6821f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ fontWeight: 600, color: '#111827' }}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="#f6821f"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorClicks)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Analytics Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Countries */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <CardTitle>Top Countries</CardTitle>
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {statsLoading ? (
              <div className="flex justify-center py-8"><Loading /></div>
            ) : countries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No geographic data yet</p>
            ) : (
              <div className="space-y-3">
                {countries.slice(0, 8).map((country, index) => (
                  <div key={country.name} className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-semibold text-gray-400">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {country.name}
                        </span>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {country.clicks.toLocaleString()} <span className="text-gray-400">({country.percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(country.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Devices */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-gray-400" />
              <CardTitle>Devices</CardTitle>
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {statsLoading ? (
              <div className="flex justify-center py-8"><Loading /></div>
            ) : devices.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No device data yet</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-40 h-40 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={devices}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {devices.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {devices.map((device, index) => {
                    const pct = totalDevices ? Math.round((device.value / totalDevices) * 100) : 0;
                    return (
                      <div key={device.name} className="flex items-center gap-3">
                        <span className="text-gray-500">{DEVICE_ICONS[device.name]}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{device.name}</span>
                            <span className="text-xs text-gray-500 tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: COLORS[index % COLORS.length] }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Browsers */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400" />
              <CardTitle>Browsers</CardTitle>
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {statsLoading ? (
              <div className="flex justify-center py-8"><Loading /></div>
            ) : browsers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No browser data yet</p>
            ) : (
              <div className="space-y-3">
                {browsers.slice(0, 6).map((browser, index) => (
                  <div key={browser.browser} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {browser.browser}
                        </span>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {browser.clicks.toLocaleString()} <span className="text-gray-400">({browser.percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(browser.percentage, 2)}%`, backgroundColor: COLORS[index % COLORS.length] }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Referrers — previously unused data now displayed */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-gray-400" />
              <CardTitle>Top Referrers</CardTitle>
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {statsLoading ? (
              <div className="flex justify-center py-8"><Loading /></div>
            ) : referrers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No referrer data yet</p>
            ) : (
              <div className="space-y-2">
                {referrers.slice(0, 8).map((ref) => (
                  <div key={ref.referer} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-700 truncate mr-4">{ref.referer}</span>
                    <span className="text-xs font-medium text-gray-500 tabular-nums flex-shrink-0">
                      {ref.clicks.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Link Details — full-width */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-gray-400" />
              <CardTitle>Link Details</CardTitle>
            </div>
          </CardHeader>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Short URL</span>
              <span className="font-medium text-gray-900">{link.short_url}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Original URL</span>
              <span className="text-gray-900 truncate ml-4 max-w-[250px]" title={link.original_url}>
                {link.original_url}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-900">{format(new Date(link.created_at), 'MMM d, yyyy \'at\' h:mm a')}</span>
            </div>
            {link.domain_name && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Domain</span>
                <span className="text-gray-900">{link.domain_name}</span>
              </div>
            )}
            {link.expires_at && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Expires</span>
                <span className={link.is_expired ? 'text-red-600 font-medium' : 'text-gray-900'}>
                  {format(new Date(link.expires_at), 'MMM d, yyyy')}
                  {link.is_expired && ' (Expired)'}
                </span>
              </div>
            )}
            {link.campaign_name && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Campaign</span>
                <span className="text-gray-900">{link.campaign_name}</span>
              </div>
            )}
            {link.utm_source && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">UTM Source</span>
                <Badge variant="default">{link.utm_source}</Badge>
              </div>
            )}
            {link.utm_medium && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">UTM Medium</span>
                <Badge variant="default">{link.utm_medium}</Badge>
              </div>
            )}
            {link.utm_campaign && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">UTM Campaign</span>
                <Badge variant="default">{link.utm_campaign}</Badge>
              </div>
            )}
            {link.is_password_protected && (
              <div className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">Password</span>
                <span className="text-gray-900 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Enabled</span>
              </div>
            )}
          </div>
        </Card>

        {/* Associated Rules Section - using getForLink API */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-400" />
                <CardTitle>Smart Rules</CardTitle>
              </div>
              <Link to={`/dashboard/rules/new?link=${id}`}>
                <Button variant="ghost" size="sm">Add Rule</Button>
              </Link>
            </div>
          </CardHeader>
          <div className="mt-4">
            {rulesLoading ? (
              <div className="flex justify-center py-4"><Loading /></div>
            ) : !linkedRules || linkedRules.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No rules configured for this link</p>
            ) : (
              <div className="space-y-2">
                {linkedRules.map((rule: Rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant={rule.is_active ? 'success' : 'default'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <span className="font-medium text-gray-900">{rule.name}</span>
                      <span className="text-xs text-gray-500">
                        {rule.condition_type} → {rule.action_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{rule.times_matched} matches</span>
                      <Link to={`/dashboard/rules/${rule.id}/edit`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Link"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700">
              <strong>Warning:</strong> This action cannot be undone. All analytics data for this link will be permanently lost.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{link.title || link.short_code}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              isLoading={deleteMutation.isPending}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Delete Link
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

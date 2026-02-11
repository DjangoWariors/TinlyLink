import React, { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2, MousePointer, QrCode, TrendingUp, ArrowRight, Copy, Plus,
  AlertTriangle, Activity, Clock, Globe, ExternalLink, Eye, Zap, BarChart3,
  Users, Monitor, Smartphone, Tablet, Share2, ArrowUpRight, ArrowDownRight,
  MapPin, Crown
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { StatCard, Badge, Loading, EmptyState, ProgressBar } from '@/components/common';
import { linksAPI, analyticsAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS } from '@/config';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#f6821f', '#1e3a5f', '#0051c3', '#059669', '#d97706', '#6366f1'];

interface ActivityItem {
  id: string;
  type: 'click' | 'link_created' | 'qr_scan' | 'milestone';
  message: string;
  timestamp: string;
  link_id?: string;
  link_title?: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { user, subscription, usage, refreshUser } = useAuth();
  const [url, setUrl] = useState('');
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);
  const [period, setPeriod] = useState('7d');

  // --- Data fetching ---

  const { data: linksData, isLoading: linksLoading } = useQuery({
    queryKey: ['recentLinks'],
    queryFn: () => linksAPI.getLinks({ page: 1, page_size: 5 }),
  });

  const { data: analytics } = useQuery({
    queryKey: ['analyticsOverview', period],
    queryFn: () => analyticsAPI.getOverview(period),
  });

  const { data: clicksData } = useQuery({
    queryKey: ['clicksChart', period],
    queryFn: () => analyticsAPI.getClicks({ period, group_by: 'day' }),
  });

  const { data: realtimeData } = useQuery({
    queryKey: ['realtime'],
    queryFn: () => analyticsAPI.getRealtime(),
    refetchInterval: 30000,
  });

  const { data: topLinksData } = useQuery({
    queryKey: ['topLinks', period],
    queryFn: () => analyticsAPI.getTopLinks({ period, limit: 5 }),
    staleTime: 60_000,
  });

  const { data: geoData } = useQuery({
    queryKey: ['geography', period],
    queryFn: () => analyticsAPI.getGeography({ period }),
    staleTime: 60_000,
  });

  const { data: deviceData } = useQuery({
    queryKey: ['devices', period],
    queryFn: () => analyticsAPI.getDevices({ period }),
    staleTime: 60_000,
  });

  const { data: referrerData } = useQuery({
    queryKey: ['referrers', period],
    queryFn: () => analyticsAPI.getReferrers({ period }),
    staleTime: 60_000,
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (originalUrl: string) => linksAPI.createLink({ original_url: originalUrl }),
    onSuccess: (link) => {
      setUrl('');
      setLastCreatedUrl(link.short_url);
      queryClient.invalidateQueries({ queryKey: ['recentLinks'] });
      refreshUser();
      navigator.clipboard.writeText(link.short_url);
      toast.success('Link created & copied to clipboard!', { id: 'quick-shorten' });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Failed to create link', { id: 'quick-shorten' }),
  });

  const handleShorten = () => {
    if (!url.trim()) { toast.error('Please enter a URL', { id: 'quick-shorten' }); return; }
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) validUrl = 'https://' + url;
    try { new URL(validUrl); } catch { toast.error('Please enter a valid URL', { id: 'quick-shorten' }); return; }
    setLastCreatedUrl(null);
    createMutation.mutate(validUrl);
  };

  const handleCopy = async (shortUrl: string) => {
    await navigator.clipboard.writeText(shortUrl);
    toast.success('Copied!', { id: 'clipboard' });
  };

  // --- Derived data ---

  const chartData = clicksData?.data || [];
  const recentLinks = linksData?.results || [];
  const totalLinks = analytics?.total_links ?? linksData?.count ?? 0;
  const totalClicks = analytics?.total_clicks ?? 0;
  const uniqueVisitors = analytics?.unique_visitors ?? 0;

  // Usage limits
  const limits = {
    links: { used: usage?.links_created ?? totalLinks, max: subscription?.limits?.links_per_month ?? 50 },
    qr: { used: usage?.qr_codes_created ?? 0, max: subscription?.limits?.qr_codes_per_month ?? 10 },
  };

  const linkUsagePercent = limits.links.max ? (limits.links.used / limits.links.max) * 100 : 0;
  const qrUsagePercent = limits.qr.max ? (limits.qr.used / limits.qr.max) * 100 : 0;
  const isNearLimit = linkUsagePercent >= 80;

  // Trend data
  const clicksTrend = analytics?.clicks_trend?.change_percent != null
    ? { value: Math.abs(analytics.clicks_trend.change_percent), isPositive: analytics.clicks_trend.change_percent >= 0 }
    : undefined;

  // Activity feed
  const activityFeed: ActivityItem[] = (realtimeData?.recent_clicks || []).slice(0, 5).map((click: any, index: number) => ({
    id: click.id || String(index),
    type: 'click' as const,
    message: `Click on ${click.link_title || click.short_code || click.link_id || 'link'}`,
    timestamp: click.timestamp || click.clicked_at || new Date().toISOString(),
    link_title: click.link_title,
  }));

  // Top links
  const topLinks = (topLinksData?.links || []).slice(0, 5);

  // Geography
  const countries = (geoData?.countries || []).slice(0, 5);

  // Devices
  const deviceItems = deviceData?.devices ? [
    { name: 'Desktop', value: deviceData.devices.desktop?.clicks || 0, icon: <Monitor className="w-4 h-4" /> },
    { name: 'Mobile', value: deviceData.devices.mobile?.clicks || 0, icon: <Smartphone className="w-4 h-4" /> },
    { name: 'Tablet', value: deviceData.devices.tablet?.clicks || 0, icon: <Tablet className="w-4 h-4" /> },
  ].filter(d => d.value > 0) : [];
  const totalDeviceClicks = deviceItems.reduce((sum, d) => sum + d.value, 0);

  // Referrers
  const referrers = (referrerData?.referrers || []).slice(0, 5);

  // Accent colors
  const linkAccentColors = ['border-l-primary', 'border-l-blue-400', 'border-l-emerald-400', 'border-l-amber-400', 'border-l-purple-400'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-gray-500 mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} &mdash; Here's your link performance overview.
          </p>
        </div>
        <Link to="/dashboard/links/new">
          <Button leftIcon={<Plus className="w-4 h-4" />}>Create Link</Button>
        </Link>
      </div>

      {/* Usage Alert */}
      {isNearLimit && (
        <Card className="bg-warning/10 border-warning/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning-dark">Approaching link limit</p>
              <p className="text-sm text-gray-600 mt-1">
                You've used {limits.links.used} of {limits.links.max} links this month ({linkUsagePercent.toFixed(0)}%).
              </p>
              <Link to="/dashboard/settings?tab=billing" className="text-sm text-primary hover:underline mt-2 inline-block">
                Upgrade your plan →
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Links"
          value={totalLinks.toLocaleString()}
          icon={<Link2 className="w-5 h-5" />}
        />
        <StatCard
          title="Total Clicks"
          value={totalClicks.toLocaleString()}
          icon={<MousePointer className="w-5 h-5" />}
          trend={clicksTrend}
        />
        <StatCard
          title="Unique Visitors"
          value={uniqueVisitors.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Active Now"
          value={realtimeData?.active_visitors?.toString() || '0'}
          icon={
            <span className="relative">
              <Eye className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse-dot" />
            </span>
          }
          className="bg-success/5 border-success/20"
        />
      </div>

      {/* Quick Shortener */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Paste your long URL here and press Enter..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleShorten()}
              leftIcon={<Link2 className="w-4 h-4" />}
            />
          </div>
          <Button onClick={handleShorten} isLoading={createMutation.isPending} className="sm:w-auto w-full">
            Shorten
          </Button>
        </div>
        {!lastCreatedUrl && !url && (
          <p className="mt-2 text-xs text-gray-400">
            Tip: Paste any URL and press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[10px]">Enter</kbd> to instantly shorten it
          </p>
        )}
        {lastCreatedUrl && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-lg">
            <Link2 className="w-4 h-4 text-success flex-shrink-0" />
            <a
              href={lastCreatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline truncate flex-1"
            >
              {lastCreatedUrl.replace('https://', '').replace('http://', '')}
            </a>
            <button
              onClick={() => handleCopy(lastCreatedUrl)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary-50 hover:bg-primary-100 rounded-md transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
        )}
      </Card>

      {/* Chart + Activity Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Clicks Chart */}
        <Card className="lg:col-span-2" padding="none">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <CardTitle>Click Performance</CardTitle>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    period === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 pb-5 h-64">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <BarChart3 className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No click data yet</p>
                <p className="text-xs text-gray-500 mt-1">Start sharing your links to see performance here.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f6821f" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f6821f" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0051c3" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#0051c3" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    labelStyle={{ fontWeight: 600, color: '#111827' }}
                  />
                  <Area type="monotone" dataKey="clicks" stroke="#f6821f" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" name="Clicks" />
                  <Area type="monotone" dataKey="unique_clicks" stroke="#0051c3" strokeWidth={1.5} strokeDasharray="4 2" fillOpacity={1} fill="url(#colorUnique)" name="Unique" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Activity Feed */}
        <Card padding="none">
          <div className="px-5 pt-5 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Live Activity
            </CardTitle>
          </div>
          <div className="px-5 pb-5">
            {activityFeed.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Activity className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700">No activity yet</p>
                <p className="text-xs text-gray-500 mt-1">Clicks and events will appear here in real time.</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {activityFeed.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.type === 'click' ? 'bg-primary/10 text-primary' :
                      item.type === 'link_created' ? 'bg-success/10 text-success' :
                      item.type === 'qr_scan' ? 'bg-accent/10 text-accent' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {item.type === 'click' && <MousePointer className="w-3 h-3" />}
                      {item.type === 'link_created' && <Link2 className="w-3 h-3" />}
                      {item.type === 'qr_scan' && <QrCode className="w-3 h-3" />}
                      {item.type === 'milestone' && <TrendingUp className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 truncate">{item.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : 'just now'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Insights Row: Top Links + Geography */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Performing Links */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" /> Top Performing Links
            </CardTitle>
            <Link to="/dashboard/analytics" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="px-5 pb-5">
            {topLinks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Share your links to see top performers here</p>
            ) : (
              <div className="space-y-3">
                {topLinks.map((link: any, index: number) => (
                  <Link
                    key={link.id || index}
                    to={`/dashboard/links/${link.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      index === 0 ? 'bg-amber-100 text-amber-700' :
                      index === 1 ? 'bg-gray-200 text-gray-600' :
                      index === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                        {link.title || link.short_code || link.short_url}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{link.original_url}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900 tabular-nums">{(link.total_clicks || link.clicks || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">clicks</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Geography */}
        <Card padding="none">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" /> Top Countries
            </CardTitle>
            <Link to="/dashboard/analytics" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="px-5 pb-5">
            {countries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Country data will appear as your links get clicks</p>
            ) : (
              <div className="space-y-3">
                {countries.map((country: any, index: number) => (
                  <div key={country.name || country.code || index} className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-semibold text-gray-400">{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{country.name || 'Unknown'}</span>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {(country.clicks || 0).toLocaleString()} <span className="text-gray-400">({country.percentage || 0}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(country.percentage || 0, 2)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Insights Row: Devices + Referrers */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Devices */}
        <Card padding="none">
          <div className="px-5 pt-5 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-gray-400" /> Devices
            </CardTitle>
          </div>
          <div className="px-5 pb-5">
            {deviceItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Device breakdown will appear as clicks come in</p>
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={deviceItems}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {deviceItems.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {deviceItems.map((device, index) => {
                    const pct = totalDeviceClicks ? Math.round((device.value / totalDeviceClicks) * 100) : 0;
                    return (
                      <div key={device.name} className="flex items-center gap-3">
                        <span className="text-gray-500">{device.icon}</span>
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

        {/* Referrers */}
        <Card padding="none">
          <div className="px-5 pt-5 pb-3">
            <CardTitle className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-gray-400" /> Top Referrers
            </CardTitle>
          </div>
          <div className="px-5 pb-5">
            {referrers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">Referrer sources will show where your clicks come from</p>
                {referrerData?.direct ? (
                  <p className="text-xs text-gray-400 mt-1">{referrerData.direct.toLocaleString()} direct visits</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {referrerData?.direct ? (
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-700 font-medium">Direct / Typed</span>
                    <span className="text-xs font-medium text-gray-500 tabular-nums">{referrerData.direct.toLocaleString()}</span>
                  </div>
                ) : null}
                {referrers.map((ref: any) => (
                  <div key={ref.referer || ref.domain} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700 truncate mr-4">{ref.referer || ref.domain || 'Unknown'}</span>
                    <span className="text-xs font-medium text-gray-500 tabular-nums flex-shrink-0">
                      {(ref.clicks || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Links + Usage */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Links */}
        <Card className="lg:col-span-2" padding="none">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <CardTitle>Recent Links</CardTitle>
            <Link to="/dashboard/links" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="px-5 pb-5">
            {linksLoading ? (
              <div className="py-8 flex justify-center"><Loading /></div>
            ) : recentLinks.length === 0 ? (
              <EmptyState
                icon={<Link2 className="w-6 h-6" />}
                title="No links yet"
                description="Create your first short link"
                action={<Link to="/dashboard/links/new"><Button size="sm">Create Link</Button></Link>}
              />
            ) : (
              <div className="space-y-2">
                {recentLinks.map((link: any, index: number) => (
                  <div key={link.id} className={`p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors border-l-4 ${linkAccentColors[index % linkAccentColors.length]}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <Link
                            to={`/dashboard/links/${link.id}`}
                            className="text-sm font-medium text-primary hover:underline truncate"
                          >
                            {link.title || link.short_url?.replace('https://', '').replace('http://', '')}
                          </Link>
                          <button onClick={() => handleCopy(link.short_url)} className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5 ml-5.5">{link.original_url}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400 hidden sm:inline">
                          {link.created_at ? formatDistanceToNow(new Date(link.created_at), { addSuffix: true }) : ''}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">{(link.total_clicks || 0).toLocaleString()}</span>
                          <span className="text-xs text-gray-400 ml-1">clicks</span>
                        </div>
                        <Badge variant={link.is_active !== false ? 'success' : 'danger'} className="text-xs hidden sm:inline-flex">
                          {link.is_active !== false ? 'Active' : 'Off'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Usage Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Usage This Month</CardTitle>
          </CardHeader>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Links
                </span>
                <span className="text-sm font-medium tabular-nums">{limits.links.used} / {limits.links.max.toLocaleString()}</span>
              </div>
              <ProgressBar value={linkUsagePercent} max={100} className={linkUsagePercent >= 90 ? 'bg-danger' : isNearLimit ? 'bg-warning' : ''} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5" /> QR Codes
                </span>
                <span className="text-sm font-medium tabular-nums">{limits.qr.used} / {limits.qr.max.toLocaleString()}</span>
              </div>
              <ProgressBar value={qrUsagePercent} max={100} className={qrUsagePercent >= 90 ? 'bg-danger' : ''} />
            </div>

            {/* Quick summary stats */}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Avg clicks/link</span>
                <span className="font-medium text-gray-900 tabular-nums">
                  {totalLinks > 0 ? Math.round(totalClicks / totalLinks).toLocaleString() : '0'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Countries reached</span>
                <span className="font-medium text-gray-900 tabular-nums">{analytics?.countries ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">QR Scans</span>
                <span className="font-medium text-gray-900 tabular-nums">{(analytics?.total_qr_scans ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {subscription?.plan === 'free' && (
              <Link to="/dashboard/settings?tab=billing">
                <Button variant="outline" className="w-full mt-2">
                  Upgrade for more <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </Card>
      </div>

      {/* Upgrade Banner */}
      {subscription?.plan === 'free' && (
        <Card className="bg-gradient-to-r from-orange-500 to-amber-400 border-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Upgrade to Pro</h3>
                <p className="text-sm text-white/90 mt-1">Get {PLAN_LIMITS.pro.linksPerMonth.toLocaleString()} links/mo, custom domains, and full analytics retention.</p>
              </div>
            </div>
            <Link to="/dashboard/settings?tab=billing">
              <Button size="sm" className="bg-white text-orange-600 hover:bg-white/90 border-0 font-semibold shadow-md">
                Upgrade Now <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

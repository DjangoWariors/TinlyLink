import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import {
  MousePointer, Users, Globe, TrendingUp, Download, Calendar,
  ArrowUpRight, ArrowDownRight, RefreshCw, ExternalLink, Eye,
  Monitor, Smartphone, Tablet, Crown, Share2, Activity, Clock,
  BarChart3, Zap, MapPin
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { StatCard, Loading, Badge, Modal, EmptyState, SkeletonDashboard } from '@/components/common';
import { analyticsAPI, linksAPI } from '@/services/api';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';

const COLORS = ['#f6821f', '#1e3a5f', '#0051c3', '#059669', '#d97706', '#6366f1', '#ec4899', '#8b5cf6'];
const DEVICE_COLORS: Record<string, string> = { Desktop: '#1e3a5f', Mobile: '#f6821f', Tablet: '#059669' };
const DEVICE_ICONS: Record<string, typeof Monitor> = { Desktop: Monitor, Mobile: Smartphone, Tablet: Tablet };

export function AnalyticsPage() {
  const [searchParams] = useSearchParams();
  const linkId = searchParams.get('link');

  const [period, setPeriod] = useState('30d');
  const [dateRange, setDateRange] = useState({ start: format(subDays(new Date(), 30), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportMethod, setExportMethod] = useState<'sync' | 'async'>('sync');
  const [isExporting, setIsExporting] = useState(false);

  // --- Data fetching ---

  const { data: linkData } = useQuery({
    queryKey: ['link', linkId],
    queryFn: () => linksAPI.getLink(linkId!),
    enabled: !!linkId,
  });

  // Build query params with custom date range support
  const dateParams = period === 'custom'
    ? { period: 'custom' as const, start_date: dateRange.start, end_date: dateRange.end }
    : { period, start_date: undefined as string | undefined, end_date: undefined as string | undefined };

  const { data: overview, isLoading: overviewLoading, refetch } = useQuery({
    queryKey: ['analyticsOverview', period, linkId, dateRange],
    queryFn: () => analyticsAPI.getOverview(dateParams.period, dateParams.start_date, dateParams.end_date),
    staleTime: 60_000,
  });

  const { data: clicksData, isLoading: clicksLoading } = useQuery({
    queryKey: ['analyticsClicks', period, linkId, dateRange],
    queryFn: () => analyticsAPI.getClicks({ ...dateParams, group_by: 'day', link_id: linkId || undefined }),
    staleTime: 60_000,
  });

  const { data: geoData, isLoading: geoLoading } = useQuery({
    queryKey: ['analyticsGeo', period, linkId, dateRange],
    queryFn: () => analyticsAPI.getGeography({ ...dateParams, link_id: linkId || undefined }),
    staleTime: 60_000,
  });

  const { data: deviceData, isLoading: deviceLoading } = useQuery({
    queryKey: ['analyticsDevices', period, linkId, dateRange],
    queryFn: () => analyticsAPI.getDevices({ ...dateParams, link_id: linkId || undefined }),
    staleTime: 60_000,
  });

  const { data: referrerData, isLoading: referrerLoading } = useQuery({
    queryKey: ['analyticsReferrers', period, linkId, dateRange],
    queryFn: () => analyticsAPI.getReferrers({ ...dateParams, link_id: linkId || undefined }),
    staleTime: 60_000,
  });

  const { data: topLinksData, isLoading: topLinksLoading } = useQuery({
    queryKey: ['analyticsTopLinks', period],
    queryFn: () => analyticsAPI.getTopLinks({ period, limit: 10 }),
    enabled: !linkId,
    staleTime: 60_000,
  });

  const { data: realtimeData } = useQuery({
    queryKey: ['analyticsRealtime'],
    queryFn: () => analyticsAPI.getRealtime(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Period comparison data using getCompare API
  const { data: compareData, isLoading: compareLoading } = useQuery({
    queryKey: ['analyticsCompare', period, linkId],
    queryFn: () => analyticsAPI.getCompare({ period, link_id: linkId || undefined }),
    enabled: compareEnabled,
    staleTime: 60_000,
  });

  // --- Handlers ---

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const effectivePeriod = period === 'custom' ? 'custom' : period;
      if (exportMethod === 'sync') {
        // Direct file download using exportAnalyticsSync
        const blob = await analyticsAPI.exportAnalyticsSync({
          format: exportFormat,
          period: effectivePeriod,
          ...(effectivePeriod === 'custom' ? { start_date: dateRange.start, end_date: dateRange.end } : {}),
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${effectivePeriod}.${exportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Analytics exported');
      } else {
        // Async export for large datasets
        const result = await analyticsAPI.exportAnalyticsAsync({
          format: exportFormat,
          period: effectivePeriod as '7d' | '30d' | '90d' | 'all',
          link_ids: linkId ? [linkId] : undefined,
          ...(effectivePeriod === 'custom' ? { start_date: dateRange.start, end_date: dateRange.end } : {}),
        });
        toast.success(`Export queued! You'll be notified when it's ready.`);
      }
      setExportModalOpen(false);
    } catch { toast.error('Failed to export'); }
    finally { setIsExporting(false); }
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[newPeriod] || 30;
    setDateRange({ start: format(subDays(new Date(), days), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  };

  // --- Derived data ---

  const chartData = clicksData?.data || [];

  const countries: Array<{ name: string; code: string; clicks: number; percentage: number }> = geoData?.countries?.map((c: any) => ({
    name: c.country_name || c.name || 'Unknown',
    code: c.code || c.country_code || '',
    clicks: c.clicks || 0,
    percentage: c.percentage || 0,
  })) || [];

  const devices: Array<{ name: string; value: number; percentage: number }> = (() => {
    if (deviceData?.devices) {
      if (Array.isArray(deviceData.devices)) return deviceData.devices;
      const d = deviceData.devices as any;
      const total = (d.desktop?.clicks || 0) + (d.mobile?.clicks || 0) + (d.tablet?.clicks || 0);
      return [
        { name: 'Desktop', value: d.desktop?.clicks || 0, percentage: d.desktop?.percentage || 0 },
        { name: 'Mobile', value: d.mobile?.clicks || 0, percentage: d.mobile?.percentage || 0 },
        { name: 'Tablet', value: d.tablet?.clicks || 0, percentage: d.tablet?.percentage || 0 },
      ].filter(item => item.value > 0);
    }
    return [];
  })();

  const browsers: Array<{ browser: string; clicks: number; percentage: number }> = deviceData?.browsers?.map((b: any) => {
    const total = deviceData?.total || 1;
    return {
      browser: b.browser || b.name || 'Unknown',
      clicks: b.clicks || b.count || 0,
      percentage: b.percentage || (total > 0 ? Math.round(((b.clicks || b.count || 0) / total) * 1000) / 10 : 0),
    };
  }) || [];

  const operatingSystems: Array<{ os: string; clicks: number; percentage: number }> = deviceData?.operating_systems?.map((o: any) => {
    const total = deviceData?.total || 1;
    return {
      os: o.os || o.name || 'Unknown',
      clicks: o.clicks || o.count || 0,
      percentage: o.percentage || (total > 0 ? Math.round(((o.clicks || o.count || 0) / total) * 1000) / 10 : 0),
    };
  }) || [];

  const referrers: Array<{ referrer: string; clicks: number; percentage: number }> = referrerData?.referrers?.map((r: any) => ({
    referrer: r.domain || r.referrer || r.source || 'Direct',
    clicks: r.clicks || r.count || 0,
    percentage: r.percentage || 0,
  })) || [];

  const topLinks: Array<{ id: string; short_code: string; short_url: string; title: string; clicks: number; unique_visitors: number; ctr: number }> =
    topLinksData?.links || [];

  const totalClicks = overview?.total_clicks || 0;
  const uniqueVisitors = (overview as any)?.unique_visitors || 0;
  const countriesCount = (overview as any)?.countries || geoData?.countries?.length || 0;
  const totalLinks = (overview as any)?.total_links || 0;
  const qrScans = (overview as any)?.total_qr_scans || 0;
  const clicksTrend = (overview as any)?.clicks_trend;
  const changePercent = compareData?.change?.clicks_percent ?? clicksTrend?.change_percent ?? 0;
  const prevClicks = compareData?.previous_period?.total_clicks ?? clicksTrend?.previous ?? 0;
  const currentUniqueFromCompare = compareData?.current_period?.unique_clicks;
  const prevUnique = compareData?.previous_period?.unique_clicks ?? 0;
  const uniqueChangePercent = compareData?.change?.unique_percent ?? 0;
  const activeVisitors = realtimeData?.active_visitors ?? 0;
  const directVisits = referrerData?.direct ?? 0;

  if (overviewLoading) return <SkeletonDashboard />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {linkId && linkData ? `Analytics: ${linkData.title || linkData.short_code}` : 'Analytics'}
            </h1>
            {activeVisitors > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {activeVisitors} active now
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-1">
            {linkId ? (
              <span className="flex items-center gap-2">
                <a href={linkData?.short_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px] sm:max-w-none">
                  {linkData?.short_url?.replace('https://', '')}
                </a>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </span>
            ) : 'Track your link performance and audience insights'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[{ value: '7d', label: '7D' }, { value: '30d', label: '30D' }, { value: '90d', label: '90D' }].map((p) => (
              <button key={p.value} onClick={() => handlePeriodChange(p.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${period === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" leftIcon={<Calendar className="w-4 h-4" />} onClick={() => setShowDatePicker(!showDatePicker)}>
              <span className="hidden sm:inline">Custom</span>
            </Button>
            <Button variant={compareEnabled ? 'primary' : 'outline'} size="sm" onClick={() => setCompareEnabled(!compareEnabled)}>
              <BarChart3 className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">{compareEnabled ? 'Comparing' : 'Compare'}</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={() => setExportModalOpen(true)}>
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Date Range Picker */}
      {showDatePicker && (
        <Card>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="input text-sm" />
              <span className="text-gray-400">to</span>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="input text-sm" />
            </div>
            <Button size="sm" onClick={() => { setPeriod('custom'); setShowDatePicker(false); }}>Apply</Button>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Clicks"
          value={totalClicks.toLocaleString()}
          icon={<MousePointer className="w-5 h-5" />}
          trend={changePercent !== 0 ? { value: Math.abs(changePercent), isPositive: changePercent >= 0 } : undefined}
        />
        <StatCard
          title="Unique Visitors"
          value={uniqueVisitors.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
        />
        <StatCard
          title="Countries"
          value={countriesCount.toLocaleString()}
          icon={<Globe className="w-5 h-5" />}
        />
        <StatCard
          title="Total Links"
          value={totalLinks.toLocaleString()}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatCard
          title="QR Scans"
          value={qrScans.toLocaleString()}
          icon={<Eye className="w-5 h-5" />}
        />
      </div>

      {/* Comparison Stats */}
      {compareEnabled && (
        <Card className="bg-gray-50 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900">Period Comparison</h3>
            {compareLoading ? (
              <span className="text-xs text-gray-400">Loading...</span>
            ) : (
              <Badge variant={changePercent >= 0 ? 'success' : 'danger'}>
                {changePercent >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {Math.abs(changePercent)}% vs previous period
              </Badge>
            )}
          </div>
          {compareData && (
            <div className="text-xs text-gray-400 mt-1">
              Comparing {compareData.current_period?.start} - {compareData.current_period?.end} vs {compareData.previous_period?.start} - {compareData.previous_period?.end}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 mt-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Clicks</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{(compareData?.current_period?.total_clicks ?? totalClicks).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Clicks</p>
              <p className="text-3xl font-bold text-gray-400 mt-1">{prevClicks.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Change</p>
              <p className={`text-3xl font-bold mt-1 ${uniqueChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {uniqueChangePercent >= 0 ? '+' : ''}{uniqueChangePercent}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Click Difference</p>
              <p className={`text-3xl font-bold mt-1 ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {changePercent >= 0 ? '+' : ''}{((compareData?.current_period?.total_clicks ?? totalClicks) - prevClicks).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Clicks Over Time */}
      <Card padding="none">
        <CardHeader className="px-5 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle>Clicks Over Time</CardTitle>
            <span className="text-xs text-gray-400">Last {period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}</span>
          </div>
        </CardHeader>
        <div className="px-5 pb-5 h-80">
          {clicksLoading ? (
            <div className="h-full flex items-center justify-center"><Loading /></div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="No click data yet" description="Clicks will appear here once your links receive traffic." />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f6821f" stopOpacity={0.15} /><stop offset="95%" stopColor="#f6821f" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.15} /><stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => {
                    try { return format(new Date(val), 'MMM d'); } catch { return val; }
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  labelFormatter={(val) => { try { return format(new Date(val), 'MMM d, yyyy'); } catch { return val; } }}
                />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="clicks" name="Total Clicks" stroke="#f6821f" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" />
                <Area type="monotone" dataKey="unique_clicks" name="Unique Visitors" stroke="#1e3a5f" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorUnique)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Top Performing Links */}
      {!linkId && (
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle>Top Performing Links</CardTitle>
              <Link to="/dashboard/links" className="text-xs text-primary hover:underline font-medium">View all</Link>
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {topLinksLoading ? (
              <div className="py-8"><Loading /></div>
            ) : topLinks.length === 0 ? (
              <EmptyState
                icon={<Crown className="w-6 h-6" />}
                title="No link data yet"
                description="Your top performing links will show up here."
              />
            ) : (
              <div className="space-y-3">
                {topLinks.slice(0, 8).map((link, index) => {
                  const maxClicks = topLinks[0]?.clicks || 1;
                  const barWidth = Math.max(5, (link.clicks / maxClicks) * 100);
                  return (
                    <Link
                      key={link.id}
                      to={`/dashboard/links/${link.id}`}
                      className="flex items-center gap-3 group py-2 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${index === 0 ? 'bg-amber-100 text-amber-700' :
                        index === 1 ? 'bg-gray-100 text-gray-600' :
                          index === 2 ? 'bg-orange-50 text-orange-600' :
                            'bg-gray-50 text-gray-400'
                        }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                            {link.title || link.short_code}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0 ml-3">
                            <span>{link.clicks.toLocaleString()} clicks</span>
                            <span className="text-gray-300">|</span>
                            <span>{link.unique_visitors.toLocaleString()} unique</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary/80 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Geography & Devices Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Countries */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> Top Countries</CardTitle>
              <span className="text-xs text-gray-400">{countries.length} countries</span>
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {geoLoading ? (
              <div className="py-8"><Loading /></div>
            ) : countries.length === 0 ? (
              <EmptyState icon={<Globe className="w-6 h-6" />} title="No geographic data" description="Country data will appear as your links get clicks." />
            ) : (
              <div className="space-y-2.5">
                {countries.slice(0, 8).map((country, index) => (
                  <div key={country.name} className="flex items-center gap-3">
                    <span className="w-5 text-center text-xs font-medium text-gray-400">{index + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{country.name}</span>
                        <span className="text-xs text-gray-500">{country.clicks.toLocaleString()} <span className="text-gray-400">({country.percentage}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${country.percentage}%` }} />
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
            <CardTitle className="flex items-center gap-2"><Monitor className="w-4 h-4 text-gray-400" /> Devices</CardTitle>
          </CardHeader>
          <div className="p-5 pt-2">
            {deviceLoading ? (
              <div className="py-8"><Loading /></div>
            ) : devices.length === 0 ? (
              <EmptyState icon={<Smartphone className="w-6 h-6" />} title="No device data" description="Device breakdown will appear as clicks come in." />
            ) : (
              <div className="flex items-center gap-6">
                <div className="w-40 h-40 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={devices} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {devices.map((entry) => <Cell key={entry.name} fill={DEVICE_COLORS[entry.name] || COLORS[0]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {devices.map((device) => {
                    const Icon = DEVICE_ICONS[device.name] || Monitor;
                    return (
                      <div key={device.name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${DEVICE_COLORS[device.name] || COLORS[0]}15` }}>
                          <Icon className="w-4 h-4" style={{ color: DEVICE_COLORS[device.name] || COLORS[0] }} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">{device.name}</span>
                            <span className="text-xs text-gray-500">{device.value.toLocaleString()} <span className="text-gray-400">({device.percentage}%)</span></span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full" style={{ width: `${device.percentage}%`, backgroundColor: DEVICE_COLORS[device.name] || COLORS[0] }} />
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
      </div>

      {/* Browsers & OS Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Browsers */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="flex items-center gap-2"><Globe className="w-4 h-4 text-gray-400" /> Browsers</CardTitle>
          </CardHeader>
          <div className="p-5 pt-2">
            {deviceLoading ? (
              <div className="py-8"><Loading /></div>
            ) : browsers.length === 0 ? (
              <EmptyState icon={<Globe className="w-6 h-6" />} title="No browser data" description="Browser breakdown will appear with traffic." />
            ) : (
              <div className="space-y-2.5">
                {browsers.slice(0, 6).map((browser, index) => (
                  <div key={browser.browser} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{browser.browser}</span>
                        <span className="text-xs text-gray-500">{browser.clicks.toLocaleString()} <span className="text-gray-400">({browser.percentage}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${browser.percentage}%`, backgroundColor: COLORS[index % COLORS.length] }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Operating Systems */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="flex items-center gap-2"><Monitor className="w-4 h-4 text-gray-400" /> Operating Systems</CardTitle>
          </CardHeader>
          <div className="p-5 pt-2">
            {deviceLoading ? (
              <div className="py-8"><Loading /></div>
            ) : operatingSystems.length === 0 ? (
              <EmptyState icon={<Monitor className="w-6 h-6" />} title="No OS data" description="OS breakdown will appear with traffic." />
            ) : (
              <div className="space-y-2.5">
                {operatingSystems.slice(0, 6).map((os, index) => (
                  <div key={os.os} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">{os.os}</span>
                        <span className="text-xs text-gray-500">{os.clicks.toLocaleString()} <span className="text-gray-400">({os.percentage}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${os.percentage}%`, backgroundColor: COLORS[(index + 3) % COLORS.length] }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Referrers & Real-time Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Referrers */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Share2 className="w-4 h-4 text-gray-400" /> Top Referrers</CardTitle>
              {directVisits > 0 && <span className="text-xs text-gray-400">{directVisits.toLocaleString()} direct visits</span>}
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {referrerLoading ? (
              <div className="py-8"><Loading /></div>
            ) : referrers.length === 0 ? (
              <EmptyState icon={<Share2 className="w-6 h-6" />} title="No referrer data" description="Referrer sources will appear as your links get shared." />
            ) : (
              <div className="space-y-2.5">
                {referrers.slice(0, 8).map((referrer, index) => (
                  <div key={referrer.referrer} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-gray-400">{referrer.referrer.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 truncate">{referrer.referrer}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{referrer.clicks.toLocaleString()} <span className="text-gray-400">({referrer.percentage}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${referrer.percentage}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Real-time Activity */}
        <Card padding="none">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" /> Real-time Activity
              </CardTitle>
              {activeVisitors > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {activeVisitors} live
                </span>
              )}
            </div>
          </CardHeader>
          <div className="p-5 pt-2">
            {!realtimeData?.recent_clicks || realtimeData.recent_clicks.length === 0 ? (
              <EmptyState icon={<Activity className="w-6 h-6" />} title="No recent activity" description="Recent clicks will appear here in real-time." />
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {realtimeData.recent_clicks.slice(0, 10).map((click: any) => (
                  <div key={click.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 bg-primary/5 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MousePointer className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">/{click.link_short_code}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        {click.country && <span>{click.country}</span>}
                        {click.device && <><span className="text-gray-300">&middot;</span><span>{click.device}</span></>}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {(() => { try { const d = new Date(click.clicked_at); const diff = Math.floor((Date.now() - d.getTime()) / 60000); return diff < 1 ? 'just now' : `${diff}m ago`; } catch { return ''; } })()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Export Modal */}
      <Modal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} title="Export Analytics">
        <div className="space-y-4">
          <div>
            <label className="label">Export Format</label>
            <div className="grid grid-cols-2 gap-2">
              {(['csv', 'json'] as const).map((fmt) => (
                <button key={fmt} onClick={() => setExportFormat(fmt)}
                  className={`py-2.5 px-4 border-2 rounded-lg text-sm font-medium uppercase transition-all ${exportFormat === fmt ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-gray-300'}`}>
                  {fmt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Export Method</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="radio" name="exportMethod" value="sync" checked={exportMethod === 'sync'} onChange={() => setExportMethod('sync')} className="text-primary" />
                <div>
                  <p className="text-sm font-medium">Direct Download</p>
                  <p className="text-xs text-gray-500">Immediate file download (recommended for smaller datasets)</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="radio" name="exportMethod" value="async" checked={exportMethod === 'async'} onChange={() => setExportMethod('async')} className="text-primary" />
                <div>
                  <p className="text-sm font-medium">Background Export</p>
                  <p className="text-xs text-gray-500">For large datasets - queued processing, notified when ready</p>
                </div>
              </label>
            </div>
          </div>
          <div>
            <label className="label">Date Range</label>
            <p className="text-sm text-gray-600">{period === 'custom' ? `${dateRange.start} to ${dateRange.end}` : `Last ${period === '7d' ? '7 days' : period === '30d' ? '30 days' : '90 days'}`}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setExportModalOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} isLoading={isExporting} leftIcon={<Download className="w-4 h-4" />}>Export</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

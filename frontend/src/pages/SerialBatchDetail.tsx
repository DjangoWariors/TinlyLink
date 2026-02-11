/**
 * Serial Batch Detail Page - View batch details, codes, and verification stats
 */

import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Package,
  Download,
  Copy,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Search,
  RefreshCw,
  BarChart3,
  Shield,
  AlertTriangle,
  ExternalLink,
  Eye,
  MapPin,
  Smartphone,
  Globe,
  Calendar,
  Hash,
  QrCode,
  Ban,
  RotateCcw,
  Play,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card, Badge, Modal, Loading, EmptyState, Tabs } from '@/components/common';
import { serialAPI, getErrorMessage } from '@/services/api';
import { useDebounce } from '@/hooks';
import type { SerialBatch, SerialCode, SerialBatchStatus } from '@/types';

// Status configuration
const STATUS_CONFIG: Record<SerialBatchStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Processing', icon: Loader2, color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-gray-100 text-gray-600' },
};

// Code status colors
const CODE_STATUS_COLORS: Record<string, string> = {
  unused: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  verified: 'bg-blue-100 text-blue-700',
  suspicious: 'bg-yellow-100 text-yellow-700',
  revoked: 'bg-red-100 text-red-700',
  blocked: 'bg-red-100 text-red-700',
  recalled: 'bg-orange-100 text-orange-700',
  expired: 'bg-gray-100 text-gray-600',
};

export function SerialBatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'codes');
  const [codeSearch, setCodeSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState<SerialCode | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);

  const debouncedCodeSearch = useDebounce(codeSearch, 300);

  // Fetch batch details
  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ['serial-batch', id],
    queryFn: () => serialAPI.batches.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      // Poll while pending or processing, stop on terminal states
      const data = query.state.data as SerialBatch | undefined;
      return data?.status === 'processing' || data?.status === 'pending' ? 3000 : false;
    },
  });

  // Fetch batch codes
  const { data: codesData, isLoading: codesLoading, refetch: refetchCodes } = useQuery({
    queryKey: ['serial-codes', id, debouncedCodeSearch],
    queryFn: () => serialAPI.codes.list(id!, { search: debouncedCodeSearch || undefined }),
    enabled: !!id && activeTab === 'codes',
  });

  // Fetch batch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['serial-batch-stats', id],
    queryFn: () => serialAPI.batches.getStats(id!),
    enabled: !!id && activeTab === 'stats',
  });

  const codes = codesData?.results || [];

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const { download_url } = await serialAPI.batches.getDownloadUrl(id!);
      window.open(download_url, '_blank');
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'batch-download' }),
  });

  // Revoke code mutation
  const revokeMutation = useMutation({
    mutationFn: (codeId: string) => serialAPI.codes.revoke(codeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-codes', id] });
      queryClient.invalidateQueries({ queryKey: ['serial-batch-stats', id] });
      toast.success('Code revoked', { id: 'code-revoke' });
      setCodeModalOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'code-revoke' }),
  });

  // Block code mutation
  const blockMutation = useMutation({
    mutationFn: (codeId: string) => serialAPI.codes.block(codeId, 'Blocked by user'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-codes', id] });
      queryClient.invalidateQueries({ queryKey: ['serial-batch-stats', id] });
      toast.success('Code blocked', { id: 'code-block' });
      setCodeModalOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'code-block' }),
  });

  // Recall code mutation
  const recallMutation = useMutation({
    mutationFn: (codeId: string) => serialAPI.codes.recall(codeId, 'Recalled by user'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-codes', id] });
      queryClient.invalidateQueries({ queryKey: ['serial-batch-stats', id] });
      toast.success('Code recalled', { id: 'code-recall' });
      setCodeModalOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'code-recall' }),
  });

  // Reactivate code mutation
  const reactivateMutation = useMutation({
    mutationFn: (codeId: string) => serialAPI.codes.reactivate(codeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-codes', id] });
      queryClient.invalidateQueries({ queryKey: ['serial-batch-stats', id] });
      toast.success('Code reactivated', { id: 'code-reactivate' });
      setCodeModalOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'code-reactivate' }),
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard', { id: 'clipboard' });
  };

  const formatNumber = (num: number) => num.toLocaleString();
  const formatDate = (date: string) => new Date(date).toLocaleString();

  if (batchLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" />
      </div>
    );
  }

  if (!batch) {
    return (
      <Card className="text-center py-12">
        <EmptyState
          icon={<Package className="w-6 h-6" />}
          title="Batch not found"
          description="The serial batch you're looking for doesn't exist or has been deleted."
          action={
            <Button onClick={() => navigate('/dashboard/serial-batches')}>
              Back to Batches
            </Button>
          }
        />
      </Card>
    );
  }

  const statusConfig = STATUS_CONFIG[batch.status];
  const StatusIcon = statusConfig.icon;
  const isProcessing = batch.status === 'processing';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/dashboard/serial-batches')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{batch.name}</h1>
            <Badge className={statusConfig.color}>
              <StatusIcon className={`w-3 h-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
              {statusConfig.label}
            </Badge>
          </div>
          {batch.product_name && (
            <p className="text-gray-500 mt-1">
              Product: {batch.product_name}
              {batch.product_sku && ` (${batch.product_sku})`}
            </p>
          )}
        </div>
        {batch.status === 'completed' && batch.can_download && (
          <Button
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => downloadMutation.mutate()}
            isLoading={downloadMutation.isPending}
          >
            Download All
          </Button>
        )}
      </div>

      {/* Progress Card (for processing batches) */}
      {isProcessing && (
        <Card className="bg-blue-50 border-blue-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">Generating QR Codes...</h3>
              <p className="text-sm text-blue-700">
                {formatNumber(batch.generated_count)} of {formatNumber(batch.quantity)} codes generated
              </p>
              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${batch.progress_percent}%` }}
                />
              </div>
            </div>
            <span className="text-2xl font-bold text-blue-600">{batch.progress_percent}%</span>
          </div>
        </Card>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Codes</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(batch.quantity)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Generated</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(batch.generated_count)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Scans</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(batch.total_scans || 0)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Suspicious</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(batch.suspicious_count || 0)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'codes', label: 'Serial Codes', icon: <Hash className="w-4 h-4" /> },
          { id: 'stats', label: 'Statistics', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'details', label: 'Batch Details', icon: <Package className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {/* Codes Tab */}
      {activeTab === 'codes' && (
        <div className="space-y-4">
          {/* Search */}
          <Card>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by serial number..."
                  value={codeSearch}
                  onChange={(e) => setCodeSearch(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                />
              </div>
              <Button
                variant="ghost"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={() => refetchCodes()}
              >
                Refresh
              </Button>
            </div>
          </Card>

          {/* Codes List */}
          {codesLoading ? (
            <Card><Loading /></Card>
          ) : codes.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Hash className="w-6 h-6" />}
                title={codeSearch ? 'No codes found' : 'No codes yet'}
                description={codeSearch ? 'Try a different search term' : 'Codes will appear here once generated'}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scans</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Scan</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Scan</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {codes.map((code) => (
                      <tr key={code.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {code.serial_number}
                            </code>
                            <button
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              onClick={() => copyToClipboard(code.serial_number)}
                            >
                              <Copy className="w-3 h-3 text-gray-500" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={CODE_STATUS_COLORS[code.status] || 'bg-gray-100 text-gray-700'}>
                            {code.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{code.scan_count}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {code.first_scanned_at ? formatDate(code.first_scanned_at) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {code.last_scanned_at ? formatDate(code.last_scanned_at) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCode(code);
                                setCodeModalOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {code.verification_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(code.verification_url, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {statsLoading ? (
            <Card><Loading /></Card>
          ) : stats ? (
            <>
              {/* Status Distribution */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Code Status Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(stats.status_distribution || {}).map(([status, count]) => (
                    <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                      <Badge className={CODE_STATUS_COLORS[status as keyof typeof CODE_STATUS_COLORS] || 'bg-gray-100'}>
                        {status}
                      </Badge>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{formatNumber(count as number)}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Scan Activity */}
              <Card>
                <h3 className="font-semibold text-gray-900 mb-4">Scan Activity (Last 30 Days)</h3>
                <div className="h-48 flex items-end gap-1">
                  {(stats.daily_scans || []).map((day: { date: string; count: number }, index: number) => {
                    const maxCount = Math.max(...(stats.daily_scans || []).map((d: { count: number }) => d.count), 1);
                    const height = (day.count / maxCount) * 100;
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${day.date}: ${day.count} scans`}
                        />
                      </div>
                    );
                  })}
                </div>
                {stats.daily_scans && stats.daily_scans.length > 0 && (
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>{stats.daily_scans[0]?.date}</span>
                    <span>{stats.daily_scans[stats.daily_scans.length - 1]?.date}</span>
                  </div>
                )}
              </Card>

              {/* Geographic Distribution */}
              {stats.top_countries && stats.top_countries.length > 0 && (
                <Card>
                  <h3 className="font-semibold text-gray-900 mb-4">Top Scan Locations</h3>
                  <div className="space-y-3">
                    {stats.top_countries!.map((country: { country: string; count: number }, index: number) => {
                      const maxCount = stats.top_countries![0]?.count || 1;
                      const percentage = (country.count / maxCount) * 100;
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <Globe className="w-4 h-4 text-gray-400" />
                          <span className="w-24 text-sm text-gray-700">{country.country}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-16 text-right">
                            {formatNumber(country.count)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Suspicious Activity */}
              {stats.suspicious_scans && stats.suspicious_scans.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-900">Suspicious Activity Detected</h3>
                  </div>
                  <div className="space-y-3">
                    {stats.suspicious_scans.map((scan: { serial: string; reason: string; timestamp: string }, index: number) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                        <Shield className="w-4 h-4 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <code className="text-sm font-mono">{scan.serial}</code>
                          <p className="text-sm text-yellow-700 mt-1">{scan.reason}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatDate(scan.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<BarChart3 className="w-6 h-6" />}
                title="No statistics available"
                description="Statistics will be available once codes are scanned"
              />
            </Card>
          )}
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Batch Information</h3>
            <dl className="space-y-4">
              <div className="flex justify-between">
                <dt className="text-gray-500">Batch ID</dt>
                <dd className="font-mono text-sm">{batch.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium">{batch.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Quantity</dt>
                <dd className="font-medium">{formatNumber(batch.quantity)}</dd>
              </div>
              {batch.prefix && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Prefix</dt>
                  <dd className="font-mono">{batch.prefix}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd>{formatDate(batch.created_at)}</dd>
              </div>
              {batch.completed_at && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Completed</dt>
                  <dd>{formatDate(batch.completed_at)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Product Information</h3>
            <dl className="space-y-4">
              {batch.product_name ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Product Name</dt>
                    <dd className="font-medium">{batch.product_name}</dd>
                  </div>
                  {batch.product_sku && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">SKU</dt>
                      <dd className="font-mono">{batch.product_sku}</dd>
                    </div>
                  )}
                  {batch.product_batch && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Production Batch</dt>
                      <dd className="font-mono">{batch.product_batch}</dd>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500 italic">No product information provided</p>
              )}
            </dl>
          </Card>

          {batch.url_template && (
            <Card className="md:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">URL Configuration</h3>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-100 px-4 py-2 rounded font-mono text-sm overflow-x-auto">
                  {batch.url_template}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(batch.url_template!)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                The <code className="bg-gray-100 px-1 rounded">{'{serial}'}</code> placeholder is replaced with each unique serial number
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Code Detail Modal */}
      <Modal
        isOpen={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        title="Serial Code Details"
        size="lg"
      >
        {selectedCode && (
          <div className="space-y-6">
            {/* Code Info */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <QrCode className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <code className="text-lg font-mono font-bold">{selectedCode.serial_number}</code>
                  <Badge className={`ml-2 ${CODE_STATUS_COLORS[selectedCode.status]}`}>
                    {selectedCode.status}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(selectedCode.serial_number)}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Eye className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{selectedCode.scan_count}</p>
                <p className="text-sm text-gray-500">Total Scans</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">
                  {selectedCode.first_scanned_at
                    ? new Date(selectedCode.first_scanned_at).toLocaleDateString()
                    : 'Never'}
                </p>
                <p className="text-sm text-gray-500">First Scan</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <MapPin className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-900">
                  {selectedCode.last_scan_location || 'Unknown'}
                </p>
                <p className="text-sm text-gray-500">Last Location</p>
              </div>
            </div>

            {/* Scan History */}
            {selectedCode.scan_history && selectedCode.scan_history.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Recent Scans</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedCode.scan_history.map((scan, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                      <Smartphone className="w-4 h-4 text-gray-400" />
                      <div className="flex-1">
                        <p className="text-gray-900">{scan.device || 'Unknown device'}</p>
                        <p className="text-gray-500">{scan.location || 'Unknown location'}</p>
                      </div>
                      <span className="text-gray-400">{formatDate(scan.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suspicion Alerts */}
            {selectedCode.suspicion_score > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-yellow-900">Suspicion Score: {selectedCode.suspicion_score}%</span>
                </div>
                {selectedCode.suspicion_reasons && (
                  <ul className="text-sm text-yellow-700 list-disc list-inside">
                    {selectedCode.suspicion_reasons.map((reason, index) => (
                      <li key={index}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap justify-between gap-2 pt-4 border-t border-gray-200">
              {selectedCode.verification_url && (
                <Button
                  variant="outline"
                  leftIcon={<ExternalLink className="w-4 h-4" />}
                  onClick={() => window.open(selectedCode.verification_url, '_blank')}
                >
                  Open Verification Page
                </Button>
              )}
              <div className="flex gap-2">
                {/* Reactivate - for revoked/blocked/recalled codes */}
                {['revoked', 'blocked', 'recalled', 'expired'].includes(selectedCode.status) && (
                  <Button
                    variant="outline"
                    leftIcon={<Play className="w-4 h-4" />}
                    onClick={() => reactivateMutation.mutate(selectedCode.id)}
                    isLoading={reactivateMutation.isPending}
                  >
                    Reactivate
                  </Button>
                )}
                {/* Recall - for active/unused codes */}
                {['active', 'unused', 'verified'].includes(selectedCode.status) && (
                  <Button
                    variant="outline"
                    leftIcon={<RotateCcw className="w-4 h-4" />}
                    onClick={() => recallMutation.mutate(selectedCode.id)}
                    isLoading={recallMutation.isPending}
                  >
                    Recall
                  </Button>
                )}
                {/* Block - for active/suspicious codes */}
                {['active', 'suspicious', 'unused'].includes(selectedCode.status) && (
                  <Button
                    variant="outline"
                    leftIcon={<Ban className="w-4 h-4" />}
                    onClick={() => blockMutation.mutate(selectedCode.id)}
                    isLoading={blockMutation.isPending}
                  >
                    Block
                  </Button>
                )}
                {/* Revoke - for non-revoked codes */}
                {selectedCode.status !== 'revoked' && (
                  <Button
                    variant="danger"
                    onClick={() => revokeMutation.mutate(selectedCode.id)}
                    isLoading={revokeMutation.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SerialBatchDetailPage;

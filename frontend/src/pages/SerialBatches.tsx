/**
 * Serial Batches Page - Manage bulk QR code generation for product authentication
 */

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  MoreVertical,
  Download,
  Trash2,
  Eye,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Filter,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input, Card, Badge, Modal, Dropdown, DropdownItem, EmptyState, Loading } from '@/components/common';
import { serialAPI, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useDebounce } from '@/hooks';
import type { SerialBatch, SerialBatchStatus } from '@/types';

// Status configuration
const STATUS_CONFIG: Record<SerialBatchStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Processing', icon: Loader2, color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', icon: XCircle, color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'bg-gray-100 text-gray-600' },
};

export function SerialBatchesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscription } = useAuth();
  const { isTeamMode, canEdit } = useTeam();

  // State
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<SerialBatchStatus | ''>('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<SerialBatch | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const debouncedSearch = useDebounce(search, 300);
  const isBusinessPlan = subscription?.plan === 'business' || subscription?.plan === 'enterprise';

  // Fetch batches
  const { data: batchesData, isLoading, refetch } = useQuery({
    queryKey: ['serial-batches', debouncedSearch, filterStatus],
    queryFn: () => serialAPI.batches.list({
      search: debouncedSearch || undefined,
      status: filterStatus || undefined,
    }),
    // Only poll when there are processing/pending batches
    refetchInterval: (query) => {
      const results = query.state.data?.results;
      const hasActiveBatches = results?.some((b: SerialBatch) => b.status === 'processing' || b.status === 'pending');
      return hasActiveBatches ? 5000 : false;
    },
  });

  const batches = batchesData?.results || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => serialAPI.batches.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-batches'] });
      toast.success('Batch deleted', { id: 'batch-delete' });
      setDeleteModalOpen(false);
      setBatchToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'batch-delete' }),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => serialAPI.batches.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serial-batches'] });
      toast.success('Batch generation cancelled', { id: 'batch-cancel' });
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'batch-cancel' }),
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { download_url } = await serialAPI.batches.getDownloadUrl(id);
      window.open(download_url, '_blank');
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'batch-download' }),
  });

  const handleDelete = (batch: SerialBatch) => {
    setBatchToDelete(batch);
    setDeleteModalOpen(true);
  };

  const formatNumber = (num: number) => num.toLocaleString();

  // Upgrade prompt for non-business users
  if (!isBusinessPlan) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Serial Batches</h1>
            <p className="text-gray-500 mt-1">Generate serialized QR codes for product authentication</p>
          </div>
        </div>

        <Card className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Upgrade to Business or Enterprise</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Serialized QR codes enable product authentication and anti-counterfeiting.
            Generate thousands of unique codes with verification tracking.
          </p>
          <Button onClick={() => navigate('/dashboard/settings?tab=billing')}>
            Upgrade Now
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serial Batches</h1>
          <p className="text-gray-500 mt-1">
            {batchesData?.count || 0} batch{(batchesData?.count || 0) !== 1 ? 'es' : ''} total
          </p>
        </div>
        {(!isTeamMode || canEdit) && (
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/dashboard/serial-batches/new')}
          >
            Create Batch
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search batches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? 'primary' : 'outline'}
              size="sm"
              leftIcon={<Filter className="w-4 h-4" />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => refetch()}
            >
              Refresh
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="input text-sm"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as SerialBatchStatus | '')}
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
            {filterStatus && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilterStatus('')}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Batches List */}
      {isLoading ? (
        <Card>
          <Loading />
        </Card>
      ) : batches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="w-6 h-6" />}
            title={search || filterStatus ? 'No batches found' : 'No serial batches yet'}
            description={
              search || filterStatus
                ? 'Try adjusting your search or filters'
                : 'Create your first batch to generate serialized QR codes for product authentication'
            }
            action={
              !search && !filterStatus && (!isTeamMode || canEdit) ? (
                <Button
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => navigate('/dashboard/serial-batches/new')}
                >
                  Create Batch
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const statusConfig = STATUS_CONFIG[batch.status];
            const StatusIcon = statusConfig.icon;
            const isProcessing = batch.status === 'processing';

            return (
              <div
                key={batch.id}
                className="cursor-pointer"
                onClick={() => navigate(`/dashboard/serial-batches/${batch.id}`)}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-primary" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{batch.name}</h3>
                      <Badge className={statusConfig.color}>
                        <StatusIcon className={`w-3 h-3 mr-1 ${isProcessing ? 'animate-spin' : ''}`} />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {batch.product_name && (
                      <p className="text-sm text-gray-500 mb-2">
                        Product: {batch.product_name}
                        {batch.product_sku && ` (${batch.product_sku})`}
                      </p>
                    )}

                    {/* Progress bar for processing batches */}
                    {isProcessing && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Generating QR codes...</span>
                          <span>{batch.progress_percent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${batch.progress_percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        {formatNumber(batch.generated_count)} / {formatNumber(batch.quantity)} codes
                      </span>
                      {batch.prefix && (
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                          Prefix: {batch.prefix}
                        </span>
                      )}
                      <span className="text-gray-400">
                        Created {new Date(batch.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {batch.status === 'completed' && batch.can_download && (
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Download className="w-4 h-4" />}
                        onClick={() => downloadMutation.mutate(batch.id)}
                        isLoading={downloadMutation.isPending}
                      >
                        Download
                      </Button>
                    )}

                    {(!isTeamMode || canEdit) && (
                      <Dropdown
                        trigger={
                          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                        }
                        align="right"
                      >
                        <DropdownItem onClick={() => navigate(`/dashboard/serial-batches/${batch.id}`)}>
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </DropdownItem>
                        <DropdownItem onClick={() => navigate(`/dashboard/serial-batches/${batch.id}?tab=stats`)}>
                          <BarChart3 className="w-4 h-4" />
                          <span>View Stats</span>
                        </DropdownItem>
                        {batch.status === 'processing' && (
                          <DropdownItem onClick={() => cancelMutation.mutate(batch.id)} danger>
                            <XCircle className="w-4 h-4" />
                            <span>Cancel Generation</span>
                          </DropdownItem>
                        )}
                        {(batch.status === 'pending' || batch.status === 'completed' || batch.status === 'failed') && (
                          <DropdownItem onClick={() => handleDelete(batch)} danger>
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </DropdownItem>
                        )}
                      </Dropdown>
                    )}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Batch"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">This action cannot be undone</p>
              <p className="text-sm text-red-600 mt-1">
                All {batchToDelete?.quantity.toLocaleString()} serial codes in this batch will be permanently deleted.
              </p>
            </div>
          </div>

          <p className="text-gray-600">
            Are you sure you want to delete <strong>{batchToDelete?.name}</strong>?
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => batchToDelete && deleteMutation.mutate(batchToDelete.id)}
              isLoading={deleteMutation.isPending}
            >
              Delete Batch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default SerialBatchesPage;

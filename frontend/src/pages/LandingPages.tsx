import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Plus, Trash2, ExternalLink, Eye, Copy,
  MoreVertical, Pencil, Search, X, Calendar,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Modal, Badge, EmptyState, Skeleton, Dropdown, DropdownItem } from '@/components/common';
import { pagesAPI, getErrorMessage } from '@/services/api';
import type { LandingPage } from '@/types';

function SkeletonPageCard() {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton height={20} className="w-40" />
          <Skeleton height={22} className="w-20 rounded-full" />
        </div>
        <Skeleton height={14} className="w-28" />
        <div className="flex items-center gap-4 pt-2">
          <Skeleton height={14} className="w-20" />
          <Skeleton height={14} className="w-24" />
        </div>
        <Skeleton height={12} className="w-32 pt-1" />
      </div>
    </Card>
  );
}

export function LandingPagesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<LandingPage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

  const { data: pages, isLoading } = useQuery({
    queryKey: ['landingPages'],
    queryFn: () => pagesAPI.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pagesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
      toast.success('Landing page deleted', { id: 'page-delete' });
      setDeleteModalOpen(false);
      setPageToDelete(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'page-delete' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => pagesAPI.duplicate(id),
    onSuccess: (newPage) => {
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
      toast.success(`Duplicated as "${newPage.title}"`, { id: 'page-duplicate' });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error), { id: 'page-duplicate' });
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      pagesAPI.update(id, { is_published }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['landingPages'] });
      toast.success(vars.is_published ? 'Page published' : 'Page unpublished');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleDeleteClick = (page: LandingPage) => {
    setPageToDelete(page);
    setDeleteModalOpen(true);
  };

  const handleDelete = () => {
    if (pageToDelete) {
      deleteMutation.mutate(pageToDelete.id);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success('URL copied to clipboard', { id: 'page-copy' });
    }).catch(() => {
      toast.error('Failed to copy URL', { id: 'page-copy' });
    });
  };

  const allPages: LandingPage[] = pages || [];
  const landingPages = allPages.filter(p => {
    const matchesSearch = !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'published' ? p.is_published : !p.is_published);
    return matchesSearch && matchesStatus;
  });
  const totalViews = allPages.reduce((s, p) => s + p.total_views, 0);
  const totalConversions = allPages.reduce((s, p) => s + p.total_conversions, 0);
  const publishedCount = allPages.filter(p => p.is_published).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing Pages</h1>
          <p className="text-gray-500 mt-1">
            {allPages.length > 0
              ? `${allPages.length} page${allPages.length !== 1 ? 's' : ''} \u00b7 ${publishedCount} published \u00b7 ${totalViews.toLocaleString()} views \u00b7 ${totalConversions.toLocaleString()} conversions`
              : 'Create high-converting landing pages for your campaigns'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/pages/templates">
            <Button variant="outline">Browse Templates</Button>
          </Link>
          <Link to="/dashboard/pages/new">
            <Button leftIcon={<Plus className="w-4 h-4" />}>Create Page</Button>
          </Link>
        </div>
      </div>

      {/* Search + Filter (only when there are pages) */}
      {allPages.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or slug..."
              leftIcon={<Search className="w-4 h-4" />}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
            className="input w-auto min-w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      )}

      {/* Landing Pages Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <SkeletonPageCard key={i} />)}
        </div>
      ) : allPages.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No landing pages yet"
            description="Create your first landing page to start capturing leads and driving conversions"
            action={
              <Link to="/dashboard/pages/new">
                <Button leftIcon={<Plus className="w-4 h-4" />}>Create Page</Button>
              </Link>
            }
          />
        </Card>
      ) : landingPages.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title="No matching results"
            description="Try adjusting your search or filter to find what you're looking for"
            action={
              <Button
                variant="outline"
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              >
                Clear Filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {landingPages.map((page: LandingPage) => (
            <Card key={page.id} className="group relative">
              <div className="space-y-3">
                {/* Title + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          page.is_published ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      />
                      <h3 className="font-medium text-gray-900 truncate">{page.title}</h3>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5 ml-4">/p/{page.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Dropdown
                      trigger={
                        <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      }
                    >
                      <DropdownItem onClick={() => navigate(`/dashboard/pages/${page.id}/edit`)}>
                        <Pencil className="w-4 h-4" /><span>Edit</span>
                      </DropdownItem>
                      {page.is_published && (
                        <DropdownItem onClick={() => window.open(page.public_url, '_blank')}>
                          <ExternalLink className="w-4 h-4" /><span>View Public</span>
                        </DropdownItem>
                      )}
                      <DropdownItem onClick={() => handleCopyUrl(page.public_url)}>
                        <Copy className="w-4 h-4" /><span>Copy URL</span>
                      </DropdownItem>
                      <DropdownItem onClick={() => duplicateMutation.mutate(page.id)}>
                        <Copy className="w-4 h-4" /><span>Duplicate</span>
                      </DropdownItem>
                      <DropdownItem onClick={() => handleDeleteClick(page)} danger>
                        <Trash2 className="w-4 h-4" /><span>Delete</span>
                      </DropdownItem>
                    </Dropdown>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    {page.total_views.toLocaleString()} view{page.total_views !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    {page.total_conversions.toLocaleString()} conversion{page.total_conversions !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Created date */}
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  Created {formatDistanceToNow(new Date(page.created_at), { addSuffix: true })}
                </p>

                {/* Publish toggle */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      onClick={() => togglePublishMutation.mutate({
                        id: page.id,
                        is_published: !page.is_published,
                      })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        page.is_published ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={page.is_published}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          page.is_published ? 'translate-x-[18px]' : 'translate-x-[3px]'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-gray-500">
                      {page.is_published ? 'Published' : 'Draft'}
                    </span>
                  </label>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setPageToDelete(null); }}
        title="Delete Landing Page"
      >
        <div className="space-y-4">
          {pageToDelete && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{pageToDelete.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">/p/{pageToDelete.slug}</p>
              {(pageToDelete.total_views > 0 || pageToDelete.total_conversions > 0) && (
                <p className="text-xs text-gray-400 mt-1">
                  {pageToDelete.total_views} view{pageToDelete.total_views !== 1 ? 's' : ''} &middot; {pageToDelete.total_conversions} conversion{pageToDelete.total_conversions !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
          <p className="text-gray-600">Are you sure? This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setDeleteModalOpen(false); setPageToDelete(null); }}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteMutation.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

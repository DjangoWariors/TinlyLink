import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Trash2, ExternalLink, Pencil, LayoutList, Eye, Link2, Calendar,
    Search, X, MoreVertical, Copy,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Modal, Badge, EmptyState, Skeleton, Dropdown, DropdownItem } from '@/components/common';
import { bioAPI, getErrorMessage } from '@/services/api';
import type { BioPage } from '@/types';

function SkeletonBioCard() {
    return (
        <Card className="overflow-hidden">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Skeleton height={20} className="w-32" />
                    <div className="flex gap-2">
                        <Skeleton height={22} className="w-16" rounded="full" />
                        <Skeleton height={22} className="w-20" rounded="full" />
                    </div>
                </div>
                <Skeleton height={14} className="w-24" />
                <div className="flex items-center gap-4 pt-2">
                    <Skeleton height={14} className="w-20" />
                    <Skeleton height={14} className="w-16" />
                </div>
                <Skeleton height={12} className="w-28 mt-2" />
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <Skeleton height={32} className="w-16" />
                    <Skeleton height={32} className="w-24" />
                    <Skeleton height={32} className="w-16" />
                </div>
            </div>
        </Card>
    );
}

const THEME_LABELS: Record<string, string> = {
    minimal: 'Minimal',
    dark: 'Dark',
    colorful: 'Colorful',
    gradient: 'Gradient',
    professional: 'Professional',
};

export function BioPagesPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [pageToDelete, setPageToDelete] = useState<BioPage | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

    const { data: bioPages, isLoading } = useQuery({
        queryKey: ['bioPages'],
        queryFn: () => bioAPI.list(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => bioAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bioPages'] });
            toast.success('Bio page deleted', { id: 'bio-delete' });
            setDeleteModalOpen(false);
            setPageToDelete(null);
        },
        onError: (error) => {
            toast.error(getErrorMessage(error), { id: 'bio-delete' });
        },
    });

    const togglePublishMutation = useMutation({
        mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
            bioAPI.update(id, { is_published }),
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['bioPages'] });
            toast.success(vars.is_published ? 'Page published' : 'Page unpublished');
        },
        onError: (err) => toast.error(getErrorMessage(err)),
    });

    const handleDeleteClick = (page: BioPage) => {
        setPageToDelete(page);
        setDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (pageToDelete) deleteMutation.mutate(pageToDelete.id);
    };

    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url).then(() => {
            toast.success('URL copied to clipboard', { id: 'bio-copy' });
        }).catch(() => {
            toast.error('Failed to copy URL', { id: 'bio-copy' });
        });
    };

    const allPages: BioPage[] = bioPages || [];
    const pages = allPages.filter(p => {
        const matchesSearch = !searchQuery ||
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.slug.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'published' ? p.is_published : !p.is_published);
        return matchesSearch && matchesStatus;
    });
    const totalViews = allPages.reduce((s, p) => s + p.total_views, 0);
    const publishedCount = allPages.filter(p => p.is_published).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bio Pages</h1>
                    <p className="text-gray-500 mt-1">
                        {allPages.length > 0
                            ? `${allPages.length} page${allPages.length !== 1 ? 's' : ''} \u00b7 ${publishedCount} published \u00b7 ${totalViews.toLocaleString()} views`
                            : 'Create link-in-bio pages to share all your links in one place'}
                    </p>
                </div>
                <Link to="/dashboard/bio/new">
                    <Button leftIcon={<Plus className="w-4 h-4" />}>Create Bio Page</Button>
                </Link>
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

            {/* Content */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => <SkeletonBioCard key={i} />)}
                </div>
            ) : allPages.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<LayoutList className="w-6 h-6" />}
                        title="No bio pages yet"
                        description="Create your first bio page to share all your important links in one place"
                        action={
                            <Link to="/dashboard/bio/new">
                                <Button leftIcon={<Plus className="w-4 h-4" />}>Create Bio Page</Button>
                            </Link>
                        }
                    />
                </Card>
            ) : pages.length === 0 ? (
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
                    {pages.map((page) => (
                        <Card key={page.id} className="group">
                            <div className="space-y-3">
                                {/* Title and Badges */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                    page.is_published ? 'bg-green-500' : 'bg-gray-400'
                                                }`}
                                            />
                                            <h3 className="font-semibold text-gray-900 truncate">{page.title}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5 ml-4">@{page.slug}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <Badge variant="default" className="text-xs capitalize">
                                            {THEME_LABELS[page.theme] || page.theme}
                                        </Badge>
                                        <Dropdown
                                            trigger={
                                                <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            }
                                        >
                                            <DropdownItem onClick={() => navigate(`/dashboard/bio/${page.id}/edit`)}>
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
                                            <DropdownItem onClick={() => handleDeleteClick(page)} danger>
                                                <Trash2 className="w-4 h-4" /><span>Delete</span>
                                            </DropdownItem>
                                        </Dropdown>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                    <span className="flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5" />
                                        {page.total_views.toLocaleString()} view{page.total_views !== 1 ? 's' : ''}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Link2 className="w-3.5 h-3.5" />
                                        {page.links_count} link{page.links_count !== 1 ? 's' : ''}
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
                title="Delete Bio Page"
            >
                <div className="space-y-4">
                    {pageToDelete && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">{pageToDelete.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">@{pageToDelete.slug}</p>
                        </div>
                    )}
                    <p className="text-gray-600">
                        Are you sure you want to delete this bio page? This action cannot be undone and all associated links will be removed.
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => { setDeleteModalOpen(false); setPageToDelete(null); }}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={confirmDelete} isLoading={deleteMutation.isPending}>
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

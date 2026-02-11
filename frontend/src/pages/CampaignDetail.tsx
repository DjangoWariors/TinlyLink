import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Edit, Trash2, Link2, BarChart3, ExternalLink,
    Calendar, Target, MousePointerClick, TrendingUp, Layers
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge, Modal, Skeleton, EmptyState } from '@/components/common';
import { campaignsAPI, linksAPI, getErrorMessage } from '@/services/api';
import { useTeam } from '@/contexts/TeamContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import type { Campaign, Link as LinkType } from '@/types';

export function CampaignDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isTeamMode, canEdit } = useTeam();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'links' | 'stats'>('links');

    // Fetch campaign details
    const { data: campaign, isLoading: campaignLoading } = useQuery({
        queryKey: ['campaign', id],
        queryFn: () => campaignsAPI.getCampaign(id!),
        enabled: !!id,
    });

    // Fetch campaign links
    const { data: linksData, isLoading: linksLoading } = useQuery({
        queryKey: ['campaignLinks', id],
        queryFn: () => campaignsAPI.getCampaignLinks(id!),
        enabled: !!id && activeTab === 'links',
    });

    // Fetch campaign stats
    const { data: stats, isLoading: statsLoading } = useQuery({
        queryKey: ['campaignStats', id],
        queryFn: () => campaignsAPI.getCampaignStats(id!),
        enabled: !!id && activeTab === 'stats',
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: () => campaignsAPI.deleteCampaign(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['campaigns'] });
            toast.success('Campaign deleted', { id: 'campaign-delete' });
            navigate('/dashboard/campaigns');
        },
        onError: (error) => toast.error(getErrorMessage(error), { id: 'campaign-delete' }),
    });

    const links = linksData?.results || [];

    if (campaignLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton width={100} height={36} />
                    <Skeleton width={200} height={32} />
                </div>
                <Card>
                    <Skeleton height={200} />
                </Card>
            </div>
        );
    }

    if (!campaign) {
        return (
            <Card>
                <EmptyState
                    icon={<Target className="w-6 h-6" />}
                    title="Campaign not found"
                    description="The campaign you're looking for doesn't exist."
                    action={<Link to="/dashboard/campaigns"><Button>Back to Campaigns</Button></Link>}
                />
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard/campaigns">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
                        {campaign.description && (
                            <p className="text-gray-500 mt-1">{campaign.description}</p>
                        )}
                    </div>
                </div>
                {(!isTeamMode || canEdit) && (
                    <div className="flex items-center gap-2">
                        <Link to={`/dashboard/campaigns/${id}/edit`}>
                            <Button variant="outline" leftIcon={<Edit className="w-4 h-4" />}>
                                Edit
                            </Button>
                        </Link>
                        <Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />} onClick={() => setDeleteModalOpen(true)}>
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            {/* UTM Parameters */}
            <Card>
                <h3 className="font-semibold text-gray-900 mb-4">UTM Parameters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Source</p>
                        <p className="font-medium text-gray-900 mt-1">{campaign.default_utm_source || '-'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Medium</p>
                        <p className="font-medium text-gray-900 mt-1">{campaign.default_utm_medium || '-'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">Campaign</p>
                        <p className="font-medium text-gray-900 mt-1">{campaign.default_utm_campaign || '-'}</p>
                    </div>
                </div>
            </Card>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('links')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'links'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Link2 className="w-4 h-4 inline mr-2" />
                        Links ({campaign.links_count || 0})
                    </button>
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'stats'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <BarChart3 className="w-4 h-4 inline mr-2" />
                        Statistics
                    </button>
                </nav>
            </div>

            {/* Links Tab */}
            {activeTab === 'links' && (
                <Card padding="none" overflow>
                    {linksLoading ? (
                        <div className="p-6">
                            <Skeleton height={150} />
                        </div>
                    ) : links.length === 0 ? (
                        <EmptyState
                            icon={<Link2 className="w-6 h-6" />}
                            title="No links in this campaign"
                            description="Add links to this campaign to track them together"
                            action={
                                <Link to="/dashboard/links/new">
                                    <Button>Create Link</Button>
                                </Link>
                            }
                        />
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Short URL</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Original URL</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Clicks</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Status</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {links.map((link: LinkType) => (
                                    <tr key={link.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <a href={link.short_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                                                {link.short_url?.replace('https://', '').replace('http://', '')}
                                            </a>
                                            {link.title && <p className="text-xs text-gray-500 truncate mt-0.5">{link.title}</p>}
                                        </td>
                                        <td className="px-4 py-3 hidden md:table-cell">
                                            <p className="text-sm text-gray-500 truncate max-w-[300px]">{link.original_url}</p>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-sm font-medium">{link.total_clicks?.toLocaleString() || 0}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                                            <Badge variant={link.is_active ? 'success' : 'danger'}>
                                                {link.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link to={`/dashboard/links/${link.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <ExternalLink className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            )}

            {/* Stats Tab */}
            {activeTab === 'stats' && (
                <div className="space-y-6">
                    {statsLoading ? (
                        <Card>
                            <Skeleton height={200} />
                        </Card>
                    ) : stats ? (
                        <>
                            {/* Stats Overview */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary-100 rounded-lg">
                                            <MousePointerClick className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">{stats.total_clicks?.toLocaleString() || 0}</p>
                                            <p className="text-sm text-gray-500">Total Clicks</p>
                                        </div>
                                    </div>
                                </Card>
                                <Card>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <Link2 className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">{campaign.links_count || 0}</p>
                                            <p className="text-sm text-gray-500">Links</p>
                                        </div>
                                    </div>
                                </Card>
                                <Card>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Layers className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">{(stats.top_links?.length || 0)}</p>
                                            <p className="text-sm text-gray-500">Top Links</p>
                                        </div>
                                    </div>
                                </Card>
                                <Card>
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-100 rounded-lg">
                                            <TrendingUp className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-gray-900">
                                                {stats.total_clicks && campaign.links_count ? Math.round(stats.total_clicks / campaign.links_count) : 0}
                                            </p>
                                            <p className="text-sm text-gray-500">Avg per Link</p>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* View in Analytics */}
                            <div className="flex justify-end">
                                <Link to="/dashboard/analytics">
                                    <Button variant="outline" size="sm" leftIcon={<BarChart3 className="w-4 h-4" />}>
                                        View in Analytics
                                    </Button>
                                </Link>
                            </div>

                            {/* Top Links */}
                            {stats.top_links && stats.top_links.length > 0 && (
                                <Card>
                                    <h3 className="font-semibold text-gray-900 mb-4">Top Performing Links</h3>
                                    <div className="space-y-3">
                                        {stats.top_links.map((link: any, index: number) => (
                                            <div key={link.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-primary-100 text-primary text-sm font-medium rounded-full">
                                                        {index + 1}
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{link.short_code || link.title}</p>
                                                        <p className="text-xs text-gray-500 truncate max-w-[300px]">{link.original_url}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-gray-900">{link.clicks?.toLocaleString() || 0}</p>
                                                    <p className="text-xs text-gray-500">clicks</p>
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
                                description="Statistics will appear once your links start getting clicks"
                            />
                        </Card>
                    )}
                </div>
            )}

            {/* Delete Modal */}
            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Campaign">
                <div className="space-y-4">
                    <p className="text-gray-600">
                        Are you sure you want to delete <strong>{campaign.name}</strong>?
                        This will remove the campaign but won't delete the associated links.
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
                        <Button variant="danger" onClick={() => deleteMutation.mutate()} isLoading={deleteMutation.isPending}>
                            Delete Campaign
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

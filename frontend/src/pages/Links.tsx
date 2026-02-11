import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Filter, Download, MoreVertical, Copy, Edit, Trash2,
  ExternalLink, QrCode, Link2, ChevronLeft, ChevronRight, X,
  Upload, CheckSquare, Square, Folder, Calendar, Lock, FileText, Layers
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card } from '@/components/common/Card';
import { Badge, EmptyState, Dropdown, DropdownItem, Modal, SkeletonLinkRow, Tooltip } from '@/components/common';
import { linksAPI, campaignsAPI, downloadBlob, getErrorMessage } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useDebounce } from '@/hooks';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Link as LinkType, Campaign } from '@/types';

const PAGE_SIZE = 20;

export function LinksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { subscription } = useAuth();
  const { isTeamMode, canEdit } = useTeam();
  const isPaidPlan = subscription?.plan !== 'free';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<LinkType | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);
  const [targetCampaign, setTargetCampaign] = useState('');
  const [bulkCreateModalOpen, setBulkCreateModalOpen] = useState(false);
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkCampaign, setBulkCampaign] = useState('');

  // Sync search from URL params (e.g., from header search)
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch && urlSearch !== search) setSearch(urlSearch);
  }, [searchParams]);

  const debouncedSearch = useDebounce(search, 300);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => campaignsAPI.getCampaigns(),
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['links', page, debouncedSearch, statusFilter, campaignFilter],
    queryFn: () => linksAPI.getLinks({
      page,
      page_size: PAGE_SIZE,
      search: debouncedSearch || undefined,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      campaign: campaignFilter || undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => linksAPI.deleteLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      toast.success('Link deleted', { id: 'link-delete' });
      setDeleteModalOpen(false);
      setLinkToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'link-delete' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => linksAPI.deleteLink(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      toast.success(`${selectedLinks.size} links deleted`, { id: 'bulk-delete' });
      setSelectedLinks(new Set());
      setBulkDeleteModalOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'bulk-delete' }),
  });

  const bulkMoveMutation = useMutation({
    mutationFn: ({ ids, campaignId }: { ids: string[], campaignId: string }) =>
      Promise.all(ids.map(id => linksAPI.updateLink(id, { campaign_id: campaignId || null }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      toast.success(`${selectedLinks.size} links moved`, { id: 'bulk-move' });
      setSelectedLinks(new Set());
      setBulkMoveModalOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'bulk-move' }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => linksAPI.importLinks(file),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      toast.success(`Imported ${result.imported} links`);
      setImportModalOpen(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to import links'),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: ({ urls, campaignId }: { urls: string[], campaignId?: string }) =>
      linksAPI.bulkCreate(urls, campaignId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      const successCount = result.links?.length || 0;
      const errorCount = result.errors?.length || 0;
      if (errorCount > 0) {
        toast.success(`Created ${successCount} links, ${errorCount} failed`);
      } else {
        toast.success(`Created ${successCount} links`);
      }
      setBulkCreateModalOpen(false);
      setBulkUrls('');
      setBulkCampaign('');
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'bulk-create' }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => linksAPI.duplicateLink(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] });
      toast.success('Link duplicated', { id: 'link-duplicate' });
    },
    onError: (error) => toast.error(getErrorMessage(error), { id: 'link-duplicate' }),
  });

  const handleCopy = async (shortUrl: string) => {
    await navigator.clipboard.writeText(shortUrl);
    toast.success('Copied to clipboard!', { id: 'clipboard' });
  };

  const handleDelete = (link: LinkType) => {
    setLinkToDelete(link);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (linkToDelete) deleteMutation.mutate(linkToDelete.id);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!isPaidPlan) {
      toast.error('Export requires Pro plan', { id: 'export-plan' });
      return;
    }
    setIsExporting(true);
    try {
      // Use proper exportLinks API
      const blob = await linksAPI.exportLinks({ format, campaign: campaignFilter || undefined });
      downloadBlob(blob, `links-export.${format}`);
      toast.success(`Links exported as ${format.toUpperCase()}`, { id: 'link-export' });
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err), { id: 'link-export' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExport = async () => {
    if (!isPaidPlan) {
      toast.error('Export requires Pro plan', { id: 'export-plan' });
      return;
    }
    setIsExporting(true);
    try {
      const blob = await linksAPI.bulkExport(Array.from(selectedLinks), 'csv');
      downloadBlob(blob, `links-export.csv`);
      toast.success('Selected links exported', { id: 'bulk-export' });
    } catch (err) {
      console.error(err);
      toast.error(getErrorMessage(err), { id: 'bulk-export' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await linksAPI.getImportTemplate();
      downloadBlob(blob, 'links-import-template.csv');
      toast.success('Template downloaded', { id: 'template-download' });
    } catch (err) {
      toast.error(getErrorMessage(err), { id: 'template-download' });
    }
  };

  const handleBulkCreate = () => {
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) {
      toast.error('Please enter at least one URL');
      return;
    }
    bulkCreateMutation.mutate({ urls, campaignId: bulkCampaign || undefined });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.json')) {
        toast.error('Please upload a CSV or JSON file');
        return;
      }
      importMutation.mutate(file);
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setCampaignFilter('');
    setSearch('');
    setPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedLinks.size === links.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(links.map(l => l.id)));
    }
  };

  const toggleSelectLink = (id: string) => {
    const newSelected = new Set(selectedLinks);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedLinks(newSelected);
  };

  const hasActiveFilters = statusFilter !== 'all' || campaignFilter !== '' || search !== '';
  const links = data?.results || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Links</h1>
          <p className="text-gray-500 mt-1">
            {totalCount > 0 ? `${totalCount} link${totalCount !== 1 ? 's' : ''} total` : 'Manage your shortened links'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(!isTeamMode || canEdit) && (
            <>
              <Button
                variant="outline"
                leftIcon={<Layers className="w-4 h-4" />}
                onClick={() => isPaidPlan ? setBulkCreateModalOpen(true) : toast.error('Bulk create requires Pro plan')}
                className={!isPaidPlan ? 'opacity-60' : ''}
              >
                Bulk Create
                {!isPaidPlan && <Badge variant="warning" className="ml-1 text-[10px] px-1 py-0">Pro</Badge>}
              </Button>
              <div className="relative">
                <Button
                  variant="outline"
                  leftIcon={<Upload className="w-4 h-4" />}
                  onClick={() => isPaidPlan ? setImportModalOpen(true) : toast.error('Import requires Pro plan')}
                  className={`flex-1 sm:flex-none ${!isPaidPlan ? 'opacity-60' : ''}`}
                >
                  Import
                  {!isPaidPlan && <Badge variant="warning" className="ml-1 text-[10px] px-1 py-0">Pro</Badge>}
                </Button>
              </div>
              <Link to="/dashboard/links/new" className="flex-1 sm:flex-none">
                <Button leftIcon={<Plus className="w-4 h-4" />} className="w-full">Create Link</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedLinks.size > 0 && (
        <Card className="bg-primary-50 border-primary/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary">{selectedLinks.size} selected</span>
              <button onClick={() => setSelectedLinks(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" leftIcon={<Folder className="w-4 h-4" />} onClick={() => setBulkMoveModalOpen(true)}>
                <span className="hidden xs:inline">Move to Campaign</span>
                <span className="xs:hidden">Move</span>
              </Button>
              <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleBulkExport} isLoading={isExporting}>
                Export
              </Button>
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />} onClick={() => setBulkDeleteModalOpen(true)}>
                Delete
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search links by URL, title, or short code..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftIcon={<Search className="w-4 h-4" />}
              rightIcon={search ? <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button> : undefined}
            />
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Button variant="outline" leftIcon={<Filter className="w-4 h-4" />} onClick={() => setFilterOpen(!filterOpen)}>
                Filter
                {hasActiveFilters && <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />}
              </Button>
            </div>
            <Dropdown
              trigger={
                <Button
                  variant="outline"
                  leftIcon={<Download className="w-4 h-4" />}
                  isLoading={isExporting}
                  className={!isPaidPlan ? 'opacity-60' : ''}
                >
                  Export
                  {!isPaidPlan && <Badge variant="warning" className="ml-1 text-[10px] px-1 py-0">Pro</Badge>}
                </Button>
              }
              align="right"
            >
              <DropdownItem onClick={() => isPaidPlan ? handleExport('csv') : toast.error('Export requires Pro plan')}>Export as CSV</DropdownItem>
              <DropdownItem onClick={() => isPaidPlan ? handleExport('json') : toast.error('Export requires Pro plan')}>Export as JSON</DropdownItem>
            </Dropdown>
          </div>
        </div>

        {/* Filter Panel */}
        {filterOpen && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                className="input"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="label">Campaign</label>
              <select
                value={campaignFilter}
                onChange={(e) => { setCampaignFilter(e.target.value); setPage(1); }}
                className="input"
              >
                <option value="">All Campaigns</option>
                {campaigns?.map((c: Campaign) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-2">
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all filters</Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Links Table */}
      <Card padding="none" overflow>
        {isLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {[...Array(5)].map((_, i) => <SkeletonLinkRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Link2 className="w-6 h-6" />}
            title={hasActiveFilters ? 'No links match your filters' : 'No links yet'}
            description={hasActiveFilters ? 'Try adjusting your search or filter criteria' : 'Create your first short link to start tracking clicks and managing your URLs'}
            action={
              hasActiveFilters ? (
                <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
              ) : (
                <Link to="/dashboard/links/new"><Button leftIcon={<Plus className="w-4 h-4" />}>Create Link</Button></Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left w-10 sm:w-12">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                      {selectedLinks.size === links.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Link</th>
                  <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Original URL</th>
                  {isTeamMode && <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell w-32">Created by</th>}
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20 sm:w-24">Clicks</th>
                  <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell w-24">Status</th>
                  <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-12 sm:w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {links.map((link: LinkType) => (
                  <tr key={link.id} className={`hover:bg-gray-50 ${selectedLinks.has(link.id) ? 'bg-primary-50/50' : ''}`}>
                    <td className="px-3 sm:px-4 py-3 w-10 sm:w-12">
                      <button onClick={() => toggleSelectLink(link.id)} className="text-gray-400 hover:text-gray-600">
                        {selectedLinks.has(link.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-3 sm:px-4 py-3">
                      <div className="min-w-0 max-w-[180px] sm:max-w-[250px]">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <a href={link.short_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate">
                            {link.short_url?.replace('https://', '').replace('http://', '')}
                          </a>
                          <Tooltip content="Copy short URL">
                            <button onClick={() => handleCopy(link.short_url)} className="p-1 text-gray-400 hover:text-gray-600 rounded flex-shrink-0">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          {link.is_password_protected && (
                            <Tooltip content="Password protected">
                              <Lock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            </Tooltip>
                          )}
                          {link.expires_at && (
                            <Tooltip content={`Expires ${format(new Date(link.expires_at), 'MMM d, yyyy')}`}>
                              <Calendar className="w-3 h-3 text-amber-400 flex-shrink-0" />
                            </Tooltip>
                          )}
                        </div>
                        {link.title && <p className="text-xs text-gray-500 truncate mt-0.5">{link.title}</p>}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-3 hidden md:table-cell">
                      <p className="text-sm text-gray-500 truncate max-w-[300px]">{link.original_url}</p>
                    </td>
                    {isTeamMode && (
                      <td className="px-3 sm:px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-gray-600">{link.created_by_name || 'Unknown'}</span>
                      </td>
                    )}
                    <td className="px-3 sm:px-4 py-3 text-center w-20 sm:w-24">
                      <span className="text-sm font-medium">{(link.total_clicks || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-3 text-center hidden sm:table-cell w-24">
                      <Badge variant={link.is_active ? 'success' : 'danger'}>{link.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-3 sm:px-4 py-3 w-12 sm:w-16">
                      <div className="flex items-center justify-end">
                        <Dropdown
                          trigger={<button className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"><MoreVertical className="w-4 h-4" /></button>}
                          align="right"
                        >
                          <DropdownItem onClick={() => navigate(`/dashboard/links/${link.id}`)}>
                            <ExternalLink className="w-4 h-4" />
                            <span>View Details</span>
                          </DropdownItem>
                          {(!isTeamMode || canEdit) && (
                            <DropdownItem onClick={() => navigate(`/dashboard/links/${link.id}/edit`)}>
                              <Edit className="w-4 h-4" />
                              <span>Edit</span>
                            </DropdownItem>
                          )}
                          <DropdownItem onClick={() => navigate(`/dashboard/links/${link.id}/qr`)}>
                            <QrCode className="w-4 h-4" />
                            <span>QR Code</span>
                          </DropdownItem>
                          <DropdownItem onClick={() => handleCopy(link.short_url)}>
                            <Copy className="w-4 h-4" />
                            <span>Copy URL</span>
                          </DropdownItem>
                          {(!isTeamMode || canEdit) && (
                            <>
                              <DropdownItem onClick={() => handleDelete(link)} danger>
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </DropdownItem>
                              <DropdownItem onClick={() => duplicateMutation.mutate(link.id)}>
                                <Copy className="w-4 h-4" />
                                <span>Duplicate</span>
                              </DropdownItem>
                            </>
                          )}
                        </Dropdown>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-500 order-2 sm:order-1">
            <span className="hidden sm:inline">Showing {startItem} to {endItem} of </span>
            <span className="sm:hidden">{totalCount} </span>
            <span className="hidden sm:inline">{totalCount} </span>
            links
          </p>
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <Button variant="ghost" size="sm" disabled={page === 1 || isFetching} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[80px] text-center">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page === totalPages || isFetching} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => { setDeleteModalOpen(false); setLinkToDelete(null); }} title="Delete Link">
        <div className="space-y-4">
          {linkToDelete && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900 truncate">{linkToDelete.short_url}</p>
              <p className="text-xs text-gray-500 truncate mt-1">{linkToDelete.original_url}</p>
            </div>
          )}
          <p className="text-gray-600">Are you sure? This action cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={deleteMutation.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal isOpen={bulkDeleteModalOpen} onClose={() => setBulkDeleteModalOpen(false)} title="Delete Links">
        <div className="space-y-4">
          <p className="text-gray-600">Delete {selectedLinks.size} selected links? This cannot be undone.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setBulkDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => bulkDeleteMutation.mutate(Array.from(selectedLinks))} isLoading={bulkDeleteMutation.isPending}>
              Delete {selectedLinks.size} Links
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Move Modal */}
      <Modal isOpen={bulkMoveModalOpen} onClose={() => setBulkMoveModalOpen(false)} title="Move to Campaign">
        <div className="space-y-4">
          <p className="text-gray-600">Move {selectedLinks.size} links to a campaign:</p>
          <select value={targetCampaign} onChange={(e) => setTargetCampaign(e.target.value)} className="input">
            <option value="">No Campaign</option>
            {campaigns?.map((c: Campaign) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setBulkMoveModalOpen(false)}>Cancel</Button>
            <Button onClick={() => bulkMoveMutation.mutate({ ids: Array.from(selectedLinks), campaignId: targetCampaign })} isLoading={bulkMoveMutation.isPending}>
              Move Links
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title="Import Links">
        <div className="space-y-4">
          <p className="text-gray-600">Upload a CSV or JSON file with your links.</p>
          <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p className="font-medium mb-2">CSV Format:</p>
            <code className="text-xs bg-gray-200 px-2 py-1 rounded">original_url,title,campaign_id</code>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" leftIcon={<FileText className="w-4 h-4" />} onClick={handleDownloadTemplate}>
              Download Template
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleFileImport} className="hidden" />
          <Button className="w-full" leftIcon={<Upload className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()} isLoading={importMutation.isPending}>
            Choose File
          </Button>
        </div>
      </Modal>

      {/* Bulk Create Modal */}
      <Modal isOpen={bulkCreateModalOpen} onClose={() => setBulkCreateModalOpen(false)} title="Bulk Create Links">
        <div className="space-y-4">
          <p className="text-gray-600">Enter one URL per line:</p>
          <textarea
            value={bulkUrls}
            onChange={(e) => setBulkUrls(e.target.value)}
            placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
            className="input min-h-[150px] font-mono text-sm"
          />
          <div>
            <label className="label">Campaign (optional)</label>
            <select value={bulkCampaign} onChange={(e) => setBulkCampaign(e.target.value)} className="input">
              <option value="">No Campaign</option>
              {campaigns?.map((c: Campaign) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="text-sm text-gray-500">
            {bulkUrls.split('\n').filter(u => u.trim()).length} URLs entered
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setBulkCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkCreate} isLoading={bulkCreateMutation.isPending} leftIcon={<Layers className="w-4 h-4" />}>
              Create Links
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

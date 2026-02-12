import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Download, Trash2, MoreVertical, ExternalLink,
    Search, Filter, X, ChevronLeft, ChevronRight, QrCode,
    CheckSquare, Square, Pencil
} from 'lucide-react';

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { EmptyState, Modal, Dropdown, DropdownItem, Badge, Skeleton } from '@/components/common';
import { Input } from '@/components/common/Input';
import { QRFramedRenderer } from '@/components/qr';
import { qrCodesAPI, downloadBlob, getErrorMessage } from '@/services/api';
import { useTeam } from '@/contexts/TeamContext';
import { useDebounce } from '@/hooks';
import { useQRDownload } from '@/hooks/useQRDownload';
import toast from 'react-hot-toast';
import type { QRCode as QRCodeType, QRStyle } from '@/types';

const PAGE_SIZE = 20;

function SkeletonQRCard() {
    return (
        <Card padding="none" className="overflow-hidden">
            <div className="p-6 flex items-center justify-center bg-gray-100">
                <Skeleton width={160} height={160} />
            </div>
            <div className="p-4 border-t border-gray-200">
                <Skeleton height={16} className="w-24 mb-2" />
                <Skeleton height={12} className="w-32 mb-3" />
                <Skeleton height={12} className="w-20" />
            </div>
        </Card>
    );
}

export function QRCodesPage() {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { isTeamMode, canEdit } = useTeam();
    const { download: downloadSvg } = useQRDownload();

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [filterOpen, setFilterOpen] = useState(false);
    const [styleFilter, setStyleFilter] = useState<QRStyle | ''>('');
    const [selectedQRs, setSelectedQRs] = useState<Set<string>>(new Set());
    const [isBatchDownloading, setIsBatchDownloading] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [qrToDelete, setQrToDelete] = useState<QRCodeType | null>(null);

    const debouncedSearch = useDebounce(search, 300);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['qrCodes', page, debouncedSearch, styleFilter],
        queryFn: () => qrCodesAPI.getQRCodes({
            page,
            search: debouncedSearch || undefined,
            style: styleFilter || undefined,
        }),
    });

    const qrCodes = data?.results || [];

    const deleteMutation = useMutation({
        mutationFn: (id: string) => qrCodesAPI.deleteQRCode(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qrCodes'] });
            toast.success('QR code deleted', { id: 'qr-delete' });
            setDeleteModalOpen(false);
            setQrToDelete(null);
        },
        onError: (error) => {
            toast.error(getErrorMessage(error), { id: 'qr-delete' });
        },
    });

    const handleDelete = (qr: QRCodeType) => {
        setQrToDelete(qr);
        setDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (qrToDelete) deleteMutation.mutate(qrToDelete.id);
    };

    const handleDownload = async (qr: QRCodeType, format: 'png' | 'svg') => {
        // Try client-side SVG download first
        const svgEl = document.getElementById(`qr-card-${qr.id}`) as SVGSVGElement | null;
        if (svgEl) {
            downloadSvg(svgEl, format, `qr-${qr.link_short_code}.${format}`);
            toast.success(`Downloaded ${format.toUpperCase()}`, { id: 'qr-download' });
            return;
        }
        // Fallback to server-side download
        try {
            const blob = await qrCodesAPI.downloadQRCode(qr.id, format);
            downloadBlob(blob, `qr-${qr.link_short_code}.${format}`);
            toast.success(`Downloaded ${format.toUpperCase()}`, { id: 'qr-download' });
        } catch (e) {
            toast.error(getErrorMessage(e), { id: 'qr-download' });
        }
    };

    const clearFilters = () => {
        setStyleFilter('');
        setSearch('');
        setPage(1);
    };

    const toggleSelectAll = () => {
        if (selectedQRs.size === qrCodes.length) {
            setSelectedQRs(new Set());
        } else {
            setSelectedQRs(new Set(qrCodes.map((qr: QRCodeType) => qr.id)));
        }
    };

    const toggleSelectQR = (id: string) => {
        const newSelected = new Set(selectedQRs);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedQRs(newSelected);
    };

    const handleBatchDownload = async (format: 'png' | 'svg') => {
        setIsBatchDownloading(true);
        try {
            const qrIds = Array.from(selectedQRs);
            const blob = await qrCodesAPI.batchDownloadQRCodes(qrIds, format);
            downloadBlob(blob, `qr-codes-bulk.zip`);
            toast.success(`Downloaded ${qrIds.length} QR codes`, { id: 'qr-batch-download' });
            setSelectedQRs(new Set());
        } catch (e) {
            toast.error(getErrorMessage(e), { id: 'qr-batch-download' });
        } finally {
            setIsBatchDownloading(false);
        }
    };

    const hasActiveFilters = styleFilter !== '' || search !== '';
    const totalCount = data?.count || 0;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const startItem = (page - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(page * PAGE_SIZE, totalCount);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">QR Codes</h1>
                    <p className="text-gray-500 mt-1">
                        {totalCount > 0
                            ? `${totalCount} QR code${totalCount !== 1 ? 's' : ''} total`
                            : 'Generate and customize QR codes for your links'}
                    </p>
                </div>
                {(!isTeamMode || canEdit) && (
                    <Link to="/dashboard/qr-codes/new">
                        <Button leftIcon={<Plus className="w-4 h-4" />}>Create QR Code</Button>
                    </Link>
                )}
            </div>

            {/* Bulk Actions */}
            {selectedQRs.size > 0 && (
                <Card className="bg-primary-50 border-primary/20">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-primary">{selectedQRs.size} selected</span>
                            <button onClick={() => setSelectedQRs(new Set())} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
                        </div>
                        <Dropdown
                            trigger={
                                <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />} isLoading={isBatchDownloading} className="w-full sm:w-auto">
                                    Download Selected
                                </Button>
                            }
                            align="right"
                        >
                            <DropdownItem onClick={() => handleBatchDownload('png')}>Download as PNG</DropdownItem>
                            <DropdownItem onClick={() => handleBatchDownload('svg')}>Download as SVG</DropdownItem>
                        </Dropdown>
                    </div>
                </Card>
            )}

            {/* Search and Filters */}
            <Card>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                        <Input
                            placeholder="Search QR codes by link URL or title..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            leftIcon={<Search className="w-4 h-4" />}
                            rightIcon={search ? <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button> : undefined}
                        />
                    </div>
                    <Button
                        variant={filterOpen ? 'secondary' : 'ghost'}
                        leftIcon={<Filter className="w-4 h-4" />}
                        onClick={() => setFilterOpen(!filterOpen)}
                    >
                        Filter
                        {hasActiveFilters && <span className="ml-1.5 w-2 h-2 bg-primary rounded-full" />}
                    </Button>
                </div>
                {filterOpen && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="label">Style</label>
                                <select className="input" value={styleFilter} onChange={(e) => { setStyleFilter(e.target.value as QRStyle | ''); setPage(1); }}>
                                    <option value="">All Styles</option>
                                    <option value="square">Square</option>
                                    <option value="dots">Dots</option>
                                    <option value="rounded">Rounded</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>}
                            </div>
                        </div>
                    </div>
                )}
            </Card>

            {/* QR Codes Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => <SkeletonQRCard key={i} />)}
                </div>
            ) : qrCodes.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={<QrCode className="w-6 h-6" />}
                        title={hasActiveFilters ? 'No QR codes match your filters' : 'No QR codes yet'}
                        description={hasActiveFilters ? 'Try adjusting your search or filters' : 'Create your first QR code to start tracking scans'}
                        action={hasActiveFilters
                            ? <Button variant="ghost" onClick={clearFilters}>Clear Filters</Button>
                            : <Link to="/dashboard/qr-codes/new"><Button leftIcon={<Plus className="w-4 h-4" />}>Create QR Code</Button></Link>
                        }
                    />
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {qrCodes.map((qr: QRCodeType) => (
                        <Card key={qr.id} padding="none" className={`group relative ${selectedQRs.has(qr.id) ? 'ring-2 ring-primary' : ''}`}>
                            {/* Selection Checkbox */}
                            <button
                                onClick={() => toggleSelectQR(qr.id)}
                                className="absolute top-3 left-3 z-10 w-6 h-6 rounded bg-white/90 shadow-sm flex items-center justify-center hover:bg-white transition-colors"
                            >
                                {selectedQRs.has(qr.id)
                                    ? <CheckSquare className="w-4 h-4 text-primary" />
                                    : <Square className="w-4 h-4 text-gray-400" />
                                }
                            </button>

                            {/* QR Preview — pure SVG, no hidden container needed */}
                            <div className="p-6 flex items-center justify-center relative" style={{ backgroundColor: qr.background_color }}>
                                <div style={{ transform: 'scale(0.8)' }}>
                                    <QRFramedRenderer
                                        id={`qr-card-${qr.id}`}
                                        value={qr.short_url}
                                        size={200}
                                        style={qr.style as any || 'square'}
                                        frame={qr.frame as any || 'none'}
                                        fgColor={qr.foreground_color}
                                        bgColor={qr.background_color}
                                        level="H"
                                        logoUrl={qr.logo_url || undefined}
                                        frameText={qr.frame_text}
                                        eyeStyle={qr.eye_style as any || 'square'}
                                        eyeColor={qr.eye_color}
                                        gradientEnabled={qr.gradient_enabled}
                                        gradientStart={qr.gradient_start}
                                        gradientEnd={qr.gradient_end}
                                        gradientDirection={qr.gradient_direction as any}
                                    />
                                </div>
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => handleDownload(qr, 'png')}>
                                        <Download className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => window.open(qr.short_url, '_blank')}>
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="p-4 border-t border-gray-200">
                                <div className="flex items-start justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900 truncate">
                                            {qr.title || qr.link_short_code || qr.qr_type}
                                        </p>
                                        <p className="text-sm text-gray-500 truncate mt-0.5">
                                            {qr.link_original_url || (qr.qr_type !== 'link' ? qr.qr_type.toUpperCase() + ' QR' : '')}
                                        </p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant="primary" className="text-xs capitalize">{qr.qr_type}</Badge>
                                            <Badge variant="default" className="text-xs">{qr.style}</Badge>
                                            <span className="text-xs text-gray-400">{qr.total_scans} scans</span>
                                            {isTeamMode && qr.created_by_name && (
                                                <span className="text-xs text-gray-400">by {qr.created_by_name}</span>
                                            )}
                                        </div>
                                    </div>
                                    <Dropdown
                                        trigger={
                                            <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        }
                                    >
                                        <DropdownItem onClick={() => handleDownload(qr, 'png')}>
                                            <Download className="w-4 h-4" /><span>Download PNG</span>
                                        </DropdownItem>
                                        <DropdownItem onClick={() => handleDownload(qr, 'svg')}>
                                            <Download className="w-4 h-4" /><span>Download SVG</span>
                                        </DropdownItem>
                                        {(!isTeamMode || canEdit) && (
                                            <DropdownItem onClick={() => navigate(`/dashboard/qr-codes/${qr.id}/edit`)}>
                                                <Pencil className="w-4 h-4" /><span>Edit QR Code</span>
                                            </DropdownItem>
                                        )}
                                        <DropdownItem onClick={() => window.open(qr.short_url, '_blank')}>
                                            <ExternalLink className="w-4 h-4" /><span>Open Link</span>
                                        </DropdownItem>
                                        {(!isTeamMode || canEdit) && (
                                            <DropdownItem onClick={() => handleDelete(qr)} danger>
                                                <Trash2 className="w-4 h-4" /><span>Delete</span>
                                            </DropdownItem>
                                        )}
                                    </Dropdown>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-gray-500 order-2 sm:order-1">
                        <span className="hidden sm:inline">Showing <span className="font-medium">{startItem}</span> to <span className="font-medium">{endItem}</span> of </span>
                        <span className="font-medium">{totalCount}</span> QR codes
                    </p>
                    <div className="flex items-center gap-1 order-1 sm:order-2">
                        <Button variant="ghost" size="sm" disabled={page === 1 || isFetching} onClick={() => setPage(page - 1)} className="px-2">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="px-3 py-1.5 text-sm text-gray-600 min-w-[90px] text-center">Page {page} of {totalPages}</span>
                        <Button variant="ghost" size="sm" disabled={page === totalPages || isFetching} onClick={() => setPage(page + 1)} className="px-2">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteModalOpen}
                onClose={() => { setDeleteModalOpen(false); setQrToDelete(null); }}
                title="Delete QR Code"
            >
                <div className="space-y-4">
                    {qrToDelete && (
                        <div className="p-4 bg-gray-50 rounded-lg flex items-center gap-4">
                            <div className="flex-shrink-0 p-2 rounded-lg" style={{ backgroundColor: qrToDelete.background_color }}>
                                <QRFramedRenderer
                                    value={qrToDelete.short_url}
                                    size={64}
                                    style={qrToDelete.style as any || 'square'}
                                    frame={qrToDelete.frame as any || 'none'}
                                    fgColor={qrToDelete.foreground_color}
                                    bgColor={qrToDelete.background_color}
                                    level="H"
                                    logoUrl={qrToDelete.logo_url || undefined}
                                    eyeStyle={qrToDelete.eye_style as any || 'square'}
                                    eyeColor={qrToDelete.eye_color}
                                    gradientEnabled={qrToDelete.gradient_enabled}
                                    gradientStart={qrToDelete.gradient_start}
                                    gradientEnd={qrToDelete.gradient_end}
                                    gradientDirection={qrToDelete.gradient_direction as any}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{qrToDelete.link_short_code}</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{qrToDelete.link_original_url}</p>
                                {qrToDelete.total_scans > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">{qrToDelete.total_scans} scan{qrToDelete.total_scans !== 1 ? 's' : ''}</p>
                                )}
                            </div>
                        </div>
                    )}
                    <p className="text-gray-600">Are you sure you want to delete this QR code? This action cannot be undone.</p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => { setDeleteModalOpen(false); setQrToDelete(null); }}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete} isLoading={deleteMutation.isPending}>Delete QR Code</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

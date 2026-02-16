import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, QrCode, Save, Download, Globe, Shield,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Loading, Badge } from '@/components/common';
import { Input } from '@/components/common/Input';
import { qrCodesAPI, rulesAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useQRDesign } from '@/hooks/useQRDesign';
import { useQRDownload } from '@/hooks/useQRDownload';
import { QRDesignPanel, QRPreviewPanel } from './qr/components';
import toast from 'react-hot-toast';
import type { QRStyle, QREyeStyle, QRGradientDirection, QRFrame, Rule } from '@/types';

export function EditQRCodePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { subscription } = useAuth();
    const isPaidPlan = !!(subscription?.plan && subscription.plan !== 'free');
    const { download } = useQRDownload();

    const showUpgradeToast = (feature: string) => {
        toast.error(`${feature} is only available on paid plans. Upgrade to unlock this feature.`, { duration: 4000, icon: '🔒' });
    };

    // Design state (shared hook)
    const [design, designActions] = useQRDesign();
    const [removedLogo, setRemovedLogo] = useState(false);
    const [destinationUrl, setDestinationUrl] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch QR code details
    const { data: qrCode, isLoading } = useQuery({
        queryKey: ['qrCode', id],
        queryFn: () => qrCodesAPI.getQRCode(id!),
        enabled: !!id,
    });

    // Fetch associated rules
    const { data: linkedRules, isLoading: rulesLoading } = useQuery({
        queryKey: ['rulesForQRCode', id],
        queryFn: () => rulesAPI.getForQRCode(id!),
        enabled: !!id,
    });

    // Initialize form with fetched data
    useEffect(() => {
        if (!qrCode) return;
        designActions.setQrStyle(qrCode.style as QRStyle);
        designActions.setQrFrame((qrCode.frame as QRFrame) || 'none');
        designActions.setFgColor(qrCode.foreground_color);
        designActions.setBgColor(qrCode.background_color);
        designActions.setEyeStyle((qrCode.eye_style as QREyeStyle) || 'square');
        designActions.setEyeColor(qrCode.eye_color || '#000000');
        designActions.setGradientEnabled(qrCode.gradient_enabled || false);
        designActions.setGradientStart(qrCode.gradient_start || '#000000');
        designActions.setGradientEnd(qrCode.gradient_end || '#666666');
        designActions.setGradientDirection((qrCode.gradient_direction as QRGradientDirection) || 'vertical');
        designActions.setFrameText(qrCode.frame_text || '');
        if (qrCode.logo_url) {
            designActions.removeLogo(); // reset any lingering file state
        }
        if (qrCode.is_dynamic) {
            setDestinationUrl(qrCode.destination_url || qrCode.link_original_url || '');
        }
    }, [qrCode]);

    // Track changes
    useEffect(() => {
        if (!qrCode) return;
        const originalDestination = qrCode.destination_url || qrCode.link_original_url || '';
        const changed =
            design.qrStyle !== qrCode.style ||
            design.qrFrame !== (qrCode.frame || 'none') ||
            design.fgColor !== qrCode.foreground_color ||
            design.bgColor !== qrCode.background_color ||
            design.logoFile !== null ||
            removedLogo ||
            (qrCode.is_dynamic && destinationUrl !== originalDestination) ||
            design.eyeStyle !== (qrCode.eye_style || 'square') ||
            design.eyeColor !== (qrCode.eye_color || '#000000') ||
            design.gradientEnabled !== (qrCode.gradient_enabled || false) ||
            design.gradientStart !== (qrCode.gradient_start || '#000000') ||
            design.gradientEnd !== (qrCode.gradient_end || '#666666') ||
            design.gradientDirection !== (qrCode.gradient_direction || 'vertical') ||
            design.frameText !== (qrCode.frame_text || '');
        setHasChanges(changed);
    }, [design, removedLogo, destinationUrl, qrCode]);

    const updateMutation = useMutation({
        mutationFn: (formData: FormData) => qrCodesAPI.updateQRCode(id!, formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qrCodes'] });
            queryClient.invalidateQueries({ queryKey: ['qrCode', id] });
            toast.success('QR code updated successfully!');
            navigate('/dashboard/qr-codes');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to update QR code');
        },
    });

    const handleSave = () => {
        const formData = new FormData();
        formData.append('style', design.qrStyle);
        formData.append('frame', design.qrFrame);
        if (design.frameText) formData.append('frame_text', design.frameText);
        formData.append('foreground_color', design.fgColor);
        formData.append('background_color', design.bgColor);
        formData.append('eye_style', design.eyeStyle);
        if (design.eyeColor !== '#000000') formData.append('eye_color', design.eyeColor);

        if (design.gradientEnabled) {
            formData.append('gradient_enabled', 'true');
            formData.append('gradient_start', design.gradientStart);
            formData.append('gradient_end', design.gradientEnd);
            formData.append('gradient_direction', design.gradientDirection);
        }

        if (design.logoFile) {
            formData.append('logo', design.logoFile);
        } else if (removedLogo) {
            formData.append('remove_logo', 'true');
        }

        if (qrCode?.is_dynamic) {
            formData.append('destination_url', destinationUrl);
        }

        updateMutation.mutate(formData);
    };

    const handleDownload = async (format: 'png' | 'svg') => {
        // Try client-side download first (reflects current design state)
        const svgEl = document.getElementById('qr-preview') as SVGSVGElement | null;
        if (svgEl) {
            download(svgEl, format, `qr-${qrCode?.link_short_code || id}`);
            toast.success(`Downloaded ${format.toUpperCase()}`);
            return;
        }
        // Fallback: server-side download
        if (!id) return;
        try {
            const blob = await qrCodesAPI.downloadQRCode(id, format);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `qr-${qrCode?.link_short_code || id}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success(`Downloaded ${format.toUpperCase()}`);
        } catch {
            toast.error('Failed to download');
        }
    };

    const handleRemoveLogo = () => {
        designActions.removeLogo();
        setRemovedLogo(true);
    };

    // The effective logo preview: new file preview > existing server URL > nothing
    const effectiveLogoPreview = design.logoPreview || (!removedLogo && qrCode?.logo_url) || '';

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loading size="lg" /></div>;
    }

    if (!qrCode) {
        return (
            <div className="text-center py-16">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h2 className="text-xl font-semibold text-gray-900">QR Code not found</h2>
                <Link to="/dashboard/qr-codes" className="text-primary hover:underline mt-2 inline-block">Go back to QR codes</Link>
            </div>
        );
    }

    // Create a modified design for the preview that uses effectiveLogoPreview
    const previewDesign = { ...design, logoPreview: effectiveLogoPreview };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard/qr-codes" className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Edit QR Code</h1>
                        <p className="text-gray-500 mt-0.5 font-mono text-sm">{qrCode.short_url}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleDownload('png')}>
                        <Download className="w-4 h-4 mr-2" /> PNG
                    </Button>
                    <Button variant="outline" onClick={() => handleDownload('svg')}>
                        <Download className="w-4 h-4 mr-2" /> SVG
                    </Button>
                    <Button onClick={handleSave} isLoading={updateMutation.isPending} disabled={!hasChanges}>
                        <Save className="w-4 h-4 mr-2" /> Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left - Configuration */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Destination URL for dynamic QRs */}
                    {qrCode.is_dynamic && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Destination URL</CardTitle>
                                <CardDescription>Change where this QR code redirects without reprinting it</CardDescription>
                            </CardHeader>
                            <Input
                                type="url" placeholder="https://example.com"
                                value={destinationUrl}
                                onChange={(e) => setDestinationUrl(e.target.value)}
                            />
                        </Card>
                    )}

                    <QRDesignPanel
                        design={{ ...design, logoPreview: effectiveLogoPreview }}
                        actions={{
                            ...designActions,
                            removeLogo: handleRemoveLogo,
                        }}
                        isPaidPlan={isPaidPlan}
                        showUpgradeToast={showUpgradeToast}
                        onChange={() => setHasChanges(true)}
                    />

                    {/* Associated Rules */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Smart Rules</CardTitle>
                                <Link to={`/dashboard/rules/new?qr_code=${id}`}>
                                    <Button variant="ghost" size="sm">Add Rule</Button>
                                </Link>
                            </div>
                            <CardDescription>Redirect users based on device, location, time, or language</CardDescription>
                        </CardHeader>
                        <div>
                            {rulesLoading ? (
                                <div className="flex justify-center py-4"><Loading /></div>
                            ) : !linkedRules || linkedRules.length === 0 ? (
                                <div className="text-center py-6">
                                    <Shield className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm text-gray-500 mb-3">No rules configured for this QR code</p>
                                    <Link to={`/dashboard/rules/new?qr_code=${id}`}>
                                        <Button variant="outline" size="sm">Create First Rule</Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {linkedRules.map((rule: Rule) => (
                                        <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <Badge variant={rule.is_active ? 'success' : 'default'}>
                                                    {rule.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                                <div>
                                                    <span className="font-medium text-gray-900">{rule.name}</span>
                                                    {rule.condition_type && (
                                                        <span className="text-xs text-gray-500 ml-2 capitalize">{rule.condition_type.replace('_', ' ')}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <Link to={`/dashboard/rules/${rule.id}/edit`}>
                                                <Button variant="ghost" size="sm">Edit</Button>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right - Preview */}
                <div className="lg:col-span-2">
                    <QRPreviewPanel
                        value={qrCode.short_url}
                        design={previewDesign}
                        downloadFilename={`qr-${qrCode.link_short_code || id}`}
                        showCancel={false}
                        primaryAction={
                            <Button onClick={handleSave} isLoading={updateMutation.isPending} disabled={!hasChanges} className="w-full">
                                <Save className="w-4 h-4 mr-2" /> Save Changes
                            </Button>
                        }
                        extraContent={
                            <>
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">Link:</span>
                                        <span className="font-medium text-gray-900 truncate ml-2">{qrCode.link_short_code}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm mt-2">
                                        <span className="text-gray-500">Scans:</span>
                                        <span className="font-medium text-gray-900">{qrCode.total_scans.toLocaleString()}</span>
                                    </div>
                                    {qrCode.is_dynamic && (
                                        <div className="flex items-center justify-between text-sm mt-2">
                                            <span className="text-gray-500">Type:</span>
                                            <Badge variant="primary" className="text-xs">Dynamic</Badge>
                                        </div>
                                    )}
                                    {linkedRules && linkedRules.length > 0 && (
                                        <div className="flex items-center justify-between text-sm mt-2">
                                            <span className="text-gray-500">Rules:</span>
                                            <span className="font-medium text-gray-900">{linkedRules.length} active</span>
                                        </div>
                                    )}
                                </div>
                                {hasChanges && (
                                    <div className="mt-4 p-3 bg-warning/10 rounded-lg border border-warning/30 text-sm text-warning-dark">
                                        You have unsaved changes
                                    </div>
                                )}
                            </>
                        }
                    />
                </div>
            </div>
        </div>
    );
}

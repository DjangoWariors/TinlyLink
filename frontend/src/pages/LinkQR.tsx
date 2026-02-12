import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, Copy, Save } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Loading } from '@/components/common';
import { linksAPI, qrCodesAPI } from '@/services/api';
import { QRFramedRenderer } from '@/components/qr';
import { useAuth } from '@/contexts/AuthContext';
import { useQRDesign } from '@/hooks/useQRDesign';
import { useQRDownload } from '@/hooks/useQRDownload';
import { QRDesignPanel } from './qr/components';
import type { QRStyle, QRFrame, QREyeStyle, QRGradientDirection } from '@/types';

export function LinkQRPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { subscription } = useAuth();
    const isPaidPlan = !!(subscription?.plan && subscription.plan !== 'free');
    const { download } = useQRDownload();

    const [design, designActions] = useQRDesign();
    const [removedLogo, setRemovedLogo] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const showUpgradeToast = (feature: string) => {
        toast.error(`${feature} is only available on paid plans. Upgrade to unlock this feature.`, { duration: 4000, icon: '🔒' });
    };

    // Fetch link details
    const { data: link, isLoading, error, refetch } = useQuery({
        queryKey: ['link', id],
        queryFn: () => linksAPI.getLink(id!),
        enabled: !!id,
    });

    // Initialize design from existing QR code
    useEffect(() => {
        if (!link?.qr_code) return;
        const qr = link.qr_code;
        designActions.setQrStyle(qr.style as QRStyle);
        designActions.setQrFrame((qr.frame as QRFrame) || 'none');
        designActions.setFgColor(qr.foreground_color);
        designActions.setBgColor(qr.background_color);
        designActions.setEyeStyle((qr.eye_style as QREyeStyle) || 'square');
        designActions.setEyeColor(qr.eye_color || '#000000');
        designActions.setGradientEnabled(qr.gradient_enabled || false);
        designActions.setGradientStart(qr.gradient_start || '#000000');
        designActions.setGradientEnd(qr.gradient_end || '#666666');
        designActions.setGradientDirection((qr.gradient_direction as QRGradientDirection) || 'vertical');
        designActions.setFrameText(qr.frame_text || '');
    }, [link]);

    const effectiveLogoPreview = design.logoPreview || (!removedLogo && link?.qr_code?.logo_url) || '';

    const handleCopyLink = async () => {
        if (link?.short_url) {
            await navigator.clipboard.writeText(link.short_url);
            toast.success('Link copied to clipboard!');
        }
    };

    const handleSave = async () => {
        if (!link) return;
        setIsSaving(true);
        try {
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

            if (link.qr_code) {
                await qrCodesAPI.updateQRCode(link.qr_code.id, formData);
                toast.success('QR Code updated!');
            } else {
                formData.append('link_id', link.id);
                await qrCodesAPI.createQRCodeWithLogo(formData);
                toast.success('QR Code created!');
            }
            refetch();
        } catch (err) {
            console.error(err);
            toast.error('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = (format: 'png' | 'svg') => {
        download('link-qr-preview', format, `qr-${link?.short_code || 'code'}`);
        toast.success(`${format.toUpperCase()} downloaded!`);
    };

    const handleRemoveLogo = () => {
        designActions.removeLogo();
        setRemovedLogo(true);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[400px]"><Loading size="lg" /></div>;
    }

    if (error || !link) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Link not found</h2>
                <p className="text-gray-500 mb-4">The link you&apos;re looking for doesn&apos;t exist.</p>
                <Button onClick={() => navigate('/dashboard/links')}>Back to Links</Button>
            </div>
        );
    }

    const previewDesign = { ...design, logoPreview: effectiveLogoPreview };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(`/dashboard/links/${id}`)} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">QR Code</h1>
                    <p className="text-gray-500 mt-1 truncate">{link.short_url}</p>
                </div>
                <Button variant="outline" onClick={handleCopyLink}>
                    <Copy className="w-4 h-4 mr-2" /> Copy Link
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                    <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* QR Code Preview */}
                <Card className="flex flex-col items-center justify-center p-8">
                    <div className="p-6 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f8fafc' }}>
                        <QRFramedRenderer
                            id="link-qr-preview"
                            value={link.short_url}
                            size={280}
                            style={previewDesign.qrStyle}
                            frame={previewDesign.qrFrame}
                            frameText={previewDesign.frameText}
                            fgColor={previewDesign.fgColor}
                            bgColor={previewDesign.bgColor}
                            level="H"
                            logoUrl={effectiveLogoPreview || undefined}
                            eyeStyle={previewDesign.eyeStyle}
                            eyeColor={previewDesign.eyeColor}
                            gradientEnabled={previewDesign.gradientEnabled}
                            gradientStart={previewDesign.gradientStart}
                            gradientEnd={previewDesign.gradientEnd}
                            gradientDirection={previewDesign.gradientDirection}
                        />
                    </div>

                    <div className="flex gap-3 mt-6">
                        <Button onClick={() => handleDownload('png')}>
                            <Download className="w-4 h-4 mr-2" /> Download PNG
                        </Button>
                        <Button variant="outline" onClick={() => handleDownload('svg')}>
                            <Download className="w-4 h-4 mr-2" /> Download SVG
                        </Button>
                    </div>

                    <p className="text-sm text-gray-500 mt-4 text-center">
                        <span className="capitalize">{design.qrStyle}</span> {' '}
                        {design.qrFrame !== 'none' ? `${design.qrFrame} Frame` : 'No Frame'}
                        <br />
                        <a href={link.short_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {link.short_url}
                        </a>
                    </p>
                </Card>

                {/* Design Panel */}
                <QRDesignPanel
                    design={previewDesign}
                    actions={{ ...designActions, removeLogo: handleRemoveLogo }}
                    isPaidPlan={isPaidPlan}
                    showUpgradeToast={showUpgradeToast}
                />
            </div>
        </div>
    );
}

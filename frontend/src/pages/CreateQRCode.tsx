import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, QrCode } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { qrCodesAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useQRDesign } from '@/hooks/useQRDesign';
import { QRTypeSelector, QRContentForm, QRDesignPanel, QRPreviewPanel } from './qr/components';
import toast from 'react-hot-toast';
import type { QRType, QRContentData, Link as LinkType } from '@/types';

export function CreateQRCodePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { subscription } = useAuth();
    const isPaidPlan = !!(subscription?.plan && subscription.plan !== 'free');

    const showUpgradeToast = (feature: string) => {
        toast.error(`${feature} is only available on paid plans. Upgrade to unlock this feature.`, { duration: 4000, icon: '🔒', id: 'upgrade-required' });
    };

    // Content state
    const [qrType, setQrType] = useState<QRType>('link');
    const [title, setTitle] = useState('');
    const [selectedLinkId, setSelectedLinkId] = useState('');
    const [linkSearch, setLinkSearch] = useState('');
    const [contentData, setContentData] = useState<QRContentData>({});
    const [isDynamic, setIsDynamic] = useState(false);
    const [destinationUrl, setDestinationUrl] = useState('');

    // Design state (shared hook)
    const [design, designActions] = useQRDesign();

    // Server preview state
    const [serverPreviewUrl, setServerPreviewUrl] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const createMutation = useMutation({
        mutationFn: (formData: FormData) => qrCodesAPI.createQRCodeWithLogo(formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qrCodes'] });
            toast.success('QR code created!', { id: 'qr-create' });
            navigate('/dashboard/qr-codes');
        },
        onError: (error: any) => {
            const message = error.response?.data?.detail || error.response?.data?.error ||
                error.response?.data?.content_data?.[0] || 'Failed to create QR code';
            toast.error(message, { id: 'qr-create' });
        },
    });

    const handleServerPreview = async () => {
        if (qrType !== 'link' || !selectedLinkId) {
            toast.error('Server preview only available for link-type QR codes with a selected link', { id: 'qr-preview' });
            return;
        }
        setIsPreviewLoading(true);
        try {
            const result = await qrCodesAPI.previewQRCode({
                link_id: selectedLinkId,
                style: design.qrStyle,
                frame: design.qrFrame,
                foreground_color: design.fgColor,
                background_color: design.bgColor,
                eye_style: design.eyeStyle,
                ...(design.eyeColor !== '#000000' ? { eye_color: design.eyeColor } : {}),
                ...(design.gradientEnabled ? {
                    gradient_enabled: true,
                    gradient_start: design.gradientStart,
                    gradient_end: design.gradientEnd,
                    gradient_direction: design.gradientDirection,
                } : {}),
            });
            setServerPreviewUrl(result.preview);
            toast.success('Server preview generated', { id: 'qr-preview' });
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to generate preview', { id: 'qr-preview' });
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const validateContentData = (): boolean => {
        const d = contentData as any;
        const fail = (msg: string) => { toast.error(msg, { id: 'qr-validation' }); return false; };
        switch (qrType) {
            case 'link': break;
            case 'vcard': if (!d.name) return fail('Name is required'); break;
            case 'wifi': if (!d.ssid) return fail('Network name (SSID) is required'); break;
            case 'email': if (!d.email) return fail('Email address is required'); break;
            case 'sms': case 'phone': if (!d.phone) return fail('Phone number is required'); break;
            case 'text': if (!d.text) return fail('Text content is required'); break;
            case 'calendar': if (!d.title) return fail('Event title is required'); break;
            case 'location': if (!d.latitude || !d.longitude) return fail('Coordinates are required'); break;
            case 'upi': if (!d.pa) return fail('UPI ID is required'); if (!d.pn) return fail('Payee name is required'); break;
            case 'pix': if (!d.key) return fail('Pix key is required'); if (!d.name) return fail('Receiver name is required'); if (!d.city) return fail('City is required'); break;
            case 'product': if (!d.name) return fail('Product name is required'); if (!d.sku) return fail('Product SKU is required'); break;
            case 'menu': if (!d.restaurant_name) return fail('Restaurant name is required'); if (!d.menu_url) return fail('Menu URL is required'); break;
            case 'document': if (!d.title) return fail('Title is required'); if (!d.file_url) return fail('Document URL is required'); break;
            case 'pdf': if (!d.title) return fail('Title is required'); if (!d.pdf_url) return fail('PDF URL is required'); break;
            case 'multi_url': if (!d.title) return fail('Page title is required'); if (!d.links?.length) return fail('At least one link is required'); break;
            case 'app_store': if (!d.app_name) return fail('App name is required'); if (!d.ios_url && !d.android_url) return fail('At least one app store URL is required'); if (!d.fallback_url) return fail('Fallback URL is required'); break;
            case 'social': if (!d.title) return fail('Profile title is required'); if (!d.links?.length) return fail('At least one social link is required'); break;
            case 'serial': break;
        }
        return true;
    };

    const handleCreate = () => {
        if (qrType === 'link' && !selectedLinkId) {
            toast.error('Please select a link', { id: 'qr-validation' });
            return;
        }
        if (!validateContentData()) return;

        const formData = new FormData();
        formData.append('qr_type', qrType);
        if (title) formData.append('title', title);
        formData.append('style', design.qrStyle);
        formData.append('frame', design.qrFrame);
        if (design.frameText) formData.append('frame_text', design.frameText);
        formData.append('foreground_color', design.fgColor);
        formData.append('background_color', design.bgColor);
        if (isDynamic) formData.append('is_dynamic', 'true');

        formData.append('eye_style', design.eyeStyle);
        if (design.eyeColor !== '#000000') formData.append('eye_color', design.eyeColor);

        if (design.gradientEnabled) {
            formData.append('gradient_enabled', 'true');
            formData.append('gradient_start', design.gradientStart);
            formData.append('gradient_end', design.gradientEnd);
            formData.append('gradient_direction', design.gradientDirection);
        }

        if (qrType === 'link') {
            formData.append('link_id', selectedLinkId);
        } else {
            formData.append('content_data', JSON.stringify(contentData));
        }

        if (isDynamic && destinationUrl) {
            formData.append('destination_url', destinationUrl);
        }

        if (design.logoFile) formData.append('logo', design.logoFile);

        createMutation.mutate(formData);
    };

    const getPreviewValue = (): string => {
        const d = contentData as any;
        switch (qrType) {
            case 'link': return 'https://example.com';
            case 'vcard': return `BEGIN:VCARD\nFN:${d.name || 'Name'}\nEND:VCARD`;
            case 'wifi': return `WIFI:T:WPA;S:${d.ssid || 'Network'};;`;
            case 'email': return `mailto:${d.email || 'email@example.com'}`;
            case 'sms': return `SMSTO:${d.phone || '+1234567890'}`;
            case 'phone': return `tel:${d.phone || '+1234567890'}`;
            case 'text': return d.text || 'Your text here';
            case 'calendar': return `BEGIN:VEVENT\nSUMMARY:${d.title || 'Event'}\nEND:VEVENT`;
            case 'location': return `geo:${d.latitude || 0},${d.longitude || 0}`;
            case 'upi': return `upi://pay?pa=${d.pa || 'merchant@upi'}&pn=${d.pn || 'Merchant'}`;
            case 'pix': return d.key || 'pix-key';
            case 'product': return `Product: ${d.name || 'Product'} (${d.sku || 'SKU'})`;
            case 'menu': return d.menu_url || 'https://restaurant.com/menu';
            case 'document': return d.file_url || 'https://example.com/doc';
            case 'pdf': return d.pdf_url || 'https://example.com/doc.pdf';
            case 'app_store': return d.fallback_url || d.ios_url || d.android_url || 'https://myapp.com';
            case 'multi_url': return d.title || 'Multi Links';
            case 'social': return d.title || 'Social Hub';
            default: return 'Preview';
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard/qr-codes" className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Create QR Code</h1>
                        <p className="text-gray-500 mt-0.5">Generate a QR code for any purpose</p>
                    </div>
                </div>
                <Button onClick={handleCreate} isLoading={createMutation.isPending} size="lg">
                    <QrCode className="w-4 h-4 mr-2" /> Create QR Code
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Panel */}
                <div className="lg:col-span-3 space-y-6">
                    <QRTypeSelector
                        value={qrType}
                        onChange={(type) => { setQrType(type); setContentData({}); }}
                        isPaidPlan={isPaidPlan}
                        showUpgradeToast={showUpgradeToast}
                    />

                    <QRContentForm
                        qrType={qrType} title={title} setTitle={setTitle}
                        contentData={contentData} setContentData={setContentData}
                        isDynamic={isDynamic} setIsDynamic={setIsDynamic}
                        destinationUrl={destinationUrl} setDestinationUrl={setDestinationUrl}
                        selectedLinkId={selectedLinkId} setSelectedLinkId={setSelectedLinkId}
                        linkSearch={linkSearch} setLinkSearch={setLinkSearch}
                        isPaidPlan={isPaidPlan} showUpgradeToast={showUpgradeToast}
                    />

                    <QRDesignPanel
                        design={design} actions={designActions}
                        isPaidPlan={isPaidPlan} showUpgradeToast={showUpgradeToast}
                    />
                </div>

                {/* Right Panel - Preview */}
                <div className="lg:col-span-2">
                    <QRPreviewPanel
                        value={getPreviewValue()}
                        design={design}
                        typeLabel={undefined}
                        primaryAction={
                            <Button onClick={handleCreate} isLoading={createMutation.isPending} className="w-full">
                                <QrCode className="w-4 h-4 mr-2" /> Create QR Code
                            </Button>
                        }
                    />
                </div>
            </div>
        </div>
    );
}

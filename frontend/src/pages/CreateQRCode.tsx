import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Search, X, Upload, QrCode, Link2, Check, Palette, Trash2,
    User, Wifi, Mail, MessageSquare, Phone, FileText, Calendar, MapPin,
    Smartphone, Image as ImageIcon, Maximize, Laptop, Globe, Zap, Lock,
    CreditCard, ShoppingBag, Menu, File, Share2, Store, Ticket, Tag, LayoutGrid, Eye
} from 'lucide-react';
import { QRCodeGenerator, QRFrame } from '@/components/QRCodeGenerator';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Loading, Badge } from '@/components/common';
import { Input } from '@/components/common/Input';
import { qrCodesAPI, linksAPI } from '@/services/api';
import { useDebounce } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { QRType, QRStyle, QREyeStyle, QRGradientDirection, Link as LinkType, QRContentData } from '@/types';

// QR Type configuration - matches backend TYPE_CHOICES
const QR_TYPES: Array<{ type: QRType; label: string; icon: React.ElementType; description: string; pro?: boolean; business?: boolean }> = [
    // Basic types
    { type: 'link', label: 'Website Link', icon: Link2, description: 'Link to any URL' },
    { type: 'vcard', label: 'Contact Card', icon: User, description: 'Share contact info', pro: true },
    { type: 'wifi', label: 'WiFi Network', icon: Wifi, description: 'Connect to WiFi', pro: true },
    { type: 'email', label: 'Email', icon: Mail, description: 'Send an email', pro: true },
    { type: 'sms', label: 'SMS Message', icon: MessageSquare, description: 'Send a text', pro: true },
    { type: 'phone', label: 'Phone Call', icon: Phone, description: 'Make a call', pro: true },
    { type: 'text', label: 'Plain Text', icon: FileText, description: 'Display text', pro: true },
    { type: 'calendar', label: 'Calendar Event', icon: Calendar, description: 'Add to calendar', pro: true },
    { type: 'location', label: 'Location', icon: MapPin, description: 'Show on map', pro: true },
    // Payment types
    { type: 'upi', label: 'UPI Payment', icon: CreditCard, description: 'Accept UPI payments', business: true },
    { type: 'pix', label: 'Pix Payment', icon: CreditCard, description: 'Brazil Pix payments', business: true },
    // Product/Business types
    { type: 'product', label: 'Product', icon: ShoppingBag, description: 'Product info page', business: true },
    { type: 'menu', label: 'Menu', icon: Menu, description: 'Restaurant menu', business: true },
    // Document types
    { type: 'document', label: 'Document', icon: File, description: 'Share a document', pro: true },
    { type: 'pdf', label: 'PDF', icon: FileText, description: 'Share a PDF file', pro: true },
    // Multi-destination types
    { type: 'multi_url', label: 'Multi URL', icon: LayoutGrid, description: 'Multiple destinations', business: true },
    { type: 'app_store', label: 'App Store', icon: Store, description: 'iOS/Android app links', pro: true },
    { type: 'social', label: 'Social Links', icon: Share2, description: 'Social media profiles', pro: true },
    // Enterprise
    { type: 'serial', label: 'Serial Code', icon: Tag, description: 'Unique product codes', business: true },
];

// Color presets
const COLOR_PRESETS = [
    { name: 'Classic', fg: '#000000', bg: '#FFFFFF' },
    { name: 'Midnight', fg: '#1e293b', bg: '#f8fafc' },
    { name: 'Ocean', fg: '#0369a1', bg: '#f0f9ff' },
    { name: 'Forest', fg: '#15803d', bg: '#f0fdf4' },
    { name: 'Berry', fg: '#9333ea', bg: '#faf5ff' },
    { name: 'Sunset', fg: '#ea580c', bg: '#fff7ed' },
];

// Frame options - matches backend FRAME_CHOICES
const FRAME_OPTIONS: Array<{ id: QRFrame; label: string; icon: React.ElementType }> = [
    { id: 'none', label: 'None', icon: Maximize },
    { id: 'simple', label: 'Simple', icon: Maximize },
    { id: 'scan_me', label: 'Scan Me', icon: QrCode },
    { id: 'balloon', label: 'Balloon', icon: MessageSquare },
    { id: 'badge', label: 'Badge', icon: User },
    { id: 'phone', label: 'Phone', icon: Smartphone },
    { id: 'polaroid', label: 'Polaroid', icon: ImageIcon },
    { id: 'laptop', label: 'Laptop', icon: Laptop },
    { id: 'ticket', label: 'Ticket', icon: Ticket },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'tag', label: 'Tag', icon: Tag },
    { id: 'certificate', label: 'Certificate', icon: FileText },
];

// Eye style options - matches backend EYE_STYLE_CHOICES
const EYE_STYLE_OPTIONS: Array<{ id: QREyeStyle; label: string }> = [
    { id: 'square', label: 'Square' },
    { id: 'circle', label: 'Circle' },
    { id: 'rounded', label: 'Rounded' },
    { id: 'leaf', label: 'Leaf' },
    { id: 'diamond', label: 'Diamond' },
];

// Gradient direction options
const GRADIENT_DIRECTIONS: Array<{ id: QRGradientDirection; label: string }> = [
    { id: 'vertical', label: 'Vertical' },
    { id: 'horizontal', label: 'Horizontal' },
    { id: 'diagonal', label: 'Diagonal' },
    { id: 'radial', label: 'Radial' },
];

export function CreateQRCodePage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { subscription } = useAuth();

    // Check if user has a paid plan
    const isPaidPlan = subscription?.plan && subscription.plan !== 'free';

    // Helper to show upgrade toast for free users
    const showUpgradeToast = (feature: string) => {
        toast.error(
            `${feature} is only available on paid plans. Upgrade to unlock this feature.`,
            { duration: 4000, icon: '🔒', id: 'upgrade-required' }
        );
    };

    // Form state
    const [qrType, setQrType] = useState<QRType>('link');
    const [title, setTitle] = useState('');
    const [selectedLinkId, setSelectedLinkId] = useState('');
    const [linkSearch, setLinkSearch] = useState('');
    const [contentData, setContentData] = useState<QRContentData>({});
    const [qrStyle, setQrStyle] = useState<QRStyle>('square');
    const [qrFrame, setQrFrame] = useState<QRFrame>('none');
    const [fgColor, setFgColor] = useState('#000000');
    const [bgColor, setBgColor] = useState('#FFFFFF');
    const [isDynamic, setIsDynamic] = useState(false);
    const [destinationUrl, setDestinationUrl] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');
    // Eye styling state
    const [eyeStyle, setEyeStyle] = useState<QREyeStyle>('square');
    const [eyeColor, setEyeColor] = useState('#000000');
    // Gradient state
    const [gradientEnabled, setGradientEnabled] = useState(false);
    const [gradientStart, setGradientStart] = useState('#000000');
    const [gradientEnd, setGradientEnd] = useState('#666666');
    const [gradientDirection, setGradientDirection] = useState<QRGradientDirection>('vertical');
    // Frame text state
    const [frameText, setFrameText] = useState('');
    // Server preview state
    const [serverPreviewUrl, setServerPreviewUrl] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const debouncedLinkSearch = useDebounce(linkSearch, 300);

    // Fetch links for link type
    const { data: linksData, isLoading: linksLoading } = useQuery({
        queryKey: ['linksForQR', debouncedLinkSearch],
        queryFn: () => linksAPI.getLinks({ page: 1, page_size: 50, search: debouncedLinkSearch || undefined }),
        enabled: qrType === 'link',
    });

    // Create mutation
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

    // Server-side preview - uses previewQRCode API
    const handleServerPreview = async () => {
        if (qrType !== 'link' || !selectedLinkId) {
            toast.error('Server preview only available for link-type QR codes with a selected link', { id: 'qr-preview' });
            return;
        }
        setIsPreviewLoading(true);
        try {
            const result = await qrCodesAPI.previewQRCode({
                link_id: selectedLinkId,
                style: qrStyle,
                frame: qrFrame,
                foreground_color: fgColor,
                background_color: bgColor,
                eye_style: eyeStyle,
                ...(eyeColor !== '#000000' ? { eye_color: eyeColor } : {}),
                ...(gradientEnabled ? {
                    gradient_enabled: true,
                    gradient_start: gradientStart,
                    gradient_end: gradientEnd,
                    gradient_direction: gradientDirection,
                } : {}),
            });
            setServerPreviewUrl(result.preview);
            toast.success('Server preview generated', { id: 'qr-preview' });
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.detail || 'Failed to generate preview', { id: 'qr-preview' });
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleCreate = () => {
        // Validate based on type
        if (qrType === 'link' && !selectedLinkId) {
            toast.error('Please select a link', { id: 'qr-validation' });
            return;
        }
        if (!validateContentData()) return;

        const formData = new FormData();
        formData.append('qr_type', qrType);
        if (title) formData.append('title', title);
        formData.append('style', qrStyle);
        formData.append('frame', qrFrame);
        if (frameText) formData.append('frame_text', frameText);
        formData.append('foreground_color', fgColor);
        formData.append('background_color', bgColor);
        if (isDynamic) formData.append('is_dynamic', 'true');

        // Eye styling
        formData.append('eye_style', eyeStyle);
        if (eyeColor !== '#000000') formData.append('eye_color', eyeColor);

        // Gradient styling
        if (gradientEnabled) {
            formData.append('gradient_enabled', 'true');
            formData.append('gradient_start', gradientStart);
            formData.append('gradient_end', gradientEnd);
            formData.append('gradient_direction', gradientDirection);
        }

        if (qrType === 'link') {
            formData.append('link_id', selectedLinkId);
        } else {
            formData.append('content_data', JSON.stringify(contentData));
        }

        if (isDynamic && destinationUrl) {
            formData.append('destination_url', destinationUrl);
        }

        if (logoFile) formData.append('logo', logoFile);

        createMutation.mutate(formData);
    };

    const validateContentData = (): boolean => {
        const d = contentData as any;
        switch (qrType) {
            case 'link':
                // Validated separately via selectedLinkId
                break;
            case 'vcard':
                if (!d.name) { toast.error('Name is required', { id: 'qr-validation' }); return false; }
                break;
            case 'wifi':
                if (!d.ssid) { toast.error('Network name (SSID) is required', { id: 'qr-validation' }); return false; }
                break;
            case 'email':
                if (!d.email) { toast.error('Email address is required', { id: 'qr-validation' }); return false; }
                break;
            case 'sms':
            case 'phone':
                if (!d.phone) { toast.error('Phone number is required', { id: 'qr-validation' }); return false; }
                break;
            case 'text':
                if (!d.text) { toast.error('Text content is required', { id: 'qr-validation' }); return false; }
                break;
            case 'calendar':
                if (!d.title) { toast.error('Event title is required', { id: 'qr-validation' }); return false; }
                break;
            case 'location':
                if (!d.latitude || !d.longitude) { toast.error('Coordinates are required', { id: 'qr-validation' }); return false; }
                break;
            case 'upi':
                if (!d.pa) { toast.error('UPI ID is required', { id: 'qr-validation' }); return false; }
                if (!d.pn) { toast.error('Payee name is required', { id: 'qr-validation' }); return false; }
                break;
            case 'pix':
                if (!d.key) { toast.error('Pix key is required', { id: 'qr-validation' }); return false; }
                if (!d.name) { toast.error('Receiver name is required', { id: 'qr-validation' }); return false; }
                if (!d.city) { toast.error('City is required', { id: 'qr-validation' }); return false; }
                break;
            case 'product':
                if (!d.name) { toast.error('Product name is required', { id: 'qr-validation' }); return false; }
                if (!d.sku) { toast.error('Product SKU is required', { id: 'qr-validation' }); return false; }
                break;
            case 'menu':
                if (!d.restaurant_name) { toast.error('Restaurant name is required', { id: 'qr-validation' }); return false; }
                if (!d.menu_url) { toast.error('Menu URL is required', { id: 'qr-validation' }); return false; }
                break;
            case 'document':
                if (!d.title) { toast.error('Title is required', { id: 'qr-validation' }); return false; }
                if (!d.file_url) { toast.error('Document URL is required', { id: 'qr-validation' }); return false; }
                break;
            case 'pdf':
                if (!d.title) { toast.error('Title is required', { id: 'qr-validation' }); return false; }
                if (!d.pdf_url) { toast.error('PDF URL is required', { id: 'qr-validation' }); return false; }
                break;
            case 'multi_url':
                if (!d.title) { toast.error('Page title is required', { id: 'qr-validation' }); return false; }
                if (!d.links || d.links.length === 0) { toast.error('At least one link is required', { id: 'qr-validation' }); return false; }
                break;
            case 'app_store':
                if (!d.app_name) { toast.error('App name is required', { id: 'qr-validation' }); return false; }
                if (!d.ios_url && !d.android_url) { toast.error('At least one app store URL is required', { id: 'qr-validation' }); return false; }
                if (!d.fallback_url) { toast.error('Fallback URL is required', { id: 'qr-validation' }); return false; }
                break;
            case 'social':
                if (!d.title) { toast.error('Profile title is required', { id: 'qr-validation' }); return false; }
                if (!d.links || d.links.length === 0) { toast.error('At least one social link is required', { id: 'qr-validation' }); return false; }
                break;
            case 'serial':
                // Serial codes are auto-generated
                break;
        }
        return true;
    };

    const updateContentField = (key: string, value: any) => {
        setContentData(prev => ({ ...prev, [key]: value }));
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error('Logo must be less than 2MB', { id: 'qr-validation' });
                return;
            }
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const getPreviewValue = (): string => {
        const d = contentData as any;
        switch (qrType) {
            case 'link':
                return links.find((l: LinkType) => l.id === selectedLinkId)?.short_url || 'https://example.com';
            case 'vcard':
                return `BEGIN:VCARD\nFN:${d.name || 'Name'}\nEND:VCARD`;
            case 'wifi':
                return `WIFI:T:WPA;S:${d.ssid || 'Network'};;`;
            case 'email':
                return `mailto:${d.email || 'email@example.com'}`;
            case 'sms':
                return `SMSTO:${d.phone || '+1234567890'}`;
            case 'phone':
                return `tel:${d.phone || '+1234567890'}`;
            case 'text':
                return d.text || 'Your text here';
            case 'calendar':
                return `BEGIN:VEVENT\nSUMMARY:${d.title || 'Event'}\nEND:VEVENT`;
            case 'location':
                return `geo:${d.latitude || 0},${d.longitude || 0}`;
            case 'upi':
                return `upi://pay?pa=${d.pa || 'merchant@upi'}&pn=${d.pn || 'Merchant'}`;
            case 'pix':
                return d.key || 'pix-key';
            case 'product':
                return `Product: ${d.name || 'Product'} (${d.sku || 'SKU'})`;
            case 'menu':
                return d.menu_url || 'https://restaurant.com/menu';
            case 'document':
                return d.file_url || 'https://example.com/doc';
            case 'pdf':
                return d.pdf_url || 'https://example.com/doc.pdf';
            case 'app_store':
                return d.fallback_url || d.ios_url || d.android_url || 'https://myapp.com';
            case 'multi_url':
                return d.title || 'Multi Links';
            case 'social':
                return d.title || 'Social Hub';
            default:
                return 'Preview';
        }
    };

    const links = linksData?.results || [];
    const selectedLink = links.find((l: LinkType) => l.id === selectedLinkId);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        to="/dashboard/qr-codes"
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Create QR Code</h1>
                        <p className="text-gray-500 mt-0.5">Generate a QR code for any purpose</p>
                    </div>
                </div>
                <Button onClick={handleCreate} isLoading={createMutation.isPending} size="lg">
                    <QrCode className="w-4 h-4 mr-2" />
                    Create QR Code
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left Panel */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Step 1: QR Type */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold">1</span>
                                QR Code Type
                            </CardTitle>
                            <CardDescription>What kind of QR code do you want?</CardDescription>
                        </CardHeader>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            {QR_TYPES.map((item) => {
                                const Icon = item.icon;
                                const isLocked = (item.pro || item.business) && !isPaidPlan;
                                const badgeLabel = item.business ? 'BIZ' : item.pro ? 'PRO' : null;
                                return (
                                    <button
                                        key={item.type}
                                        onClick={() => {
                                            if (isLocked) {
                                                showUpgradeToast(item.label);
                                                return;
                                            }
                                            setQrType(item.type);
                                            setContentData({});
                                        }}
                                        className={`relative p-3 border-2 rounded-xl text-center transition-all ${qrType === item.type
                                            ? 'border-primary bg-primary-50 ring-2 ring-primary/20'
                                            : isLocked
                                                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {isLocked && <Lock className="w-3 h-3 absolute top-1 left-1 text-gray-400" />}
                                        <Icon className={`w-6 h-6 mx-auto mb-1 ${qrType === item.type ? 'text-primary' : isLocked ? 'text-gray-400' : 'text-gray-500'}`} />
                                        <span className={`text-xs font-medium block truncate ${isLocked ? 'text-gray-400' : ''}`}>{item.label}</span>
                                        {badgeLabel && <Badge variant="primary" className="text-[8px] absolute top-1 right-1 px-1">{badgeLabel}</Badge>}
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    {/* Step 2: Content */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold">2</span>
                                {QR_TYPES.find(t => t.type === qrType)?.label} Details
                            </CardTitle>
                        </CardHeader>
                        <div className="space-y-4">
                            {/* Title (optional for all) */}
                            <div>
                                <label className="label">Title (Optional)</label>
                                <Input
                                    placeholder="Give this QR code a name..."
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            {/* Dynamic QR toggle */}
                            <div className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 ${!isPaidPlan ? 'opacity-60' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <Zap className={`w-5 h-5 ${isDynamic ? 'text-primary' : 'text-gray-400'}`} />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Dynamic QR Code</p>
                                        <p className="text-xs text-gray-500">Change destination without reprinting</p>
                                    </div>
                                    <Badge variant="primary" className="text-xs">PRO</Badge>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isPaidPlan) {
                                            showUpgradeToast('Dynamic QR codes');
                                            return;
                                        }
                                        setIsDynamic(!isDynamic);
                                    }}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDynamic ? 'bg-primary' : 'bg-gray-300'} ${!isPaidPlan ? 'cursor-not-allowed' : ''}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDynamic ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {/* Destination URL for dynamic non-link QRs */}
                            {isDynamic && qrType !== 'link' && (
                                <div>
                                    <label className="label flex items-center gap-2">
                                        <Globe className="w-4 h-4" />
                                        Destination URL
                                    </label>
                                    <Input
                                        type="url"
                                        placeholder="https://example.com"
                                        value={destinationUrl}
                                        onChange={(e) => setDestinationUrl(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">The URL this QR code will redirect to. You can change this later.</p>
                                </div>
                            )}

                            {/* Type-specific fields */}
                            {qrType === 'link' && (
                                <div className="space-y-3">
                                    <label className="label">Select Link</label>
                                    <Input
                                        placeholder="Search links..."
                                        value={linkSearch}
                                        onChange={(e) => setLinkSearch(e.target.value)}
                                        leftIcon={<Search className="w-4 h-4" />}
                                        rightIcon={linkSearch ? (
                                            <button onClick={() => setLinkSearch('')}><X className="w-4 h-4" /></button>
                                        ) : undefined}
                                    />
                                    <div className="border rounded-xl max-h-48 overflow-y-auto">
                                        {linksLoading ? <div className="p-4 text-center"><Loading /></div> : links.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500 text-sm">No links found</div>
                                        ) : links.slice(0, 10).map((link: LinkType) => (
                                            <button
                                                key={link.id}
                                                onClick={() => setSelectedLinkId(link.id)}
                                                className={`w-full px-3 py-2 text-left border-b last:border-0 flex items-center justify-between ${selectedLinkId === link.id ? 'bg-primary-50' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{link.title || link.short_code}</p>
                                                    <p className="text-xs text-gray-500 truncate">{link.short_url}</p>
                                                </div>
                                                {selectedLinkId === link.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {qrType === 'vcard' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2"><label className="label">Full Name *</label><Input value={(contentData as any).name || ''} onChange={e => updateContentField('name', e.target.value)} placeholder="John Doe" /></div>
                                    <div><label className="label">Organization</label><Input value={(contentData as any).organization || ''} onChange={e => updateContentField('organization', e.target.value)} placeholder="Company" /></div>
                                    <div><label className="label">Job Title</label><Input value={(contentData as any).title || ''} onChange={e => updateContentField('title', e.target.value)} placeholder="Manager" /></div>
                                    <div><label className="label">Phone</label><Input value={(contentData as any).phone || ''} onChange={e => updateContentField('phone', e.target.value)} placeholder="+1234567890" /></div>
                                    <div><label className="label">Email</label><Input value={(contentData as any).email || ''} onChange={e => updateContentField('email', e.target.value)} placeholder="email@example.com" /></div>
                                    <div className="col-span-2"><label className="label">Website</label><Input value={(contentData as any).website || ''} onChange={e => updateContentField('website', e.target.value)} placeholder="https://example.com" /></div>
                                </div>
                            )}

                            {qrType === 'wifi' && (
                                <div className="space-y-3">
                                    <div><label className="label">Network Name (SSID) *</label><Input value={(contentData as any).ssid || ''} onChange={e => updateContentField('ssid', e.target.value)} placeholder="MyWiFi" /></div>
                                    <div><label className="label">Password</label><Input type="password" value={(contentData as any).password || ''} onChange={e => updateContentField('password', e.target.value)} placeholder="••••••••" /></div>
                                    <div>
                                        <label className="label">Security Type</label>
                                        <select className="input" value={(contentData as any).auth || 'WPA'} onChange={e => updateContentField('auth', e.target.value)}>
                                            <option value="WPA">WPA/WPA2</option>
                                            <option value="WEP">WEP</option>
                                            <option value="nopass">No Password</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {qrType === 'email' && (
                                <div className="space-y-3">
                                    <div><label className="label">Email Address *</label><Input value={(contentData as any).email || ''} onChange={e => updateContentField('email', e.target.value)} placeholder="recipient@example.com" /></div>
                                    <div><label className="label">Subject</label><Input value={(contentData as any).subject || ''} onChange={e => updateContentField('subject', e.target.value)} placeholder="Subject line" /></div>
                                    <div><label className="label">Message</label><textarea className="input min-h-[80px]" value={(contentData as any).body || ''} onChange={e => updateContentField('body', e.target.value)} placeholder="Email body..." /></div>
                                </div>
                            )}

                            {qrType === 'sms' && (
                                <div className="space-y-3">
                                    <div><label className="label">Phone Number *</label><Input value={(contentData as any).phone || ''} onChange={e => updateContentField('phone', e.target.value)} placeholder="+1234567890" /></div>
                                    <div><label className="label">Pre-filled Message</label><textarea className="input min-h-[80px]" value={(contentData as any).message || ''} onChange={e => updateContentField('message', e.target.value)} placeholder="Your message..." /></div>
                                </div>
                            )}

                            {qrType === 'phone' && (
                                <div><label className="label">Phone Number *</label><Input value={(contentData as any).phone || ''} onChange={e => updateContentField('phone', e.target.value)} placeholder="+1234567890" /></div>
                            )}

                            {qrType === 'text' && (
                                <div><label className="label">Text Content *</label><textarea className="input min-h-[120px]" value={(contentData as any).text || ''} onChange={e => updateContentField('text', e.target.value)} placeholder="Enter your text here..." /></div>
                            )}

                            {qrType === 'calendar' && (
                                <div className="space-y-3">
                                    <div><label className="label">Event Title *</label><Input value={(contentData as any).title || ''} onChange={e => updateContentField('title', e.target.value)} placeholder="Meeting" /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="label">Start Date & Time</label><Input type="datetime-local" value={(contentData as any).start || ''} onChange={e => updateContentField('start', e.target.value)} /></div>
                                        <div><label className="label">End Date & Time</label><Input type="datetime-local" value={(contentData as any).end || ''} onChange={e => updateContentField('end', e.target.value)} /></div>
                                    </div>
                                    <div><label className="label">Location</label><Input value={(contentData as any).location || ''} onChange={e => updateContentField('location', e.target.value)} placeholder="123 Main St" /></div>
                                    <div><label className="label">Description</label><textarea className="input" value={(contentData as any).description || ''} onChange={e => updateContentField('description', e.target.value)} placeholder="Event details..." /></div>
                                </div>
                            )}

                            {qrType === 'location' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="label">Latitude *</label><Input type="number" step="any" value={(contentData as any).latitude || ''} onChange={e => updateContentField('latitude', parseFloat(e.target.value))} placeholder="37.7749" /></div>
                                        <div><label className="label">Longitude *</label><Input type="number" step="any" value={(contentData as any).longitude || ''} onChange={e => updateContentField('longitude', parseFloat(e.target.value))} placeholder="-122.4194" /></div>
                                    </div>
                                    <div><label className="label">Location Name</label><Input value={(contentData as any).name || ''} onChange={e => updateContentField('name', e.target.value)} placeholder="Headquarters" /></div>
                                </div>
                            )}

                            {qrType === 'upi' && (
                                <div className="space-y-3">
                                    <div><label className="label">UPI ID (VPA) *</label><Input value={(contentData as any).pa || ''} onChange={e => updateContentField('pa', e.target.value)} placeholder="merchant@upi" /></div>
                                    <div><label className="label">Payee Name *</label><Input value={(contentData as any).pn || ''} onChange={e => updateContentField('pn', e.target.value)} placeholder="Store Name" /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="label">Amount</label><Input type="number" step="0.01" value={(contentData as any).am || ''} onChange={e => updateContentField('am', e.target.value)} placeholder="100.00" /></div>
                                        <div><label className="label">Currency</label><Input value={(contentData as any).cu || 'INR'} onChange={e => updateContentField('cu', e.target.value)} placeholder="INR" /></div>
                                    </div>
                                    <div><label className="label">Transaction Note</label><Input value={(contentData as any).tn || ''} onChange={e => updateContentField('tn', e.target.value)} placeholder="Payment for order" /></div>
                                </div>
                            )}

                            {qrType === 'pix' && (
                                <div className="space-y-3">
                                    <div><label className="label">Pix Key *</label><Input value={(contentData as any).key || ''} onChange={e => updateContentField('key', e.target.value)} placeholder="CPF, email, phone, or random key" /></div>
                                    <div><label className="label">Receiver Name *</label><Input value={(contentData as any).name || ''} onChange={e => updateContentField('name', e.target.value)} placeholder="Receiver Name" /></div>
                                    <div><label className="label">City *</label><Input value={(contentData as any).city || ''} onChange={e => updateContentField('city', e.target.value)} placeholder="São Paulo" /></div>
                                    <div><label className="label">Amount</label><Input type="number" step="0.01" value={(contentData as any).amount || ''} onChange={e => updateContentField('amount', e.target.value)} placeholder="50.00" /></div>
                                </div>
                            )}

                            {qrType === 'product' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="label">Product Name *</label><Input value={(contentData as any).name || ''} onChange={e => updateContentField('name', e.target.value)} placeholder="Widget Pro" /></div>
                                        <div><label className="label">SKU *</label><Input value={(contentData as any).sku || ''} onChange={e => updateContentField('sku', e.target.value)} placeholder="WGT-001" /></div>
                                    </div>
                                    <div><label className="label">Brand</label><Input value={(contentData as any).brand || ''} onChange={e => updateContentField('brand', e.target.value)} placeholder="Brand Name" /></div>
                                    <div><label className="label">Description</label><textarea className="input min-h-[80px]" value={(contentData as any).description || ''} onChange={e => updateContentField('description', e.target.value)} placeholder="Product description..." /></div>
                                    <div><label className="label">Buy URL</label><Input value={(contentData as any).buy_url || ''} onChange={e => updateContentField('buy_url', e.target.value)} placeholder="https://store.com/product" /></div>
                                </div>
                            )}

                            {qrType === 'menu' && (
                                <div className="space-y-3">
                                    <div><label className="label">Restaurant Name *</label><Input value={(contentData as any).restaurant_name || ''} onChange={e => updateContentField('restaurant_name', e.target.value)} placeholder="My Restaurant" /></div>
                                    <div><label className="label">Menu URL *</label><Input value={(contentData as any).menu_url || ''} onChange={e => updateContentField('menu_url', e.target.value)} placeholder="https://restaurant.com/menu" /></div>
                                    <div><label className="label">Logo URL</label><Input value={(contentData as any).logo_url || ''} onChange={e => updateContentField('logo_url', e.target.value)} placeholder="https://restaurant.com/logo.png" /></div>
                                </div>
                            )}

                            {(qrType === 'document' || qrType === 'pdf') && (
                                <div className="space-y-3">
                                    <div><label className="label">Title *</label><Input value={(contentData as any).title || ''} onChange={e => updateContentField('title', e.target.value)} placeholder="Document Title" /></div>
                                    <div><label className="label">{qrType === 'pdf' ? 'PDF URL *' : 'Document URL *'}</label><Input value={(contentData as any)[qrType === 'pdf' ? 'pdf_url' : 'file_url'] || ''} onChange={e => updateContentField(qrType === 'pdf' ? 'pdf_url' : 'file_url', e.target.value)} placeholder="https://example.com/document" /></div>
                                    <div><label className="label">Description</label><textarea className="input min-h-[60px]" value={(contentData as any).description || ''} onChange={e => updateContentField('description', e.target.value)} placeholder="Brief description..." /></div>
                                    {qrType === 'pdf' && (
                                        <div><label className="label">Author</label><Input value={(contentData as any).author || ''} onChange={e => updateContentField('author', e.target.value)} placeholder="Author Name" /></div>
                                    )}
                                </div>
                            )}

                            {qrType === 'app_store' && (
                                <div className="space-y-3">
                                    <div><label className="label">App Name *</label><Input value={(contentData as any).app_name || ''} onChange={e => updateContentField('app_name', e.target.value)} placeholder="My App" /></div>
                                    <div><label className="label">iOS App Store URL</label><Input value={(contentData as any).ios_url || ''} onChange={e => updateContentField('ios_url', e.target.value)} placeholder="https://apps.apple.com/app/..." /></div>
                                    <div><label className="label">Android Play Store URL</label><Input value={(contentData as any).android_url || ''} onChange={e => updateContentField('android_url', e.target.value)} placeholder="https://play.google.com/store/apps/..." /></div>
                                    <div><label className="label">Fallback URL *</label><Input value={(contentData as any).fallback_url || ''} onChange={e => updateContentField('fallback_url', e.target.value)} placeholder="https://myapp.com" /></div>
                                    <div><label className="label">Description</label><textarea className="input min-h-[60px]" value={(contentData as any).description || ''} onChange={e => updateContentField('description', e.target.value)} placeholder="App description..." /></div>
                                </div>
                            )}

                            {qrType === 'multi_url' && (
                                <div className="space-y-3">
                                    <div><label className="label">Page Title *</label><Input value={(contentData as any).title || ''} onChange={e => updateContentField('title', e.target.value)} placeholder="My Links" /></div>
                                    <div><label className="label">Subtitle</label><Input value={(contentData as any).subtitle || ''} onChange={e => updateContentField('subtitle', e.target.value)} placeholder="Check out my links" /></div>
                                    <div>
                                        <label className="label">Links *</label>
                                        {((contentData as any).links || []).map((link: any, idx: number) => (
                                            <div key={idx} className="flex gap-2 mb-2">
                                                <Input className="flex-1" value={link.label || ''} onChange={e => {
                                                    const links = [...((contentData as any).links || [])];
                                                    links[idx] = { ...links[idx], label: e.target.value };
                                                    updateContentField('links', links);
                                                }} placeholder="Label" />
                                                <Input className="flex-[2]" value={link.url || ''} onChange={e => {
                                                    const links = [...((contentData as any).links || [])];
                                                    links[idx] = { ...links[idx], url: e.target.value };
                                                    updateContentField('links', links);
                                                }} placeholder="https://..." />
                                                <button type="button" onClick={() => {
                                                    const links = [...((contentData as any).links || [])];
                                                    links.splice(idx, 1);
                                                    updateContentField('links', links);
                                                }} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => {
                                            const links = [...((contentData as any).links || []), { label: '', url: '' }];
                                            updateContentField('links', links);
                                        }} className="text-sm text-primary hover:underline">+ Add Link</button>
                                    </div>
                                </div>
                            )}

                            {qrType === 'social' && (
                                <div className="space-y-3">
                                    <div><label className="label">Profile Title *</label><Input value={(contentData as any).title || ''} onChange={e => updateContentField('title', e.target.value)} placeholder="My Social Profiles" /></div>
                                    <div><label className="label">Bio</label><textarea className="input min-h-[60px]" value={(contentData as any).bio || ''} onChange={e => updateContentField('bio', e.target.value)} placeholder="Short bio..." /></div>
                                    <div>
                                        <label className="label">Social Links *</label>
                                        {((contentData as any).links || []).map((link: any, idx: number) => (
                                            <div key={idx} className="flex gap-2 mb-2">
                                                <select className="input w-32" value={link.platform || ''} onChange={e => {
                                                    const links = [...((contentData as any).links || [])];
                                                    links[idx] = { ...links[idx], platform: e.target.value };
                                                    updateContentField('links', links);
                                                }}>
                                                    <option value="">Platform</option>
                                                    {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'github', 'website'].map(p => (
                                                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                                    ))}
                                                </select>
                                                <Input className="flex-1" value={link.url || ''} onChange={e => {
                                                    const links = [...((contentData as any).links || [])];
                                                    links[idx] = { ...links[idx], url: e.target.value };
                                                    updateContentField('links', links);
                                                }} placeholder="https://..." />
                                                <button type="button" onClick={() => {
                                                    const links = [...((contentData as any).links || [])];
                                                    links.splice(idx, 1);
                                                    updateContentField('links', links);
                                                }} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => {
                                            const links = [...((contentData as any).links || []), { platform: '', url: '' }];
                                            updateContentField('links', links);
                                        }} className="text-sm text-primary hover:underline">+ Add Social Link</button>
                                    </div>
                                </div>
                            )}

                            {qrType === 'serial' && (
                                <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                                    <p className="font-medium mb-1">Serial Code QR</p>
                                    <p>Serial QR codes are generated via the Serial Batches module. Use the Serial Batches page to create bulk product authentication codes.</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Step 3: Design */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold">3</span>
                                <Palette className="w-5 h-5" /> Design
                            </CardTitle>
                        </CardHeader>
                        <div className="space-y-5">
                            {/* Pattern */}
                            <div>
                                <label className="label mb-2">Pattern Style {!isPaidPlan && <span className="text-xs text-gray-400 ml-1">(Pro feature)</span>}</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['square', 'dots', 'rounded'] as const).map((style) => {
                                        const isStyleLocked = style !== 'square' && !isPaidPlan;
                                        return (
                                            <button
                                                key={style}
                                                onClick={() => {
                                                    if (isStyleLocked) {
                                                        showUpgradeToast('Custom QR styles');
                                                        return;
                                                    }
                                                    setQrStyle(style);
                                                }}
                                                className={`relative p-3 border-2 rounded-lg text-center ${qrStyle === style
                                                    ? 'border-primary bg-primary-50'
                                                    : isStyleLocked
                                                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                {isStyleLocked && <Lock className="w-3 h-3 absolute top-1 right-1 text-gray-400" />}
                                                <span className={`text-sm font-medium capitalize ${isStyleLocked ? 'text-gray-400' : ''}`}>{style}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Frame Selector - NEW */}
                            <div>
                                <label className="label mb-2">Frame <Badge variant="primary" className="text-xs ml-1">PRO</Badge></label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {FRAME_OPTIONS.map((frame) => {
                                        const Icon = frame.icon;
                                        const isFrameLocked = frame.id !== 'none' && !isPaidPlan;
                                        return (
                                            <button
                                                key={frame.id}
                                                onClick={() => {
                                                    if (isFrameLocked) {
                                                        showUpgradeToast('QR code frames');
                                                        return;
                                                    }
                                                    setQrFrame(frame.id);
                                                }}
                                                className={`relative p-3 border-2 rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${qrFrame === frame.id
                                                    ? 'border-primary bg-primary-50'
                                                    : isFrameLocked
                                                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                                        : 'border-gray-200 hover:bg-gray-50'
                                                    }`}
                                            >
                                                {isFrameLocked && <Lock className="w-3 h-3 absolute top-1 right-1 text-gray-400" />}
                                                <Icon className={`w-5 h-5 ${qrFrame === frame.id ? 'text-primary' : isFrameLocked ? 'text-gray-400' : 'text-gray-500'}`} />
                                                <span className={`text-xs font-medium ${isFrameLocked ? 'text-gray-400' : ''}`}>{frame.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {qrFrame !== 'none' && isPaidPlan && (
                                    <div className="mt-3">
                                        <label className="text-xs text-gray-500">Frame Text</label>
                                        <Input
                                            value={frameText}
                                            onChange={(e) => setFrameText(e.target.value)}
                                            placeholder="Custom frame label..."
                                            className="mt-1"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Colors */}
                            <div>
                                <label className="label mb-2">Colors {!isPaidPlan && <span className="text-xs text-gray-400 ml-1">(Pro feature)</span>}</label>
                                <div className="grid grid-cols-6 gap-2 mb-3">
                                    {COLOR_PRESETS.map((preset, index) => {
                                        // Only the first preset (Classic) is free
                                        const isColorLocked = index > 0 && !isPaidPlan;
                                        return (
                                            <button
                                                key={preset.name}
                                                onClick={() => {
                                                    if (isColorLocked) {
                                                        showUpgradeToast('Custom QR colors');
                                                        return;
                                                    }
                                                    setFgColor(preset.fg);
                                                    setBgColor(preset.bg);
                                                }}
                                                className={`relative p-2 border-2 rounded-lg ${fgColor === preset.fg && bgColor === preset.bg
                                                    ? 'border-primary'
                                                    : isColorLocked
                                                        ? 'border-gray-200 opacity-60 cursor-not-allowed'
                                                        : 'border-gray-200'
                                                    }`}
                                                title={preset.name}
                                            >
                                                {isColorLocked && <Lock className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-gray-400" />}
                                                <div className="w-full aspect-square rounded flex items-center justify-center" style={{ backgroundColor: preset.bg }}>
                                                    <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.fg }} />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className={`grid grid-cols-2 gap-3 ${!isPaidPlan ? 'opacity-60 pointer-events-none' : ''}`}>
                                    <div>
                                        <label className="text-xs text-gray-500">Foreground</label>
                                        <div className="flex gap-2 mt-1">
                                            <input
                                                type="color"
                                                value={fgColor}
                                                onChange={(e) => {
                                                    if (!isPaidPlan) {
                                                        showUpgradeToast('Custom QR colors');
                                                        return;
                                                    }
                                                    setFgColor(e.target.value);
                                                }}
                                                className={`w-10 h-9 rounded border-0 ${!isPaidPlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                disabled={!isPaidPlan}
                                            />
                                            <Input
                                                value={fgColor}
                                                onChange={(e) => setFgColor(e.target.value)}
                                                className="flex-1 font-mono text-sm"
                                                disabled={!isPaidPlan}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Background</label>
                                        <div className="flex gap-2 mt-1">
                                            <input
                                                type="color"
                                                value={bgColor}
                                                onChange={(e) => {
                                                    if (!isPaidPlan) {
                                                        showUpgradeToast('Custom QR colors');
                                                        return;
                                                    }
                                                    setBgColor(e.target.value);
                                                }}
                                                className={`w-10 h-9 rounded border-0 ${!isPaidPlan ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                disabled={!isPaidPlan}
                                            />
                                            <Input
                                                value={bgColor}
                                                onChange={(e) => setBgColor(e.target.value)}
                                                className="flex-1 font-mono text-sm"
                                                disabled={!isPaidPlan}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Logo */}
                            <div>
                                <label className="label mb-2">Logo <Badge variant="primary" className="text-xs ml-1">PRO</Badge></label>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={!isPaidPlan} />
                                {!logoPreview ? (
                                    <button
                                        onClick={() => {
                                            if (!isPaidPlan) {
                                                showUpgradeToast('Logo embedding');
                                                return;
                                            }
                                            fileInputRef.current?.click();
                                        }}
                                        className={`w-full p-4 border-2 border-dashed rounded-lg text-center ${!isPaidPlan
                                            ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                            : 'border-gray-300 hover:border-primary'
                                            }`}
                                    >
                                        {!isPaidPlan ? (
                                            <Lock className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                                        ) : (
                                            <Upload className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                                        )}
                                        <span className={`text-sm ${!isPaidPlan ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {!isPaidPlan ? 'Upgrade to add logo' : 'Upload logo'}
                                        </span>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded" />
                                        <span className="flex-1 text-sm truncate">{logoFile?.name}</span>
                                        <button onClick={removeLogo} className="p-1 text-gray-400 hover:text-danger"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                )}
                            </div>

                            {/* Eye Style */}
                            <div>
                                <label className="label mb-2">Eye Style <Badge variant="primary" className="text-xs ml-1">PRO</Badge></label>
                                <div className="grid grid-cols-5 gap-2">
                                    {EYE_STYLE_OPTIONS.map((opt) => {
                                        const isEyeLocked = opt.id !== 'square' && !isPaidPlan;
                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={() => {
                                                    if (isEyeLocked) {
                                                        showUpgradeToast('Eye styling');
                                                        return;
                                                    }
                                                    setEyeStyle(opt.id);
                                                }}
                                                className={`relative p-2 border-2 rounded-lg text-center ${eyeStyle === opt.id
                                                    ? 'border-primary bg-primary-50'
                                                    : isEyeLocked
                                                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                                        : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                {isEyeLocked && <Lock className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-gray-400" />}
                                                <Eye className={`w-4 h-4 mx-auto mb-1 ${eyeStyle === opt.id ? 'text-primary' : isEyeLocked ? 'text-gray-400' : 'text-gray-500'}`} />
                                                <span className={`text-xs ${isEyeLocked ? 'text-gray-400' : ''}`}>{opt.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {isPaidPlan && (
                                    <div className="flex items-center gap-2 mt-2">
                                        <label className="text-xs text-gray-500">Eye Color:</label>
                                        <input
                                            type="color"
                                            value={eyeColor}
                                            onChange={(e) => setEyeColor(e.target.value)}
                                            className="w-8 h-6 rounded border-0 cursor-pointer"
                                        />
                                        <Input
                                            value={eyeColor}
                                            onChange={(e) => setEyeColor(e.target.value)}
                                            className="flex-1 font-mono text-sm"
                                            placeholder="#000000"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Gradient */}
                            <div>
                                <label className="label mb-2">Gradient <Badge variant="primary" className="text-xs ml-1">BUSINESS</Badge></label>
                                <div className={`${!isPaidPlan ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded-full"
                                                style={{
                                                    background: gradientEnabled
                                                        ? `linear-gradient(to bottom, ${gradientStart}, ${gradientEnd})`
                                                        : '#ccc'
                                                }}
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">Enable Gradient</p>
                                                <p className="text-xs text-gray-500">Create smooth color transitions</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!isPaidPlan) {
                                                    showUpgradeToast('Gradient styling');
                                                    return;
                                                }
                                                setGradientEnabled(!gradientEnabled);
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${gradientEnabled ? 'bg-primary' : 'bg-gray-300'} ${!isPaidPlan ? 'cursor-not-allowed' : ''}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${gradientEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    {gradientEnabled && isPaidPlan && (
                                        <div className="mt-3 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-500">Start Color</label>
                                                    <div className="flex gap-2 mt-1">
                                                        <input
                                                            type="color"
                                                            value={gradientStart}
                                                            onChange={(e) => setGradientStart(e.target.value)}
                                                            className="w-10 h-9 rounded border-0 cursor-pointer"
                                                        />
                                                        <Input
                                                            value={gradientStart}
                                                            onChange={(e) => setGradientStart(e.target.value)}
                                                            className="flex-1 font-mono text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500">End Color</label>
                                                    <div className="flex gap-2 mt-1">
                                                        <input
                                                            type="color"
                                                            value={gradientEnd}
                                                            onChange={(e) => setGradientEnd(e.target.value)}
                                                            className="w-10 h-9 rounded border-0 cursor-pointer"
                                                        />
                                                        <Input
                                                            value={gradientEnd}
                                                            onChange={(e) => setGradientEnd(e.target.value)}
                                                            className="flex-1 font-mono text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500">Direction</label>
                                                <div className="grid grid-cols-4 gap-2 mt-1">
                                                    {GRADIENT_DIRECTIONS.map((dir) => (
                                                        <button
                                                            key={dir.id}
                                                            onClick={() => setGradientDirection(dir.id)}
                                                            className={`p-2 border-2 rounded-lg text-center text-xs ${gradientDirection === dir.id
                                                                ? 'border-primary bg-primary-50 text-primary'
                                                                : 'border-gray-200 hover:border-gray-300'
                                                                }`}
                                                        >
                                                            {dir.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Right Panel - Preview */}
                <div className="lg:col-span-2">
                    <div className="sticky top-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><QrCode className="w-5 h-5" /> Preview</CardTitle>
                            </CardHeader>
                            <div className="flex items-center justify-center p-6 rounded-xl border-2 border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
                                {serverPreviewUrl ? (
                                    <img src={serverPreviewUrl} alt="QR Preview" className="max-w-full h-auto" style={{ maxHeight: 200 }} />
                                ) : (
                                    <QRCodeGenerator
                                        value={getPreviewValue()}
                                        size={200}
                                        style={qrStyle}
                                        frame={qrFrame}
                                        fgColor={fgColor}
                                        bgColor={bgColor}
                                        level="H"
                                        logoUrl={logoPreview}
                                        title={title}
                                        frameText={frameText}
                                        eyeStyle={eyeStyle}
                                        eyeColor={eyeColor}
                                        gradientEnabled={gradientEnabled}
                                        gradientStart={gradientStart}
                                        gradientEnd={gradientEnd}
                                        gradientDirection={gradientDirection}
                                    />
                                )}
                            </div>
                            {/* Server Preview Button */}
                            {qrType === 'link' && selectedLinkId && (
                                <div className="mt-3 text-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleServerPreview}
                                        isLoading={isPreviewLoading}
                                        className="text-xs"
                                    >
                                        <Eye className="w-3 h-3 mr-1" />
                                        {serverPreviewUrl ? 'Refresh Server Preview' : 'Generate Server Preview'}
                                    </Button>
                                    {serverPreviewUrl && (
                                        <button
                                            onClick={() => setServerPreviewUrl(null)}
                                            className="ml-2 text-xs text-gray-500 hover:text-gray-700"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                                <p className="text-sm text-gray-500">{QR_TYPES.find(t => t.type === qrType)?.label}</p>
                                <p className="text-xs text-gray-400 mt-1 capitalize">
                                    {qrStyle} • {qrFrame !== 'none' ? `${qrFrame} Frame` : 'No Frame'}
                                </p>
                            </div>
                            <div className="mt-4 space-y-2">
                                <Button onClick={handleCreate} isLoading={createMutation.isPending} className="w-full">
                                    <QrCode className="w-4 h-4 mr-2" /> Create QR Code
                                </Button>
                                <Link to="/dashboard/qr-codes" className="block">
                                    <Button variant="ghost" className="w-full">Cancel</Button>
                                </Link>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

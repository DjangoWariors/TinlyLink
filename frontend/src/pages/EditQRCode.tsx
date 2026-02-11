import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft, Upload, QrCode, Check, Palette, Trash2, Save, Download,
    Square, Smartphone, Laptop, MessageSquare, User, Image, Maximize, Globe, Lock,
    Eye, Ticket, CreditCard, Tag, FileText
} from 'lucide-react';
import { QRCodeGenerator, QRFrame } from '@/components/QRCodeGenerator';
import type { QREyeStyle, QRGradientDirection } from '@/components/QRCodeGenerator';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Loading, Badge } from '@/components/common';
import { Input } from '@/components/common/Input';
import { qrCodesAPI, rulesAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import type { QRStyle, QREyeStyle as QREyeStyleType, QRGradientDirection as QRGradientDirectionType, Rule } from '@/types';

// Color presets
const COLOR_PRESETS = [
    { name: 'Classic', fg: '#000000', bg: '#FFFFFF' },
    { name: 'Midnight', fg: '#1e293b', bg: '#f8fafc' },
    { name: 'Ocean', fg: '#0369a1', bg: '#f0f9ff' },
    { name: 'Forest', fg: '#15803d', bg: '#f0fdf4' },
    { name: 'Berry', fg: '#9333ea', bg: '#faf5ff' },
    { name: 'Sunset', fg: '#ea580c', bg: '#fff7ed' },
    { name: 'Rose', fg: '#e11d48', bg: '#fff1f2' },
    { name: 'Slate', fg: '#475569', bg: '#f1f5f9' },
    { name: 'Inverted', fg: '#FFFFFF', bg: '#18181b' },
    { name: 'Navy', fg: '#60a5fa', bg: '#1e3a5f' },
];

// Frame options
const FRAME_OPTIONS: Array<{ id: QRFrame; label: string; icon: React.ElementType }> = [
    { id: 'none', label: 'None', icon: Maximize },
    { id: 'simple', label: 'Simple', icon: Maximize },
    { id: 'scan_me', label: 'Scan Me', icon: QrCode },
    { id: 'balloon', label: 'Balloon', icon: MessageSquare },
    { id: 'badge', label: 'Badge', icon: User },
    { id: 'phone', label: 'Phone', icon: Smartphone },
    { id: 'polaroid', label: 'Polaroid', icon: Image },
    { id: 'laptop', label: 'Laptop', icon: Laptop },
    { id: 'ticket', label: 'Ticket', icon: Ticket },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'tag', label: 'Tag', icon: Tag },
    { id: 'certificate', label: 'Certificate', icon: FileText },
];

// Eye style options
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

export function EditQRCodePage() {
    const { id } = useParams<{ id: string }>();
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
            { duration: 4000, icon: '🔒' }
        );
    };

    // Form state
    const [qrStyle, setQrStyle] = useState<QRStyle>('square');
    const [qrFrame, setQrFrame] = useState<QRFrame>('none');
    const [fgColor, setFgColor] = useState('#000000');
    const [bgColor, setBgColor] = useState('#FFFFFF');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [removeLogo, setRemoveLogo] = useState(false);
    const [destinationUrl, setDestinationUrl] = useState('');
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
    const [hasChanges, setHasChanges] = useState(false);

    // Fetch QR code details
    const { data: qrCode, isLoading } = useQuery({
        queryKey: ['qrCode', id],
        queryFn: () => qrCodesAPI.getQRCode(id!),
        enabled: !!id,
    });

    // Fetch rules associated with this QR code using getForQRCode
    const { data: linkedRules, isLoading: rulesLoading } = useQuery({
        queryKey: ['rulesForQRCode', id],
        queryFn: () => rulesAPI.getForQRCode(id!),
        enabled: !!id,
    });

    // Initialize form with fetched data
    useEffect(() => {
        if (qrCode) {
            setQrStyle(qrCode.style as QRStyle);
            setQrFrame((qrCode.frame as QRFrame) || 'none');
            setFgColor(qrCode.foreground_color);
            setBgColor(qrCode.background_color);
            if (qrCode.logo_url) {
                setLogoPreview(qrCode.logo_url);
            }
            if (qrCode.is_dynamic) {
                setDestinationUrl(qrCode.destination_url || qrCode.link_original_url || '');
            }
            // Eye styling
            setEyeStyle((qrCode.eye_style as QREyeStyle) || 'square');
            setEyeColor(qrCode.eye_color || '#000000');
            // Gradient
            setGradientEnabled(qrCode.gradient_enabled || false);
            setGradientStart(qrCode.gradient_start || '#000000');
            setGradientEnd(qrCode.gradient_end || '#666666');
            setGradientDirection((qrCode.gradient_direction as QRGradientDirection) || 'vertical');
            // Frame text
            setFrameText(qrCode.frame_text || '');
        }
    }, [qrCode]);

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: (formData: FormData) => qrCodesAPI.updateQRCode(id!, formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['qrCodes'] });
            queryClient.invalidateQueries({ queryKey: ['qrCode', id] });
            toast.success('QR code updated successfully!');
            navigate('/dashboard/qr-codes');
        },
        onError: (error: any) => {
            const message = error.response?.data?.detail ||
                error.response?.data?.error ||
                'Failed to update QR code';
            toast.error(message);
        },
    });

    const handleSave = () => {
        const formData = new FormData();
        formData.append('style', qrStyle);
        formData.append('frame', qrFrame);
        if (frameText) formData.append('frame_text', frameText);
        formData.append('foreground_color', fgColor);
        formData.append('background_color', bgColor);

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

        if (logoFile) {
            formData.append('logo', logoFile);
        } else if (removeLogo) {
            formData.append('remove_logo', 'true');
        }

        if (qrCode?.is_dynamic) {
            formData.append('destination_url', destinationUrl);
        }

        updateMutation.mutate(formData);
    };

    // ... (rest of methods)

    // Track changes
    useEffect(() => {
        if (qrCode) {
            const originalDestination = qrCode.destination_url || qrCode.link_original_url || '';
            const changed =
                qrStyle !== qrCode.style ||
                qrFrame !== (qrCode.frame || 'none') ||
                fgColor !== qrCode.foreground_color ||
                bgColor !== qrCode.background_color ||
                logoFile !== null ||
                removeLogo ||
                (qrCode.is_dynamic && destinationUrl !== originalDestination) ||
                eyeStyle !== (qrCode.eye_style || 'square') ||
                eyeColor !== (qrCode.eye_color || '#000000') ||
                gradientEnabled !== (qrCode.gradient_enabled || false) ||
                gradientStart !== (qrCode.gradient_start || '#000000') ||
                gradientEnd !== (qrCode.gradient_end || '#666666') ||
                gradientDirection !== (qrCode.gradient_direction || 'vertical') ||
                frameText !== (qrCode.frame_text || '');
            setHasChanges(changed);
        }
    }, [qrStyle, qrFrame, fgColor, bgColor, logoFile, removeLogo, destinationUrl, qrCode,
        eyeStyle, eyeColor, gradientEnabled, gradientStart, gradientEnd, gradientDirection, frameText]);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error('Logo must be less than 2MB');
                return;
            }
            setLogoFile(file);
            setRemoveLogo(false);
            setHasChanges(true);
            const reader = new FileReader();
            reader.onloadend = () => setLogoPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview('');
        setRemoveLogo(true);
        setHasChanges(true);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const applyColorPreset = (preset: { fg: string; bg: string }) => {
        setFgColor(preset.fg);
        setBgColor(preset.bg);
        setHasChanges(true);
    };

    const handleDownload = async (format: 'png' | 'svg') => {
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loading size="lg" />
            </div>
        );
    }

    if (!qrCode) {
        return (
            <div className="text-center py-16">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h2 className="text-xl font-semibold text-gray-900">QR Code not found</h2>
                <Link to="/dashboard/qr-codes" className="text-primary hover:underline mt-2 inline-block">
                    Go back to QR codes
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6">
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
                        <h1 className="text-2xl font-bold text-gray-900">Edit QR Code</h1>
                        <p className="text-gray-500 mt-0.5 font-mono text-sm">{qrCode.short_url}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleDownload('png')}>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                    </Button>
                    <Button
                        onClick={handleSave}
                        isLoading={updateMutation.isPending}
                        disabled={!hasChanges}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left - Configuration (3 cols) */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Destination URL - only for dynamic QRs */}
                    {qrCode.is_dynamic && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Globe className="w-5 h-5" />
                                    Destination URL
                                </CardTitle>
                                <CardDescription>
                                    Change where this QR code redirects without reprinting it
                                </CardDescription>
                            </CardHeader>
                            <div>
                                <Input
                                    type="url"
                                    placeholder="https://example.com"
                                    value={destinationUrl}
                                    onChange={(e) => { setDestinationUrl(e.target.value); setHasChanges(true); }}
                                />
                            </div>
                        </Card>
                    )}

                    {/* Style */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Pattern Style {!isPaidPlan && <span className="text-xs text-gray-400 ml-1">(Pro feature)</span>}</CardTitle>
                        </CardHeader>
                        <div className="grid grid-cols-3 gap-4">
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
                                            setHasChanges(true);
                                        }}
                                        className={`relative p-5 border-2 rounded-xl text-center transition-all ${qrStyle === style
                                            ? 'border-primary bg-primary-50 ring-2 ring-primary/20'
                                            : isStyleLocked
                                                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {isStyleLocked && <Lock className="w-3 h-3 absolute top-2 left-2 text-gray-400" />}
                                        <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                                            <div className="grid grid-cols-3 gap-0.5">
                                                {[...Array(9)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-3 h-3 ${[0, 1, 3, 4, 6, 8].includes(i) ? (isStyleLocked ? 'bg-gray-400' : 'bg-gray-800') : 'bg-gray-200'} ${style === 'dots' ? 'rounded-full' : style === 'rounded' ? 'rounded-sm' : ''
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <span className={`text-sm font-semibold capitalize ${isStyleLocked ? 'text-gray-400' : ''}`}>{style}</span>
                                        {qrStyle === style && (
                                            <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    {/* Frame Selector */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 mb-3 block">Frame <Badge variant="primary" className="text-xs ml-1">PRO</Badge></label>
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
                                            setHasChanges(true);
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
                                    onChange={(e) => { setFrameText(e.target.value); setHasChanges(true); }}
                                    placeholder="Custom frame label..."
                                    className="mt-1"
                                />
                            </div>
                        )}
                    </div>

                    {/* Eye Style */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Eye className="w-5 h-5" />
                                Eye Style
                                <Badge variant="default" className="text-xs ml-1">Pro</Badge>
                            </CardTitle>
                        </CardHeader>
                        <div className="space-y-3">
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
                                                setHasChanges(true);
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
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-500">Eye Color:</label>
                                    <input
                                        type="color"
                                        value={eyeColor}
                                        onChange={(e) => { setEyeColor(e.target.value); setHasChanges(true); }}
                                        className="w-8 h-6 rounded border-0 cursor-pointer"
                                    />
                                    <Input
                                        value={eyeColor}
                                        onChange={(e) => { setEyeColor(e.target.value); setHasChanges(true); }}
                                        className="flex-1 font-mono text-sm"
                                        placeholder="#000000"
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Gradient */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Gradient
                                <Badge variant="default" className="text-xs ml-1">Business</Badge>
                            </CardTitle>
                        </CardHeader>
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
                                        setHasChanges(true);
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
                                                    onChange={(e) => { setGradientStart(e.target.value); setHasChanges(true); }}
                                                    className="w-10 h-9 rounded border-0 cursor-pointer"
                                                />
                                                <Input
                                                    value={gradientStart}
                                                    onChange={(e) => { setGradientStart(e.target.value); setHasChanges(true); }}
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
                                                    onChange={(e) => { setGradientEnd(e.target.value); setHasChanges(true); }}
                                                    className="w-10 h-9 rounded border-0 cursor-pointer"
                                                />
                                                <Input
                                                    value={gradientEnd}
                                                    onChange={(e) => { setGradientEnd(e.target.value); setHasChanges(true); }}
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
                                                    onClick={() => { setGradientDirection(dir.id); setHasChanges(true); }}
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
                    </Card>

                    {/* Colors */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Palette className="w-5 h-5" />
                                Colors
                            </CardTitle>
                        </CardHeader>
                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-3 block">Quick Presets</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {COLOR_PRESETS.map((preset) => (
                                        <button
                                            key={preset.name}
                                            onClick={() => applyColorPreset(preset)}
                                            className={`group p-2 border-2 rounded-xl transition-all hover:scale-105 ${fgColor === preset.fg && bgColor === preset.bg
                                                ? 'border-primary shadow-md'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            title={preset.name}
                                        >
                                            <div
                                                className="w-full aspect-square rounded-lg flex items-center justify-center"
                                                style={{ backgroundColor: preset.bg }}
                                            >
                                                <div className="w-5 h-5 rounded" style={{ backgroundColor: preset.fg }} />
                                            </div>
                                            <p className="text-[10px] text-center mt-1.5 truncate text-gray-600 font-medium">{preset.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Foreground</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={fgColor}
                                            onChange={(e) => { setFgColor(e.target.value); setHasChanges(true); }}
                                            className="w-14 h-11 rounded-lg cursor-pointer border-2 border-gray-200"
                                        />
                                        <Input
                                            value={fgColor}
                                            onChange={(e) => { setFgColor(e.target.value); setHasChanges(true); }}
                                            className="flex-1 font-mono text-sm uppercase"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 mb-2 block">Background</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={bgColor}
                                            onChange={(e) => { setBgColor(e.target.value); setHasChanges(true); }}
                                            className="w-14 h-11 rounded-lg cursor-pointer border-2 border-gray-200"
                                        />
                                        <Input
                                            value={bgColor}
                                            onChange={(e) => { setBgColor(e.target.value); setHasChanges(true); }}
                                            className="flex-1 font-mono text-sm uppercase"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Logo */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                Logo
                                <Badge variant="default" className="text-xs ml-1">Pro</Badge>
                            </CardTitle>
                            <CardDescription>Add or change the logo in your QR code</CardDescription>
                        </CardHeader>
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                onChange={handleLogoUpload}
                                className="hidden"
                            />

                            {!logoPreview ? (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-8 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary hover:bg-primary-50/30 transition-all text-center group"
                                >
                                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gray-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                        <Upload className="w-7 h-7 text-gray-400 group-hover:text-primary transition-colors" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-700 group-hover:text-primary">
                                        Click to upload logo
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">PNG, JPEG, SVG, WebP • Max 2MB</p>
                                </button>
                            ) : (
                                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
                                        <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900">
                                            {logoFile ? logoFile.name : 'Current logo'}
                                        </p>
                                        {logoFile && (
                                            <p className="text-xs text-gray-500">{((logoFile.size) / 1024).toFixed(1)} KB</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                                            Change
                                        </Button>
                                        <button
                                            onClick={handleRemoveLogo}
                                            className="p-2 text-gray-400 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Associated Rules Section - using getForQRCode API */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Square className="w-5 h-5" />
                                    Smart Rules
                                </CardTitle>
                                <Link to={`/dashboard/rules/new?qr_code=${id}`}>
                                    <Button variant="ghost" size="sm">Add Rule</Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <div>
                            {rulesLoading ? (
                                <div className="flex justify-center py-4"><Loading /></div>
                            ) : !linkedRules || linkedRules.length === 0 ? (
                                <p className="text-sm text-gray-400 text-center py-4">No rules configured for this QR code</p>
                            ) : (
                                <div className="space-y-2">
                                    {linkedRules.map((rule: Rule) => (
                                        <div key={rule.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <Badge variant={rule.is_active ? 'success' : 'default'}>
                                                    {rule.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                                <span className="font-medium text-gray-900">{rule.name}</span>
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

                {/* Right - Preview (2 cols) */}
                <div className="lg:col-span-2">
                    <div className="sticky top-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <QrCode className="w-5 h-5" />
                                    Preview
                                </CardTitle>
                            </CardHeader>
                            <div
                                className="flex items-center justify-center p-8 rounded-xl border-2 border-gray-100"
                                style={{ backgroundColor: '#f8fafc' }}
                            >
                                <QRCodeGenerator
                                    value={qrCode.short_url}
                                    size={220}
                                    style={qrStyle}
                                    frame={qrFrame}
                                    fgColor={fgColor}
                                    bgColor={bgColor}
                                    level="H"
                                    logoUrl={logoPreview}
                                    title={qrCode.title || 'Scan Me'}
                                    frameText={frameText}
                                    eyeStyle={eyeStyle}
                                    eyeColor={eyeColor}
                                    gradientEnabled={gradientEnabled}
                                    gradientStart={gradientStart}
                                    gradientEnd={gradientEnd}
                                    gradientDirection={gradientDirection}
                                />
                            </div>

                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Link:</span>
                                    <span className="font-medium text-gray-900 truncate ml-2">{qrCode.link_short_code}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-gray-500">Scans:</span>
                                    <span className="font-medium text-gray-900">{qrCode.total_scans.toLocaleString()}</span>
                                </div>
                            </div>

                            {hasChanges && (
                                <div className="mt-4 p-3 bg-warning/10 rounded-lg border border-warning/30 text-sm text-warning-dark">
                                    You have unsaved changes
                                </div>
                            )}

                            <div className="mt-6 space-y-3">
                                <Button
                                    onClick={handleSave}
                                    isLoading={updateMutation.isPending}
                                    disabled={!hasChanges}
                                    className="w-full"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Changes
                                </Button>
                                <Link to="/dashboard/qr-codes" className="block">
                                    <Button variant="ghost" className="w-full">
                                        Cancel
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

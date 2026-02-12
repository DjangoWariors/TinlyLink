import React from 'react';
import {
    Palette, Lock, Upload, Trash2, Eye
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Badge } from '@/components/common';
import { Input } from '@/components/common/Input';
import type { QRDesignState, QRDesignActions } from '@/hooks/useQRDesign';
import type { QRStyle, QREyeStyle, QRGradientDirection, QRFrame } from '@/types';

// Same constants used in both Create and Edit
export const COLOR_PRESETS = [
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

export const FRAME_OPTIONS: Array<{ id: QRFrame; label: string }> = [
    { id: 'none', label: 'None' },
    { id: 'simple', label: 'Simple' },
    { id: 'scan_me', label: 'Scan Me' },
    { id: 'balloon', label: 'Balloon' },
    { id: 'badge', label: 'Badge' },
    { id: 'phone', label: 'Phone' },
    { id: 'polaroid', label: 'Polaroid' },
    { id: 'laptop', label: 'Laptop' },
    { id: 'ticket', label: 'Ticket' },
    { id: 'card', label: 'Card' },
    { id: 'tag', label: 'Tag' },
    { id: 'certificate', label: 'Certificate' },
];

export const EYE_STYLE_OPTIONS: Array<{ id: QREyeStyle; label: string }> = [
    { id: 'square', label: 'Square' },
    { id: 'circle', label: 'Circle' },
    { id: 'rounded', label: 'Rounded' },
    { id: 'leaf', label: 'Leaf' },
    { id: 'diamond', label: 'Diamond' },
];

export const GRADIENT_DIRECTIONS: Array<{ id: QRGradientDirection; label: string }> = [
    { id: 'vertical', label: 'Vertical' },
    { id: 'horizontal', label: 'Horizontal' },
    { id: 'diagonal', label: 'Diagonal' },
    { id: 'radial', label: 'Radial' },
];

interface QRDesignPanelProps {
    design: QRDesignState;
    actions: QRDesignActions;
    isPaidPlan: boolean;
    showUpgradeToast: (feature: string) => void;
    /** Optional callback on every change (for Edit page's hasChanges tracking) */
    onChange?: () => void;
}

export function QRDesignPanel({
    design, actions, isPaidPlan, showUpgradeToast, onChange,
}: QRDesignPanelProps) {
    const wrap = <T,>(setter: (v: T) => void) => (v: T) => {
        setter(v);
        onChange?.();
    };

    return (
        <div className="space-y-6">
            {/* Pattern Style */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="w-5 h-5" /> Design
                    </CardTitle>
                </CardHeader>
                <div className="space-y-5">
                    {/* Pattern */}
                    <div>
                        <label className="label mb-2">Pattern Style {!isPaidPlan && <span className="text-xs text-gray-400 ml-1">(Pro feature)</span>}</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['square', 'dots', 'rounded'] as const).map((style) => {
                                const isLocked = style !== 'square' && !isPaidPlan;
                                return (
                                    <button
                                        key={style}
                                        onClick={() => {
                                            if (isLocked) { showUpgradeToast('Custom QR styles'); return; }
                                            wrap(actions.setQrStyle)(style);
                                        }}
                                        className={`relative p-3 border-2 rounded-lg text-center ${design.qrStyle === style
                                            ? 'border-primary bg-primary-50'
                                            : isLocked ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        {isLocked && <Lock className="w-3 h-3 absolute top-1 right-1 text-gray-400" />}
                                        <span className={`text-sm font-medium capitalize ${isLocked ? 'text-gray-400' : ''}`}>{style}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Frame */}
                    <FrameSelector
                        value={design.qrFrame}
                        frameText={design.frameText}
                        isPaidPlan={isPaidPlan}
                        showUpgradeToast={showUpgradeToast}
                        onFrameChange={wrap(actions.setQrFrame)}
                        onFrameTextChange={wrap(actions.setFrameText)}
                    />

                    {/* Colors */}
                    <ColorSection
                        fgColor={design.fgColor}
                        bgColor={design.bgColor}
                        isPaidPlan={isPaidPlan}
                        showUpgradeToast={showUpgradeToast}
                        onFgChange={wrap(actions.setFgColor)}
                        onBgChange={wrap(actions.setBgColor)}
                        onPresetApply={(fg, bg) => { actions.applyColorPreset(fg, bg); onChange?.(); }}
                    />

                    {/* Logo */}
                    <LogoSection
                        logoPreview={design.logoPreview}
                        logoFile={design.logoFile}
                        isPaidPlan={isPaidPlan}
                        showUpgradeToast={showUpgradeToast}
                        fileInputRef={actions.fileInputRef}
                        onUpload={(e) => { actions.handleLogoUpload(e); onChange?.(); }}
                        onRemove={() => { actions.removeLogo(); onChange?.(); }}
                    />

                    {/* Eye Style */}
                    <EyeSection
                        eyeStyle={design.eyeStyle}
                        eyeColor={design.eyeColor}
                        isPaidPlan={isPaidPlan}
                        showUpgradeToast={showUpgradeToast}
                        onStyleChange={wrap(actions.setEyeStyle)}
                        onColorChange={wrap(actions.setEyeColor)}
                    />

                    {/* Gradient */}
                    <GradientSection
                        enabled={design.gradientEnabled}
                        start={design.gradientStart}
                        end={design.gradientEnd}
                        direction={design.gradientDirection}
                        isPaidPlan={isPaidPlan}
                        showUpgradeToast={showUpgradeToast}
                        onEnabledChange={wrap(actions.setGradientEnabled)}
                        onStartChange={wrap(actions.setGradientStart)}
                        onEndChange={wrap(actions.setGradientEnd)}
                        onDirectionChange={wrap(actions.setGradientDirection)}
                    />
                </div>
            </Card>
        </div>
    );
}

/* ── Sub-sections ──────────────────────────────────────────────── */

function FrameSelector({ value, frameText, isPaidPlan, showUpgradeToast, onFrameChange, onFrameTextChange }: {
    value: QRFrame; frameText: string; isPaidPlan: boolean;
    showUpgradeToast: (f: string) => void;
    onFrameChange: (f: QRFrame) => void; onFrameTextChange: (t: string) => void;
}) {
    return (
        <div>
            <label className="label mb-2">Frame <Badge variant="primary" className="text-xs ml-1">PRO</Badge></label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FRAME_OPTIONS.map((frame) => {
                    const isLocked = frame.id !== 'none' && !isPaidPlan;
                    return (
                        <button
                            key={frame.id}
                            onClick={() => {
                                if (isLocked) { showUpgradeToast('QR code frames'); return; }
                                onFrameChange(frame.id);
                            }}
                            className={`relative p-3 border-2 rounded-lg flex flex-col items-center justify-center gap-2 transition-all ${value === frame.id
                                ? 'border-primary bg-primary-50'
                                : isLocked ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {isLocked && <Lock className="w-3 h-3 absolute top-1 right-1 text-gray-400" />}
                            <span className={`text-xs font-medium ${isLocked ? 'text-gray-400' : ''}`}>{frame.label}</span>
                        </button>
                    );
                })}
            </div>
            {value !== 'none' && isPaidPlan && (
                <div className="mt-3">
                    <label className="text-xs text-gray-500">Frame Text</label>
                    <Input
                        value={frameText}
                        onChange={(e) => onFrameTextChange(e.target.value)}
                        placeholder="Custom frame label..."
                        className="mt-1"
                    />
                </div>
            )}
        </div>
    );
}

function ColorSection({ fgColor, bgColor, isPaidPlan, showUpgradeToast, onFgChange, onBgChange, onPresetApply }: {
    fgColor: string; bgColor: string; isPaidPlan: boolean;
    showUpgradeToast: (f: string) => void;
    onFgChange: (c: string) => void; onBgChange: (c: string) => void;
    onPresetApply: (fg: string, bg: string) => void;
}) {
    return (
        <div>
            <label className="label mb-2">Colors {!isPaidPlan && <span className="text-xs text-gray-400 ml-1">(Pro feature)</span>}</label>
            <div className="grid grid-cols-5 gap-2 mb-3">
                {COLOR_PRESETS.map((preset, index) => {
                    const isLocked = index > 0 && !isPaidPlan;
                    return (
                        <button
                            key={preset.name}
                            onClick={() => {
                                if (isLocked) { showUpgradeToast('Custom QR colors'); return; }
                                onPresetApply(preset.fg, preset.bg);
                            }}
                            className={`relative p-2 border-2 rounded-lg ${fgColor === preset.fg && bgColor === preset.bg
                                ? 'border-primary shadow-md'
                                : isLocked ? 'border-gray-200 opacity-60 cursor-not-allowed' : 'border-gray-200'
                            }`}
                            title={preset.name}
                        >
                            {isLocked && <Lock className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-gray-400" />}
                            <div className="w-full aspect-square rounded flex items-center justify-center" style={{ backgroundColor: preset.bg }}>
                                <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.fg }} />
                            </div>
                            <p className="text-[10px] text-center mt-1 truncate text-gray-600">{preset.name}</p>
                        </button>
                    );
                })}
            </div>
            <div className={`grid grid-cols-2 gap-3 ${!isPaidPlan ? 'opacity-60 pointer-events-none' : ''}`}>
                <div>
                    <label className="text-xs text-gray-500">Foreground</label>
                    <div className="flex gap-2 mt-1">
                        <input type="color" value={fgColor} onChange={(e) => onFgChange(e.target.value)}
                            className="w-10 h-9 rounded border-0 cursor-pointer" disabled={!isPaidPlan} />
                        <Input value={fgColor} onChange={(e) => onFgChange(e.target.value)}
                            className="flex-1 font-mono text-sm" disabled={!isPaidPlan} />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-500">Background</label>
                    <div className="flex gap-2 mt-1">
                        <input type="color" value={bgColor} onChange={(e) => onBgChange(e.target.value)}
                            className="w-10 h-9 rounded border-0 cursor-pointer" disabled={!isPaidPlan} />
                        <Input value={bgColor} onChange={(e) => onBgChange(e.target.value)}
                            className="flex-1 font-mono text-sm" disabled={!isPaidPlan} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function LogoSection({ logoPreview, logoFile, isPaidPlan, showUpgradeToast, fileInputRef, onUpload, onRemove }: {
    logoPreview: string; logoFile: File | null; isPaidPlan: boolean;
    showUpgradeToast: (f: string) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
}) {
    return (
        <div>
            <label className="label mb-2">Logo <Badge variant="primary" className="text-xs ml-1">PRO</Badge></label>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onUpload} className="hidden" disabled={!isPaidPlan} />
            {!logoPreview ? (
                <button
                    onClick={() => {
                        if (!isPaidPlan) { showUpgradeToast('Logo embedding'); return; }
                        fileInputRef.current?.click();
                    }}
                    className={`w-full p-4 border-2 border-dashed rounded-lg text-center ${!isPaidPlan
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-300 hover:border-primary'
                    }`}
                >
                    {!isPaidPlan
                        ? <Lock className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                        : <Upload className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                    }
                    <span className={`text-sm ${!isPaidPlan ? 'text-gray-400' : 'text-gray-600'}`}>
                        {!isPaidPlan ? 'Upgrade to add logo' : 'Upload logo'}
                    </span>
                </button>
            ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <img src={logoPreview} alt="Logo" className="w-12 h-12 object-contain rounded" />
                    <span className="flex-1 text-sm truncate">{logoFile?.name || 'Current logo'}</span>
                    <button onClick={onRemove} className="p-1 text-gray-400 hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

function EyeSection({ eyeStyle, eyeColor, isPaidPlan, showUpgradeToast, onStyleChange, onColorChange }: {
    eyeStyle: QREyeStyle; eyeColor: string; isPaidPlan: boolean;
    showUpgradeToast: (f: string) => void;
    onStyleChange: (s: QREyeStyle) => void; onColorChange: (c: string) => void;
}) {
    return (
        <div>
            <label className="label mb-2">Eye Style <Badge variant="primary" className="text-xs ml-1">PRO</Badge></label>
            <div className="grid grid-cols-5 gap-2">
                {EYE_STYLE_OPTIONS.map((opt) => {
                    const isLocked = opt.id !== 'square' && !isPaidPlan;
                    return (
                        <button
                            key={opt.id}
                            onClick={() => {
                                if (isLocked) { showUpgradeToast('Eye styling'); return; }
                                onStyleChange(opt.id);
                            }}
                            className={`relative p-2 border-2 rounded-lg text-center ${eyeStyle === opt.id
                                ? 'border-primary bg-primary-50'
                                : isLocked ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            {isLocked && <Lock className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-gray-400" />}
                            <Eye className={`w-4 h-4 mx-auto mb-1 ${eyeStyle === opt.id ? 'text-primary' : isLocked ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-xs ${isLocked ? 'text-gray-400' : ''}`}>{opt.label}</span>
                        </button>
                    );
                })}
            </div>
            {isPaidPlan && (
                <div className="flex items-center gap-2 mt-2">
                    <label className="text-xs text-gray-500">Eye Color:</label>
                    <input type="color" value={eyeColor} onChange={(e) => onColorChange(e.target.value)}
                        className="w-8 h-6 rounded border-0 cursor-pointer" />
                    <Input value={eyeColor} onChange={(e) => onColorChange(e.target.value)}
                        className="flex-1 font-mono text-sm" placeholder="#000000" />
                </div>
            )}
        </div>
    );
}

function GradientSection({ enabled, start, end, direction, isPaidPlan, showUpgradeToast,
    onEnabledChange, onStartChange, onEndChange, onDirectionChange }: {
    enabled: boolean; start: string; end: string; direction: QRGradientDirection;
    isPaidPlan: boolean; showUpgradeToast: (f: string) => void;
    onEnabledChange: (v: boolean) => void; onStartChange: (c: string) => void;
    onEndChange: (c: string) => void; onDirectionChange: (d: QRGradientDirection) => void;
}) {
    return (
        <div>
            <label className="label mb-2">Gradient <Badge variant="primary" className="text-xs ml-1">BUSINESS</Badge></label>
            <div className={`${!isPaidPlan ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full" style={{
                            background: enabled ? `linear-gradient(to bottom, ${start}, ${end})` : '#ccc'
                        }} />
                        <div>
                            <p className="text-sm font-medium text-gray-900">Enable Gradient</p>
                            <p className="text-xs text-gray-500">Create smooth color transitions</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (!isPaidPlan) { showUpgradeToast('Gradient styling'); return; }
                            onEnabledChange(!enabled);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-gray-300'} ${!isPaidPlan ? 'cursor-not-allowed' : ''}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                {enabled && isPaidPlan && (
                    <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-500">Start Color</label>
                                <div className="flex gap-2 mt-1">
                                    <input type="color" value={start} onChange={(e) => onStartChange(e.target.value)}
                                        className="w-10 h-9 rounded border-0 cursor-pointer" />
                                    <Input value={start} onChange={(e) => onStartChange(e.target.value)}
                                        className="flex-1 font-mono text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">End Color</label>
                                <div className="flex gap-2 mt-1">
                                    <input type="color" value={end} onChange={(e) => onEndChange(e.target.value)}
                                        className="w-10 h-9 rounded border-0 cursor-pointer" />
                                    <Input value={end} onChange={(e) => onEndChange(e.target.value)}
                                        className="flex-1 font-mono text-sm" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Direction</label>
                            <div className="grid grid-cols-4 gap-2 mt-1">
                                {GRADIENT_DIRECTIONS.map((dir) => (
                                    <button
                                        key={dir.id}
                                        onClick={() => onDirectionChange(dir.id)}
                                        className={`p-2 border-2 rounded-lg text-center text-xs ${direction === dir.id
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
    );
}

import React from 'react';
import { Link } from 'react-router';
import { QrCode, Download } from 'lucide-react';
import { QRFramedRenderer } from '@/components/qr';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { useQRDownload } from '@/hooks/useQRDownload';
import type { QRDesignState } from '@/hooks/useQRDesign';

interface QRPreviewPanelProps {
    /** The value/URL to encode in the QR code */
    value: string;
    /** Design state from useQRDesign */
    design: QRDesignState;
    /** Type label like "Website Link" */
    typeLabel?: string;
    /** Primary action button */
    primaryAction: React.ReactNode;
    /** Optional extra content below the preview (e.g. scan count, server preview button) */
    extraContent?: React.ReactNode;
    /** SVG element id for download hooks */
    svgId?: string;
    /** Download filename base (e.g. "qr-abc123") */
    downloadFilename?: string;
    /** Show/hide cancel link (default true) */
    showCancel?: boolean;
}

export function QRPreviewPanel({
    value, design, typeLabel, primaryAction, extraContent,
    svgId = 'qr-preview', downloadFilename = 'qr-code', showCancel = true,
}: QRPreviewPanelProps) {
    const { download } = useQRDownload();

    const handleDownload = (format: 'png' | 'svg') => {
        download(svgId, format, downloadFilename);
    };

    return (
        <div className="sticky top-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><QrCode className="w-5 h-5" /> Preview</CardTitle>
                </CardHeader>
                <div className="flex items-center justify-center p-6 rounded-xl border-2 border-gray-100" style={{ backgroundColor: '#f8fafc' }}>
                    <QRFramedRenderer
                        id={svgId}
                        value={value || 'https://example.com'}
                        size={200}
                        style={design.qrStyle}
                        frame={design.qrFrame}
                        frameText={design.frameText}
                        fgColor={design.fgColor}
                        bgColor={design.bgColor}
                        level="H"
                        logoUrl={design.logoPreview || undefined}
                        eyeStyle={design.eyeStyle}
                        eyeColor={design.eyeColor}
                        gradientEnabled={design.gradientEnabled}
                        gradientStart={design.gradientStart}
                        gradientEnd={design.gradientEnd}
                        gradientDirection={design.gradientDirection}
                    />
                </div>

                {/* Download buttons */}
                <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleDownload('png')} className="flex-1">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> PNG
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownload('svg')} className="flex-1">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> SVG
                    </Button>
                </div>

                {extraContent}

                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                    {typeLabel && <p className="text-sm text-gray-500">{typeLabel}</p>}
                    <p className="text-xs text-gray-400 mt-1 capitalize">
                        {design.qrStyle} • {design.qrFrame !== 'none' ? `${design.qrFrame} Frame` : 'No Frame'}
                    </p>
                </div>

                <div className="mt-4 space-y-2">
                    {primaryAction}
                    {showCancel && (
                        <Link to="/dashboard/qr-codes" className="block">
                            <Button variant="ghost" className="w-full">Cancel</Button>
                        </Link>
                    )}
                </div>
            </Card>
        </div>
    );
}

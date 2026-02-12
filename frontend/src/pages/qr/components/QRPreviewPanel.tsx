import React from 'react';
import { Link } from 'react-router';
import { QrCode, Eye } from 'lucide-react';
import { QRFramedRenderer } from '@/components/qr';
import { Button } from '@/components/common/Button';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
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
}

export function QRPreviewPanel({
    value, design, typeLabel, primaryAction, extraContent, svgId = 'qr-preview',
}: QRPreviewPanelProps) {
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

                {extraContent}

                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                    {typeLabel && <p className="text-sm text-gray-500">{typeLabel}</p>}
                    <p className="text-xs text-gray-400 mt-1 capitalize">
                        {design.qrStyle} • {design.qrFrame !== 'none' ? `${design.qrFrame} Frame` : 'No Frame'}
                    </p>
                </div>

                <div className="mt-4 space-y-2">
                    {primaryAction}
                    <Link to="/dashboard/qr-codes" className="block">
                        <Button variant="ghost" className="w-full">Cancel</Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}

/**
 * QRFramedRenderer — wraps QRRenderer with an SVG frame.
 *
 * The entire output (QR + frame) is a single scalable SVG element.
 * This replaces the old HTML/Tailwind frame approach and enables
 * direct SVG serialization for export.
 */

import React, { useMemo, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getFrame } from './frames';
import type { QRStyle, QREyeStyle, QRGradientDirection, QRFrame } from './QRRenderer';

interface QRFramedRendererProps {
    value: string;
    size?: number;
    style?: QRStyle;
    frame?: QRFrame;
    frameText?: string;
    fgColor?: string;
    bgColor?: string;
    logoUrl?: string;
    level?: 'L' | 'M' | 'Q' | 'H';
    eyeStyle?: QREyeStyle;
    eyeColor?: string;
    gradientEnabled?: boolean;
    gradientStart?: string;
    gradientEnd?: string;
    gradientDirection?: QRGradientDirection;
    className?: string;
    id?: string;
}

const CELL = 10;

function isFinderModule(r: number, c: number, n: number): boolean {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= n - 7) return true;
    if (r >= n - 7 && c < 7) return true;
    return false;
}

function renderEye(x: number, y: number, cell: number, style: QREyeStyle, fg: string, bg: string): React.ReactNode[] {
    const key = `eye-${x}-${y}`;
    const outer = 7 * cell, inner = 5 * cell, center = 3 * cell;
    if (style === 'circle') {
        const r1 = outer / 2, r2 = inner / 2, r3 = center / 2;
        const cx = x + r1, cy = y + r1;
        return [
            <circle key={`${key}-o`} cx={cx} cy={cy} r={r1} fill={fg} />,
            <circle key={`${key}-i`} cx={cx} cy={cy} r={r2} fill={bg} />,
            <circle key={`${key}-c`} cx={cx} cy={cy} r={r3} fill={fg} />,
        ];
    }
    if (style === 'rounded') {
        const r = cell * 1.2, cr = cell * 0.8;
        return [
            <rect key={`${key}-o`} x={x} y={y} width={outer} height={outer} rx={r} fill={fg} />,
            <rect key={`${key}-i`} x={x + cell} y={y + cell} width={inner} height={inner} rx={r} fill={bg} />,
            <rect key={`${key}-c`} x={x + 2 * cell} y={y + 2 * cell} width={center} height={center} rx={cr} fill={fg} />,
        ];
    }
    if (style === 'leaf') {
        const r = cell * 2, cr = cell * 1.2;
        return [
            <rect key={`${key}-o`} x={x} y={y} width={outer} height={outer} rx={r} fill={fg} />,
            <rect key={`${key}-i`} x={x + cell} y={y + cell} width={inner} height={inner} rx={r} fill={bg} />,
            <rect key={`${key}-c`} x={x + 2 * cell} y={y + 2 * cell} width={center} height={center} rx={cr} fill={fg} />,
        ];
    }
    if (style === 'diamond') {
        const h = outer / 2, cx = x + h, cy = y + h, hi = inner / 2, hc = center / 2;
        return [
            <polygon key={`${key}-o`} points={`${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}`} fill={fg} />,
            <polygon key={`${key}-i`} points={`${cx},${cy - hi} ${cx + hi},${cy} ${cx},${cy + hi} ${cx - hi},${cy}`} fill={bg} />,
            <polygon key={`${key}-c`} points={`${cx},${cy - hc} ${cx + hc},${cy} ${cx},${cy + hc} ${cx - hc},${cy}`} fill={fg} />,
        ];
    }
    return [
        <rect key={`${key}-o`} x={x} y={y} width={outer} height={outer} fill={fg} />,
        <rect key={`${key}-i`} x={x + cell} y={y + cell} width={inner} height={inner} fill={bg} />,
        <rect key={`${key}-c`} x={x + 2 * cell} y={y + 2 * cell} width={center} height={center} fill={fg} />,
    ];
}

export const QRFramedRenderer: React.FC<QRFramedRendererProps> = ({
    value,
    size = 200,
    style = 'square',
    frame = 'none',
    frameText,
    fgColor = '#000000',
    bgColor = '#FFFFFF',
    logoUrl,
    level = 'M',
    eyeStyle = 'square',
    eyeColor,
    gradientEnabled = false,
    gradientStart = '#000000',
    gradientEnd = '#666666',
    gradientDirection = 'vertical',
    className,
    id,
}) => {
    const [matrixData, setMatrixData] = useState<{ data: Uint8Array; n: number } | null>(null);
    const effectiveLevel = logoUrl ? 'H' : level;

    useEffect(() => {
        if (!value) return;
        const qr = QRCode.create(value, { errorCorrectionLevel: effectiveLevel });
        setMatrixData({ data: qr.modules.data, n: qr.modules.size });
    }, [value, effectiveLevel]);

    const fillId = gradientEnabled ? 'qrGrad' : undefined;
    const moduleFill = gradientEnabled ? `url(#${fillId})` : fgColor;
    const resolvedEyeColor = eyeColor || fgColor;

    const frameObj = getFrame(frame);
    const qrPixelSize = matrixData ? matrixData.n * CELL : 0;

    // Build the inner QR content as SVG group (no wrapper <svg>)
    const qrInner = useMemo(() => {
        if (!matrixData) return null;
        const { data, n } = matrixData;
        const body: React.ReactNode[] = [];
        const eyes: React.ReactNode[] = [];

        let isExcavated = (_r: number, _c: number) => false;
        if (logoUrl) {
            const center = Math.floor(n / 2);
            const half = Math.floor(n * 0.11);
            isExcavated = (r, c) => r >= center - half && r <= center + half && c >= center - half && c <= center + half;
        }

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (!data[r * n + c] || isExcavated(r, c) || isFinderModule(r, c, n)) continue;
                const x = c * CELL, y = r * CELL;
                if (style === 'dots') {
                    body.push(<circle key={`${r}-${c}`} cx={x + CELL / 2} cy={y + CELL / 2} r={CELL / 2.2} fill={moduleFill} />);
                } else if (style === 'rounded') {
                    body.push(<rect key={`${r}-${c}`} x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1} rx={CELL / 3} fill={moduleFill} />);
                } else {
                    body.push(<rect key={`${r}-${c}`} x={x} y={y} width={CELL} height={CELL} fill={moduleFill} />);
                }
            }
        }

        const positions = [{ r: 0, c: 0 }, { r: 0, c: n - 7 }, { r: n - 7, c: 0 }];
        for (const p of positions) {
            eyes.push(...renderEye(p.c * CELL, p.r * CELL, CELL, eyeStyle, resolvedEyeColor, bgColor));
        }

        const logoImgSize = qrPixelSize * 0.2;
        const logoPos = (qrPixelSize - logoImgSize) / 2;

        let gradientDef: React.ReactNode = null;
        if (gradientEnabled && fillId) {
            if (gradientDirection === 'radial') {
                gradientDef = (
                    <defs>
                        <radialGradient id={fillId} cx={qrPixelSize / 2} cy={qrPixelSize / 2} r={qrPixelSize / 2} gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor={gradientStart} />
                            <stop offset="100%" stopColor={gradientEnd} />
                        </radialGradient>
                    </defs>
                );
            } else {
                let gx2 = 0, gy2 = qrPixelSize;
                if (gradientDirection === 'horizontal') { gx2 = qrPixelSize; gy2 = 0; }
                else if (gradientDirection === 'diagonal') { gx2 = qrPixelSize; gy2 = qrPixelSize; }
                gradientDef = (
                    <defs>
                        <linearGradient id={fillId} x1={0} y1={0} x2={gx2} y2={gy2} gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor={gradientStart} />
                            <stop offset="100%" stopColor={gradientEnd} />
                        </linearGradient>
                    </defs>
                );
            }
        }

        return (
            <g>
                {gradientDef}
                <rect width={qrPixelSize} height={qrPixelSize} fill={bgColor} />
                {body}
                {eyes}
                {logoUrl && (
                    <image href={logoUrl} x={logoPos} y={logoPos}
                        width={logoImgSize} height={logoImgSize}
                        preserveAspectRatio="xMidYMid meet" />
                )}
            </g>
        );
    }, [matrixData, style, moduleFill, logoUrl, eyeStyle, resolvedEyeColor, bgColor,
        gradientEnabled, fillId, gradientStart, gradientEnd, gradientDirection, qrPixelSize]);

    if (!matrixData || !qrInner) return null;

    // No frame — simple SVG wrapper
    if (!frameObj) {
        return (
            <svg id={id} className={className}
                viewBox={`0 0 ${qrPixelSize} ${qrPixelSize}`}
                width={size} height={size}
                shapeRendering="crispEdges"
                xmlns="http://www.w3.org/2000/svg"
                role="img" aria-label="QR Code">
                {qrInner}
            </svg>
        );
    }

    // Framed — let frame determine viewBox
    const vb = frameObj.getViewBox(qrPixelSize);
    const frameContent = frameObj.render({
        qrContent: qrInner,
        qrSize: qrPixelSize,
        fgColor,
        bgColor,
        text: frameText,
    });

    // Scale proportionally
    const aspect = vb.width / vb.height;
    const svgW = aspect >= 1 ? size : size * aspect;
    const svgH = aspect >= 1 ? size / aspect : size;

    return (
        <svg id={id} className={className}
            viewBox={`0 0 ${vb.width} ${vb.height}`}
            width={svgW} height={svgH}
            shapeRendering="crispEdges"
            xmlns="http://www.w3.org/2000/svg"
            role="img" aria-label="QR Code">
            {frameContent}
        </svg>
    );
};

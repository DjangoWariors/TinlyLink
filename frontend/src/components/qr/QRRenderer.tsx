/**
 * Core QR code renderer — generates a pure SVG from the qrcode matrix.
 *
 * All visual elements (modules, eyes, gradient, logo) are SVG primitives.
 * No HTML, no Tailwind, no html-to-image.
 */

import React, { useMemo, useEffect, useState } from 'react';
import QRCode from 'qrcode';

export type QRStyle = 'square' | 'dots' | 'rounded';
export type QRFrame = 'none' | 'simple' | 'scan_me' | 'balloon' | 'badge' | 'phone' | 'polaroid' | 'laptop' | 'ticket' | 'card' | 'tag' | 'certificate';
export type QREyeStyle = 'square' | 'circle' | 'rounded' | 'leaf' | 'diamond';
export type QRGradientDirection = 'vertical' | 'horizontal' | 'diagonal' | 'radial';

export interface QRRendererProps {
    value: string;
    size?: number;
    style?: QRStyle;
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

interface QRMatrix {
    data: Uint8Array;
    size: number;
}

const CELL = 10; // Virtual cell size in SVG units

function isFinderModule(r: number, c: number, n: number): boolean {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= n - 7) return true;
    if (r >= n - 7 && c < 7) return true;
    return false;
}

function renderEye(
    x: number, y: number, cell: number,
    style: QREyeStyle, fg: string, bg: string,
): React.ReactNode[] {
    const key = `eye-${x}-${y}`;
    const outer = 7 * cell;
    const inner = 5 * cell;
    const center = 3 * cell;

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
        const h = outer / 2;
        const cx = x + h, cy = y + h;
        const hi = inner / 2, hc = center / 2;
        return [
            <polygon key={`${key}-o`} points={`${cx},${cy - h} ${cx + h},${cy} ${cx},${cy + h} ${cx - h},${cy}`} fill={fg} />,
            <polygon key={`${key}-i`} points={`${cx},${cy - hi} ${cx + hi},${cy} ${cx},${cy + hi} ${cx - hi},${cy}`} fill={bg} />,
            <polygon key={`${key}-c`} points={`${cx},${cy - hc} ${cx + hc},${cy} ${cx},${cy + hc} ${cx - hc},${cy}`} fill={fg} />,
        ];
    }

    // square default
    return [
        <rect key={`${key}-o`} x={x} y={y} width={outer} height={outer} fill={fg} />,
        <rect key={`${key}-i`} x={x + cell} y={y + cell} width={inner} height={inner} fill={bg} />,
        <rect key={`${key}-c`} x={x + 2 * cell} y={y + 2 * cell} width={center} height={center} fill={fg} />,
    ];
}

export const QRRenderer: React.FC<QRRendererProps> = ({
    value,
    size = 200,
    style = 'square',
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
    const [matrix, setMatrix] = useState<QRMatrix | null>(null);

    const effectiveLevel = logoUrl ? 'H' : level;

    useEffect(() => {
        if (!value) return;
        const qr = QRCode.create(value, { errorCorrectionLevel: effectiveLevel });
        setMatrix({ data: qr.modules.data, size: qr.modules.size });
    }, [value, effectiveLevel]);

    const fillId = gradientEnabled ? 'qrGrad' : undefined;
    const moduleFill = gradientEnabled ? `url(#${fillId})` : fgColor;
    const resolvedEyeColor = eyeColor || fgColor;

    const { bodyPaths, eyeElements } = useMemo(() => {
        if (!matrix) return { bodyPaths: [] as React.ReactNode[], eyeElements: [] as React.ReactNode[] };

        const { data, size: n } = matrix;
        const body: React.ReactNode[] = [];
        const eyes: React.ReactNode[] = [];

        const isDark = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && !!data[r * n + c];

        // Logo excavation
        let isExcavated = (_r: number, _c: number) => false;
        if (logoUrl) {
            const center = Math.floor(n / 2);
            const half = Math.floor(n * 0.11);
            isExcavated = (r, c) => r >= center - half && r <= center + half && c >= center - half && c <= center + half;
        }

        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (!isDark(r, c) || isExcavated(r, c) || isFinderModule(r, c, n)) continue;
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

        // Eyes
        const positions = [
            { r: 0, c: 0 },
            { r: 0, c: n - 7 },
            { r: n - 7, c: 0 },
        ];
        for (const p of positions) {
            eyes.push(...renderEye(p.c * CELL, p.r * CELL, CELL, eyeStyle, resolvedEyeColor, bgColor));
        }

        return { bodyPaths: body, eyeElements: eyes };
    }, [matrix, style, moduleFill, logoUrl, eyeStyle, resolvedEyeColor, bgColor]);

    if (!matrix) return null;

    const qrSize = matrix.size * CELL;

    let gradientDef: React.ReactNode = null;
    if (gradientEnabled && fillId) {
        if (gradientDirection === 'radial') {
            gradientDef = (
                <defs>
                    <radialGradient id={fillId} cx={qrSize / 2} cy={qrSize / 2} r={qrSize / 2} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={gradientStart} />
                        <stop offset="100%" stopColor={gradientEnd} />
                    </radialGradient>
                </defs>
            );
        } else {
            let gx2 = 0, gy2 = qrSize;
            if (gradientDirection === 'horizontal') { gx2 = qrSize; gy2 = 0; }
            else if (gradientDirection === 'diagonal') { gx2 = qrSize; gy2 = qrSize; }
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

    const logoImgSize = qrSize * 0.2;
    const logoPos = (qrSize - logoImgSize) / 2;

    return (
        <svg
            id={id}
            className={className}
            viewBox={`0 0 ${qrSize} ${qrSize}`}
            width={size}
            height={size}
            shapeRendering="crispEdges"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="QR Code"
        >
            {gradientDef}
            <rect width={qrSize} height={qrSize} fill={bgColor} />
            {bodyPaths}
            {eyeElements}
            {logoUrl && (
                <image
                    href={logoUrl}
                    x={logoPos}
                    y={logoPos}
                    width={logoImgSize}
                    height={logoImgSize}
                    preserveAspectRatio="xMidYMid meet"
                />
            )}
        </svg>
    );
};

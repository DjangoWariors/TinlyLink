import React, { useMemo, useEffect, useState } from 'react';
import QRCode from 'qrcode';

export type QRStyle = 'square' | 'dots' | 'rounded';
export type QRFrame = 'none' | 'simple' | 'scan_me' | 'balloon' | 'badge' | 'phone' | 'polaroid' | 'laptop' | 'ticket' | 'card' | 'tag' | 'certificate';
export type QREyeStyle = 'square' | 'circle' | 'rounded' | 'leaf' | 'diamond';
export type QRGradientDirection = 'vertical' | 'horizontal' | 'diagonal' | 'radial';

interface QRCodeGeneratorProps {
    value: string;
    size?: number;
    style?: QRStyle;
    frame?: QRFrame;
    fgColor?: string;
    bgColor?: string;
    logoUrl?: string;
    title?: string;
    frameText?: string;
    level?: 'L' | 'M' | 'Q' | 'H';
    eyeStyle?: QREyeStyle;
    eyeColor?: string;
    gradientEnabled?: boolean;
    gradientStart?: string;
    gradientEnd?: string;
    gradientDirection?: QRGradientDirection;
}

interface QRMatrix {
    data: Uint8Array;
    size: number;
}

// Check if a module is inside one of the three finder patterns (7x7 areas)
function isFinderModule(r: number, c: number, matrixSize: number, margin: number): boolean {
    const dataSize = matrixSize - 2 * margin;
    const dr = r - margin;
    const dc = c - margin;
    if (dr < 0 || dc < 0 || dr >= dataSize || dc >= dataSize) return false;
    // Top-left
    if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) return true;
    // Top-right
    if (dr >= 0 && dr <= 6 && dc >= dataSize - 7 && dc <= dataSize - 1) return true;
    // Bottom-left
    if (dr >= dataSize - 7 && dr <= dataSize - 1 && dc >= 0 && dc <= 6) return true;
    return false;
}

function renderEye(
    cx: number, cy: number, eyeSize: number, cellSize: number,
    style: QREyeStyle, color: string
): React.ReactNode[] {
    const elements: React.ReactNode[] = [];
    const key = `${cx}-${cy}`;
    const outerSize = 7 * cellSize;
    const innerSize = 5 * cellSize;
    const centerSize = 3 * cellSize;
    const ox = cx;
    const oy = cy;

    if (style === 'circle') {
        const r1 = outerSize / 2;
        const r2 = innerSize / 2;
        const r3 = centerSize / 2;
        const ecx = ox + r1;
        const ecy = oy + r1;
        elements.push(<circle key={`${key}-outer`} cx={ecx} cy={ecy} r={r1} fill={color} />);
        elements.push(<circle key={`${key}-inner`} cx={ecx} cy={ecy} r={r2} fill="currentBg" />);
        elements.push(<circle key={`${key}-center`} cx={ecx} cy={ecy} r={r3} fill={color} />);
    } else if (style === 'rounded') {
        const r = cellSize * 1.2;
        const cr = cellSize * 0.8;
        elements.push(<rect key={`${key}-outer`} x={ox} y={oy} width={outerSize} height={outerSize} rx={r} ry={r} fill={color} />);
        elements.push(<rect key={`${key}-inner`} x={ox + cellSize} y={oy + cellSize} width={innerSize} height={innerSize} rx={r} ry={r} fill="currentBg" />);
        elements.push(<rect key={`${key}-center`} x={ox + 2 * cellSize} y={oy + 2 * cellSize} width={centerSize} height={centerSize} rx={cr} ry={cr} fill={color} />);
    } else if (style === 'leaf') {
        // Leaf: large rounded corners giving an organic leaf shape
        const r = cellSize * 2;
        const cr = cellSize * 1.2;
        elements.push(<rect key={`${key}-outer`} x={ox} y={oy} width={outerSize} height={outerSize} rx={r} ry={r} fill={color} />);
        elements.push(<rect key={`${key}-inner`} x={ox + cellSize} y={oy + cellSize} width={innerSize} height={innerSize} rx={r} ry={r} fill="currentBg" />);
        elements.push(<rect key={`${key}-center`} x={ox + 2 * cellSize} y={oy + 2 * cellSize} width={centerSize} height={centerSize} rx={cr} ry={cr} fill={color} />);
    } else if (style === 'diamond') {
        // Diamond: rotated 45° squares
        const halfOuter = outerSize / 2;
        const halfInner = innerSize / 2;
        const halfCenter = centerSize / 2;
        const cxo = ox + halfOuter;
        const cyo = oy + halfOuter;
        const outerPts = `${cxo},${cyo - halfOuter} ${cxo + halfOuter},${cyo} ${cxo},${cyo + halfOuter} ${cxo - halfOuter},${cyo}`;
        const innerPts = `${cxo},${cyo - halfInner} ${cxo + halfInner},${cyo} ${cxo},${cyo + halfInner} ${cxo - halfInner},${cyo}`;
        const centerPts = `${cxo},${cyo - halfCenter} ${cxo + halfCenter},${cyo} ${cxo},${cyo + halfCenter} ${cxo - halfCenter},${cyo}`;
        elements.push(<polygon key={`${key}-outer`} points={outerPts} fill={color} />);
        elements.push(<polygon key={`${key}-inner`} points={innerPts} fill="currentBg" />);
        elements.push(<polygon key={`${key}-center`} points={centerPts} fill={color} />);
    } else {
        // Square (default)
        elements.push(<rect key={`${key}-outer`} x={ox} y={oy} width={outerSize} height={outerSize} fill={color} />);
        elements.push(<rect key={`${key}-inner`} x={ox + cellSize} y={oy + cellSize} width={innerSize} height={innerSize} fill="currentBg" />);
        elements.push(<rect key={`${key}-center`} x={ox + 2 * cellSize} y={oy + 2 * cellSize} width={centerSize} height={centerSize} fill={color} />);
    }
    return elements;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({
    value,
    size = 200,
    style = 'square',
    frame = 'none',
    fgColor = '#000000',
    bgColor = '#FFFFFF',
    logoUrl,
    title,
    frameText,
    level = 'M',
    eyeStyle = 'square',
    eyeColor,
    gradientEnabled = false,
    gradientStart = '#000000',
    gradientEnd = '#666666',
    gradientDirection = 'vertical',
}) => {
    const [matrix, setMatrix] = useState<QRMatrix | null>(null);

    const effectiveLevel = logoUrl ? 'H' : level;
    // QRCode.create() returns a matrix with NO margin — the returned
    // modules.size is the raw QR symbol size (e.g. 25 for version 2).
    // Setting margin=0 so finder-pattern detection and eye positioning
    // align correctly with the matrix data.
    const margin = 0;

    useEffect(() => {
        if (!value) return;

        const qr = QRCode.create(value, {
            errorCorrectionLevel: effectiveLevel,
        });
        const { modules } = qr;

        setMatrix({
            data: modules.data,
            size: modules.size,
        });

    }, [value, effectiveLevel]);

    const fillId = gradientEnabled ? 'qrGradient' : undefined;
    const moduleFill = gradientEnabled ? `url(#${fillId})` : fgColor;
    const resolvedEyeColor = eyeColor || fgColor;

    const { bodyPaths, eyeElements } = useMemo(() => {
        if (!matrix) return { bodyPaths: [], eyeElements: [] };

        const { data, size: mSize } = matrix;
        const cellSize = 10;
        const bodyPaths: React.ReactNode[] = [];
        const eyeElements: React.ReactNode[] = [];

        const isDark = (r: number, c: number) => {
            if (r < 0 || c < 0 || r >= mSize || c >= mSize) return false;
            return !!data[r * mSize + c];
        };

        // Logo Excavation
        let isExcavated = (_r: number, _c: number) => false;
        if (logoUrl) {
            const center = Math.floor(mSize / 2);
            const excavationSize = Math.floor(mSize * 0.22);
            const halfExcavation = Math.floor(excavationSize / 2);
            const startRow = center - halfExcavation;
            const endRow = center + halfExcavation;
            const startCol = center - halfExcavation;
            const endCol = center + halfExcavation;
            isExcavated = (r, c) => r >= startRow && r <= endRow && c >= startCol && c <= endCol;
        }

        // Render body modules (skip finder patterns)
        for (let r = 0; r < mSize; r++) {
            for (let c = 0; c < mSize; c++) {
                if (!isDark(r, c)) continue;
                if (isExcavated(r, c)) continue;
                if (isFinderModule(r, c, mSize, margin)) continue;

                const x = c * cellSize;
                const y = r * cellSize;

                if (style === 'dots') {
                    bodyPaths.push(
                        <circle key={`${r}-${c}`} cx={x + cellSize / 2} cy={y + cellSize / 2} r={cellSize / 2.2} fill={moduleFill} />
                    );
                } else if (style === 'rounded') {
                    bodyPaths.push(
                        <rect key={`${r}-${c}`} x={x + 0.5} y={y + 0.5} width={cellSize - 1} height={cellSize - 1} rx={cellSize / 3} ry={cellSize / 3} fill={moduleFill} />
                    );
                } else {
                    bodyPaths.push(
                        <rect key={`${r}-${c}`} x={x} y={y} width={cellSize} height={cellSize} fill={moduleFill} />
                    );
                }
            }
        }

        // Render finder pattern eyes
        const cellS = cellSize;
        const dataSize = mSize - 2 * margin;
        const eyePositions = [
            { r: margin, c: margin },                          // top-left
            { r: margin, c: margin + dataSize - 7 },           // top-right
            { r: margin + dataSize - 7, c: margin },           // bottom-left
        ];

        for (const pos of eyePositions) {
            const ex = pos.c * cellS;
            const ey = pos.r * cellS;
            const eyeEls = renderEye(ex, ey, 7, cellS, eyeStyle, resolvedEyeColor);
            // Replace "currentBg" fill with actual bgColor
            for (const el of eyeEls) {
                if (React.isValidElement(el)) {
                    const props = el.props as any;
                    if (props.fill === 'currentBg') {
                        eyeElements.push(React.cloneElement(el, { fill: bgColor } as any));
                    } else {
                        eyeElements.push(el);
                    }
                }
            }
        }

        return { bodyPaths, eyeElements };
    }, [matrix, style, moduleFill, logoUrl, eyeStyle, resolvedEyeColor, bgColor, margin]);

    if (!matrix) return null;

    const qrSize = matrix.size * 10;
    const viewBox = `0 0 ${qrSize} ${qrSize}`;

    const logoImgSize = qrSize * 0.20;
    const logoPos = (qrSize - logoImgSize) / 2;

    // Build SVG gradient def
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
            let gx1 = 0, gy1 = 0, gx2 = 0, gy2 = qrSize;
            if (gradientDirection === 'horizontal') { gx2 = qrSize; gy2 = 0; }
            else if (gradientDirection === 'diagonal') { gx2 = qrSize; gy2 = qrSize; }
            gradientDef = (
                <defs>
                    <linearGradient id={fillId} x1={gx1} y1={gy1} x2={gx2} y2={gy2} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={gradientStart} />
                        <stop offset="100%" stopColor={gradientEnd} />
                    </linearGradient>
                </defs>
            );
        }
    }

    const QRContent = (
        <svg viewBox={viewBox} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="QR Code">
            {gradientDef}
            <rect width="100%" height="100%" fill={bgColor} />
            {bodyPaths}
            {eyeElements}
            {logoUrl && (
                <image
                    href={logoUrl}
                    x={logoPos}
                    y={logoPos}
                    width={logoImgSize}
                    height={logoImgSize}
                    preserveAspectRatio="xMidYMid contain"
                />
            )}
        </svg>
    );

    const displayText = frameText || title;

    // Default: just the QR
    if (frame === 'none') {
        return (
            <div style={{ width: size, height: size }}>
                {QRContent}
            </div>
        );
    }

    if (frame === 'simple') {
        return (
            <div className="relative mx-auto bg-white p-4 border-4 border-black rounded-xl" style={{ width: size + 40, borderColor: fgColor }}>
                <div className="text-center font-bold mb-2 uppercase tracking-wider text-sm" style={{ color: fgColor }}>
                    {displayText || 'Scan Me'}
                </div>
                {QRContent}
            </div>
        );
    }

    if (frame === 'scan_me') {
        return (
            <div className="relative mx-auto bg-white rounded-xl shadow-lg overflow-hidden" style={{ width: size + 40 }}>
                <div className="p-4">
                    {QRContent}
                </div>
                <div className="py-2 text-center text-white font-bold uppercase tracking-widest text-sm" style={{ backgroundColor: fgColor }}>
                    {displayText || 'Scan Me'}
                </div>
            </div>
        );
    }

    if (frame === 'balloon') {
        return (
            <div className="relative mx-auto" style={{ width: size + 60 }}>
                <div className="relative bg-white p-5 rounded-[2rem] shadow-lg border-2" style={{ borderColor: fgColor }}>
                    {QRContent}
                    <div
                        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-white border-b-2 border-r-2 rotate-45"
                        style={{ borderColor: fgColor }}
                    />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-4 bg-white" />
                </div>
                <div className="mt-6 text-center font-bold text-sm" style={{ color: fgColor }}>
                    {displayText || 'Message Me'}
                </div>
            </div>
        );
    }

    if (frame === 'badge') {
        return (
            <div className="relative mx-auto bg-white shadow-md rounded-xl overflow-hidden border" style={{ width: size + 40, borderColor: '#e2e8f0' }}>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full" />
                <div className="h-24 flex flex-col items-center justify-center p-4 bg-gray-50 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-full bg-gray-200 mb-2 flex items-center justify-center text-gray-400">
                        {logoUrl ? <img src={logoUrl} className="w-full h-full object-cover rounded-full" /> : <span className="text-xs">LOGO</span>}
                    </div>
                    <div className="font-bold text-gray-900 text-sm truncate w-full text-center">{displayText || title || 'Visitor'}</div>
                </div>
                <div className="p-5">
                    {QRContent}
                </div>
                <div className="py-2 bg-primary text-primary-foreground text-center text-xs font-mono uppercase">
                    SCAN TO CONNECT
                </div>
            </div>
        );
    }

    if (frame === 'laptop') {
        return (
            <div className="relative mx-auto" style={{ width: size * 1.5 }}>
                <div className="bg-gray-800 rounded-t-xl p-1 pb-0 mx-auto" style={{ width: '80%' }}>
                    <div className="bg-gray-900 rounded-t-lg p-2 border border-gray-700 border-b-0 relative">
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gray-600" />
                        <div className="bg-white rounded aspect-video flex items-center justify-center overflow-hidden relative">
                            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                                <div style={{ width: '60%', height: '60%' }}>
                                    {QRContent}
                                </div>
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gray-100 border-t border-gray-200 flex items-center justify-center gap-1">
                                <div className="w-2 h-2 rounded bg-blue-400" />
                                <div className="w-2 h-2 rounded bg-green-400" />
                                <div className="w-2 h-2 rounded bg-red-400" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-300 h-3 rounded-b-lg border-t border-gray-400 relative shadow-xl">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-400 rounded-b" />
                </div>
            </div>
        );
    }

    if (frame === 'phone') {
        return (
            <div className="relative mx-auto" style={{ width: size * 1.2, height: size * 2 }}>
                <svg viewBox="0 0 300 600" width="100%" height="100%">
                    <defs>
                        <clipPath id="screenClip">
                            <rect x="20" y="60" width="260" height="480" rx="20" />
                        </clipPath>
                    </defs>
                    <rect x="5" y="5" width="290" height="590" rx="35" fill="#333" stroke="#1a1a1a" strokeWidth="5" />
                    <rect x="15" y="15" width="270" height="570" rx="25" fill="#fff" />
                    <g clipPath="url(#screenClip)">
                        <rect x="20" y="60" width="260" height="480" fill={bgColor} />
                        <rect x="20" y="60" width="260" height="60" fill={fgColor} opacity="0.1" />
                        <text x="150" y="100" textAnchor="middle" fontSize="18" fill={fgColor} fontWeight="bold">
                            {displayText || title || 'Scan Me'}
                        </text>
                        <g transform="translate(50, 180) scale(0.66)">
                            <svg viewBox={viewBox} width="300" height="300" shapeRendering="crispEdges">
                                {gradientDef}
                                <rect width="100%" height="100%" fill={bgColor} />
                                {bodyPaths}
                                {eyeElements}
                                {logoUrl && (
                                    <image
                                        href={logoUrl}
                                        x={logoPos}
                                        y={logoPos}
                                        width={logoImgSize}
                                        height={logoImgSize}
                                        preserveAspectRatio="xMidYMid contain"
                                    />
                                )}
                            </svg>
                        </g>
                        <text x="150" y="450" textAnchor="middle" fontSize="14" fill="#666">
                            Open Camera to Scan
                        </text>
                    </g>
                    <rect x="100" y="25" width="100" height="20" rx="10" fill="#222" />
                </svg>
            </div>
        );
    }

    if (frame === 'polaroid') {
        return (
            <div className="relative mx-auto bg-white shadow-xl p-4 pb-12 rotate-2" style={{ width: size + 40 }}>
                <div className="aspect-square bg-gray-100 mb-4 overflow-hidden">
                    {QRContent}
                </div>
                <div className="text-center font-handwriting text-gray-700 text-lg font-medium">
                    {displayText || title || 'Scan Me!'}
                </div>
            </div>
        );
    }

    if (frame === 'ticket') {
        return (
            <div className="relative mx-auto bg-white rounded-lg shadow-md overflow-hidden border-2" style={{ width: size + 50, borderColor: fgColor }}>
                <div className="p-4 flex items-center justify-center">
                    {QRContent}
                </div>
                <div className="flex items-center px-2">
                    <div className="flex-1 border-t-2 border-dashed" style={{ borderColor: fgColor }} />
                </div>
                {displayText && (
                    <div className="py-2 text-center text-sm font-bold uppercase tracking-wider" style={{ color: fgColor }}>
                        {displayText}
                    </div>
                )}
            </div>
        );
    }

    if (frame === 'card') {
        return (
            <div className="relative mx-auto bg-white rounded-xl shadow-md border p-4" style={{ width: size + 40, borderColor: '#e2e8f0' }}>
                {displayText && (
                    <div className="text-center font-bold mb-2 text-sm" style={{ color: fgColor }}>
                        {displayText}
                    </div>
                )}
                {QRContent}
            </div>
        );
    }

    if (frame === 'tag') {
        return (
            <div className="relative mx-auto" style={{ width: size + 40 }}>
                <div className="flex justify-center mb-1">
                    <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: fgColor }} />
                </div>
                <div className="bg-white rounded-lg border-2 p-4" style={{ borderColor: fgColor }}>
                    {QRContent}
                    {displayText && (
                        <div className="mt-2 text-center text-xs font-bold uppercase tracking-wider" style={{ color: fgColor }}>
                            {displayText}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (frame === 'certificate') {
        return (
            <div className="relative mx-auto bg-white p-1 shadow-md" style={{ width: size + 60 }}>
                <div className="border-2 p-1" style={{ borderColor: fgColor }}>
                    <div className="border p-4" style={{ borderColor: fgColor }}>
                        {QRContent}
                        {displayText && (
                            <div className="mt-3 text-center text-sm font-bold uppercase tracking-wider" style={{ color: fgColor }}>
                                {displayText}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Fallback
    return (
        <div style={{ width: size, height: size }}>
            {QRContent}
        </div>
    );
};

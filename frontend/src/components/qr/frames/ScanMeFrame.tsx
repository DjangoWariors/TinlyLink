import React from 'react';
import type { FrameRenderer, FrameRenderProps } from './types';

export const ScanMeFrame: FrameRenderer = {
    name: 'scan_me',
    getViewBox(qrSize) {
        const pad = 30;
        const total = qrSize + pad * 2 + 70;
        return { width: total, height: total };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const pad = 30;
        const { width, height } = this.getViewBox(qrSize);
        const badgeText = text || 'SCAN ME';
        const badgeY = qrSize + pad + 15;
        const badgeH = 36;
        const tw = badgeText.length * 10;
        const badgeW = tw + 40;
        const bx = (width - badgeW) / 2;
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <g transform={`translate(${pad},${pad})`}>{qrContent}</g>
                <rect x={bx} y={badgeY} width={badgeW} height={badgeH}
                    rx={badgeH / 2} fill={fgColor} />
                <text x={width / 2} y={badgeY + badgeH * 0.65} fill={bgColor}
                    fontSize={14} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                    {badgeText}
                </text>
            </g>
        );
    },
};

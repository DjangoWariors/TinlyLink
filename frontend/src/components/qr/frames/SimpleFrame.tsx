import React from 'react';
import type { FrameRenderer, FrameRenderProps } from './types';

export const SimpleFrame: FrameRenderer = {
    name: 'simple',
    getViewBox(qrSize) {
        const pad = 30;
        return { width: qrSize + pad * 2, height: qrSize + pad * 2 + 50 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const pad = 30;
        const { width, height } = this.getViewBox(qrSize);
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={pad / 2} y={pad / 2} width={width - pad} height={qrSize + pad}
                    fill="none" stroke={fgColor} strokeWidth={3} />
                <g transform={`translate(${pad},${pad})`}>{qrContent}</g>
                {text && (
                    <text x={width / 2} y={qrSize + pad + 30} fill={fgColor}
                        fontSize={16} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                        {text}
                    </text>
                )}
            </g>
        );
    },
};

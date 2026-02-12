import React from 'react';
import type { FrameRenderer, FrameRenderProps } from './types';

export const PhoneFrame: FrameRenderer = {
    name: 'phone',
    getViewBox(qrSize) {
        return { width: qrSize + 60, height: qrSize + 120 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={10} y={10} width={width - 20} height={height - 20} rx={20}
                    fill="none" stroke={fgColor} strokeWidth={3} />
                {/* Notch */}
                <rect x={width / 2 - 30} y={10} width={60} height={6} rx={3} fill={fgColor} />
                <g transform="translate(30,40)">{qrContent}</g>
                {text && (
                    <text x={width / 2} y={height - 25} fill={fgColor}
                        fontSize={14} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                        {text}
                    </text>
                )}
            </g>
        );
    },
};

export const LaptopFrame: FrameRenderer = {
    name: 'laptop',
    getViewBox(qrSize) {
        return { width: qrSize + 80, height: qrSize + 100 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        const baseY = height - 25;
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                {/* Screen */}
                <rect x={15} y={10} width={width - 30} height={height - 40} rx={8}
                    fill="none" stroke={fgColor} strokeWidth={3} />
                {/* Base */}
                <path d={`M5,${baseY} L${width - 5},${baseY} L${width - 15},${height - 5} L15,${height - 5} Z`}
                    fill="none" stroke={fgColor} strokeWidth={2} />
                <g transform="translate(40,30)">{qrContent}</g>
                {text && (
                    <text x={width / 2} y={height - 8} fill={fgColor}
                        fontSize={12} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                        {text}
                    </text>
                )}
            </g>
        );
    },
};

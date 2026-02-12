import React from 'react';
import type { FrameRenderer, FrameRenderProps } from './types';

export const BalloonFrame: FrameRenderer = {
    name: 'balloon',
    getViewBox(qrSize) {
        const pad = 40;
        return { width: qrSize + pad * 2, height: qrSize + pad * 2 + 70 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const pad = 40;
        const { width, height } = this.getViewBox(qrSize);
        const br = qrSize + pad + pad / 2;
        const mid = width / 2;
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={pad / 2} y={pad / 2} width={width - pad} height={qrSize + pad}
                    rx={30} fill="none" stroke={fgColor} strokeWidth={3} />
                <polygon points={`${mid - 15},${br} ${mid + 15},${br} ${mid},${br + 25}`} fill={fgColor} />
                <g transform={`translate(${pad},${pad})`}>{qrContent}</g>
                {text && (
                    <text x={width / 2} y={br + 45} fill={fgColor}
                        fontSize={16} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                        {text}
                    </text>
                )}
            </g>
        );
    },
};

export const BadgeFrame: FrameRenderer = {
    name: 'badge',
    getViewBox(qrSize) {
        return { width: qrSize + 60, height: qrSize + 140 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        const headerH = 50;
        const display = text || 'VISITOR';
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={10} y={10} width={width - 20} height={height - 20} rx={15}
                    fill="none" stroke={fgColor} strokeWidth={2} />
                <rect x={10} y={10} width={width - 20} height={headerH} rx={15} fill={fgColor} />
                <rect x={10} y={10 + headerH - 15} width={width - 20} height={15} fill={fgColor} />
                <text x={width / 2} y={42} fill={bgColor}
                    fontSize={18} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle" fontWeight="bold">
                    {display}
                </text>
                <g transform={`translate(30,${10 + headerH + 15})`}>{qrContent}</g>
                <text x={width / 2} y={height - 20} fill={fgColor}
                    fontSize={12} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                    SCAN TO CONNECT
                </text>
            </g>
        );
    },
};

export const PolaroidFrame: FrameRenderer = {
    name: 'polaroid',
    getViewBox(qrSize) {
        return { width: qrSize + 60, height: qrSize + 110 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={19} y={19} width={width - 30} height={height - 30} rx={2} fill="#C8C8C8" />
                <rect x={15} y={15} width={width - 30} height={height - 30} rx={2}
                    fill="white" stroke="#DCDCDC" strokeWidth={1} />
                <g transform="translate(30,30)">{qrContent}</g>
                <text x={width / 2} y={height - 30} fill={fgColor}
                    fontSize={16} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                    {text || 'Scan Me!'}
                </text>
            </g>
        );
    },
};

export const TicketFrame: FrameRenderer = {
    name: 'ticket',
    getViewBox(qrSize) {
        return { width: qrSize + 80, height: qrSize + 120 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        const perfY = height - 60;
        const dots: React.ReactNode[] = [];
        for (let x = 20; x < width - 20; x += 15) {
            dots.push(<circle key={`dot-${x}`} cx={x} cy={perfY} r={3} fill={fgColor} />);
        }
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={15} y={15} width={width - 30} height={height - 30}
                    fill="none" stroke={fgColor} strokeWidth={2} />
                {dots}
                <g transform="translate(40,40)">{qrContent}</g>
                {text && (
                    <text x={width / 2} y={perfY + 30} fill={fgColor}
                        fontSize={14} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle">
                        {text}
                    </text>
                )}
            </g>
        );
    },
};

export const CardFrame: FrameRenderer = {
    name: 'card',
    getViewBox(qrSize) {
        return { width: qrSize + 60, height: qrSize + 80 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        const qrY = text ? 50 : 30;
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={12} y={12} width={width - 20} height={height - 20} rx={12} fill="#E6E6E6" />
                <rect x={10} y={10} width={width - 20} height={height - 20} rx={12}
                    fill="white" stroke="#DCDCDC" strokeWidth={1} />
                {text && (
                    <text x={width / 2} y={35} fill={fgColor}
                        fontSize={16} fontFamily="Arial,Helvetica,sans-serif" textAnchor="middle" fontWeight="bold">
                        {text}
                    </text>
                )}
                <g transform={`translate(30,${qrY})`}>{qrContent}</g>
            </g>
        );
    },
};

export const TagFrame: FrameRenderer = {
    name: 'tag',
    getViewBox(qrSize) {
        return { width: qrSize + 60, height: qrSize + 100 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        const holeCx = width / 2;
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={15} y={30} width={width - 30} height={height - 45} rx={10}
                    fill="none" stroke={fgColor} strokeWidth={2} />
                <circle cx={holeCx} cy={25} r={10} fill="none" stroke={fgColor} strokeWidth={2} />
                <g transform="translate(30,50)">{qrContent}</g>
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

export const CertificateFrame: FrameRenderer = {
    name: 'certificate',
    getViewBox(qrSize) {
        return { width: qrSize + 80, height: qrSize + 100 };
    },
    render({ qrContent, qrSize, fgColor, bgColor, text }: FrameRenderProps) {
        const { width, height } = this.getViewBox(qrSize);
        return (
            <g>
                <rect width={width} height={height} fill={bgColor} />
                <rect x={8} y={8} width={width - 16} height={height - 16}
                    fill="none" stroke={fgColor} strokeWidth={2} />
                <rect x={16} y={16} width={width - 32} height={height - 32}
                    fill="none" stroke={fgColor} strokeWidth={1} />
                <g transform="translate(40,40)">{qrContent}</g>
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

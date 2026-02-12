import React from 'react';

export interface FrameRenderProps {
    qrContent: React.ReactNode;
    qrSize: number;
    fgColor: string;
    bgColor: string;
    text?: string;
}

export interface FrameRenderer {
    name: string;
    getViewBox(qrSize: number): { width: number; height: number };
    render(props: FrameRenderProps): React.ReactNode;
}

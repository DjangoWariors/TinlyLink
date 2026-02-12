import { useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * Hook for downloading QR codes from SVG elements.
 * Uses SVG serialization → canvas → blob (no html-to-image dependency).
 */
export function useQRDownload() {
    const downloadSVG = useCallback((svgElement: SVGSVGElement, filename: string) => {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        triggerDownload(blob, filename);
    }, []);

    const downloadPNG = useCallback((svgElement: SVGSVGElement, filename: string, scale = 2) => {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgElement);

        // Get dimensions from the SVG element
        const width = svgElement.width.baseVal.value || 200;
        const height = svgElement.height.baseVal.value || 200;

        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            toast.error('Canvas not supported');
            return;
        }

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
                if (blob) {
                    triggerDownload(blob, filename);
                } else {
                    toast.error('Failed to generate PNG');
                }
            }, 'image/png');
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            toast.error('Failed to render QR code');
        };

        img.src = url;
    }, []);

    const download = useCallback((elementOrId: SVGSVGElement | string, format: 'png' | 'svg', filename: string) => {
        const svg = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId) as SVGSVGElement | null
            : elementOrId;

        if (!svg) {
            toast.error('QR code element not found');
            return;
        }

        if (format === 'svg') {
            downloadSVG(svg, filename.endsWith('.svg') ? filename : `${filename}.svg`);
        } else {
            downloadPNG(svg, filename.endsWith('.png') ? filename : `${filename}.png`);
        }
    }, [downloadSVG, downloadPNG]);

    return { download, downloadSVG, downloadPNG };
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

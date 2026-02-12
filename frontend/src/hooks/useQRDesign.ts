import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { QRStyle, QREyeStyle, QRGradientDirection, QRFrame } from '@/types';

export interface QRDesignState {
    qrStyle: QRStyle;
    qrFrame: QRFrame;
    fgColor: string;
    bgColor: string;
    eyeStyle: QREyeStyle;
    eyeColor: string;
    gradientEnabled: boolean;
    gradientStart: string;
    gradientEnd: string;
    gradientDirection: QRGradientDirection;
    frameText: string;
    logoFile: File | null;
    logoPreview: string;
}

export interface QRDesignActions {
    setQrStyle: (s: QRStyle) => void;
    setQrFrame: (f: QRFrame) => void;
    setFgColor: (c: string) => void;
    setBgColor: (c: string) => void;
    setEyeStyle: (s: QREyeStyle) => void;
    setEyeColor: (c: string) => void;
    setGradientEnabled: (v: boolean) => void;
    setGradientStart: (c: string) => void;
    setGradientEnd: (c: string) => void;
    setGradientDirection: (d: QRGradientDirection) => void;
    setFrameText: (t: string) => void;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removeLogo: () => void;
    applyColorPreset: (fg: string, bg: string) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

const DEFAULT_STATE: QRDesignState = {
    qrStyle: 'square',
    qrFrame: 'none',
    fgColor: '#000000',
    bgColor: '#FFFFFF',
    eyeStyle: 'square',
    eyeColor: '#000000',
    gradientEnabled: false,
    gradientStart: '#000000',
    gradientEnd: '#666666',
    gradientDirection: 'vertical',
    frameText: '',
    logoFile: null,
    logoPreview: '',
};

export function useQRDesign(initial?: Partial<QRDesignState>): [QRDesignState, QRDesignActions] {
    const [qrStyle, setQrStyle] = useState<QRStyle>(initial?.qrStyle ?? DEFAULT_STATE.qrStyle);
    const [qrFrame, setQrFrame] = useState<QRFrame>(initial?.qrFrame ?? DEFAULT_STATE.qrFrame);
    const [fgColor, setFgColor] = useState(initial?.fgColor ?? DEFAULT_STATE.fgColor);
    const [bgColor, setBgColor] = useState(initial?.bgColor ?? DEFAULT_STATE.bgColor);
    const [eyeStyle, setEyeStyle] = useState<QREyeStyle>(initial?.eyeStyle ?? DEFAULT_STATE.eyeStyle);
    const [eyeColor, setEyeColor] = useState(initial?.eyeColor ?? DEFAULT_STATE.eyeColor);
    const [gradientEnabled, setGradientEnabled] = useState(initial?.gradientEnabled ?? DEFAULT_STATE.gradientEnabled);
    const [gradientStart, setGradientStart] = useState(initial?.gradientStart ?? DEFAULT_STATE.gradientStart);
    const [gradientEnd, setGradientEnd] = useState(initial?.gradientEnd ?? DEFAULT_STATE.gradientEnd);
    const [gradientDirection, setGradientDirection] = useState<QRGradientDirection>(initial?.gradientDirection ?? DEFAULT_STATE.gradientDirection);
    const [frameText, setFrameText] = useState(initial?.frameText ?? DEFAULT_STATE.frameText);
    const [logoFile, setLogoFile] = useState<File | null>(initial?.logoFile ?? null);
    const [logoPreview, setLogoPreview] = useState(initial?.logoPreview ?? DEFAULT_STATE.logoPreview);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo must be less than 2MB', { id: 'qr-validation' });
            return;
        }
        setLogoFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setLogoPreview(reader.result as string);
        reader.readAsDataURL(file);
    }, []);

    const removeLogo = useCallback(() => {
        setLogoFile(null);
        setLogoPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    const applyColorPreset = useCallback((fg: string, bg: string) => {
        setFgColor(fg);
        setBgColor(bg);
    }, []);

    const state: QRDesignState = {
        qrStyle, qrFrame, fgColor, bgColor,
        eyeStyle, eyeColor,
        gradientEnabled, gradientStart, gradientEnd, gradientDirection,
        frameText, logoFile, logoPreview,
    };

    const actions: QRDesignActions = {
        setQrStyle, setQrFrame, setFgColor, setBgColor,
        setEyeStyle, setEyeColor,
        setGradientEnabled, setGradientStart, setGradientEnd, setGradientDirection,
        setFrameText, handleLogoUpload, removeLogo, applyColorPreset,
        fileInputRef,
    };

    return [state, actions];
}

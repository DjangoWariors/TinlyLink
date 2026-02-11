import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { toPng, toSvg } from 'html-to-image';
import {
  ArrowLeft, Download, Copy, Settings2, Palette,
  Image, Square, Circle, Smartphone,
  Laptop, MessageSquare, QrCode as QrIcon, User,
  Upload, Trash2
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Loading } from '@/components/common';
import { linksAPI, qrCodesAPI } from '@/services/api';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { QRStyle, QRFrame } from '@/types';

const FRAME_OPTIONS: { id: QRFrame; label: string; icon: any }[] = [
  { id: 'none', label: 'None', icon: QrIcon },
  { id: 'simple', label: 'Simple', icon: Square },
  { id: 'scan_me', label: 'Scan Me', icon: QrIcon },
  { id: 'balloon', label: 'Balloon', icon: MessageSquare },
  { id: 'badge', label: 'Badge', icon: User },
  { id: 'phone', label: 'Phone', icon: Smartphone },
  { id: 'polaroid', label: 'Polaroid', icon: Image },
  { id: 'laptop', label: 'Laptop', icon: Laptop },
];

export function LinkQRPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const downloadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR customization state
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [style, setStyle] = useState<QRStyle>('square');
  const [frame, setFrame] = useState<QRFrame>('none');
  const [size, setSize] = useState(300);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch link details
  const { data: link, isLoading, error, refetch } = useQuery({
    queryKey: ['link', id],
    queryFn: () => linksAPI.getLink(id!),
    enabled: !!id,
  });

  // Initialize state from existing QR code if available
  useEffect(() => {
    if (link?.qr_code) {
      const qr = link.qr_code;
      setFgColor(qr.foreground_color);
      setBgColor(qr.background_color);
      setStyle(qr.style);
      setFrame((qr.frame as QRFrame) || 'none');
      if (qr.logo_url) setLogo(qr.logo_url);
    }
  }, [link]);

  const handleCopyLink = async () => {
    if (link?.short_url) {
      await navigator.clipboard.writeText(link.short_url);
      toast.success('Link copied to clipboard!');
    }
  };

  const handleSave = async () => {
    if (!link) return;
    setIsSaving(true);
    try {
      if (logoFile) {
        // Use FormData when there's a logo file to upload
        const formData = new FormData();
        formData.append('style', style);
        formData.append('frame', frame);
        formData.append('foreground_color', fgColor);
        formData.append('background_color', bgColor);
        formData.append('logo', logoFile);

        if (link.qr_code) {
          await qrCodesAPI.updateQRCode(link.qr_code.id, formData);
          toast.success('QR Code updated!');
        } else {
          formData.append('link_id', link.id);
          await qrCodesAPI.createQRCodeWithLogo(formData);
          toast.success('QR Code created!');
        }
      } else {
        const qrData = {
          style,
          frame,
          foreground_color: fgColor,
          background_color: bgColor,
          ...(logo === null && link.qr_code?.logo_url ? { remove_logo: true } : {}),
        };

        if (link.qr_code) {
          await qrCodesAPI.updateQRCode(link.qr_code.id, qrData);
          toast.success('QR Code updated!');
        } else {
          await qrCodesAPI.createQRCode({
            link_id: link.id,
            ...qrData
          });
          toast.success('QR Code created!');
        }
      }
      refetch();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      setLogo(null);
      setLogoFile(null);
      return;
    }

    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be less than 2MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = async (format: 'png' | 'svg') => {
    if (!downloadRef.current) {
      toast.error('Could not find QR Code element');
      return;
    }

    try {
      // Standardize export size
      // We rely on the size prop being correct (max 512)
      const options = {
        quality: 1,
        pixelRatio: 1, // 1:1 match with displayed size (max 512px)
        backgroundColor: 'white',
      };

      let dataUrl = '';
      if (format === 'svg') {
        dataUrl = await toSvg(downloadRef.current, options);
      } else {
        dataUrl = await toPng(downloadRef.current, options);
      }

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr-${link?.short_code || 'code'}.${format}`;
      a.click();
      toast.success(`${format.toUpperCase()} downloaded!`);

    } catch (err) {
      console.error('Download failed', err);
      toast.error('Failed to generate download');
    }
  };

  // ... rest of component

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading size="lg" />
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Link not found</h2>
        <p className="text-gray-500 mb-4">The link you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/dashboard/links')}>Back to Links</Button>
      </div>
    );
  }

  const presetColors = [
    '#000000', '#1f2937', '#374151', '#4b5563',
    '#f6821f', '#ea580c', '#dc2626', '#16a34a',
    '#2563eb', '#7c3aed', '#db2777', '#0891b2',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/dashboard/links/${id}`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">QR Code</h1>
          <p className="text-gray-500 mt-1 truncate">{link.short_url}</p>
        </div>
        <Button variant="outline" onClick={handleCopyLink}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Link
        </Button>
        <Button onClick={handleSave} isLoading={isSaving}>
          Save Changes
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Code Preview */}
        <Card className="flex flex-col items-center justify-center p-8">
          <div
            ref={downloadRef}
            className="p-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: bgColor }}
          >
            <QRCodeGenerator
              value={link.short_url}
              size={size}
              style={style}
              frame={frame}
              fgColor={fgColor}
              bgColor={bgColor} // Pass bgColor so SVG rect is filled if needed
              level="M"
              title={link.title || link.short_code}
              logoUrl={logo || undefined}
            />
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={() => handleDownload('png')}>
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
            <Button variant="outline" onClick={() => handleDownload('svg')}>
              <Download className="w-4 h-4 mr-2" />
              Download SVG
            </Button>
          </div>

          <p className="text-sm text-gray-500 mt-4 text-center">
            {FRAME_OPTIONS.find(f => f.id === frame)?.label} • <span className="capitalize">{style}</span>
            <br />
            <a
              href={link.short_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {link.short_url}
            </a>
          </p>
        </Card>

        {/* Customization Options */}
        <div className="space-y-6">
          {/* Logo Upload - NEW */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" /> Logo
              </CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {logo ? (
                <div className="flex items-center gap-4 p-3 border rounded-lg bg-gray-50">
                  <div className="w-12 h-12 rounded bg-white border flex items-center justify-center overflow-hidden">
                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">Logo Uploaded</p>
                    <p className="text-xs text-gray-500">Will appear in center</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setLogo(null); setLogoFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Logo
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Recommended: Square PNG, transparent background
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Frame Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" /> Frame
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-4 gap-2">
              {FRAME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setFrame(opt.id)}
                    className={`p-2 border rounded-lg flex flex-col items-center gap-1.5 transition-all h-20 justify-center ${frame === opt.id
                      ? 'border-primary bg-primary-50 text-primary'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] text-center leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Style Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" /> Style
              </CardTitle>
            </CardHeader>
            <div className="grid grid-cols-3 gap-3">
              {(['square', 'dots', 'rounded'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`p-3 border rounded-lg text-sm text-center capitalize transition-colors ${style === s
                    ? 'border-primary bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Colors
              </CardTitle>
            </CardHeader>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Foreground Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <Input
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="flex-1 font-mono"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {presetColors.slice(0, 8).map((color) => (
                    <button
                      key={color}
                      onClick={() => setFgColor(color)}
                      className={`w-6 h-6 rounded-full border ${fgColor === color ? 'border-primary ring-1 ring-primary' : 'border-gray-300'
                        }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Background Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <Input
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size: {size}px
                </label>
                <input
                  type="range"
                  min="128"
                  max="512"
                  step="32"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

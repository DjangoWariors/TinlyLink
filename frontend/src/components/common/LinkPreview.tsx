import { useState, useEffect } from 'react';
import { ExternalLink, Globe, Lock, Calendar, Copy, QrCode, Check } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './index';
import { Button } from './Button';
import { QRFramedRenderer } from '../qr';
import toast from 'react-hot-toast';

interface LinkPreviewProps {
  originalUrl: string;
  shortUrl?: string;
  title?: string;
  expiresAt?: string;
  hasPassword?: boolean;
  createQR?: boolean;
}

export function LinkPreview({
  originalUrl,
  shortUrl,
  title,
  expiresAt,
  hasPassword,
  createQR
}: LinkPreviewProps) {
  const [favicon, setFavicon] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (originalUrl) {
      try {
        const url = new URL(originalUrl.startsWith('http') ? originalUrl : `https://${originalUrl}`);
        setFavicon(`https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`);
      } catch {
        setFavicon('');
      }
    }
  }, [originalUrl]);

  const handleCopy = () => {
    if (shortUrl) {
      navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!originalUrl) {
    return (
      <Card className="bg-gray-50">
        <div className="text-center py-8 text-gray-400">
          <Globe className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Enter a URL to see preview</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="space-y-4">
        {/* Header with favicon */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {favicon ? (
              <img src={favicon} alt="" className="w-6 h-6" onError={() => setFavicon('')} />
            ) : (
              <Globe className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {title || 'Untitled Link'}
            </p>
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-primary truncate block"
            >
              {originalUrl}
            </a>
          </div>
        </div>

        {/* Short URL Preview */}
        {shortUrl && (
          <div className="p-3 bg-primary-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-500 mb-1">Short URL</p>
                <p className="text-sm font-medium text-primary truncate">{shortUrl}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="flex-shrink-0 ml-2"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="flex flex-wrap gap-2">
          {hasPassword && (
            <Badge variant="warning" className="text-xs">
              <Lock className="w-3 h-3 mr-1" /> Password Protected
            </Badge>
          )}
          {expiresAt && (
            <Badge variant="default" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" /> Expires {new Date(expiresAt).toLocaleDateString()}
            </Badge>
          )}
          {createQR && (
            <Badge variant="primary" className="text-xs">
              <QrCode className="w-3 h-3 mr-1" /> QR Code
            </Badge>
          )}
        </div>

        {/* QR Preview Toggle */}
        {shortUrl && (
          <div>
            <button
              onClick={() => setShowQR(!showQR)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <QrCode className="w-3 h-3" />
              {showQR ? 'Hide QR Preview' : 'Show QR Preview'}
            </button>
            {showQR && (
              <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 flex justify-center">
                <QRFramedRenderer value={shortUrl} size={120} />
              </div>
            )}
          </div>
        )}

        {/* Open Link */}
        {shortUrl && (
          <a
            href={shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2 text-sm text-gray-600 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Link
          </a>
        )}
      </div>
    </Card>
  );
}

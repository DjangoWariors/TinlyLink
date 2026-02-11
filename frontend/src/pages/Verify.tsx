/**
 * Verify Page - Public product verification page
 * Shows verification results when customers scan QR codes
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Package,
  Calendar,
  MapPin,
  Globe,
  Eye,
  RefreshCw,
  ExternalLink,
  Loader2,
  Info,
} from 'lucide-react';
import { Button, Card } from '@/components/common';
import { publicAPI } from '@/services/api';
import type { VerificationResult } from '@/types';

// Verification status configuration
const STATUS_CONFIG = {
  authentic: {
    icon: ShieldCheck,
    title: 'Authentic Product',
    description: 'This product has been verified as genuine.',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    iconColor: 'text-green-500',
    iconBg: 'bg-green-100',
  },
  suspicious: {
    icon: ShieldAlert,
    title: 'Verification Warning',
    description: 'This product may require additional verification.',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-100',
  },
  counterfeit: {
    icon: ShieldX,
    title: 'Verification Failed',
    description: 'This product could not be verified as authentic.',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-100',
  },
  unknown: {
    icon: Shield,
    title: 'Unknown Product',
    description: 'This serial number is not in our database.',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    iconColor: 'text-gray-500',
    iconBg: 'bg-gray-100',
  },
};

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const serial = searchParams.get('serial') || searchParams.get('s') || '';
  const [manualSerial, setManualSerial] = useState('');

  // Verify the serial number
  const { data: result, isLoading, error, refetch } = useQuery({
    queryKey: ['verify', serial],
    queryFn: () => publicAPI.verify(serial),
    enabled: !!serial,
    retry: false,
  });

  // Determine status config
  const status = result?.status || 'unknown';
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unknown;
  const StatusIcon = config.icon;

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualSerial.trim()) {
      navigate(`/verify?serial=${encodeURIComponent(manualSerial.trim())}`);
    }
  };

  // No serial provided - show input form
  if (!serial) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Product Verification</h1>
            <p className="text-gray-500 mt-2">
              Enter the serial number from your product to verify authenticity
            </p>
          </div>

          <form onSubmit={handleManualVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={manualSerial}
                onChange={(e) => setManualSerial(e.target.value)}
                placeholder="Enter serial number..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!manualSerial.trim()}>
              <Shield className="w-4 h-4 mr-2" />
              Verify Product
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            The serial number can be found on your product packaging or certificate of authenticity.
          </p>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center py-12">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Verifying Product...</h2>
          <p className="text-gray-500 mt-2">Please wait while we check the authenticity</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification Error</h2>
          <p className="text-gray-500 mb-6">
            Unable to verify this product. Please try again or contact support.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => navigate('/verify')}>
              Enter Different Serial
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${config.bgColor} flex items-center justify-center p-4`}>
      <div className="max-w-lg w-full space-y-4">
        {/* Main Verification Result */}
        <Card className={`border-2 ${config.borderColor}`}>
          {/* Status Header */}
          <div className="text-center mb-6">
            <div className={`w-20 h-20 ${config.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <StatusIcon className={`w-10 h-10 ${config.iconColor}`} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
            <p className="text-gray-600 mt-2">{config.description}</p>
          </div>

          {/* Serial Number Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Serial Number</p>
            <p className="font-mono text-lg font-bold text-gray-900">{serial}</p>
          </div>

          {/* Product Info */}
          {result?.product && (
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Product Information
              </h3>
              <dl className="space-y-2">
                {result.product.name && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Product</dt>
                    <dd className="font-medium text-gray-900">{result.product.name}</dd>
                  </div>
                )}
                {result.product.sku && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">SKU</dt>
                    <dd className="font-mono text-gray-900">{result.product.sku}</dd>
                  </div>
                )}
                {result.product.batch && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Batch</dt>
                    <dd className="font-mono text-gray-900">{result.product.batch}</dd>
                  </div>
                )}
                {result.product.manufacture_date && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Manufactured</dt>
                    <dd className="text-gray-900">
                      {new Date(result.product.manufacture_date).toLocaleDateString()}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Verification Stats */}
          {result?.verification && (
            <div className="border-t border-gray-200 pt-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Verification History
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{result.verification.scan_count}</p>
                  <p className="text-sm text-gray-500">Total Scans</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    {result.verification.first_scanned
                      ? new Date(result.verification.first_scanned).toLocaleDateString()
                      : 'First scan'}
                  </p>
                  <p className="text-sm text-gray-500">First Verified</p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {result?.warnings && result.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">Attention Required</h4>
                  <ul className="mt-2 space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-yellow-800">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Manufacturer Info */}
          {result?.manufacturer && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Manufacturer
              </h3>
              <div className="flex items-center gap-4">
                {result.manufacturer.logo && (
                  <img
                    src={result.manufacturer.logo}
                    alt={result.manufacturer.name}
                    className="w-12 h-12 object-contain rounded"
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900">{result.manufacturer.name}</p>
                  {result.manufacturer.website && (
                    <a
                      href={result.manufacturer.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      Visit website
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Additional Actions */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/verify')}
            >
              Verify Another Product
            </Button>
            {result?.support_url && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(result.support_url, '_blank')}
              >
                <Info className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            )}
          </div>
        </Card>

        {/* Trust Badge */}
        <div className="text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Powered by TinlyLink Product Verification</span>
          </div>
          <p className="mt-1">
            Verified at {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerifyPage;

import React from 'react';
import {
    Link2, User, Wifi, Mail, MessageSquare, Phone, FileText, Calendar, MapPin,
    CreditCard, ShoppingBag, Menu, File, Share2, Store, Tag, LayoutGrid, Lock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/common/Card';
import { Badge } from '@/components/common';
import type { QRType } from '@/types';

const QR_TYPES: Array<{ type: QRType; label: string; icon: React.ElementType; description: string; pro?: boolean; business?: boolean }> = [
    { type: 'link', label: 'Website Link', icon: Link2, description: 'Link to any URL' },
    { type: 'vcard', label: 'Contact Card', icon: User, description: 'Share contact info', pro: true },
    { type: 'wifi', label: 'WiFi Network', icon: Wifi, description: 'Connect to WiFi', pro: true },
    { type: 'email', label: 'Email', icon: Mail, description: 'Send an email', pro: true },
    { type: 'sms', label: 'SMS Message', icon: MessageSquare, description: 'Send a text', pro: true },
    { type: 'phone', label: 'Phone Call', icon: Phone, description: 'Make a call', pro: true },
    { type: 'text', label: 'Plain Text', icon: FileText, description: 'Display text', pro: true },
    { type: 'calendar', label: 'Calendar Event', icon: Calendar, description: 'Add to calendar', pro: true },
    { type: 'location', label: 'Location', icon: MapPin, description: 'Show on map', pro: true },
    { type: 'upi', label: 'UPI Payment', icon: CreditCard, description: 'Accept UPI payments', business: true },
    { type: 'pix', label: 'Pix Payment', icon: CreditCard, description: 'Brazil Pix payments', business: true },
    { type: 'product', label: 'Product', icon: ShoppingBag, description: 'Product info page', business: true },
    { type: 'menu', label: 'Menu', icon: Menu, description: 'Restaurant menu', business: true },
    { type: 'document', label: 'Document', icon: File, description: 'Share a document', pro: true },
    { type: 'pdf', label: 'PDF', icon: FileText, description: 'Share a PDF file', pro: true },
    { type: 'multi_url', label: 'Multi URL', icon: LayoutGrid, description: 'Multiple destinations', business: true },
    { type: 'app_store', label: 'App Store', icon: Store, description: 'iOS/Android app links', pro: true },
    { type: 'social', label: 'Social Links', icon: Share2, description: 'Social media profiles', pro: true },
    { type: 'serial', label: 'Serial Code', icon: Tag, description: 'Unique product codes', business: true },
];

export { QR_TYPES };

interface QRTypeSelectorProps {
    value: QRType;
    onChange: (type: QRType) => void;
    isPaidPlan: boolean;
    showUpgradeToast: (feature: string) => void;
}

export function QRTypeSelector({ value, onChange, isPaidPlan, showUpgradeToast }: QRTypeSelectorProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold">1</span>
                    QR Code Type
                </CardTitle>
                <CardDescription>What kind of QR code do you want?</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {QR_TYPES.map((item) => {
                    const Icon = item.icon;
                    const isLocked = (item.pro || item.business) && !isPaidPlan;
                    const badgeLabel = item.business ? 'BIZ' : item.pro ? 'PRO' : null;
                    return (
                        <button
                            key={item.type}
                            onClick={() => {
                                if (isLocked) { showUpgradeToast(item.label); return; }
                                onChange(item.type);
                            }}
                            className={`relative p-3 border-2 rounded-xl text-center transition-all ${value === item.type
                                ? 'border-primary bg-primary-50 ring-2 ring-primary/20'
                                : isLocked
                                    ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {isLocked && <Lock className="w-3 h-3 absolute top-1 left-1 text-gray-400" />}
                            <Icon className={`w-6 h-6 mx-auto mb-1 ${value === item.type ? 'text-primary' : isLocked ? 'text-gray-400' : 'text-gray-500'}`} />
                            <span className={`text-xs font-medium block truncate ${isLocked ? 'text-gray-400' : ''}`}>{item.label}</span>
                            {badgeLabel && <Badge variant="primary" className="text-[8px] absolute top-1 right-1 px-1">{badgeLabel}</Badge>}
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}

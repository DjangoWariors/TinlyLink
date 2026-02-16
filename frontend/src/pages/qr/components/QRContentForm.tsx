import React from 'react';
import {
    Search, X, Check, Zap, Globe, Lock,
} from 'lucide-react';
import { Link as RouterLink } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@/components/common/Card';
import { Loading, Badge } from '@/components/common';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { linksAPI } from '@/services/api';
import { useDebounce } from '@/hooks';
import toast from 'react-hot-toast';
import { QR_TYPES } from './QRTypeSelector';
import type { QRType, QRContentData, Link as LinkType } from '@/types';

interface QRContentFormProps {
    qrType: QRType;
    title: string;
    setTitle: (t: string) => void;
    contentData: QRContentData;
    setContentData: React.Dispatch<React.SetStateAction<QRContentData>>;
    isDynamic: boolean;
    setIsDynamic: (v: boolean) => void;
    destinationUrl: string;
    setDestinationUrl: (u: string) => void;
    selectedLinkId: string;
    setSelectedLinkId: (id: string) => void;
    linkSearch: string;
    setLinkSearch: (s: string) => void;
    isPaidPlan: boolean;
    showUpgradeToast: (feature: string) => void;
}

export function QRContentForm({
    qrType, title, setTitle, contentData, setContentData,
    isDynamic, setIsDynamic, destinationUrl, setDestinationUrl,
    selectedLinkId, setSelectedLinkId, linkSearch, setLinkSearch,
    isPaidPlan, showUpgradeToast,
}: QRContentFormProps) {
    const debouncedLinkSearch = useDebounce(linkSearch, 300);

    const { data: linksData, isLoading: linksLoading } = useQuery({
        queryKey: ['linksForQR', debouncedLinkSearch],
        queryFn: () => linksAPI.getLinks({ page: 1, page_size: 50, search: debouncedLinkSearch || undefined }),
        enabled: qrType === 'link',
    });

    const links = linksData?.results || [];

    const updateField = (key: string, value: any) => {
        setContentData((prev: QRContentData) => ({ ...prev, [key]: value }));
    };

    const d = contentData as any;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary text-white text-sm flex items-center justify-center font-bold">2</span>
                    {QR_TYPES.find(t => t.type === qrType)?.label} Details
                </CardTitle>
            </CardHeader>
            <div className="space-y-4">
                {/* Title */}
                <div>
                    <label className="label">Title (Optional)</label>
                    <Input placeholder="Give this QR code a name..." value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                {/* Dynamic toggle */}
                <div className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 ${!isPaidPlan ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3">
                        <Zap className={`w-5 h-5 ${isDynamic ? 'text-primary' : 'text-gray-400'}`} />
                        <div>
                            <p className="text-sm font-medium text-gray-900">Dynamic QR Code</p>
                            <p className="text-xs text-gray-500">Change destination without reprinting</p>
                        </div>
                        <Badge variant="primary" className="text-xs">PRO</Badge>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (!isPaidPlan) { showUpgradeToast('Dynamic QR codes'); return; }
                            setIsDynamic(!isDynamic);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDynamic ? 'bg-primary' : 'bg-gray-300'} ${!isPaidPlan ? 'cursor-not-allowed' : ''}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDynamic ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {isDynamic && qrType !== 'link' && (
                    <div>
                        <label className="label flex items-center gap-2"><Globe className="w-4 h-4" /> Destination URL</label>
                        <Input type="url" placeholder="https://example.com" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} />
                        <p className="text-xs text-gray-500 mt-1">The URL this QR code will redirect to. You can change this later.</p>
                    </div>
                )}

                {/* Type-specific fields */}
                {qrType === 'link' && (
                    <LinkSelector
                        links={links} loading={linksLoading}
                        search={linkSearch} setSearch={setLinkSearch}
                        selected={selectedLinkId} setSelected={setSelectedLinkId}
                    />
                )}

                {qrType === 'vcard' && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><label className="label">Full Name *</label><Input value={d.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="John Doe" /></div>
                        <div><label className="label">Organization</label><Input value={d.organization || ''} onChange={e => updateField('organization', e.target.value)} placeholder="Company" /></div>
                        <div><label className="label">Job Title</label><Input value={d.title || ''} onChange={e => updateField('title', e.target.value)} placeholder="Manager" /></div>
                        <div><label className="label">Phone</label><Input value={d.phone || ''} onChange={e => updateField('phone', e.target.value)} placeholder="+1234567890" /></div>
                        <div><label className="label">Email</label><Input value={d.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="email@example.com" /></div>
                        <div className="col-span-2"><label className="label">Website</label><Input value={d.website || ''} onChange={e => updateField('website', e.target.value)} placeholder="https://example.com" /></div>
                    </div>
                )}

                {qrType === 'wifi' && (
                    <div className="space-y-3">
                        <div><label className="label">Network Name (SSID) *</label><Input value={d.ssid || ''} onChange={e => updateField('ssid', e.target.value)} placeholder="MyWiFi" /></div>
                        <div><label className="label">Password</label><Input type="text" value={d.password || ''} onChange={e => updateField('password', e.target.value)} placeholder="WiFi password" /></div>
                        <div>
                            <label className="label">Security Type</label>
                            <select className="input" value={d.auth || 'WPA'} onChange={e => updateField('auth', e.target.value)}>
                                <option value="WPA">WPA/WPA2</option>
                                <option value="WEP">WEP</option>
                                <option value="nopass">No Password</option>
                            </select>
                        </div>
                    </div>
                )}

                {qrType === 'email' && (
                    <div className="space-y-3">
                        <div><label className="label">Email Address *</label><Input value={d.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="recipient@example.com" /></div>
                        <div><label className="label">Subject</label><Input value={d.subject || ''} onChange={e => updateField('subject', e.target.value)} placeholder="Subject line" /></div>
                        <div><label className="label">Message</label><textarea className="input min-h-[80px]" value={d.body || ''} onChange={e => updateField('body', e.target.value)} placeholder="Email body..." /></div>
                    </div>
                )}

                {qrType === 'sms' && (
                    <div className="space-y-3">
                        <div><label className="label">Phone Number *</label><Input value={d.phone || ''} onChange={e => updateField('phone', e.target.value)} placeholder="+1234567890" /></div>
                        <div><label className="label">Pre-filled Message</label><textarea className="input min-h-[80px]" value={d.message || ''} onChange={e => updateField('message', e.target.value)} placeholder="Your message..." /></div>
                    </div>
                )}

                {qrType === 'phone' && (
                    <div><label className="label">Phone Number *</label><Input value={d.phone || ''} onChange={e => updateField('phone', e.target.value)} placeholder="+1234567890" /></div>
                )}

                {qrType === 'text' && (
                    <div><label className="label">Text Content *</label><textarea className="input min-h-[120px]" value={d.text || ''} onChange={e => updateField('text', e.target.value)} placeholder="Enter your text here..." /></div>
                )}

                {qrType === 'calendar' && (
                    <div className="space-y-3">
                        <div><label className="label">Event Title *</label><Input value={d.title || ''} onChange={e => updateField('title', e.target.value)} placeholder="Meeting" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="label">Start Date & Time</label><Input type="datetime-local" value={d.start || ''} onChange={e => updateField('start', e.target.value)} /></div>
                            <div><label className="label">End Date & Time</label><Input type="datetime-local" value={d.end || ''} onChange={e => updateField('end', e.target.value)} /></div>
                        </div>
                        <div><label className="label">Location</label><Input value={d.location || ''} onChange={e => updateField('location', e.target.value)} placeholder="123 Main St" /></div>
                        <div><label className="label">Description</label><textarea className="input" value={d.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Event details..." /></div>
                    </div>
                )}

                {qrType === 'location' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="label">Latitude *</label><Input type="number" step="any" value={d.latitude || ''} onChange={e => updateField('latitude', parseFloat(e.target.value))} placeholder="37.7749" /></div>
                            <div><label className="label">Longitude *</label><Input type="number" step="any" value={d.longitude || ''} onChange={e => updateField('longitude', parseFloat(e.target.value))} placeholder="-122.4194" /></div>
                        </div>
                        <div><label className="label">Location Name</label><Input value={d.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Headquarters" /></div>
                    </div>
                )}

                {qrType === 'upi' && (
                    <div className="space-y-3">
                        <div><label className="label">UPI ID (VPA) *</label><Input value={d.pa || ''} onChange={e => updateField('pa', e.target.value)} placeholder="merchant@upi" /></div>
                        <div><label className="label">Payee Name *</label><Input value={d.pn || ''} onChange={e => updateField('pn', e.target.value)} placeholder="Store Name" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="label">Amount</label><Input type="number" step="0.01" value={d.am || ''} onChange={e => updateField('am', e.target.value)} placeholder="100.00" /></div>
                            <div><label className="label">Currency</label><Input value={d.cu || 'INR'} onChange={e => updateField('cu', e.target.value)} placeholder="INR" /></div>
                        </div>
                        <div><label className="label">Transaction Note</label><Input value={d.tn || ''} onChange={e => updateField('tn', e.target.value)} placeholder="Payment for order" /></div>
                    </div>
                )}

                {qrType === 'pix' && (
                    <div className="space-y-3">
                        <div><label className="label">Pix Key *</label><Input value={d.key || ''} onChange={e => updateField('key', e.target.value)} placeholder="CPF, email, phone, or random key" /></div>
                        <div><label className="label">Receiver Name *</label><Input value={d.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Receiver Name" /></div>
                        <div><label className="label">City *</label><Input value={d.city || ''} onChange={e => updateField('city', e.target.value)} placeholder="São Paulo" /></div>
                        <div><label className="label">Amount</label><Input type="number" step="0.01" value={d.amount || ''} onChange={e => updateField('amount', e.target.value)} placeholder="50.00" /></div>
                    </div>
                )}

                {qrType === 'product' && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="label">Product Name *</label><Input value={d.name || ''} onChange={e => updateField('name', e.target.value)} placeholder="Widget Pro" /></div>
                            <div><label className="label">SKU *</label><Input value={d.sku || ''} onChange={e => updateField('sku', e.target.value)} placeholder="WGT-001" /></div>
                        </div>
                        <div><label className="label">Brand</label><Input value={d.brand || ''} onChange={e => updateField('brand', e.target.value)} placeholder="Brand Name" /></div>
                        <div><label className="label">Description</label><textarea className="input min-h-[80px]" value={d.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Product description..." /></div>
                        <div><label className="label">Buy URL</label><Input value={d.buy_url || ''} onChange={e => updateField('buy_url', e.target.value)} placeholder="https://store.com/product" /></div>
                    </div>
                )}

                {qrType === 'menu' && (
                    <div className="space-y-3">
                        <div><label className="label">Restaurant Name *</label><Input value={d.restaurant_name || ''} onChange={e => updateField('restaurant_name', e.target.value)} placeholder="My Restaurant" /></div>
                        <div><label className="label">Menu URL *</label><Input value={d.menu_url || ''} onChange={e => updateField('menu_url', e.target.value)} placeholder="https://restaurant.com/menu" /></div>
                        <div><label className="label">Logo URL</label><Input value={d.logo_url || ''} onChange={e => updateField('logo_url', e.target.value)} placeholder="https://restaurant.com/logo.png" /></div>
                    </div>
                )}

                {(qrType === 'document' || qrType === 'pdf') && (
                    <div className="space-y-3">
                        <div><label className="label">Title *</label><Input value={d.title || ''} onChange={e => updateField('title', e.target.value)} placeholder="Document Title" /></div>
                        <div><label className="label">{qrType === 'pdf' ? 'PDF URL *' : 'Document URL *'}</label><Input value={d[qrType === 'pdf' ? 'pdf_url' : 'file_url'] || ''} onChange={e => updateField(qrType === 'pdf' ? 'pdf_url' : 'file_url', e.target.value)} placeholder="https://example.com/document" /></div>
                        <div><label className="label">Description</label><textarea className="input min-h-[60px]" value={d.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="Brief description..." /></div>
                        {qrType === 'pdf' && (
                            <div><label className="label">Author</label><Input value={d.author || ''} onChange={e => updateField('author', e.target.value)} placeholder="Author Name" /></div>
                        )}
                    </div>
                )}

                {qrType === 'app_store' && (
                    <div className="space-y-3">
                        <div><label className="label">App Name *</label><Input value={d.app_name || ''} onChange={e => updateField('app_name', e.target.value)} placeholder="My App" /></div>
                        <div><label className="label">iOS App Store URL</label><Input value={d.ios_url || ''} onChange={e => updateField('ios_url', e.target.value)} placeholder="https://apps.apple.com/app/..." /></div>
                        <div><label className="label">Android Play Store URL</label><Input value={d.android_url || ''} onChange={e => updateField('android_url', e.target.value)} placeholder="https://play.google.com/store/apps/..." /></div>
                        <div><label className="label">Fallback URL *</label><Input value={d.fallback_url || ''} onChange={e => updateField('fallback_url', e.target.value)} placeholder="https://myapp.com" /></div>
                        <div><label className="label">Description</label><textarea className="input min-h-[60px]" value={d.description || ''} onChange={e => updateField('description', e.target.value)} placeholder="App description..." /></div>
                    </div>
                )}

                {qrType === 'multi_url' && (
                    <div className="space-y-3">
                        <div><label className="label">Page Title *</label><Input value={d.title || ''} onChange={e => updateField('title', e.target.value)} placeholder="My Links" /></div>
                        <div><label className="label">Subtitle</label><Input value={d.subtitle || ''} onChange={e => updateField('subtitle', e.target.value)} placeholder="Check out my links" /></div>
                        <div>
                            <label className="label">Links *</label>
                            {(d.links || []).map((link: any, idx: number) => (
                                <div key={idx} className="flex gap-2 mb-2">
                                    <Input className="flex-1" value={link.label || ''} onChange={e => {
                                        const arr = [...(d.links || [])];
                                        arr[idx] = { ...arr[idx], label: e.target.value };
                                        updateField('links', arr);
                                    }} placeholder="Label" />
                                    <Input className="flex-[2]" value={link.url || ''} onChange={e => {
                                        const arr = [...(d.links || [])];
                                        arr[idx] = { ...arr[idx], url: e.target.value };
                                        updateField('links', arr);
                                    }} placeholder="https://..." />
                                    <button type="button" onClick={() => {
                                        const arr = [...(d.links || [])];
                                        arr.splice(idx, 1);
                                        updateField('links', arr);
                                    }} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <button type="button" onClick={() => updateField('links', [...(d.links || []), { label: '', url: '' }])} className="text-sm text-primary hover:underline">+ Add Link</button>
                        </div>
                    </div>
                )}

                {qrType === 'social' && (
                    <div className="space-y-3">
                        <div><label className="label">Profile Title *</label><Input value={d.title || ''} onChange={e => updateField('title', e.target.value)} placeholder="My Social Profiles" /></div>
                        <div><label className="label">Bio</label><textarea className="input min-h-[60px]" value={d.bio || ''} onChange={e => updateField('bio', e.target.value)} placeholder="Short bio..." /></div>
                        <div>
                            <label className="label">Social Links *</label>
                            {(d.links || []).map((link: any, idx: number) => (
                                <div key={idx} className="flex gap-2 mb-2">
                                    <select className="input w-32" value={link.platform || ''} onChange={e => {
                                        const arr = [...(d.links || [])];
                                        arr[idx] = { ...arr[idx], platform: e.target.value };
                                        updateField('links', arr);
                                    }}>
                                        <option value="">Platform</option>
                                        {['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'github', 'website'].map(p => (
                                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                        ))}
                                    </select>
                                    <Input className="flex-1" value={link.url || ''} onChange={e => {
                                        const arr = [...(d.links || [])];
                                        arr[idx] = { ...arr[idx], url: e.target.value };
                                        updateField('links', arr);
                                    }} placeholder="https://..." />
                                    <button type="button" onClick={() => {
                                        const arr = [...(d.links || [])];
                                        arr.splice(idx, 1);
                                        updateField('links', arr);
                                    }} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <button type="button" onClick={() => updateField('links', [...(d.links || []), { platform: '', url: '' }])} className="text-sm text-primary hover:underline">+ Add Social Link</button>
                        </div>
                    </div>
                )}

                {qrType === 'serial' && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-sm font-medium text-blue-800 mb-1">Serial Code QR</p>
                        <p className="text-sm text-blue-700 mb-3">
                            Serial QR codes are generated via the Serial Batches module. Create bulk product authentication codes with unique tracking.
                        </p>
                        <RouterLink to="/dashboard/serial-batches">
                            <Button variant="outline" size="sm">Go to Serial Batches</Button>
                        </RouterLink>
                    </div>
                )}
            </div>
        </Card>
    );
}

/* ── Link Selector Sub-component ──────────────────────────────── */

function LinkSelector({ links, loading, search, setSearch, selected, setSelected }: {
    links: any[]; loading: boolean;
    search: string; setSearch: (s: string) => void;
    selected: string; setSelected: (id: string) => void;
}) {
    return (
        <div className="space-y-3">
            <label className="label">Select Link</label>
            <Input
                placeholder="Search links..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                rightIcon={search ? <button onClick={() => setSearch('')}><X className="w-4 h-4" /></button> : undefined}
            />
            <div className="border rounded-xl max-h-48 overflow-y-auto">
                {loading ? <div className="p-4 text-center"><Loading /></div> : links.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">No links found</div>
                ) : links.slice(0, 10).map((link: any) => (
                    <button
                        key={link.id}
                        onClick={() => setSelected(link.id)}
                        className={`w-full px-3 py-2 text-left border-b last:border-0 flex items-center justify-between ${selected === link.id ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{link.title || link.short_code}</p>
                            <p className="text-xs text-gray-500 truncate">{link.short_url}</p>
                        </div>
                        {selected === link.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    </button>
                ))}
            </div>
        </div>
    );
}

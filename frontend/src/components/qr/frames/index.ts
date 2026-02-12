import type { FrameRenderer } from './types';
import { SimpleFrame } from './SimpleFrame';
import { ScanMeFrame } from './ScanMeFrame';
import {
    BalloonFrame, BadgeFrame, PolaroidFrame, TicketFrame,
    CardFrame, TagFrame, CertificateFrame,
} from './DecorativeFrames';
import { PhoneFrame, LaptopFrame } from './MockupFrames';

export type { FrameRenderer, FrameRenderProps } from './types';

const REGISTRY: Record<string, FrameRenderer> = {
    simple: SimpleFrame,
    scan_me: ScanMeFrame,
    balloon: BalloonFrame,
    badge: BadgeFrame,
    polaroid: PolaroidFrame,
    ticket: TicketFrame,
    card: CardFrame,
    tag: TagFrame,
    certificate: CertificateFrame,
    phone: PhoneFrame,
    laptop: LaptopFrame,
};

export function getFrame(name: string): FrameRenderer | null {
    if (name === 'none') return null;
    return REGISTRY[name] ?? null;
}

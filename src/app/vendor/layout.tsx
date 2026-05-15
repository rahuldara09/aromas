import type { Metadata } from 'next';
import VendorShell from './VendorShell';

export const metadata: Metadata = {
    manifest: '/vendor-manifest.json',
    title: 'Aroma Ops',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'Aroma Ops',
    },
};

export default function VendorLayout({ children }: { children: React.ReactNode }) {
    return <VendorShell>{children}</VendorShell>;
}

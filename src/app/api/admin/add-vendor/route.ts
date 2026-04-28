import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if vendor already exists
        const existingVendor = await adminDb.collection('vendors')
            .where('email', '==', normalizedEmail)
            .where('isVendor', '==', true)
            .limit(1)
            .get();

        if (!existingVendor.empty) {
            return NextResponse.json({ error: 'Vendor email already exists' }, { status: 409 });
        }

        // Add new vendor
        await adminDb.collection('vendors').add({
            email: normalizedEmail,
            isVendor: true,
            isActive: true,
            createdAt: new Date(),
            role: 'vendor'
        });

        return NextResponse.json({ success: true, message: 'Vendor email added successfully' });
    } catch (err) {
        console.error('add-vendor error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
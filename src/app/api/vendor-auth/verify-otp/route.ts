import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { adminAuth } from '@/lib/firebaseAdmin';

const redis = Redis.fromEnv();

export async function POST(request: NextRequest) {
    try {
        const { email, otp } = await request.json();

        if (!email || !otp) {
            return NextResponse.json({ error: 'Email and OTP are required' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const redisKey = `vendor-otp:${normalizedEmail}`;

        // Upstash Redis deserializes values via JSON.parse — a numeric-looking
        // string like "804227" comes back as the number 804227 at runtime.
        // Use String() on both sides to ensure a safe comparison regardless of type.
        const storedOtpRaw = await redis.get(redisKey);

        if (storedOtpRaw === null || storedOtpRaw === undefined) {
            return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 401 });
        }

        if (String(storedOtpRaw) !== String(otp)) {
            return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 401 });
        }

        // OTP matched — delete it immediately (single-use)
        await redis.del(redisKey);

        // Issue a Firebase custom token for this vendor email
        // UID is derived from email for uniqueness
        const uid = `vendor_${normalizedEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const customToken = await adminAuth.createCustomToken(uid, { vendorEmail: normalizedEmail, isVendor: true });

        return NextResponse.json({ success: true, token: customToken, email: normalizedEmail });
    } catch (err) {
        console.error('verify-otp error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

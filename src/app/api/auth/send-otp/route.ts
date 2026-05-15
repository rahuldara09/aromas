import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { Resend } from 'resend';

const redis = Redis.fromEnv();
const resend = new Resend(process.env.RESEND_API_KEY);

function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json();

        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Rate limit: max 3 OTP requests per email per 10 minutes
        const rateLimitKey = `otp-rate:${normalizedEmail}`;
        const count = await redis.incr(rateLimitKey);
        if (count === 1) await redis.expire(rateLimitKey, 600); // 10 min window
        if (count > 3) {
            return NextResponse.json({ error: 'Too many requests. Please wait 10 minutes.' }, { status: 429 });
        }

        // Generate OTP and store in Redis with 5-min TTL
        const otp = generateOTP();
        const redisKey = `user-otp:${normalizedEmail}`;
        await redis.set(redisKey, otp, { ex: 300 }); // 5 minutes

        // Send email via Resend
        const { error } = await resend.emails.send({
            from: 'Aroma Dhaba <noreply@aromadhaba.in>',
            to: [normalizedEmail],
            subject: `${otp} is your Aroma Dhaba login code`,
            html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #fff;">
                    <div style="text-align: center; margin-bottom: 32px;">
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; background: #fef2f2; border-radius: 16px; margin-bottom: 16px;">
                            <span style="font-size: 28px;">🍽️</span>
                        </div>
                        <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a;">Aroma Dhaba</h1>
                        <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">IIM Mumbai's favourite canteen</p>
                    </div>

                    <h2 style="text-align: center; font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">Your login code</h2>
                    <p style="text-align: center; font-size: 14px; color: #64748b; margin: 0 0 28px;">Use this code to sign in. It expires in 5 minutes.</p>

                    <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 24px;">
                        <span style="font-size: 44px; font-weight: 900; color: #ef4444; letter-spacing: 12px; font-family: 'Courier New', monospace;">${otp}</span>
                    </div>

                    <p style="text-align: center; font-size: 13px; color: #94a3b8; margin: 0;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            `,
        });

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('send-otp error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

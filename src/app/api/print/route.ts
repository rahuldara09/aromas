import { NextRequest, NextResponse } from 'next/server';

const PRINTER_SERVICE_URL = 'http://localhost:4000';
const PRINT_TIMEOUT_MS = 5000;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), PRINT_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch(`${PRINTER_SERVICE_URL}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: ctrl.signal,
            });
        } catch (err: any) {
            const isTimeout = err?.name === 'AbortError';
            return NextResponse.json(
                { error: isTimeout ? 'Print request timed out' : 'Printer service unreachable' },
                { status: 503 },
            );
        } finally {
            clearTimeout(timer);
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            return NextResponse.json(
                { error: text || 'Printer returned an error' },
                { status: 502 },
            );
        }

        const text = await response.text().catch(() => 'OK');
        return NextResponse.json({ message: text }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

export async function GET() {
    // Health check — ping the local printer service
    try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`${PRINTER_SERVICE_URL}/health`, { signal: ctrl.signal });
        return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 503 });
    } catch {
        // /health not defined — try root OPTIONS
        try {
            const ctrl2 = new AbortController();
            setTimeout(() => ctrl2.abort(), 2000);
            await fetch(PRINTER_SERVICE_URL, { method: 'OPTIONS', signal: ctrl2.signal });
            return NextResponse.json({ ok: true }, { status: 200 });
        } catch {
            return NextResponse.json({ ok: false }, { status: 503 });
        }
    }
}

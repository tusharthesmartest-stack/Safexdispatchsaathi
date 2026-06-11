import { NextRequest, NextResponse } from 'next/server';
import {
  appendDispatchHistory,
  appendNotFoundLog,
  appendLocationCorrection,
  readSheet,
  updateCell,
} from '@/lib/sheets';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: string = body.action;

    if (action === 'FOUND') {
      await appendDispatchHistory(body);
      // Save location correction if actual differs and user opted in
      if (body.saveNewLocation && body.actualLocation && body.expectedLocation !== body.actualLocation) {
        await appendLocationCorrection({
          brand: body.brand,
          pack: body.pack,
          batch: body.batch,
          expectedLocation: body.expectedLocation,
          actualLocation: body.actualLocation,
          user: body.user,
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'NOT_FOUND') {
      await appendNotFoundLog(body);
      return NextResponse.json({ ok: true });
    }

    if (action === 'APPROVE_LOCATION_CORRECTION') {
      // Supervisor approves a pending row in LOCATION_CORRECTION_LOG
      const rowNum: number = body.rowNum; // 1-indexed including header
      await updateCell('LOCATION_CORRECTION_LOG', `I${rowNum}`, 'APPROVED');
      await updateCell('LOCATION_CORRECTION_LOG', `J${rowNum}`, body.user || 'supervisor');
      await updateCell('LOCATION_CORRECTION_LOG', `K${rowNum}`, new Date().toISOString());
      return NextResponse.json({ ok: true });
    }

    if (action === 'REJECT_LOCATION_CORRECTION') {
      const rowNum: number = body.rowNum;
      await updateCell('LOCATION_CORRECTION_LOG', `I${rowNum}`, 'REJECTED');
      await updateCell('LOCATION_CORRECTION_LOG', `J${rowNum}`, body.user || 'supervisor');
      await updateCell('LOCATION_CORRECTION_LOG', `K${rowNum}`, new Date().toISOString());
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sheet = url.searchParams.get('sheet');
  if (!sheet) return NextResponse.json({ error: 'sheet param required' }, { status: 400 });
  try {
    const rows = await readSheet(sheet);
    return NextResponse.json({ rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

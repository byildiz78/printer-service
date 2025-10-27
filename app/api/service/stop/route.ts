import { NextResponse } from 'next/server';
import { pollingService } from '@/lib/polling-service';

export async function POST() {
  try {
    await pollingService.stop();
    return NextResponse.json({
      success: true,
      message: 'Servis başarıyla durduruldu',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

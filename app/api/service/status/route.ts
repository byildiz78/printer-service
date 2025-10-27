import { NextResponse } from 'next/server';
import { pollingService } from '@/lib/polling-service';

export async function GET() {
  try {
    const status = pollingService.getStatus();
    return NextResponse.json({
      success: true,
      data: status,
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

import { NextResponse } from 'next/server';
import { pollingService } from '@/lib/polling-service';

export async function GET() {
  try {
    const status = pollingService.getStatus();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: {
        isRunning: status.isRunning,
        startedAt: status.startedAt,
        totalJobsProcessed: status.totalJobsProcessed,
        totalJobsFailed: status.totalJobsFailed,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}

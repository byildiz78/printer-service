import { NextRequest, NextResponse } from 'next/server';
import { loadSettings, saveSettings } from '@/lib/settings';
import { pollingService } from '@/lib/polling-service';
import { AppSettings } from '@/types';

// GET - Load settings
export async function GET() {
  try {
    const settings = loadSettings();
    return NextResponse.json({
      success: true,
      data: settings,
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

// PUT - Save settings
export async function PUT(request: NextRequest) {
  try {
    const settings: AppSettings = await request.json();

    // Validate
    if (!settings.PRINTER_API_URL || !settings.PRINTER_IP || !settings.PRINTER_PORT) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tüm alanlar zorunludur',
        },
        { status: 400 }
      );
    }

    // Remove trailing slash from API URL
    settings.PRINTER_API_URL = settings.PRINTER_API_URL.replace(/\/$/, '');

    const saved = saveSettings(settings);

    if (!saved) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ayarlar kaydedilemedi',
        },
        { status: 500 }
      );
    }

    // Polling service'e ayarları yeniden yüklemesini söyle
    pollingService.reloadSettings();

    // Eğer servis çalışıyorsa, yeniden başlat
    const status = pollingService.getStatus();
    if (status.isRunning) {
      await pollingService.stop();
      // Kısa bir bekleme sonrası yeniden başlat
      setTimeout(async () => {
        await pollingService.start();
      }, 1000);
    }

    return NextResponse.json({
      success: true,
      message: 'Ayarlar başarıyla kaydedildi',
      needsRestart: status.isRunning,
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

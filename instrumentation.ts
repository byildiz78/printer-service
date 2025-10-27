export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { pollingService } = await import('@/lib/polling-service');
    const { logger } = await import('@/lib/logger');

    // Servisi başlat
    try {
      await pollingService.start();
      logger.success('Uygulama başlatıldı, servis otomatik olarak başlatıldı');
    } catch (error) {
      logger.error('Servis otomatik başlatma hatası', error);
    }
  }
}

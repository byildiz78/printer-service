export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { pollingService } = await import('@/lib/polling-service');
    const { logger } = await import('@/lib/logger');

    // Next.js'in tam olarak ayağa kalkması için kısa bir gecikme
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Servisi başlat
    try {
      logger.info(`API URL: ${process.env.PRINTER_API_URL || 'localhost:3000'}`);
      await pollingService.start();
      logger.success('Uygulama başlatıldı, servis otomatik olarak başlatıldı');
    } catch (error) {
      logger.error('Servis otomatik başlatma hatası', error);
    }
  }
}

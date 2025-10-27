export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { pollingService } = await import('@/lib/polling-service');
    const { logger } = await import('@/lib/logger');
    const { isSettingsConfigured } = await import('@/lib/settings');

    // Next.js'in tam olarak ayağa kalkması için kısa bir gecikme
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Servisi başlat (sadece settings yapılandırılmışsa)
    try {
      if (isSettingsConfigured()) {
        logger.info('Ayarlar yüklendi, servis başlatılıyor...');
        await pollingService.start();
        logger.success('Uygulama başlatıldı, servis otomatik olarak başlatıldı');
      } else {
        logger.warning('Ayarlar yapılandırılmamış, servis başlatılmadı. Lütfen ayarları yapılandırın.');
      }
    } catch (error) {
      logger.error('Servis otomatik başlatma hatası', error);
    }
  }
}

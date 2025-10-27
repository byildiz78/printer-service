import { logger } from './logger';
import { printerService } from './printer';
import * as printerRouter from './printer-router';
import { htmlRenderer } from './renderer';
import { PrinterJobResponse, ServiceStatus, PrinterJob } from '@/types';

interface JobRetryInfo {
  job: PrinterJob;
  attempts: number;
  lastAttempt: number;
  consecutiveConnectionFailures: number; // Peş peşe bağlantı hatası sayısı
}

class PollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPolling = false; // Polling devam ediyor mu?
  private activeJobs: Map<number, JobRetryInfo> = new Map(); // Job ID -> Retry bilgisi
  private status: ServiceStatus = {
    isRunning: false,
    startedAt: null,
    lastPollTime: null,
    totalJobsProcessed: 0,
    totalJobsFailed: 0,
    lastError: null,
  };

  private apiUrl = '';
  private updateApiUrl = '';
  private pollInterval = 1000; // 1 saniye
  private maxRetries = 5; // Maksimum deneme sayısı

  constructor() {
    this.loadSettingsAndUpdateUrls();
  }

  private loadSettingsAndUpdateUrls() {
    // Try to load from settings.json first, fallback to env
    try {
      const { loadSettings } = require('./settings');
      const settings = loadSettings();

      const baseUrl = settings.PRINTER_API_URL || process.env.PRINTER_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/printer/templateJob`;

      this.apiUrl = `${fullUrl}?status=0&limit=10`;
      this.updateApiUrl = fullUrl;
    } catch (error) {
      // Fallback to env or default
      const baseUrl = process.env.PRINTER_API_URL || 'http://localhost:3000';
      const fullUrl = `${baseUrl}/api/printer/templateJob`;
      this.apiUrl = `${fullUrl}?status=0&limit=10`;
      this.updateApiUrl = fullUrl;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warning('Servis zaten çalışıyor');
      return;
    }

    try {
      // Puppeteer'ı başlat
      await htmlRenderer.initialize();

      // Yazıcı bağlantısını test et
      const printerConnected = await printerService.testConnection();
      if (!printerConnected) {
        logger.warning('Yazıcıya bağlanılamadı, ancak servis başlatılıyor...');
      }

      this.isRunning = true;
      this.status.isRunning = true;
      this.status.startedAt = new Date().toISOString();
      this.status.lastError = null;

      logger.success('Polling servisi başlatıldı');

      // İlk kontrolü hemen yap
      await this.poll();

      // Sonra periyodik olarak kontrol et
      this.intervalId = setInterval(() => {
        this.poll();
      }, this.pollInterval);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error('Servis başlatma hatası', errorMessage);
      this.status.lastError = errorMessage;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      logger.warning('Servis zaten durmuş');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.status.isRunning = false;

    // Puppeteer'ı kapat
    await htmlRenderer.close();

    logger.info('Polling servisi durduruldu');
  }

  private async updateJobStatus(autoId: number, jobStatus: number, notes: string) {
    try {
      const response = await fetch(this.updateApiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          autoId,
          jobStatus,
          externalNotes: notes,
        }),
      });

      if (!response.ok) {
        throw new Error(`Status güncelleme hatası: ${response.status}`);
      }

      logger.info(`Job status güncellendi: ID=${autoId}, Status=${jobStatus}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error(`Job status güncelleme hatası: ID=${autoId}`, errorMessage);
      return false;
    }
  }

  private async poll() {
    // Önceki polling henüz bitmemişse yeni polling başlatma
    if (this.isPolling) {
      logger.warning('Önceki polling devam ediyor, atlanıyor');
      return;
    }

    this.isPolling = true;

    try {
      this.status.lastPollTime = new Date().toISOString();

      // API'ye sorgu yap (log çok fazla output üretiyor, yoruma alındı)
      // logger.info(`API sorgulanıyor: ${this.apiUrl}`);
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Self-signed certificate hatalarını görmezden gel (development)
        // @ts-ignore
        agent: this.apiUrl.startsWith('https') ? undefined : undefined,
      }).catch((fetchError) => {
        // Fetch hatası detaylarını logla
        logger.error(`Fetch hatası detayı: ${fetchError.message}`, {
          url: this.apiUrl,
          cause: fetchError.cause,
        });
        throw fetchError;
      });

      if (!response.ok) {
        throw new Error(`API hatası: ${response.status} ${response.statusText}`);
      }

      const data: PrinterJobResponse = await response.json();

      if (!data.success) {
        logger.warning(`API başarısız yanıt döndü: ${data.message}`);
        return;
      }

      const jobs = data.data || [];

      if (jobs.length === 0) {
        // Yazdırılacak iş yok, sessizce devam et
        return;
      }

      logger.info(`${jobs.length} adet yazdırma işi bulundu`);

      // Yeni job'ları activeJobs'a ekle
      for (const job of jobs) {
        if (!this.activeJobs.has(job.AutoID)) {
          this.activeJobs.set(job.AutoID, {
            job,
            attempts: 0,
            lastAttempt: 0,
            consecutiveConnectionFailures: 0,
          });
          logger.info(`Yeni job eklendi: ID=${job.AutoID}`);
        }
      }

      // ActiveJobs'daki tüm job'ları işle
      for (const [jobId, retryInfo] of this.activeJobs.entries()) {
        const { job, attempts } = retryInfo;

        // Maksimum deneme sayısına ulaşıldı mı?
        if (attempts >= this.maxRetries) {
          logger.error(
            `Job ID=${jobId} maksimum deneme sayısına (${this.maxRetries}) ulaştı, vazgeçiliyor`
          );

          // API'ye başarısız olarak bildir
          await this.updateJobStatus(
            jobId,
            2,
            `${this.maxRetries} kez denendi yazdırılamadı - ${new Date().toLocaleString('tr-TR')}`
          );

          this.status.totalJobsFailed++;
          this.activeJobs.delete(jobId);
          continue;
        }

        // Yazdırmayı dene
        try {
          retryInfo.attempts++;
          retryInfo.lastAttempt = Date.now();

          logger.info(
            `Job yazdırılıyor: ID=${jobId}, Deneme=${retryInfo.attempts}/${this.maxRetries}`
          );

          // Yazıcı tipine göre doğru akışa yönlendir (slip veya termal)
          const result = await printerRouter.printJob(job);

          if (result.success) {
            // Başarılı - API'ye bildir
            this.status.totalJobsProcessed++;
            retryInfo.consecutiveConnectionFailures = 0; // Reset connection failure counter

            const statusUpdated = await this.updateJobStatus(
              jobId,
              2,
              `Başarıyla yazdırıldı - ${new Date().toLocaleString('tr-TR')}`
            );

            // Sadece status başarıyla güncellendiyse listeden çıkar
            if (statusUpdated) {
              this.activeJobs.delete(jobId);
              logger.success(`Job tamamlandı ve listeden çıkarıldı: ID=${jobId}`);
            } else {
              logger.warning(`Job yazdırıldı ama status güncellenemedi, listede tutuluyor: ID=${jobId}`);
              // Attempts'i sıfırla ki sonraki polling'de API güncellenene kadar tekrar denemesin
              retryInfo.attempts = this.maxRetries - 1; // Bir sonraki denemede max'a ulaşacak
            }
          } else {
            // Başarısız - bağlantı hatası mı kontrol et
            const isConnectionError =
              result.error?.includes('Socket timeout') ||
              result.error?.includes('ETIMEDOUT') ||
              result.error?.includes('ECONNREFUSED') ||
              result.error?.includes('ECONNRESET') ||
              result.error?.includes('bağlanılamadı') ||
              result.error?.includes('timeout');

            if (isConnectionError) {
              retryInfo.consecutiveConnectionFailures++;
              logger.warning(
                `Bağlantı hatası: ID=${jobId}, Peş peşe=${retryInfo.consecutiveConnectionFailures}/5, Hata: ${result.error}`
              );

              // 5 peş peşe bağlantı hatası - vazgeç ve sıradakine geç
              if (retryInfo.consecutiveConnectionFailures >= 5) {
                logger.error(
                  `Job ID=${jobId} 5 kez bağlantı hatası aldı, vazgeçiliyor`
                );

                await this.updateJobStatus(
                  jobId,
                  2,
                  `5 kez bağlantı hatası, yazıcıya ulaşılamadı - ${new Date().toLocaleString('tr-TR')}`
                );

                this.status.totalJobsFailed++;
                this.activeJobs.delete(jobId);
                continue;
              }
            } else {
              // Farklı tip hata - connection failure counter'ı sıfırla
              retryInfo.consecutiveConnectionFailures = 0;
            }

            // Başarısız - retry için listede tut
            this.status.lastError = result.error || 'Bilinmeyen hata';
            logger.warning(
              `Job başarısız: ID=${jobId}, Deneme=${retryInfo.attempts}/${this.maxRetries}, Hata: ${result.error}`
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
          this.status.lastError = errorMessage;
          logger.error(
            `Job exception: ID=${jobId}, Deneme=${retryInfo.attempts}/${this.maxRetries}`,
            errorMessage
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error('Polling hatası', errorMessage);
      this.status.lastError = errorMessage;
    } finally {
      this.isPolling = false;
    }
  }

  getStatus(): ServiceStatus {
    return { ...this.status };
  }

  updateConfig(apiUrl: string, pollInterval: number) {
    this.apiUrl = apiUrl;
    this.pollInterval = pollInterval;

    // Servis çalışıyorsa yeniden başlat
    if (this.isRunning) {
      logger.info('Konfigürasyon değişti, servis yeniden başlatılıyor...');
      this.stop().then(() => {
        this.start();
      });
    }
  }

  reloadSettings() {
    this.loadSettingsAndUpdateUrls();
    logger.info('Ayarlar yeniden yüklendi');
  }
}

// Singleton instance
export const pollingService = new PollingService();

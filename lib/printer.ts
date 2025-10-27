import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import { logger } from './logger';
import { htmlRenderer } from './renderer';
import { PrinterJob, PrintResult } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

class PrinterService {
  private printerIp: string;
  private printerPort: number;
  private tempDir: string;

  constructor(ip: string = '192.168.2.214', port: number = 9100) {
    this.printerIp = ip;
    this.printerPort = port;

    // Temp klasörünü oluştur
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      logger.info(`Temp klasörü oluşturuldu: ${this.tempDir}`);
    }
  }

  async printJob(job: PrinterJob): Promise<PrintResult> {
    let tempFilePath: string | null = null;

    try {
      logger.info(`Print job başlatıldı: ID=${job.AutoID}, Ref=${job.ReferenceNumber}`);

      // HTML'i görüntüye dönüştür
      const imageBuffer = await htmlRenderer.renderHtmlToImage(job.Content);
      logger.info(`HTML render tamamlandı: Job ID=${job.AutoID}`);

      // Geçici dosyaya kaydet (temp klasöründe)
      tempFilePath = path.join(this.tempDir, `print-${job.AutoID}-${Date.now()}.png`);
      fs.writeFileSync(tempFilePath, imageBuffer);
      logger.info(`Geçici dosya oluşturuldu: ${tempFilePath}`);

      // Yazıcı yapılandırması
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${this.printerIp}:${this.printerPort}`,
        options: {
          timeout: 3000, // 3 saniye timeout
        },
      });

      // Görüntüyü yazdır - termal yazıcı için optimize edilmiş ayarlar
      // deviceScaleFactor: 2 ile görüntü 768px genişliğinde
      await printer.printImage(tempFilePath);

      // Kağıdı kes - partial cut kullanarak minimum boşluk
      printer.partialCut();

      // Yazdırma komutunu gönder
      await printer.execute();

      // Bağlantıyı temizle
      printer.clear();

      logger.success(
        `Print job başarılı: ID=${job.AutoID}, Printer=${job.PrinterName}`
      );

      return {
        success: true,
        jobId: job.AutoID,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error(`Print job hatası: ID=${job.AutoID}`, errorMessage);

      return {
        success: false,
        jobId: job.AutoID,
        error: errorMessage,
      };
    } finally {
      // Geçici dosyayı sil
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.info(`Geçici dosya silindi: ${tempFilePath}`);
        } catch (cleanupError) {
          logger.warning(`Geçici dosya silinemedi: ${tempFilePath}`);
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${this.printerIp}:${this.printerPort}`,
      });

      const isConnected = await printer.isPrinterConnected();

      if (isConnected) {
        logger.success(`Yazıcı bağlantısı başarılı: ${this.printerIp}:${this.printerPort}`);
      } else {
        logger.error(`Yazıcı bağlantısı başarısız: ${this.printerIp}:${this.printerPort}`);
      }

      return isConnected;
    } catch (error) {
      logger.error('Yazıcı bağlantı testi hatası', error);
      return false;
    }
  }

  updateConfig(ip: string, port: number) {
    this.printerIp = ip;
    this.printerPort = port;
    logger.info(`Yazıcı konfigürasyonu güncellendi: ${ip}:${port}`);
  }
}

// Singleton instance
export const printerService = new PrinterService();

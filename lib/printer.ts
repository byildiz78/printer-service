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

  constructor(
    ip: string = process.env.PRINTER_IP || '192.168.2.214',
    port: number = parseInt(process.env.PRINTER_PORT || '9100')
  ) {
    this.printerIp = ip;
    this.printerPort = port;

    // Temp klasörünü oluştur
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      logger.info(`Temp klasörü oluşturuldu: ${this.tempDir}`);
    }
  }

  private parsePrinterAddress(address: string): { ip: string; port: number } | null {
    try {
      // Format: "192.168.2.173:9101"
      const parts = address.split(':');
      if (parts.length !== 2) {
        return null;
      }

      const ip = parts[0].trim();
      const port = parseInt(parts[1].trim());

      if (!ip || isNaN(port)) {
        return null;
      }

      return { ip, port };
    } catch (error) {
      logger.error('Printer address parse hatası', error);
      return null;
    }
  }

  async printJob(job: PrinterJob): Promise<PrintResult> {
    let tempFilePath: string | null = null;

    try {
      logger.info(`Print job başlatıldı: ID=${job.AutoID}, Ref=${job.ReferenceNumber}`);

      // Yazıcı IP ve Port'u belirle (AltPrinterName'den veya env'den)
      let printerIp = this.printerIp;
      let printerPort = this.printerPort;

      logger.info(`Job bilgisi: PrinterName="${job.PrinterName}", AltPrinterName="${job.AltPrinterName || 'yok'}"`);

      if (job.AltPrinterName && job.AltPrinterName.trim() !== '') {
        const parsed = this.parsePrinterAddress(job.AltPrinterName);
        if (parsed) {
          printerIp = parsed.ip;
          printerPort = parsed.port;
          logger.info(`✅ Job için özel yazıcı kullanılıyor: ${printerIp}:${printerPort} (${job.PrinterName})`);
        } else {
          logger.warning(`⚠️ AltPrinterName parse edilemedi: "${job.AltPrinterName}", varsayılan kullanılıyor: ${printerIp}:${printerPort}`);
        }
      } else {
        logger.info(`ℹ️ AltPrinterName yok, varsayılan yazıcı kullanılıyor: ${printerIp}:${printerPort}`);
      }

      // HTML'i görüntüye dönüştür
      const imageBuffer = await htmlRenderer.renderHtmlToImage(job.Content);
      logger.info(`HTML render tamamlandı: Job ID=${job.AutoID}`);

      // Geçici dosyaya kaydet (temp klasöründe)
      tempFilePath = path.join(this.tempDir, `print-${job.AutoID}-${Date.now()}.png`);
      fs.writeFileSync(tempFilePath, imageBuffer);
      logger.info(`Geçici dosya oluşturuldu: ${tempFilePath}`);

      // Yazıcı yapılandırması
      logger.info(`Yazıcıya bağlanılıyor: ${printerIp}:${printerPort}`);
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: `tcp://${printerIp}:${printerPort}`,
        options: {
          timeout: 10000, // 10 saniye timeout
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
        `Print job başarılı: ID=${job.AutoID}, Printer=${job.PrinterName} → ${printerIp}:${printerPort}`
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

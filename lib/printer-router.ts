import { logger } from './logger';
import { printerService } from './printer';
import { NetworkSlipPrinter } from './slip-printer';
import { PrinterJob, PrintResult } from '@/types';

/**
 * Yazıcı tipi belirleme
 * Türkçe karakter duyarlı kontrol (İ → i dönüşümü için tr-TR locale)
 */
export function getPrinterType(job: PrinterJob): 'slip' | 'thermal' {
  const printerName = job.PrinterName?.toLocaleLowerCase('tr-TR') || '';
  return printerName.includes('adisyon') ? 'slip' : 'thermal';
}

/**
 * AltPrinterName'den IP:Port parse et
 */
function parseIpPort(
  altPrinterName: string | undefined
): { ip: string; port: number } | null {
  try {
    if (!altPrinterName || !altPrinterName.trim()) {
      return null;
    }

    const parts = altPrinterName.split(':');
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
    logger.error('AltPrinterName parse hatası', error);
    return null;
  }
}

/**
 * Ana yazdırma router'ı - Yazıcı tipine göre doğru akışa yönlendirir
 * - PrinterName "adisyon" içeriyorsa → Slip printer (HTML→Text→TCP)
 * - PrinterName "adisyon" içermiyorsa → Termal printer (HTML→PNG→ESC/POS)
 */
export async function printJob(job: PrinterJob): Promise<PrintResult> {
  const printerType = getPrinterType(job);

  logger.info(
    `Yazıcı tipi belirlendi: ${printerType} - PrinterName: ${job.PrinterName}, Job ID: ${job.AutoID}`
  );

  if (printerType === 'slip') {
    // ==========================================
    // SLIP PRINTER AKIŞI
    // ==========================================
    logger.info(`Slip printer akışı başlatılıyor - Job ID: ${job.AutoID}`);

    // AltPrinterName'den IP:Port al
    const ipPort = parseIpPort(job.AltPrinterName);
    if (!ipPort) {
      const errorMsg = `Slip yazıcı için AltPrinterName IP:Port formatında olmalı. Mevcut değer: "${job.AltPrinterName || 'boş'}"`;
      logger.error(errorMsg);
      return {
        success: false,
        jobId: job.AutoID,
        error: errorMsg,
      };
    }

    logger.info(
      `Slip printer kullanılacak: ${ipPort.ip}:${ipPort.port} - Job ID: ${job.AutoID}`
    );

    // NetworkSlipPrinter ile yazdır (HTML→Text→TCP)
    const slipPrinter = new NetworkSlipPrinter(ipPort.ip, ipPort.port);
    return await slipPrinter.printHtml(job.Content, job.AutoID);
  } else {
    // ==========================================
    // TERMAL PRINTER AKIŞI (MEVCUT)
    // ==========================================
    logger.info(`Termal printer akışı başlatılıyor - Job ID: ${job.AutoID}`);

    // Mevcut printer.ts akışını kullan (HTML→PNG→ESC/POS)
    // AltPrinterName zaten printer.ts içinde kullanılıyor
    return await printerService.printJob(job);
  }
}

import * as net from 'net';
import * as iconv from 'iconv-lite';
import { logger } from './logger';
import { PrintResult } from '@/types';

/**
 * Network üzerinden slip yazıcılara HTML içerik yazdırma sınıfı
 * 100% DİNAMİK - Hiç statik text yok, her şey HTML'den geliyor
 * 80mm EPSON yazıcı için - 32 karakter genişlik
 * C# NetworkSlipPrinter.cs'den uyarlanmıştır
 */
export class NetworkSlipPrinter {
  private printerIp: string;
  private printerPort: number;
  private connectionTimeout: number;
  private readTimeout: number;
  private static readonly LINE_WIDTH = 32;

  constructor(
    printerIp: string,
    printerPort: number = 9101,
    connectionTimeout: number = 10000,
    readTimeout: number = 1000
  ) {
    this.printerIp = printerIp;
    this.printerPort = printerPort;
    this.connectionTimeout = connectionTimeout;
    this.readTimeout = readTimeout;
  }

  /**
   * HTML tag'lerini temizle
   */
  private stripTags(html: string): string {
    if (!html) return '';

    // HTML tag'lerini temizle
    let text = html.replace(/<[^>]+>/g, ' ');
    // Çoklu boşlukları tek boşluğa çevir
    text = text.replace(/\s+/g, ' ');
    // HTML entity'leri decode et
    text = this.htmlDecode(text);
    return text.trim();
  }

  /**
   * HTML entity decode
   */
  private htmlDecode(text: string): string {
    const entities: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
    };

    return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
  }

  /**
   * Para birimi dönüşümü - ₺ sembolünü TL'ye çevir
   */
  private convertCurrency(text: string): string {
    if (!text) return text;

    // ₺ sembolünü temizle
    text = text.replace(/₺/g, '').trim();

    // Eğer para birimi yoksa ve sadece sayı varsa TL ekle
    if (
      !text.endsWith('TL') &&
      !text.endsWith('USD') &&
      !text.endsWith('EUR') &&
      !text.endsWith('GBP') &&
      /[\d,\.\-]+/.test(text)
    ) {
      text = text + ' TL';
    }

    return text;
  }

  /**
   * 3 sütunlu satır formatı - 80mm yazıcı
   * Kolon genişlikleri: 16 + 5 + 9 = 30 karakter (aralarında boşluklar)
   */
  private formatLine(col1: string, col2: string, col3: string): string {
    const col1Width = 16;
    const col2Width = 5;
    const col3Width = 9;

    // Kolon 1'i kes
    if (col1.length > col1Width) {
      col1 = col1.substring(0, col1Width);
    }

    return (
      col1.padEnd(col1Width, ' ') +
      ' ' +
      col2.padStart(col2Width, ' ') +
      ' ' +
      col3.padStart(col3Width, ' ')
    );
  }

  /**
   * 2 sütunlu toplam satırı formatı - 80mm yazıcı
   * Kolon genişlikleri: 18 + 13 = 31 karakter (aralarında boşluk)
   */
  private formatTotalLine(label: string, value: string): string {
    const labelWidth = 18;
    const valueWidth = 13;

    // Label'ı kes
    if (label.length > labelWidth) {
      label = label.substring(0, labelWidth);
    }

    return label.padEnd(labelWidth, ' ') + ' ' + value.padStart(valueWidth, ' ');
  }

  /**
   * HTML'i metne çevirir - 100% DİNAMİK
   * Hiçbir statik text yok - her şey HTML'den parse ediliyor
   */
  private htmlToText(html: string): string {
    if (!html) return '';

    const output: string[] = [];

    // HTML entity decode
    html = this.htmlDecode(html);

    // ==========================================
    // 1. BAŞLIK (title class)
    // ==========================================
    const titleMatch = html.match(
      /<div[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (titleMatch) {
      const baslik = this.stripTags(titleMatch[1]);
      if (baslik) {
        output.push('='.repeat(NetworkSlipPrinter.LINE_WIDTH));
        output.push(baslik);
        output.push('='.repeat(NetworkSlipPrinter.LINE_WIDTH));
      }
    }

    // ==========================================
    // 2. SİPARİŞ BİLGİLERİ (order-info class)
    // DİNAMİK: Tüm <strong>Label:</strong> Value formatındaki satırları al
    // ==========================================
    const orderInfoMatch = html.match(
      /<div[^>]*class="[^"]*order-info[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*divider/
    );
    if (orderInfoMatch) {
      const orderInfoHtml = orderInfoMatch[1];

      // Tüm <strong>Label:</strong> value pattern'lerini bul
      const labelValueRegex = /<strong>([^<]+)<\/strong>\s*([^<]+?)(?=<|$)/g;
      let match;
      while ((match = labelValueRegex.exec(orderInfoHtml)) !== null) {
        let label = this.stripTags(match[1]);
        const value = this.stripTags(match[2]);

        if (label && value) {
          // Label'den : varsa koru, yoksa ekle
          if (!label.endsWith(':')) {
            label += ':';
          }
          output.push(`${label} ${value}`);
        }
      }

      // Alternatif: info-line div'lerini de kontrol et
      const infoLineRegex = /<div[^>]*class="[^"]*info-line[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
      while ((match = infoLineRegex.exec(orderInfoHtml)) !== null) {
        const lineText = this.stripTags(match[1]);
        if (lineText && !output.join('\n').includes(lineText)) {
          output.push(lineText);
        }
      }
    }

    output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));

    // ==========================================
    // 3. ÜRÜN TABLOSU BAŞLIĞI (ilk item-row)
    // DİNAMİK: İlk item-row'daki span'leri al (ÜRÜN, ADET, TUTAR veya başka dil)
    // ==========================================
    const firstItemMatch = html.match(
      /<div[^>]*class="[^"]*item-row[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );
    if (firstItemMatch) {
      const firstRowHtml = firstItemMatch[1];
      const headerSpans = Array.from(
        firstRowHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)
      );

      if (headerSpans.length >= 3) {
        const h1 = this.stripTags(headerSpans[0][1]);
        const h2 = this.stripTags(headerSpans[1][1]);
        const h3 = this.stripTags(headerSpans[2][1]);

        if (h1) {
          output.push(this.formatLine(h1, h2, h3));
          output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));
        }
      }
    }

    // ==========================================
    // 4. ÜRÜNLER (tüm item-row'lar)
    // DİNAMİK: Her item-row'daki 3 span'i al
    // ==========================================
    const allItemMatches = Array.from(
      html.matchAll(/<div[^>]*class="[^"]*item-row[^"]*"[^>]*>([\s\S]*?)<\/div>/g)
    );
    let firstRow = true;

    for (const itemMatch of allItemMatches) {
      // İlk satırı atla (başlık)
      if (firstRow) {
        firstRow = false;
        continue;
      }

      const rowHtml = itemMatch[1];
      const spans = Array.from(rowHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g));

      if (spans.length >= 3) {
        const col1 = this.stripTags(spans[0][1]);
        const col2 = this.stripTags(spans[1][1]);
        let col3 = this.stripTags(spans[2][1]);

        // Boş satırları atla
        if (!col1) continue;

        // Para birimi dönüşümü
        col3 = this.convertCurrency(col3);

        output.push(this.formatLine(col1, col2, col3));
      }
    }

    output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));

    // ==========================================
    // 5. TOPLAMLAR (totals class)
    // DİNAMİK: total-row ve grand-total-row'lardaki label-value'ları al
    // ==========================================
    const totalsMatch = html.match(
      /<div[^>]*class="[^"]*totals[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*divider/
    );
    if (totalsMatch) {
      const totalsHtml = totalsMatch[1];

      // Tüm total-row'ları bul (hem normal hem grand)
      const totalRowMatches = Array.from(
        totalsHtml.matchAll(/<div[^>]*class="[^"]*total[^"]*"[^>]*>([\s\S]*?)<\/div>/g)
      );

      for (const totalRow of totalRowMatches) {
        const rowHtml = totalRow[1];
        const spans = Array.from(rowHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g));

        if (spans.length >= 2) {
          const label = this.stripTags(spans[0][1]);
          let value = this.stripTags(spans[1][1]);

          if (label) {
            value = this.convertCurrency(value);
            output.push(this.formatTotalLine(label, value));
          }
        }
      }
    }

    output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));

    // ==========================================
    // 6. ÖDEME BİLGİLERİ (payments class) - VARSA
    // DİNAMİK: payment-row'lardaki method-amount çiftlerini al
    // ==========================================
    const paymentsMatch = html.match(
      /<div[^>]*class="[^"]*payments[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*divider/
    );
    if (paymentsMatch) {
      const paymentsHtml = paymentsMatch[1];

      // payment-row var mı kontrol et
      if (
        paymentsHtml.includes('payment-row') ||
        paymentsHtml.includes('payment-info')
      ) {
        // Section title'ı bul (ödeme bilgileri / payment info / etc)
        const paymentSectionMatch = html.match(
          /<div[^>]*class="[^"]*section-title[^"]*"[^>]*>([^<]*(?:ÖDEME|PAYMENT|PAY)[^<]*)<\/div>/i
        );
        if (paymentSectionMatch) {
          const sectionTitle = this.stripTags(paymentSectionMatch[1]);
          if (sectionTitle) {
            output.push(sectionTitle);
            output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));
          }
        }

        // Tüm payment-row'ları bul
        const paymentRows = Array.from(
          paymentsHtml.matchAll(
            /<div[^>]*class="[^"]*payment-row[^"]*"[^>]*>([\s\S]*?)<\/div>/g
          )
        );

        for (const payRow of paymentRows) {
          const rowHtml = payRow[1];
          const spans = Array.from(rowHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g));

          if (spans.length >= 2) {
            const method = this.stripTags(spans[0][1]);
            let amount = this.stripTags(spans[1][1]);

            if (method) {
              amount = this.convertCurrency(amount);
              output.push(this.formatTotalLine(method, amount));
            }
          }
        }

        // Para üstü (change-line) varsa
        const changeMatch = paymentsHtml.match(
          /<div[^>]*class="[^"]*change-line[^"]*"[^>]*>([\s\S]*?)<\/div>/
        );
        if (changeMatch) {
          const changeHtml = changeMatch[1];
          const spans = Array.from(changeHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g));

          if (spans.length >= 2) {
            const changeLabel = this.stripTags(spans[0][1]);
            let changeAmount = this.stripTags(spans[1][1]);

            changeAmount = this.convertCurrency(changeAmount);
            output.push(this.formatTotalLine(changeLabel, changeAmount));
          }
        }

        output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));
      }
    }

    // ==========================================
    // 7. SİPARİŞ NOTU (order-notes-section) - VARSA
    // DİNAMİK: Başlık ve not içeriğini al
    // ==========================================
    const orderNotesMatch = html.match(
      /<div[^>]*class="[^"]*order-notes-section[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*divider/
    );
    if (orderNotesMatch) {
      const notesSection = orderNotesMatch[1];

      // Başlık (section-title)
      const notesTitleMatch = notesSection.match(
        /<div[^>]*class="[^"]*section-title[^"]*"[^>]*>([^<]+)<\/div>/
      );
      if (notesTitleMatch) {
        const title = this.stripTags(notesTitleMatch[1]);
        if (title) {
          output.push(title);
          output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));
        }
      }

      // Not içeriği (order-notes)
      const notesContentMatch = notesSection.match(
        /<div[^>]*class="[^"]*order-notes[^"]*"[^>]*>([^<]+)<\/div>/
      );
      if (notesContentMatch) {
        const notes = this.stripTags(notesContentMatch[1]);
        if (notes) {
          output.push(notes);
          output.push('-'.repeat(NetworkSlipPrinter.LINE_WIDTH));
        }
      }
    }

    // ==========================================
    // 8. FOOTER (footer class)
    // DİNAMİK: footer-message ve footer-website'i al
    // ==========================================
    const footerMatch = html.match(
      /<div[^>]*class="[^"]*footer[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/
    );
    if (footerMatch) {
      const footerHtml = footerMatch[1];

      // Footer message
      const messageMatch = footerHtml.match(
        /<div[^>]*class="[^"]*footer-message[^"]*"[^>]*>([^<]+)<\/div>/
      );
      if (messageMatch) {
        const message = this.stripTags(messageMatch[1]);
        if (message) {
          output.push(message);
        }
      }

      // Footer website
      const websiteMatch = footerHtml.match(
        /<div[^>]*class="[^"]*footer-website[^"]*"[^>]*>([^<]+)<\/div>/
      );
      if (websiteMatch) {
        const website = this.stripTags(websiteMatch[1]);
        if (website) {
          output.push(website);
        }
      }
    }

    return output.join('\n');
  }

  /**
   * Byte-by-byte delay ile veri gönder (C# implementasyonu gibi)
   */
  private async sendBytesWithDelay(
    socket: net.Socket,
    bytes: Buffer,
    delayMs: number = 2
  ): Promise<void> {
    for (let i = 0; i < bytes.length; i++) {
      await new Promise<void>((resolve, reject) => {
        socket.write(Buffer.from([bytes[i]]), (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 2ms delay (C# Thread.Sleep(2) gibi)
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * TCP socket ile slip yazıcıya HTML yazdır
   */
  async printHtml(htmlContent: string, jobId: number): Promise<PrintResult> {
    try {
      logger.info(
        `Slip printer yazdırma başlıyor - IP: ${this.printerIp}:${this.printerPort}, Job ID: ${jobId}`
      );

      // HTML'i metne çevir
      const text = this.htmlToText(htmlContent);

      if (!text) {
        logger.error(`HTML metne çevrilemedi - Job ID: ${jobId}`);
        return {
          success: false,
          jobId: jobId,
          error: 'HTML metne çevrilemedi',
        };
      }

      return await new Promise<PrintResult>((resolve) => {
        const socket = new net.Socket();

        // TCP_NODELAY aktif et (Nagle algoritması devre dışı - C#'taki gibi)
        socket.setNoDelay(true);

        // Timeout ayarları
        socket.setTimeout(this.connectionTimeout);

        socket.on('timeout', () => {
          logger.error(
            `Slip printer socket timeout - IP: ${this.printerIp}:${this.printerPort}`
          );
          socket.destroy();
          resolve({
            success: false,
            jobId: jobId,
            error: 'Socket timeout',
          });
        });

        socket.on('error', (err) => {
          logger.error(
            `Slip printer bağlantı hatası - IP: ${this.printerIp}:${this.printerPort}`,
            err.message
          );
          resolve({
            success: false,
            jobId: jobId,
            error: err.message,
          });
        });

        socket.connect(this.printerPort, this.printerIp, async () => {
          try {
            logger.info(
              `Slip printer bağlantısı başarılı - IP: ${this.printerIp}:${this.printerPort}`
            );

            // 1. INITIALIZE - Byte by byte gönder (C#'taki gibi)
            const initCommand = Buffer.from([0x1b, 0x40, 0x1d, 0x4c, 0x00, 0x00]);
            await this.sendBytesWithDelay(socket, initCommand, 2);

            // 2. ENCODING - CP857 (Türkçe karakter desteği)
            let textBytes: Buffer;
            try {
              textBytes = iconv.encode(text, 'cp857');
            } catch (encErr) {
              logger.warning('CP857 encoding hatası, UTF-8 kullanılıyor');
              textBytes = Buffer.from(text, 'utf8');
            }

            // 3. METİN - Byte by byte gönder (C#'taki gibi)
            await this.sendBytesWithDelay(socket, textBytes, 2);

            // 4. FEED - 10 satır boşluk byte by byte
            const feedText = '\r\n'.repeat(10);
            const feedBytes = iconv.encode(feedText, 'cp857');
            await this.sendBytesWithDelay(socket, feedBytes, 2);

            // 5. REVERSE FEED - Kağıdı maksimum geri çek (C#'taki gibi)
            const reverseFeedCommand = Buffer.from([0x1b, 0x4b, 0x7f]); // ESC K 127 (~54mm)
            await this.sendBytesWithDelay(socket, reverseFeedCommand, 2);

            // Geri çekme işleminin tamamlanması için bekleme
            await new Promise((resolve) => setTimeout(resolve, 100));

            // 6. RELEASE - Kağıdı serbest bırak (C#'taki gibi)
            const releaseCommand = Buffer.from([0x1b, 0x71]); // ESC q
            await this.sendBytesWithDelay(socket, releaseCommand, 2);

            socket.end();

            logger.success(
              `Slip printer yazdırma başarılı - IP: ${this.printerIp}:${this.printerPort}, Job ID: ${jobId}`
            );

            resolve({
              success: true,
              jobId: jobId,
            });
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
            logger.error(
              `Slip printer yazdırma sırasında hata - Job ID: ${jobId}`,
              errorMessage
            );
            socket.destroy();
            resolve({
              success: false,
              jobId: jobId,
              error: errorMessage,
            });
          }
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error(`Slip printer hatası - Job ID: ${jobId}`, errorMessage);
      return {
        success: false,
        jobId: jobId,
        error: errorMessage,
      };
    }
  }
}

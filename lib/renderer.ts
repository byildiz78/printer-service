import puppeteer, { Browser, Page } from 'puppeteer';
import { logger } from './logger';

class HtmlRenderer {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private renderCount = 0;
  private readonly maxRendersBeforeRefresh = 100; // 100 render sonrası page yenile

  async initialize() {
    if (this.isInitialized && this.browser && this.page) {
      return;
    }

    try {
      logger.info('Puppeteer başlatılıyor...');

      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      // Reusable page oluştur
      this.page = await this.browser.newPage();

      // Viewport'u baştan ayarla
      await this.page.setViewport({
        width: 384,
        height: 1000,
        deviceScaleFactor: 1,
      });

      this.isInitialized = true;
      logger.success('Puppeteer başarıyla başlatıldı');
    } catch (error) {
      logger.error('Puppeteer başlatma hatası', error);
      throw error;
    }
  }

  async renderHtmlToImage(html: string, retryCount = 0): Promise<Buffer> {
    const maxRetries = 3;

    if (!this.page || !this.browser) {
      await this.initialize();
    }

    if (!this.page) {
      throw new Error('Browser başlatılamadı');
    }

    // Düzenli aralıklarla page'i yenile (memory leak önlemi)
    this.renderCount++;
    if (this.renderCount >= this.maxRendersBeforeRefresh) {
      logger.info(`${this.maxRendersBeforeRefresh} render tamamlandı, page yenileniyor...`);
      await this.recreatePage();
      this.renderCount = 0;
    }

    try {
      // HTML içeriğini tam sayfa olarak yükle
      const fullHtml = `
        <!DOCTYPE html>
        <html style="margin: 0; padding: 0;">
          <head>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              html, body {
                width: 72mm;
                background: white;
                margin: 0;
                padding: 0;
                overflow: hidden;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      // Hızlı content yükleme - networkidle0 yerine domcontentloaded
      await this.page.setContent(fullHtml, {
        waitUntil: 'domcontentloaded',
      });

      // İçerik yüksekliğini al
      const contentHeight = await this.page.evaluate(() => {
        return document.body.scrollHeight;
      });

      // Viewport'u içerik yüksekliğine göre ayarla
      // deviceScaleFactor: 2 ile daha iyi kalite
      await this.page.setViewport({
        width: 384,
        height: contentHeight,
        deviceScaleFactor: 2,
      });

      // Screenshot al - tam içerik boyutunda, boşluksuz
      const screenshot = await this.page.screenshot({
        type: 'png',
        fullPage: false,
        omitBackground: false,
        clip: {
          x: 0,
          y: 0,
          width: 384,
          height: contentHeight,
        },
      });

      return screenshot;
    } catch (error) {
      // Detached frame hatası varsa page'i yeniden oluştur
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('detached Frame') || errorMessage.includes('Target closed')) {
        if (retryCount < maxRetries) {
          logger.warning(`Detached frame hatası, page yeniden oluşturuluyor... (Retry ${retryCount + 1}/${maxRetries})`);
          await this.recreatePage();

          // Bir kez daha dene
          return this.renderHtmlToImage(html, retryCount + 1);
        } else {
          logger.error(`Maksimum retry sayısına ulaşıldı (${maxRetries}), render başarısız`);
          throw new Error('Puppeteer page detached, maksimum retry aşıldı');
        }
      }

      logger.error('HTML render hatası', error);
      throw error;
    }
  }

  private async recreatePage() {
    try {
      // Eski page'i kapat
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }

      // Render sayacını sıfırla
      this.renderCount = 0;

      // Browser hala çalışıyorsa yeni page oluştur
      if (this.browser) {
        this.page = await this.browser.newPage();
        await this.page.setViewport({
          width: 384,
          height: 1000,
          deviceScaleFactor: 1,
        });
        logger.info('Page yeniden oluşturuldu');
      } else {
        // Browser da kapanmışsa tümden yeniden başlat
        await this.initialize();
      }
    } catch (error) {
      logger.error('Page yeniden oluşturma hatası', error);
      // Tam yeniden başlatma
      this.isInitialized = false;
      await this.initialize();
    }
  }

  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.isInitialized = false;
    logger.info('Puppeteer kapatıldı');
  }
}

// Singleton instance
export const htmlRenderer = new HtmlRenderer();

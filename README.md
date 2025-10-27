# Termal Yazıcı Servisi

Next.js tabanlı otomatik termal yazıcı servisi. API'den gelen HTML içeriklerini Puppeteer ile render edip ESC/POS komutları ile Epson termal yazıcıya yazdırır.

## Özellikler

- **Otomatik Polling**: Saniyede bir kez API'ye sorgu yapar
- **HTML Rendering**: Puppeteer ile CSS dahil HTML'i görüntüye dönüştürür
- **ESC/POS Desteği**: node-thermal-printer ile Epson termal yazıcılara yazdırma
- **Web Dashboard**: Real-time servis izleme ve kontrol
- **Logging**: Detaylı log kaydı ve görüntüleme

## Gereksinimler

- Node.js 18+
- npm veya yarn
- Epson ESC/POS uyumlu termal yazıcı (192.168.2.214:9100)

## Kurulum

```bash
cd printer-service
npm install
```

## Yapılandırma

### Environment Variables

`.env.local` dosyası oluşturun:

```bash
# Printer API Configuration
PRINTER_API_URL=https://dev.robotpos.com/api/printer/templateJob
PRINTER_IP=192.168.2.214
PRINTER_PORT=9100
```

**Değişkenler:**
- `PRINTER_API_URL`: Printer job API endpoint (zorunlu değil, varsayılan: localhost:3000)
- `PRINTER_IP`: Yazıcı IP adresi (varsayılan: 192.168.2.214)
- `PRINTER_PORT`: Yazıcı port numarası (varsayılan: 9100)

### Polling Interval

Sorgu aralığını değiştirmek için `lib/polling-service.ts`:

```typescript
private pollInterval = 1000; // 1 saniye
```

## Kullanım

### Development Mode

```bash
npm run dev
```

Tarayıcınızda `http://localhost:3000` adresini açın.

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Servis Kontrol

- `GET /api/service/status` - Servis durumunu getir
- `POST /api/service/start` - Servisi başlat
- `POST /api/service/stop` - Servisi durdur

### Loglar

- `GET /api/logs?limit=100` - Son N log kaydını getir
- `DELETE /api/logs` - Tüm logları temizle

## API Veri Yapısı

Servis şu formatta veri bekler:

```json
{
  "success": true,
  "message": "Printer job'ları başarıyla getirildi",
  "data": [
    {
      "AutoID": 1252,
      "StationID": 1,
      "JobStatus": 0,
      "ReferenceNumber": "3996B732-868E-49E7-8E9F-33A3A3A1FB17",
      "Content": "<div>HTML İçeriği...</div>",
      "PrinterName": "HESAP",
      "AddDateTime": "2025-10-26T12:15:31.403Z",
      "ProcessDateTime": null,
      "ExternalNotes": "HESAP"
    }
  ]
}
```

## Dashboard Özellikleri

- **Servis Durumu**: Çalışıyor/Durmuş göstergesi
- **İstatistikler**:
  - Toplam işlenen job sayısı
  - Başarısız job sayısı
  - Son polling zamanı
- **Kontroller**: Başlat/Durdur butonları
- **Real-time Logs**: 2 saniyede bir güncellenen log konsolu

## Otomatik Başlatma

Servis, uygulama başladığında otomatik olarak başlar. Bu davranışı değiştirmek için `instrumentation.ts` dosyasını kaldırın veya düzenleyin.

## Teknik Detaylar

### Teknoloji Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Puppeteer (HTML rendering)
- node-thermal-printer (ESC/POS)
- Sharp (Image processing)

### Klasör Yapısı

```
printer-service/
├── app/
│   ├── api/              # API routes
│   ├── page.tsx          # Dashboard
│   └── layout.tsx
├── lib/
│   ├── logger.ts         # Logging sistemi
│   ├── renderer.ts       # Puppeteer HTML renderer
│   ├── printer.ts        # ESC/POS printer
│   └── polling-service.ts # Ana servis
├── types/
│   └── index.ts          # TypeScript type tanımları
└── instrumentation.ts    # Otomatik başlatma
```

## Sorun Giderme

### Puppeteer Hatası

WSL veya Linux'ta Puppeteer için gerekli kütüphaneler:

```bash
sudo apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2
```

### Yazıcı Bağlantı Hatası

- Yazıcının açık ve ağa bağlı olduğundan emin olun
- IP adresi ve port numarasını kontrol edin
- Güvenlik duvarı ayarlarını kontrol edin

## Lisans

MIT

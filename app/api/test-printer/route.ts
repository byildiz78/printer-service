import { NextRequest, NextResponse } from 'next/server';
import { printerService } from '@/lib/printer';
import { NetworkSlipPrinter } from '@/lib/slip-printer';

export async function POST(request: NextRequest) {
  try {
    const { ip, port, printerType } = await request.json();

    if (!ip || !port) {
      return NextResponse.json(
        {
          success: false,
          error: 'IP ve Port zorunludur',
        },
        { status: 400 }
      );
    }

    const portNumber = parseInt(port);
    if (isNaN(portNumber)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Port numarası geçerli değil',
        },
        { status: 400 }
      );
    }

    if (printerType === 'slip') {
      // Slip yazıcı testi
      const slipPrinter = new NetworkSlipPrinter(ip, portNumber);
      const testHtml = `
        <div class="title">YAZICI TEST</div>
        <div class="order-info">Test Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
        <div class="item-row">Bu bir test yazdırmasıdır</div>
        <div class="item-row">IP: ${ip}</div>
        <div class="item-row">Port: ${portNumber}</div>
        <div class="totals">Slip Yazıcı Test</div>
      `;

      const result = await slipPrinter.printHtml(testHtml, 0);

      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Test yazdırma başarılı' : 'Test yazdırma başarısız',
        error: result.error,
      });
    } else {
      // Termal yazıcı testi
      const testHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              width: 80mm;
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
            }
            .header {
              text-align: center;
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .info {
              font-size: 14px;
              margin: 5px 0;
            }
            .divider {
              border-top: 2px dashed #000;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">YAZICI TEST</div>
          <div class="divider"></div>
          <div class="info">Test Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
          <div class="info">IP: ${ip}</div>
          <div class="info">Port: ${portNumber}</div>
          <div class="divider"></div>
          <div class="info" style="text-align: center;">Bu bir test yazdırmasıdır</div>
          <div class="divider"></div>
        </body>
        </html>
      `;

      const result = await printerService.printJob({
        AutoID: 0,
        StationID: 0,
        JobStatus: 0,
        ReferenceNumber: 'TEST',
        Content: testHtml,
        PrinterName: 'Test Printer',
        AltPrinterName: `${ip}:${portNumber}`,
        AddDateTime: new Date().toISOString(),
        ProcessDateTime: null,
        ExternalNotes: 'Test',
      });

      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Test yazdırma başarılı' : 'Test yazdırma başarısız',
        error: result.error,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

'use client';

import { useEffect, useState } from 'react';
import { ServiceStatus, LogEntry } from '@/types';

export default function Dashboard() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch service status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/service/status');
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (error) {
      console.error('Status fetch error:', error);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs?limit=100');
      const data = await response.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Logs fetch error:', error);
    }
  };

  // Start service
  const startService = async () => {
    try {
      const response = await fetch('/api/service/start', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        await fetchStatus();
        await fetchLogs();
      } else {
        alert('Servis başlatılamadı: ' + data.error);
      }
    } catch (error) {
      alert('Servis başlatma hatası: ' + error);
    }
  };

  // Stop service
  const stopService = async () => {
    try {
      const response = await fetch('/api/service/stop', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        await fetchStatus();
      } else {
        alert('Servis durdurulamadı: ' + data.error);
      }
    } catch (error) {
      alert('Servis durdurma hatası: ' + error);
    }
  };

  // Clear logs
  const clearLogs = async () => {
    try {
      const response = await fetch('/api/logs', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setLogs([]);
      }
    } catch (error) {
      console.error('Log clear error:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      await fetchStatus();
      await fetchLogs();
      setIsLoading(false);
    };
    init();
  }, []);

  // Auto refresh status and logs
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 2000); // 2 saniyede bir güncelle

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Yükleniyor...</div>
      </div>
    );
  }

  const getStatusColor = () => {
    if (!status) return 'bg-gray-500';
    return status.isRunning ? 'bg-green-500' : 'bg-red-500';
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'success':
        return 'text-green-600';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Termal Yazıcı Servisi
          </h1>
          <p className="text-gray-600">
            ESC/POS yazıcı otomasyonu - 192.168.2.214:9100
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor()}`}></div>
              <h2 className="text-2xl font-semibold text-gray-900">
                Servis Durumu: {status?.isRunning ? 'Çalışıyor' : 'Durmuş'}
              </h2>
            </div>
            <div className="flex gap-3">
              {!status?.isRunning ? (
                <button
                  onClick={startService}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Başlat
                </button>
              ) : (
                <button
                  onClick={stopService}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Durdur
                </button>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium mb-1">
                Başlama Zamanı
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {status?.startedAt
                  ? new Date(status.startedAt).toLocaleString('tr-TR')
                  : 'N/A'}
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium mb-1">
                İşlenen İş
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {status?.totalJobsProcessed || 0}
              </div>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-red-600 font-medium mb-1">
                Başarısız İş
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {status?.totalJobsFailed || 0}
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600 font-medium mb-1">
                Son Kontrol
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {status?.lastPollTime
                  ? new Date(status.lastPollTime).toLocaleTimeString('tr-TR')
                  : 'N/A'}
              </div>
            </div>
          </div>

          {/* Last Error */}
          {status?.lastError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-600 font-medium mb-1">
                Son Hata
              </div>
              <div className="text-red-900 font-mono text-sm">
                {status.lastError}
              </div>
            </div>
          )}
        </div>

        {/* Logs Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-900">
              Sistem Logları
            </h2>
            <button
              onClick={clearLogs}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
            >
              Logları Temizle
            </button>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                Henüz log kaydı yok
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-2">
                  <span className="text-gray-400">
                    [{new Date(log.timestamp).toLocaleString('tr-TR')}]
                  </span>{' '}
                  <span className={`font-semibold ${getLogColor(log.level)}`}>
                    [{log.level.toUpperCase()}]
                  </span>{' '}
                  <span className="text-gray-200">{log.message}</span>
                  {log.details && (
                    <div className="ml-4 text-gray-400">
                      {typeof log.details === 'string'
                        ? log.details
                        : JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

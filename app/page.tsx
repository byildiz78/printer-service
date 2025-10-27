'use client';

import { useEffect, useState } from 'react';
import { ServiceStatus, LogEntry, AppSettings } from '@/types';
import {
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  TestTube2,
  Settings,
} from 'lucide-react';

interface JobGroup {
  jobId: string;
  logs: LogEntry[];
  status: 'success' | 'failed' | 'in_progress';
  startTime: string;
  endTime?: string;
  printerName?: string;
}

export default function Dashboard() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<string>('all');
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [showTestModal, setShowTestModal] = useState(false);
  const [testIp, setTestIp] = useState('');
  const [testPort, setTestPort] = useState('');
  const [testPrinterType, setTestPrinterType] = useState<'thermal' | 'slip'>('thermal');
  const [isTesting, setIsTesting] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    PRINTER_API_URL: '',
    PRINTER_IP: '',
    PRINTER_PORT: 9100,
  });
  const [settingsForm, setSettingsForm] = useState<AppSettings>({
    PRINTER_API_URL: '',
    PRINTER_IP: '',
    PRINTER_PORT: 9100,
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
        setSettingsForm(data.data);

        // Eğer PRINTER_API_URL boşsa modal'ı aç
        if (!data.data.PRINTER_API_URL || data.data.PRINTER_API_URL.trim() === '') {
          setShowSettingsModal(true);
        }
      }
    } catch (error) {
      console.error('Settings fetch error:', error);
    }
  };

  // Start service (used only when saving settings for the first time)
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

  // Clear logs
  const clearLogs = async () => {
    try {
      const response = await fetch('/api/logs', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setLogs([]);
        setExpandedJobs(new Set());
      }
    } catch (error) {
      console.error('Log clear error:', error);
    }
  };

  // Test printer
  const testPrinter = async () => {
    if (!testIp || !testPort) {
      alert('IP ve Port alanlarını doldurun');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch('/api/test-printer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip: testIp,
          port: testPort,
          printerType: testPrinterType,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Test yazdırma başarılı!');
        setShowTestModal(false);
        setTestIp('');
        setTestPort('');
        setTestPrinterType('thermal');
      } else {
        alert('Test yazdırma başarısız: ' + data.error);
      }
    } catch (error) {
      alert('Test yazdırma hatası: ' + error);
    } finally {
      setIsTesting(false);
    }
  };

  // Save settings
  const saveSettings = async () => {
    if (!settingsForm.PRINTER_API_URL || !settingsForm.PRINTER_IP || !settingsForm.PRINTER_PORT) {
      alert('Tüm alanları doldurun');
      return;
    }

    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsForm),
      });

      const data = await response.json();

      if (data.success) {
        setSettings(settingsForm);
        setShowSettingsModal(false);

        // Eğer servis çalışıyordu, yeniden başlatıldı
        if (data.needsRestart) {
          alert('Ayarlar başarıyla kaydedildi! Servis yeniden başlatılıyor...');
          setTimeout(() => {
            fetchStatus();
          }, 2000);
        } else {
          // İlk kez ayarlandı, servisi başlat
          alert('Ayarlar başarıyla kaydedildi! Servis başlatılıyor...');
          setTimeout(async () => {
            await startService();
            await fetchStatus();
          }, 1000);
        }
      } else {
        alert('Ayarlar kaydedilemedi: ' + data.error);
      }
    } catch (error) {
      alert('Ayar kaydetme hatası: ' + error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      await fetchSettings();
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

  // Calculate metrics
  const totalJobs = (status?.totalJobsProcessed || 0) + (status?.totalJobsFailed || 0);
  const successRate = totalJobs > 0 ? ((status?.totalJobsProcessed || 0) / totalJobs) * 100 : 100;

  // Calculate uptime
  const getUptime = () => {
    if (!status?.startedAt) return 'N/A';
    const start = new Date(status.startedAt).getTime();
    const now = new Date().getTime();
    const diffMs = now - start;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    if (hours > 0) return `${hours}s ${minutes}d`;
    if (minutes > 0) return `${minutes}d ${seconds}sn`;
    return `${seconds}sn`;
  };

  // Extract Job ID from log message
  const extractJobId = (message: string): string | null => {
    const match = message.match(/ID[=:](\d+)/i);
    return match ? match[1] : null;
  };

  // Extract Printer Name from log message
  const extractPrinterName = (message: string): string | null => {
    const match = message.match(/Printer[=:\s]+([A-Za-zğüşöçİĞÜŞÖÇıI\s]+?)(?:\s*→|\s*-|\s*,|$)/i);
    return match ? match[1].trim() : null;
  };

  // Group logs by Job ID
  const groupLogsByJob = (logs: LogEntry[]): JobGroup[] => {
    const jobMap = new Map<string, JobGroup>();
    const ungroupedLogs: LogEntry[] = [];
    let lastJobId: string | null = null;

    logs.forEach((log, index) => {
      const jobId = extractJobId(log.message);

      if (jobId) {
        // Job ID var - yeni grup oluştur veya mevcut gruba ekle
        lastJobId = jobId;

        if (!jobMap.has(jobId)) {
          jobMap.set(jobId, {
            jobId,
            logs: [],
            status: 'in_progress',
            startTime: log.timestamp,
          });
        }

        const group = jobMap.get(jobId)!;
        group.logs.push(log);

        // Extract printer name if not already set
        if (!group.printerName) {
          const printerName = extractPrinterName(log.message);
          if (printerName) {
            group.printerName = printerName;
          }
        }

        // Determine job status
        if (log.message.includes('tamamlandı') || log.message.includes('başarılı')) {
          group.status = 'success';
          group.endTime = log.timestamp;
        } else if (
          log.message.includes('vazgeçiliyor') ||
          log.message.includes('başarısız') ||
          log.level === 'error'
        ) {
          group.status = 'failed';
          group.endTime = log.timestamp;
        }
      } else {
        // Job ID yok - son job'a ekle veya ungrouped olarak tut
        if (lastJobId && jobMap.has(lastJobId)) {
          // Son işlenen job'a ekle
          jobMap.get(lastJobId)!.logs.push(log);
        } else {
          // Gerçekten bir job'a ait değil (örn: servis başlatıldı/durduruldu)
          ungroupedLogs.push(log);
        }
      }
    });

    const groups = Array.from(jobMap.values());

    // Add ungrouped logs as individual groups with unique keys
    ungroupedLogs.forEach((log, index) => {
      groups.push({
        jobId: `ungrouped-${log.timestamp}-${index}`,
        logs: [log],
        status: log.level === 'error' ? 'failed' : 'success',
        startTime: log.timestamp,
        endTime: log.timestamp,
      });
    });

    // En son loglar en üstte olsun
    return groups.reverse();
  };

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = logLevelFilter === 'all' || log.level === logLevelFilter;
    return matchesSearch && matchesLevel;
  });

  const jobGroups = groupLogsByJob(filteredLogs);

  // Toggle job expansion
  const toggleJob = (jobId: string) => {
    const newExpanded = new Set(expandedJobs);
    if (newExpanded.has(jobId)) {
      newExpanded.delete(jobId);
    } else {
      newExpanded.add(jobId);
    }
    setExpandedJobs(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-lg text-gray-700 font-medium">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-300 hover:bg-green-100';
      case 'failed':
        return 'bg-red-50 border-red-300 hover:bg-red-100';
      default:
        return 'bg-blue-50 border-blue-300 hover:bg-blue-100';
    }
  };

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-blue-600 animate-pulse" />;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'success':
        return 'text-green-700 bg-green-50 border-green-200';
      default:
        return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-3 h-3" />;
      case 'warning':
        return <Activity className="w-3 h-3" />;
      case 'success':
        return <CheckCircle2 className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 text-center md:text-left">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg shadow-lg">
                <Printer className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  robotPOS Air Print Service
                </h1>
                <p className="text-gray-600 text-sm">
                  Termal & Slip Yazıcı Otomasyonu - Gerçek Zamanlı İzleme
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSettingsForm(settings);
                setShowSettingsModal(true);
              }}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              title="Ayarlar"
            >
              <Settings className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Status Header Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-4 mb-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {status?.isRunning ? (
                <div className="relative">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <div className="absolute inset-0 w-4 h-4 bg-green-500 rounded-full animate-ping"></div>
                </div>
              ) : (
                <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              )}
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                  {status?.isRunning ? 'Servis Aktif' : 'Servis Hazırlanıyor'}
                </h2>
                <p className="text-gray-600 text-xs">
                  {status?.isRunning ? 'Çalışıyor ve görevleri işliyor' : 'Otomatik başlatılıyor...'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowTestModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-blue-500/50 transform hover:scale-105"
              >
                <TestTube2 className="w-4 h-4" />
                Test
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {/* Success Rate Card */}
          <div className="bg-white border border-green-200 rounded-xl p-3 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-600">
                  {successRate.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="text-gray-900 font-medium text-xs">Başarı Oranı</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {status?.totalJobsProcessed || 0} / {totalJobs} iş
            </div>
          </div>

          {/* Processed Jobs Card */}
          <div className="bg-white border border-blue-200 rounded-xl p-3 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600">
                  {status?.totalJobsProcessed || 0}
                </div>
              </div>
            </div>
            <div className="text-gray-900 font-medium text-xs">İşlenen İş</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Başarıyla tamamlandı</div>
          </div>

          {/* Failed Jobs Card */}
          <div className="bg-white border border-red-200 rounded-xl p-3 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-4 h-4 text-red-600" />
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-red-600">
                  {status?.totalJobsFailed || 0}
                </div>
              </div>
            </div>
            <div className="text-gray-900 font-medium text-xs">Başarısız İş</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Hata ile sonuçlandı</div>
          </div>

          {/* Uptime Card */}
          <div className="bg-white border border-purple-200 rounded-xl p-3 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-purple-600">
                  {getUptime()}
                </div>
              </div>
            </div>
            <div className="text-gray-900 font-medium text-xs">Çalışma Süresi</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {status?.startedAt
                ? new Date(status.startedAt).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'N/A'}
            </div>
          </div>
        </div>

        {/* Last Error */}
        {status?.lastError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-bold text-red-600">Son Hata</h3>
            </div>
            <div className="text-red-700 font-mono text-xs bg-white rounded-lg p-3 border border-red-200">
              {status.lastError}
            </div>
          </div>
        )}

        {/* Logs Card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Activity className="w-4 h-4 text-gray-700" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Sistem Logları</h2>
                <p className="text-gray-600 text-xs">
                  {jobGroups.length} job gösteriliyor
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Search Input */}
              <div className="relative flex-1 md:flex-initial">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full md:w-48 bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all"
                />
              </div>

              {/* Level Filter */}
              <div className="relative">
                <Filter className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-6 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 transition-all appearance-none cursor-pointer"
                >
                  <option value="all">Tümü</option>
                  <option value="info">Bilgi</option>
                  <option value="success">Başarı</option>
                  <option value="warning">Uyarı</option>
                  <option value="error">Hata</option>
                </select>
              </div>

              {/* Clear Button */}
              <button
                onClick={clearLogs}
                className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-md"
              >
                <Trash2 className="w-3 h-3" />
                Temizle
              </button>
            </div>
          </div>

          {/* Logs Container with Job Groups */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 h-[400px] overflow-y-auto text-xs">
            {jobGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Activity className="w-10 h-10 mb-2 opacity-50" />
                <div className="text-center text-xs">
                  {logs.length === 0
                    ? 'Henüz log kaydı yok'
                    : 'Filtreye uygun log bulunamadı'}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {jobGroups.map((group) => {
                  const isExpanded = expandedJobs.has(group.jobId);
                  const isUngrouped = group.jobId.startsWith('ungrouped');

                  return (
                    <div
                      key={group.jobId}
                      className={`border-2 rounded-lg transition-all duration-200 ${getJobStatusColor(
                        group.status
                      )}`}
                    >
                      {/* Job Header */}
                      <button
                        onClick={() => toggleJob(group.jobId)}
                        className="w-full p-2.5 flex items-center justify-between hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center gap-2">
                          {getJobStatusIcon(group.status)}
                          <div className="text-left">
                            <div className="font-semibold text-gray-900 text-xs flex items-center gap-2">
                              {isUngrouped ? 'Sistem Mesajı' : `Job #${group.jobId}`}
                              {group.printerName && (
                                <span className="text-[10px] text-gray-600 font-normal px-1.5 py-0.5 bg-white/60 rounded">
                                  {group.printerName}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-600 mt-0.5">
                              {new Date(group.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              {group.endTime &&
                                ` - ${new Date(group.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                              {' • '}
                              {group.logs.length} log
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                              group.status === 'success'
                                ? 'bg-green-200 text-green-800'
                                : group.status === 'failed'
                                ? 'bg-red-200 text-red-800'
                                : 'bg-blue-200 text-blue-800'
                            }`}
                          >
                            {group.status === 'success'
                              ? 'Başarılı'
                              : group.status === 'failed'
                              ? 'Başarısız'
                              : 'İşleniyor'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                      </button>

                      {/* Job Logs (Collapsed) */}
                      {isExpanded && (
                        <div className="border-t border-gray-300 p-2 space-y-1.5 bg-white/50">
                          {group.logs.map((log, index) => (
                            <div
                              key={index}
                              className={`border rounded-md p-2 ${getLogLevelColor(log.level)}`}
                            >
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5">{getLogIcon(log.level)}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="text-gray-500 text-[10px]">
                                      {new Date(log.timestamp).toLocaleTimeString('tr-TR')}
                                    </span>
                                    <span
                                      className={`text-[9px] font-semibold uppercase px-1 py-0.5 rounded ${
                                        log.level === 'error'
                                          ? 'bg-red-200 text-red-800'
                                          : log.level === 'warning'
                                          ? 'bg-yellow-200 text-yellow-800'
                                          : log.level === 'success'
                                          ? 'bg-green-200 text-green-800'
                                          : 'bg-blue-200 text-blue-800'
                                      }`}
                                    >
                                      {log.level}
                                    </span>
                                  </div>
                                  <div className="text-gray-900 break-words text-[11px]">
                                    {log.message}
                                  </div>
                                  {log.details && (
                                    <div className="mt-1 text-gray-600 text-[10px] bg-white rounded p-1.5 border border-gray-300">
                                      {typeof log.details === 'string'
                                        ? log.details
                                        : JSON.stringify(log.details, null, 2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
              {/* Close Button - Only if settings are configured */}
              {settings.PRINTER_API_URL && (
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Uygulama Ayarları</h2>
                  <p className="text-xs text-gray-600">
                    {settings.PRINTER_API_URL ? 'Ayarları düzenleyin' : 'Lütfen ayarları yapılandırın'}
                  </p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* API URL Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    API URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.PRINTER_API_URL}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, PRINTER_API_URL: e.target.value })
                    }
                    placeholder="https://dev.robotpos.com"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sadece base URL girin (örn: https://dev.robotpos.com)
                  </p>
                </div>

                {/* Printer IP Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Varsayılan Yazıcı IP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settingsForm.PRINTER_IP}
                    onChange={(e) => setSettingsForm({ ...settingsForm, PRINTER_IP: e.target.value })}
                    placeholder="192.168.2.214"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  />
                </div>

                {/* Printer Port Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Varsayılan Yazıcı Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={settingsForm.PRINTER_PORT}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, PRINTER_PORT: parseInt(e.target.value) })
                    }
                    placeholder="9100"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                  />
                </div>

                {/* Warning if not configured */}
                {!settings.PRINTER_API_URL && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      <strong>Uyarı:</strong> Servis başlatılabilmesi için API URL gereklidir.
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  {settings.PRINTER_API_URL && (
                    <button
                      onClick={() => setShowSettingsModal(false)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
                    >
                      İptal
                    </button>
                  )}
                  <button
                    onClick={saveSettings}
                    disabled={isSavingSettings}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingSettings ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Printer Modal */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-200">
              {/* Close Button */}
              <button
                onClick={() => setShowTestModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <TestTube2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Yazıcı Test</h2>
                  <p className="text-xs text-gray-600">Test yazdırması yapın</p>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {/* IP Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    IP Adresi
                  </label>
                  <input
                    type="text"
                    value={testIp}
                    onChange={(e) => setTestIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                {/* Port Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Port
                  </label>
                  <input
                    type="text"
                    value={testPort}
                    onChange={(e) => setTestPort(e.target.value)}
                    placeholder="9100"
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>

                {/* Printer Type Radio */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Yazıcı Tipi
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        value="thermal"
                        checked={testPrinterType === 'thermal'}
                        onChange={(e) => setTestPrinterType(e.target.value as 'thermal' | 'slip')}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">Normal Yazıcı</div>
                        <div className="text-xs text-gray-600">Termal yazıcı (PNG)</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        value="slip"
                        checked={testPrinterType === 'slip'}
                        onChange={(e) => setTestPrinterType(e.target.value as 'thermal' | 'slip')}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">Slip Yazıcı</div>
                        <div className="text-xs text-gray-600">Adisyon yazıcı (Text)</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowTestModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
                  >
                    İptal
                  </button>
                  <button
                    onClick={testPrinter}
                    disabled={isTesting}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTesting ? 'Yazdırılıyor...' : 'Yazdır'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

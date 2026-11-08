/**
 * EVOOPTIMIZER Native Bridge Service
 * Comunicación local segura con el motor nativo C# .NET 8 (EvoNativeEngine)
 * Escuchando exclusivamente en http://127.0.0.1:48120
 */

import { useState, useEffect, useCallback } from 'react';

export const DEFAULT_NATIVE_ENGINE_URL = 'http://127.0.0.1:48120';

export interface EngineStatus {
  isReady: boolean;
  version: string;
  engineName: string;
  isElevated: boolean;
  processId: number;
  uptimeSeconds: number;
  operatingSystem: string;
  architecture: string;
  startedAtUtc: string;
  supportedEndpoints: string[];
}

export interface OperatingSystemInfo {
  name: string;
  version: string;
  buildNumber: string;
  architecture: string;
  windowsEdition: string;
  installDate: string | null;
  uptimeHours: number;
}

export interface ProcessorInfo {
  name: string;
  manufacturer: string;
  physicalCores: number;
  logicalProcessors: number;
  maxClockSpeedMhz: number;
  architecture: string;
  socket: string;
}

export interface MemoryInfo {
  totalPhysicalBytes: number;
  availablePhysicalBytes: number;
  totalGb: number;
  availableGb: number;
  usedGb: number;
  usedPercentage: number;
}

export interface GpuInfo {
  name: string;
  manufacturer: string;
  driverVersion: string;
  adapterRamBytes: number;
  adapterRamMb: number;
  isPrimary: boolean;
}

export interface DiskDriveInfo {
  driveLetter: string;
  volumeLabel: string;
  driveType: string;
  fileSystem: string;
  totalBytes: number;
  freeBytes: number;
  totalGb: number;
  freeGb: number;
  usedGb: number;
  freePercentage: number;
  isSystemDrive: boolean;
}

export interface SystemHardwareReport {
  operatingSystem: OperatingSystemInfo;
  processor: ProcessorInfo;
  memory: MemoryInfo;
  graphicsCards: GpuInfo[];
  storageDrives: DiskDriveInfo[];
  queriedAtUtc: string;
  executionTimeMs: number;
  hostName: string;
  isWindowsPlatform: boolean;
  isElevated: boolean;
}

export interface OperationCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  requiresElevation: boolean;
  canRestore: boolean;
  isImplemented: boolean;
}

export interface OperationResult {
  success: boolean;
  operationId: string;
  actionType: 'apply' | 'restore';
  timestampUtc: string;
  durationMs: number;
  logs: string[];
  previousState: any;
  currentState: any;
  errorMessage: string | null;
  restored: boolean;
}

export interface OperationHistoryItem {
  id: string;
  operationId: string;
  actionType: string;
  timestampUtc: string;
  success: boolean;
  durationMs: number;
  summary: string;
  errorMessage: string | null;
}

export interface OperationStatusResponse {
  operationId: string;
  isImplemented: boolean;
  canRestore: boolean;
  hasBackup: boolean;
  lastRunUtc: string | null;
  currentState: any;
  message: string | null;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Consulta el estado del motor nativo C# en localhost:48120
 */
export async function checkEngineStatus(baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<EngineStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(`${baseUrl}/api/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`El motor C# respondió con código HTTP ${res.status}: ${res.statusText}`);
    }

    const data: EngineStatus = await res.json();
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado al conectar con ${baseUrl} (3.5s). Verifica que EvoNativeEngine esté corriendo.`);
    }
    throw new Error(`No se pudo conectar con el motor nativo en ${baseUrl}. Asegúrate de ejecutar scripts/Start-EvoEngine.ps1 o dotnet run en src-native/EvoNativeEngine.`);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Solicita el informe de diagnóstico de hardware en vivo desde el motor C#
 */
export async function fetchHardwareDiagnostics(baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<SystemHardwareReport> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${baseUrl}/api/diagnostics`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Error ${res.status} al obtener diagnóstico: ${res.statusText}`);
    }

    const data: SystemHardwareReport = await res.json();
    return data;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Tiempo de espera agotado al obtener diagnóstico desde ${baseUrl}.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fuerza un refresco de diagnóstico en el motor C#
 */
export async function refreshHardwareDiagnostics(baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<SystemHardwareReport> {
  const res = await fetch(`${baseUrl}/api/diagnostics/refresh`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status} al refrescar diagnóstico: ${res.statusText}`);
  }

  const data: SystemHardwareReport = await res.json();
  return data;
}

/**
 * Obtiene el catálogo de operaciones disponibles en el motor C#
 */
export async function fetchOperationsCatalog(baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<OperationCatalogItem[]> {
  const res = await fetch(`${baseUrl}/api/operations`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status} al obtener el catálogo de operaciones: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Aplica una operación real en Windows mediante su identificador
 */
export async function applyOperation(operationId: string, baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<OperationResult> {
  const res = await fetch(`${baseUrl}/api/operations/${encodeURIComponent(operationId)}/apply`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok && res.status !== 400) {
    throw new Error(`Error ${res.status} al aplicar la operación '${operationId}': ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Restaura los valores originales de una operación previamente aplicada
 */
export async function restoreOperation(operationId: string, baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<OperationResult> {
  const res = await fetch(`${baseUrl}/api/operations/${encodeURIComponent(operationId)}/restore`, {
    method: 'POST',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok && res.status !== 400) {
    throw new Error(`Error ${res.status} al restaurar la operación '${operationId}': ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Obtiene el historial de operaciones ejecutadas
 */
export async function fetchOperationsHistory(baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<OperationHistoryItem[]> {
  const res = await fetch(`${baseUrl}/api/operations/history`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status} al obtener historial: ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Consulta el estado actual de una operación específica
 */
export async function fetchOperationStatus(operationId: string, baseUrl = DEFAULT_NATIVE_ENGINE_URL): Promise<OperationStatusResponse> {
  const res = await fetch(`${baseUrl}/api/operations/${encodeURIComponent(operationId)}/status`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status} al consultar estado de '${operationId}': ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Hook de React para gestionar la conexión, diagnósticos y operaciones del motor C# en tiempo real
 */
export function useNativeBridge(baseUrl = DEFAULT_NATIVE_ENGINE_URL) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [engineInfo, setEngineInfo] = useState<EngineStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemHardwareReport | null>(null);
  const [catalog, setCatalog] = useState<OperationCatalogItem[]>([]);
  const [history, setHistory] = useState<OperationHistoryItem[]>([]);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);

  const connectAndProbe = useCallback(async (isUserInitiated = false) => {
    setConnectionStatus('connecting');
    setError(null);

    try {
      // Paso 1: Handshake con el motor C#
      const status = await checkEngineStatus(baseUrl);
      setEngineInfo(status);
      setConnectionStatus('connected');
      setLastCheckTime(new Date());

      // Paso 2: Consulta de diagnóstico de hardware en vivo
      setIsScanning(true);
      try {
        const report = await fetchHardwareDiagnostics(baseUrl);
        setDiagnostics(report);
      } catch (diagErr: any) {
        console.warn('Motor conectado pero falló la lectura de diagnóstico:', diagErr);
      } finally {
        setIsScanning(false);
      }

      // Paso 3: Carga del catálogo de operaciones e historial
      try {
        const [opsCatalog, opsHistory] = await Promise.all([
          fetchOperationsCatalog(baseUrl),
          fetchOperationsHistory(baseUrl),
        ]);
        setCatalog(opsCatalog);
        setHistory(opsHistory);
      } catch (opsErr: any) {
        console.warn('Advertencia al cargar catálogo de operaciones:', opsErr);
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setEngineInfo(null);
      setError(err.message || 'Error desconocido al conectar con el motor C#');
      setLastCheckTime(new Date());
      if (isUserInitiated) {
        console.warn('Conexión con motor nativo:', err.message);
      }
    }
  }, [baseUrl]);

  const refreshScan = useCallback(async () => {
    if (connectionStatus !== 'connected') {
      return connectAndProbe(true);
    }

    setIsScanning(true);
    setError(null);
    try {
      const freshReport = await refreshHardwareDiagnostics(baseUrl);
      setDiagnostics(freshReport);
      setLastCheckTime(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsScanning(false);
    }
  }, [baseUrl, connectionStatus, connectAndProbe]);

  const refreshHistory = useCallback(async () => {
    if (connectionStatus !== 'connected') return;
    try {
      const list = await fetchOperationsHistory(baseUrl);
      setHistory(list);
    } catch (err: any) {
      console.warn('Error al actualizar historial:', err);
    }
  }, [baseUrl, connectionStatus]);

  const applyOp = useCallback(async (operationId: string): Promise<OperationResult> => {
    if (activeOperation) {
      throw new Error(`Hay otra operación en curso ('${activeOperation}'). Espera a que finalice.`);
    }

    setActiveOperation(operationId);
    try {
      const result = await applyOperation(operationId, baseUrl);
      await refreshHistory();
      return result;
    } finally {
      setActiveOperation(null);
    }
  }, [baseUrl, activeOperation, refreshHistory]);

  const restoreOp = useCallback(async (operationId: string): Promise<OperationResult> => {
    if (activeOperation) {
      throw new Error(`Hay otra operación en curso ('${activeOperation}'). Espera a que finalice.`);
    }

    setActiveOperation(operationId);
    try {
      const result = await restoreOperation(operationId, baseUrl);
      await refreshHistory();
      return result;
    } finally {
      setActiveOperation(null);
    }
  }, [baseUrl, activeOperation, refreshHistory]);

  const getOpStatus = useCallback(async (operationId: string): Promise<OperationStatusResponse> => {
    return await fetchOperationStatus(operationId, baseUrl);
  }, [baseUrl]);

  // Chequeo inicial suave al montar el componente
  useEffect(() => {
    connectAndProbe(false);
  }, [connectAndProbe]);

  return {
    connectionStatus,
    engineInfo,
    diagnostics,
    catalog,
    history,
    activeOperation,
    error,
    isScanning,
    lastCheckTime,
    reconnect: () => connectAndProbe(true),
    refreshScan,
    refreshHistory,
    applyOp,
    restoreOp,
    getOpStatus,
    isConnected: connectionStatus === 'connected',
  };
}

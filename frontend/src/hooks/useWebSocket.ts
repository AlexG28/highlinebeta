import { useEffect, useRef, useState, useCallback } from 'react';
import { Service } from '../types';

interface WSMessage {
  type: 'init' | 'services' | 'service_update' | 'pong';
  data: Service[] | Service | null;
}

interface UseWebSocketReturn {
  services: Service[];
  connected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [services, setServices] = useState<Service[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }, []);

  const connect = useCallback(() => {
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = getWebSocketUrl();
    console.log('[WS] Connecting to', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
      setError(null);
      
      // Start ping interval to keep connection alive
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'init':
          case 'services':
            // Full services list
            setServices(msg.data as Service[] || []);
            break;
            
          case 'service_update':
            // Single service update - merge into existing list
            const updatedService = msg.data as Service;
            setServices(prev => {
              const index = prev.findIndex(s => s.name === updatedService.name);
              if (index >= 0) {
                const newServices = [...prev];
                newServices[index] = updatedService;
                return newServices;
              } else {
                return [...prev, updatedService];
              }
            });
            break;
            
          case 'pong':
            // Heartbeat response, ignore
            break;
            
          default:
            console.log('[WS] Unknown message type:', msg.type);
        }
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    ws.onerror = (event) => {
      console.error('[WS] Error:', event);
      setError('WebSocket error');
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setConnected(false);
      
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        console.log('[WS] Reconnecting...');
        connect();
      }, 3000);
    };
  }, [getWebSocketUrl]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { services, connected, error, reconnect };
}

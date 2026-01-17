package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"

	"golang.org/x/net/websocket"
)

// WSHub manages all WebSocket connections
type WSHub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

// NewWSHub creates a new WebSocket hub
func NewWSHub() *WSHub {
	return &WSHub{
		clients: make(map[*websocket.Conn]bool),
	}
}

// AddClient registers a new WebSocket client
func (h *WSHub) AddClient(ws *websocket.Conn) {
	h.mu.Lock()
	h.clients[ws] = true
	h.mu.Unlock()
	slog.Info("WebSocket client connected", "total_clients", len(h.clients))
}

// RemoveClient unregisters a WebSocket client
func (h *WSHub) RemoveClient(ws *websocket.Conn) {
	h.mu.Lock()
	delete(h.clients, ws)
	h.mu.Unlock()
	slog.Info("WebSocket client disconnected", "total_clients", len(h.clients))
}

// Broadcast sends a message to all connected clients
func (h *WSHub) Broadcast(msgType string, data interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	msg := WSMessage{
		Type: msgType,
		Data: data,
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		slog.Error("Failed to marshal WebSocket message", "error", err)
		return
	}

	for client := range h.clients {
		go func(c *websocket.Conn) {
			if _, err := c.Write(msgBytes); err != nil {
				slog.Debug("Failed to send to client", "error", err)
			}
		}(client)
	}
}

// WSMessage is the structure for WebSocket messages
type WSMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// WSHandler handles WebSocket connections
func (app *App) WSHandler(ws *websocket.Conn) {
	app.wsHub.AddClient(ws)
	defer func() {
		app.wsHub.RemoveClient(ws)
		ws.Close()
	}()

	// Send initial state to the new client
	services := app.store.GetAllServices()
	initialMsg := WSMessage{
		Type: "init",
		Data: services,
	}
	msgBytes, _ := json.Marshal(initialMsg)
	ws.Write(msgBytes)

	// Keep connection alive and listen for pings
	buf := make([]byte, 1024)
	for {
		n, err := ws.Read(buf)
		if err != nil {
			break
		}
		// Handle ping/pong or other client messages if needed
		if n > 0 {
			var msg map[string]interface{}
			if json.Unmarshal(buf[:n], &msg) == nil {
				if msg["type"] == "ping" {
					pong := WSMessage{Type: "pong", Data: nil}
					pongBytes, _ := json.Marshal(pong)
					ws.Write(pongBytes)
				}
			}
		}
	}
}

// BroadcastServiceUpdate sends a service update to all clients
func (app *App) BroadcastServiceUpdate(service *Service) {
	app.wsHub.Broadcast("service_update", service)
}

// BroadcastAllServices sends all services to all clients
func (app *App) BroadcastAllServices() {
	services := app.store.GetAllServices()
	app.wsHub.Broadcast("services", services)
}

// WebSocket HTTP handler wrapper
func (app *App) WebSocketHandler() http.Handler {
	return websocket.Handler(app.WSHandler)
}

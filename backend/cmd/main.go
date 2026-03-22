package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/KimMaru10/PeelTask/backend/internal/handler"
	"github.com/KimMaru10/PeelTask/backend/internal/store"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("home dir: %v", err)
	}

	dbDir := filepath.Join(homeDir, ".peeltask")
	if err := os.MkdirAll(dbDir, 0750); err != nil {
		log.Fatalf("create db dir: %v", err)
	}

	dbPath := filepath.Join(dbDir, "peeltask.db")
	db, err := store.NewDatabase(dbPath)
	if err != nil {
		log.Fatalf("database init: %v", err)
	}
	_ = db // TODO(kim): ハンドラーへのDI実装時に使用 #2

	port := os.Getenv("PEELTASK_PORT")
	if port == "" {
		port = "8080"
	}

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	healthHandler := handler.NewHealthHandler()
	api := e.Group("/api")
	api.GET("/health", healthHandler.HealthCheck)

	log.Printf("PeelTask backend starting on :%s", port)
	if err := e.Start(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}

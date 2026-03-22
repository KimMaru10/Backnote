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
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("create db dir: %v", err)
	}

	dbPath := filepath.Join(dbDir, "peeltask.db")
	_, err = store.NewDatabase(dbPath)
	if err != nil {
		log.Fatalf("database init: %v", err)
	}

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	healthHandler := handler.NewHealthHandler()
	api := e.Group("/api")
	api.GET("/health", healthHandler.HealthCheck)

	log.Println("PeelTask backend starting on :8080")
	if err := e.Start(":8080"); err != nil {
		log.Fatalf("server: %v", err)
	}
}

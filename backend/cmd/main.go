package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/KimMaru10/PeelTask/backend/internal/handler"
	"github.com/KimMaru10/PeelTask/backend/internal/service"
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

	backlogClient := service.NewBacklogClient()
	syncer := service.NewSyncer(db, backlogClient)
	syncer.Start()
	defer syncer.Stop()

	port := os.Getenv("PEELTASK_PORT")
	if port == "" {
		port = "8080"
	}

	e := echo.New()
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	healthHandler := handler.NewHealthHandler()
	syncHandler := handler.NewSyncHandler(db, syncer)
	spaceHandler := handler.NewSpaceHandler(db)
	scheduleHandler := handler.NewScheduleHandler(db)
	taskHandler := handler.NewTaskHandler(db)

	api := e.Group("/api")
	api.GET("/health", healthHandler.HealthCheck)
	api.GET("/tasks/:id", taskHandler.GetTask)
	api.GET("/tasks/:id/memos", taskHandler.GetMemos)
	api.POST("/tasks/:id/memos", taskHandler.AddMemo)
	api.DELETE("/tasks/:id/memos/:memoId", taskHandler.DeleteMemo)
	api.POST("/sync", syncHandler.Sync)
	api.GET("/tasks", syncHandler.GetTasks)
	api.GET("/sync/status", syncHandler.GetSyncStatus)
	api.GET("/schedule", scheduleHandler.GetSchedule)
	api.GET("/spaces", spaceHandler.List)
	api.POST("/spaces", spaceHandler.Create)
	api.PUT("/spaces/:id", spaceHandler.Update)
	api.DELETE("/spaces/:id", spaceHandler.Delete)
	api.POST("/spaces/test", spaceHandler.TestConnection)

	log.Printf("PeelTask backend starting on :%s", port)
	if err := e.Start(":" + port); err != nil {
		log.Fatalf("server: %v", err)
	}
}

package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/handler"
	"github.com/KimMaru10/Backnote/backend/internal/service"
	"github.com/KimMaru10/Backnote/backend/internal/store"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

const shutdownTimeout = 5 * time.Second

func main() {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("home dir: %v", err)
	}

	dbDir := filepath.Join(homeDir, ".backnote")
	if err := os.MkdirAll(dbDir, 0750); err != nil {
		log.Fatalf("create db dir: %v", err)
	}

	dbPath := filepath.Join(dbDir, "backnote.db")
	db, err := store.NewDatabase(dbPath)
	if err != nil {
		log.Fatalf("database init: %v", err)
	}

	// すべての書き込みは DBWriter goroutine 経由で直列化する。
	// これにより SQLite の書き込みロック競合（BUSY/LOCKED）を構造的に回避する。
	writer := store.NewDBWriter(db)
	defer writer.Stop()

	backlogClient := service.NewBacklogClient()
	syncer := service.NewSyncer(db, backlogClient, writer)
	syncer.Start()
	defer syncer.Stop()

	port := os.Getenv("BACKNOTE_PORT")
	if port == "" {
		port = "8080"
	}

	e := echo.New()
	e.HideBanner = true
	// リクエスト処理時間を含むログを出力（latency が見えるとパフォーマンス問題の切り分けが楽）
	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "[${time_rfc3339}] ${method} ${uri} status=${status} latency=${latency_human}\n",
	}))
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// HTTP サーバーにタイムアウトを設定。
	// ハングしたリクエストが永遠に接続を握り続けるのを防ぐ。
	e.Server.ReadTimeout = 30 * time.Second
	e.Server.WriteTimeout = 60 * time.Second
	e.Server.IdleTimeout = 120 * time.Second

	shutdownCh := make(chan struct{}, 1)
	shutdownHandler := handler.NewShutdownHandler(shutdownCh, os.Getenv("BACKNOTE_SHUTDOWN_TOKEN"))

	healthHandler := handler.NewHealthHandler()
	syncHandler := handler.NewSyncHandler(db, syncer)
	spaceHandler := handler.NewSpaceHandler(db, syncer, writer)
	scheduleHandler := handler.NewScheduleHandler(db)
	taskHandler := handler.NewTaskHandler(db, writer)
	settingHandler := handler.NewSettingHandler(db, writer)
	notificationHandler := handler.NewNotificationHandler(db, writer)
	searchHandler := handler.NewSearchHandler(db)
	focusHandler := handler.NewFocusHandler(db, writer)
	commentHandler := handler.NewCommentHandler(db)
	attachmentHandler := handler.NewAttachmentHandler(db)
	childrenHandler := handler.NewChildrenHandler(db)
	backlogNotifHandler := handler.NewBacklogNotificationHandler(db)

	api := e.Group("/api")
	api.GET("/health", healthHandler.HealthCheck)
	api.POST("/shutdown", shutdownHandler.Shutdown)
	api.GET("/tasks/:id", taskHandler.GetTask)
	api.GET("/tasks/:id/memos", taskHandler.GetMemos)
	api.POST("/tasks/:id/memos", taskHandler.AddMemo)
	api.DELETE("/tasks/:id/memos/:memoId", taskHandler.DeleteMemo)
	api.GET("/tasks/:id/comments", commentHandler.Get)
	api.GET("/tasks/:id/attachments/:filename", attachmentHandler.GetByName)
	api.GET("/tasks/:id/related", childrenHandler.GetRelated)
	api.POST("/sync", syncHandler.Sync)
	api.GET("/tasks", syncHandler.GetTasks)
	api.GET("/sync/status", syncHandler.GetSyncStatus)
	api.GET("/schedule", scheduleHandler.GetSchedule)
	api.GET("/spaces", spaceHandler.List)
	api.POST("/spaces", spaceHandler.Create)
	api.PUT("/spaces/:id", spaceHandler.Update)
	api.DELETE("/spaces/:id", spaceHandler.Delete)
	api.POST("/spaces/test", spaceHandler.TestConnection)
	api.POST("/spaces/info", spaceHandler.GetSpaceInfo)
	api.GET("/spaces/:id/projects", spaceHandler.GetProjects)
	api.PATCH("/spaces/:id/projects", spaceHandler.UpdateProjects)
	api.GET("/settings", settingHandler.Get)
	api.PUT("/settings", settingHandler.Update)
	api.GET("/notifications/due", notificationHandler.GetDue)
	api.POST("/notifications/mark", notificationHandler.Mark)
	api.GET("/notifications/backlog", backlogNotifHandler.List)
	api.GET("/notifications/backlog/count", backlogNotifHandler.Count)
	api.POST("/notifications/backlog/:spaceId/:id/read", backlogNotifHandler.MarkRead)
	api.GET("/search", searchHandler.Search)
	api.GET("/focus", focusHandler.Get)
	api.PUT("/focus", focusHandler.Put)
	api.POST("/focus/:taskId/complete", focusHandler.Complete)
	api.DELETE("/focus/:taskId", focusHandler.Remove)

	go func() {
		log.Printf("Backnote backend starting on :%s", port)
		if err := e.Start(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	// Electron からの /api/shutdown 通知、または OS シグナル（開発時の Ctrl+C）で graceful shutdown する。
	// defer の writer.Stop / syncer.Stop が確実に走る経路を作るのが目的。
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)

	select {
	case <-shutdownCh:
		log.Println("shutdown requested via HTTP")
	case sig := <-sigCh:
		log.Printf("signal received: %s", sig)
	}

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := e.Shutdown(ctx); err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			log.Printf("server shutdown timed out after %s, forcing stop", shutdownTimeout)
		} else {
			log.Printf("server shutdown error: %v", err)
		}
	}
}

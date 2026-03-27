package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/KimMaru10/Backnote/backend/internal/service"
	"github.com/labstack/echo/v4"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.AutoMigrate(
		&model.BacklogSpace{},
		&model.Task{},
		&model.Schedule{},
		&model.ScheduleSlot{},
		&model.Category{},
	); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	return db
}

func TestSync_EmptySpaces(t *testing.T) {
	db := setupTestDB(t)
	client := service.NewBacklogClient()
	syncer := service.NewSyncer(db, client)
	h := NewSyncHandler(db, syncer)

	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/api/sync", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.Sync(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if resp["totalTasks"].(float64) != 0 {
		t.Errorf("expected 0 tasks, got %v", resp["totalTasks"])
	}
}

func TestGetTasks_Empty(t *testing.T) {
	db := setupTestDB(t)
	client := service.NewBacklogClient()
	syncer := service.NewSyncer(db, client)
	h := NewSyncHandler(db, syncer)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.GetTasks(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var tasks []model.Task
	if err := json.Unmarshal(rec.Body.Bytes(), &tasks); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}
}

func TestGetTasks_WithData(t *testing.T) {
	db := setupTestDB(t)
	client := service.NewBacklogClient()
	syncer := service.NewSyncer(db, client)
	h := NewSyncHandler(db, syncer)

	db.Create(&model.Task{
		IssueKey: "TEST-1",
		Title:    "テストタスク",
		Priority: "高",
		Score:    0.8,
		SpaceID:  1,
	})
	db.Create(&model.Task{
		IssueKey: "TEST-2",
		Title:    "テストタスク2",
		Priority: "低",
		Score:    0.3,
		SpaceID:  1,
	})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/tasks", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.GetTasks(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}

	var tasks []model.Task
	if err := json.Unmarshal(rec.Body.Bytes(), &tasks); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(tasks) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(tasks))
	}

	// スコア降順で返ることを確認
	if tasks[0].Score < tasks[1].Score {
		t.Errorf("expected tasks sorted by score DESC, got %v < %v", tasks[0].Score, tasks[1].Score)
	}
}

func TestGetSyncStatus_InitiallyNull(t *testing.T) {
	db := setupTestDB(t)
	client := service.NewBacklogClient()
	syncer := service.NewSyncer(db, client)
	h := NewSyncHandler(db, syncer)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/sync/status", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.GetSyncStatus(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if resp["lastSyncedAt"] != nil {
		t.Errorf("expected null lastSyncedAt, got %v", resp["lastSyncedAt"])
	}
}

func TestGetSyncStatus_AfterSync(t *testing.T) {
	db := setupTestDB(t)
	client := service.NewBacklogClient()
	syncer := service.NewSyncer(db, client)
	h := NewSyncHandler(db, syncer)

	db.Create(&model.BacklogSpace{
		Domain:      "test.backlog.com",
		ApiKeyRef:   "test-key",
		DisplayName: "Test",
		IsActive:    true,
	})
	syncer.RunManualSync()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/sync/status", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.GetSyncStatus(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if resp["lastSyncedAt"] == nil {
		t.Error("expected non-null lastSyncedAt after sync")
	}
}

package service

import (
	"sync"
	"testing"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.AutoMigrate(&model.BacklogSpace{}, &model.Task{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	return db
}

func TestSyncer_StartStop(t *testing.T) {
	db := setupTestDB(t)
	client := NewBacklogClient()
	syncer := NewSyncer(db, client, nil)

	syncer.Start()
	time.Sleep(100 * time.Millisecond)
	syncer.Stop()
}

func TestSyncer_StopWithoutStart(t *testing.T) {
	db := setupTestDB(t)
	client := NewBacklogClient()
	syncer := NewSyncer(db, client, nil)

	// Stop without Start should not panic
	syncer.Stop()
}

func TestSyncer_LastSyncedAt_InitiallyNil(t *testing.T) {
	db := setupTestDB(t)
	client := NewBacklogClient()
	syncer := NewSyncer(db, client, nil)

	if got := syncer.LastSyncedAt(); got != nil {
		t.Errorf("expected nil, got %v", got)
	}
}

func TestSyncer_LastSyncedAt_AfterSync(t *testing.T) {
	db := setupTestDB(t)
	client := NewBacklogClient()
	syncer := NewSyncer(db, client, nil)

	// スペースを1件追加して同期を実行（スペース0件だと早期リターンで lastSyncedAt が更新されない）
	db.Create(&model.BacklogSpace{
		Domain:      "test.backlog.com",
		ApiKeyRef:   "test-key",
		DisplayName: "Test",
		IsActive:    true,
	})

	before := time.Now()
	syncer.RunManualSync()
	after := time.Now()

	got := syncer.LastSyncedAt()
	if got == nil {
		t.Fatal("expected non-nil lastSyncedAt after sync")
	}
	if got.Before(before) || got.After(after) {
		t.Errorf("lastSyncedAt %v not in range [%v, %v]", got, before, after)
	}
}

func TestSyncer_RunManualSync_NoSpaces(t *testing.T) {
	db := setupTestDB(t)
	client := NewBacklogClient()
	syncer := NewSyncer(db, client, nil)

	totalTasks, errs := syncer.RunManualSync()

	if totalTasks != 0 {
		t.Errorf("expected 0 tasks, got %d", totalTasks)
	}
	if errs != nil {
		t.Errorf("expected no errors, got %v", errs)
	}
}

func TestSyncer_RunManualSync_InvalidSpace(t *testing.T) {
	db := setupTestDB(t)
	client := NewBacklogClient()
	syncer := NewSyncer(db, client, nil)

	db.Create(&model.BacklogSpace{
		Domain:      "invalid-domain.example.com",
		ApiKeyRef:   "invalid-key",
		DisplayName: "Test",
		IsActive:    true,
	})

	totalTasks, errs := syncer.RunManualSync()

	if totalTasks != 0 {
		t.Errorf("expected 0 tasks, got %d", totalTasks)
	}
	if len(errs) == 0 {
		t.Error("expected errors for invalid space, got none")
	}
}

func TestSyncer_ConcurrentAccess(t *testing.T) {
	db := setupTestDB(t)
	client := NewBacklogClient()
	syncer := NewSyncer(db, client, nil)

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			syncer.RunManualSync()
			syncer.LastSyncedAt()
		}()
	}
	wg.Wait()
}

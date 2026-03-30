package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupSpaceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.AutoMigrate(&model.BacklogSpace{}, &model.Task{}, &model.Memo{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
	return db
}

func TestSpaceList_Empty(t *testing.T) {
	db := setupSpaceTestDB(t)
	h := NewSpaceHandler(db, nil)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/spaces", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.List(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var spaces []model.BacklogSpace
	if err := json.Unmarshal(rec.Body.Bytes(), &spaces); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(spaces) != 0 {
		t.Errorf("expected 0 spaces, got %d", len(spaces))
	}
}

func TestSpaceCreate_MissingFields(t *testing.T) {
	db := setupSpaceTestDB(t)
	h := NewSpaceHandler(db, nil)

	e := echo.New()
	body := `{"domain":"","apiKeyRef":"","displayName":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/spaces", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	if err := h.Create(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestSpaceDelete_NotFound(t *testing.T) {
	db := setupSpaceTestDB(t)
	h := NewSpaceHandler(db, nil)

	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/spaces/999", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("999")

	if err := h.Delete(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestSpaceDelete_CascadeDelete(t *testing.T) {
	db := setupSpaceTestDB(t)
	h := NewSpaceHandler(db, nil)

	db.Create(&model.BacklogSpace{Domain: "test.backlog.jp", ApiKeyRef: "key", DisplayName: "Test", IsActive: true})
	db.Create(&model.Task{IssueKey: "T-1", Title: "task1", SpaceID: 1})
	db.Create(&model.Memo{TaskID: 1, Content: "memo1"})

	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/spaces/1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")

	if err := h.Delete(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var taskCount int64
	db.Model(&model.Task{}).Count(&taskCount)
	if taskCount != 0 {
		t.Errorf("expected 0 tasks after cascade delete, got %d", taskCount)
	}

	var memoCount int64
	db.Model(&model.Memo{}).Count(&memoCount)
	if memoCount != 0 {
		t.Errorf("expected 0 memos after cascade delete, got %d", memoCount)
	}
}

func TestSpaceUpdate_NotFound(t *testing.T) {
	db := setupSpaceTestDB(t)
	h := NewSpaceHandler(db, nil)

	e := echo.New()
	body := `{"displayName":"updated"}`
	req := httptest.NewRequest(http.MethodPut, "/api/spaces/999", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("999")

	if err := h.Update(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

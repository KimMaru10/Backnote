package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/labstack/echo/v4"
)

func TestGetTask_NotFound(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/tasks/999", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("999")

	if err := h.GetTask(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestGetTask_Found(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	db.Create(&model.Task{IssueKey: "T-1", Title: "Test Task", SpaceID: 1})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/tasks/1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")

	if err := h.GetTask(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var task model.Task
	if err := json.Unmarshal(rec.Body.Bytes(), &task); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if task.IssueKey != "T-1" {
		t.Errorf("expected T-1, got %s", task.IssueKey)
	}
}

func TestGetMemos_Empty(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	db.Create(&model.Task{IssueKey: "T-1", Title: "Test", SpaceID: 1})

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/tasks/1/memos", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")

	if err := h.GetMemos(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
}

func TestAddMemo_Success(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	db.Create(&model.Task{IssueKey: "T-1", Title: "Test", SpaceID: 1})

	e := echo.New()
	body := `{"content":"テストメモ"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks/1/memos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")

	if err := h.AddMemo(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusCreated {
		t.Errorf("expected 201, got %d", rec.Code)
	}

	var memo model.Memo
	if err := json.Unmarshal(rec.Body.Bytes(), &memo); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if memo.Content != "テストメモ" {
		t.Errorf("expected テストメモ, got %s", memo.Content)
	}
}

func TestAddMemo_EmptyContent(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	db.Create(&model.Task{IssueKey: "T-1", Title: "Test", SpaceID: 1})

	e := echo.New()
	body := `{"content":"   "}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks/1/memos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("1")

	if err := h.AddMemo(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", rec.Code)
	}
}

func TestAddMemo_TaskNotFound(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	e := echo.New()
	body := `{"content":"test"}`
	req := httptest.NewRequest(http.MethodPost, "/api/tasks/999/memos", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id")
	c.SetParamValues("999")

	if err := h.AddMemo(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestDeleteMemo_NotFound(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/tasks/1/memos/999", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "memoId")
	c.SetParamValues("1", "999")

	if err := h.DeleteMemo(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Errorf("expected 404, got %d", rec.Code)
	}
}

func TestDeleteMemo_Success(t *testing.T) {
	db := setupTestDB(t)
	h := NewTaskHandler(db, nil)

	db.Create(&model.Task{IssueKey: "T-1", Title: "Test", SpaceID: 1})
	db.Create(&model.Memo{TaskID: 1, Content: "to delete"})

	e := echo.New()
	req := httptest.NewRequest(http.MethodDelete, "/api/tasks/1/memos/1", nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	c.SetParamNames("id", "memoId")
	c.SetParamValues("1", "1")

	if err := h.DeleteMemo(c); err != nil {
		t.Fatalf("handler error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var count int64
	db.Model(&model.Memo{}).Count(&count)
	if count != 0 {
		t.Errorf("expected 0 memos, got %d", count)
	}
}

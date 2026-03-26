package handler

import (
	"errors"
	"log"
	"net/http"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type TaskHandler struct {
	db *gorm.DB
}

func NewTaskHandler(db *gorm.DB) *TaskHandler {
	return &TaskHandler{db: db}
}

func (h *TaskHandler) GetTask(c echo.Context) error {
	id := c.Param("id")
	var task model.Task
	if err := h.db.First(&task, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "task not found"})
		}
		log.Printf("error: failed to fetch task %s: %v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch task"})
	}
	return c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) GetMemos(c echo.Context) error {
	taskID := c.Param("id")
	var memos []model.Memo
	if err := h.db.Where("task_id = ?", taskID).Order("created_at DESC").Find(&memos).Error; err != nil {
		log.Printf("error: failed to fetch memos for task %s: %v", taskID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to fetch memos"})
	}
	return c.JSON(http.StatusOK, memos)
}

func (h *TaskHandler) AddMemo(c echo.Context) error {
	taskID := c.Param("id")

	var task model.Task
	if err := h.db.First(&task, taskID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "task not found"})
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := c.Bind(&req); err != nil || req.Content == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "content is required"})
	}

	memo := model.Memo{
		TaskID:  task.ID,
		Content: req.Content,
	}
	if err := h.db.Create(&memo).Error; err != nil {
		log.Printf("error: failed to create memo for task %s: %v", taskID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create memo"})
	}

	return c.JSON(http.StatusCreated, memo)
}

func (h *TaskHandler) DeleteMemo(c echo.Context) error {
	memoID := c.Param("memoId")
	result := h.db.Delete(&model.Memo{}, memoID)
	if result.Error != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to delete memo"})
	}
	if result.RowsAffected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "memo not found"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "deleted"})
}

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

func (h *TaskHandler) CompleteTask(c echo.Context) error {
	id := c.Param("id")

	var task model.Task
	if err := h.db.First(&task, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.JSON(http.StatusNotFound, map[string]string{
				"error": "task not found",
			})
		}
		log.Printf("error: failed to fetch task %s: %v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch task",
		})
	}

	task.Status = model.TaskStatusCompleted
	if err := h.db.Save(&task).Error; err != nil {
		log.Printf("error: failed to complete task %s: %v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to complete task",
		})
	}

	return c.JSON(http.StatusOK, task)
}

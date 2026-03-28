package handler

import (
	"log"
	"net/http"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/KimMaru10/Backnote/backend/internal/service"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type ScheduleHandler struct {
	db *gorm.DB
}

func NewScheduleHandler(db *gorm.DB) *ScheduleHandler {
	return &ScheduleHandler{db: db}
}

func (h *ScheduleHandler) GetSchedule(c echo.Context) error {
	var tasks []model.Task
	if err := h.db.Where("status != ?", model.TaskStatusCompleted).Find(&tasks).Error; err != nil {
		log.Printf("error: failed to fetch tasks for schedule (status != %s): %v", model.TaskStatusCompleted, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch tasks",
		})
	}

	schedules, err := service.GenerateSchedule(tasks, time.Now())
	if err != nil {
		log.Printf("error: failed to generate schedule: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to generate schedule",
		})
	}

	return c.JSON(http.StatusOK, schedules)
}

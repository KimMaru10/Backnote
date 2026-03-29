package handler

import (
	"log"
	"net/http"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/KimMaru10/Backnote/backend/internal/service"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SyncHandler struct {
	db     *gorm.DB
	syncer *service.Syncer
}

func NewSyncHandler(db *gorm.DB, syncer *service.Syncer) *SyncHandler {
	return &SyncHandler{
		db:     db,
		syncer: syncer,
	}
}

type syncResponse struct {
	TotalTasks   int      `json:"totalTasks"`
	Errors       []string `json:"errors,omitempty"`
	LastSyncedAt *string  `json:"lastSyncedAt,omitempty"`
}

func (h *SyncHandler) Sync(c echo.Context) error {
	totalTasks, errs := h.syncer.RunManualSync()

	resp := syncResponse{
		TotalTasks: totalTasks,
		Errors:     errs,
	}

	if t := h.syncer.LastSyncedAt(); t != nil {
		formatted := t.Format("2006-01-02T15:04:05Z07:00")
		resp.LastSyncedAt = &formatted
	}

	return c.JSON(http.StatusOK, resp)
}

func (h *SyncHandler) GetTasks(c echo.Context) error {
	query := h.db.Preload(clause.Associations).Order("score DESC")

	if c.QueryParam("mode") != "all" {
		// 「自分」モード: 各スペースの MyUserID に一致する担当者のタスクのみ返す
		subQuery := h.db.Model(&model.BacklogSpace{}).Select("my_user_id").Where("is_active = ? AND my_user_id > 0", true)
		query = query.Where("assignee_id IN (?)", subQuery)
	}

	var tasks []model.Task
	if err := query.Find(&tasks).Error; err != nil {
		log.Printf("error: failed to fetch tasks: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "failed to fetch tasks",
		})
	}
	return c.JSON(http.StatusOK, tasks)
}

func (h *SyncHandler) GetSyncStatus(c echo.Context) error {
	resp := map[string]interface{}{
		"lastSyncedAt": nil,
	}
	if t := h.syncer.LastSyncedAt(); t != nil {
		resp["lastSyncedAt"] = t.Format("2006-01-02T15:04:05Z07:00")
	}
	return c.JSON(http.StatusOK, resp)
}

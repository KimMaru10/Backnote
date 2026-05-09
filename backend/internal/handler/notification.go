package handler

import (
	"log"
	"net/http"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/KimMaru10/Backnote/backend/internal/store"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type NotificationHandler struct {
	db     *gorm.DB
	writer *store.DBWriter
}

func NewNotificationHandler(db *gorm.DB, writer *store.DBWriter) *NotificationHandler {
	return &NotificationHandler{db: db, writer: writer}
}

func (h *NotificationHandler) write(fn store.WriteFunc) error {
	if h.writer != nil {
		return h.writer.Do(fn)
	}
	return h.db.Transaction(fn)
}

type duePayload struct {
	DueToday []model.Task `json:"dueToday"`
	Overdue  []model.Task `json:"overdue"`
}

// GET /api/notifications/due
// 期限が今日 / 期限切れのタスクを「自分担当」のみ返す。
// 期限切れは Today 当日と区別。
// last_notified_at は Task に含まれているので、Electron 側で「今日まだ通知していない」を判定できる。
// /api/tasks の mode=mine と同じ assignee フィルタを使い、他人担当タスクで通知が鳴らないようにする。
func (h *NotificationHandler) GetDue(c echo.Context) error {
	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrowStart := todayStart.Add(24 * time.Hour)

	var myUserIDs []int
	if err := h.db.Model(&model.BacklogSpace{}).
		Where("is_active = ? AND my_user_id > 0", true).
		Pluck("my_user_id", &myUserIDs).Error; err != nil {
		log.Printf("error: failed to fetch my_user_ids for /due: %v", err)
	}
	// my_user_id が一つも保存されていない場合はフィルタしないでフォールバック
	// （sync.go GetTasks と同じ挙動）。
	applyAssignee := len(myUserIDs) > 0

	dueTodayQuery := h.db.Where("due_date >= ? AND due_date < ? AND status != ?",
		todayStart, tomorrowStart, model.TaskStatusCompleted)
	if applyAssignee {
		dueTodayQuery = dueTodayQuery.Where("assignee_id IN ?", myUserIDs)
	}
	var dueToday []model.Task
	if err := dueTodayQuery.Order("score DESC").Find(&dueToday).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch due-today failed"})
	}

	overdueQuery := h.db.Where("due_date < ? AND status != ?",
		todayStart, model.TaskStatusCompleted)
	if applyAssignee {
		overdueQuery = overdueQuery.Where("assignee_id IN ?", myUserIDs)
	}
	var overdue []model.Task
	if err := overdueQuery.Order("due_date ASC").Find(&overdue).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch overdue failed"})
	}

	return c.JSON(http.StatusOK, duePayload{DueToday: dueToday, Overdue: overdue})
}

type markRequest struct {
	TaskIDs []uint `json:"taskIds"`
}

// POST /api/notifications/mark
// 指定タスクの last_notified_at を現在時刻にする。重複通知抑止。
func (h *NotificationHandler) Mark(c echo.Context) error {
	var req markRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request"})
	}
	if len(req.TaskIDs) == 0 {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	}

	now := time.Now()
	err := h.write(func(tx *gorm.DB) error {
		return tx.Model(&model.Task{}).
			Where("id IN ?", req.TaskIDs).
			Update("last_notified_at", now).Error
	})
	if err != nil {
		store.LogSQLiteError(err, "notification.Mark")
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "update failed"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

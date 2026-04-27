package handler

import (
	"log"
	"net/http"
	"strings"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SearchHandler struct {
	db *gorm.DB
}

func NewSearchHandler(db *gorm.DB) *SearchHandler {
	return &SearchHandler{db: db}
}

const searchResultLimit = 50

// GET /api/search?q=...
// title / issue_key / memo content を横断検索してタスクを返す。
// 完了タスクは除外。スコア降順で最大 50 件。
func (h *SearchHandler) Search(c echo.Context) error {
	q := strings.TrimSpace(c.QueryParam("q"))
	if q == "" {
		return c.JSON(http.StatusOK, []model.Task{})
	}

	// LIKE のメタ文字をエスケープ（_ と % を含むクエリでも安全に動かす）
	pattern := "%" + escapeLike(q) + "%"

	var tasks []model.Task
	err := h.db.Preload(clause.Associations).
		Where("status != ?", model.TaskStatusCompleted).
		Where(
			"title LIKE ? ESCAPE '\\' OR issue_key LIKE ? ESCAPE '\\' OR id IN (SELECT task_id FROM memos WHERE content LIKE ? ESCAPE '\\')",
			pattern, pattern, pattern,
		).
		Order("score DESC").
		Limit(searchResultLimit).
		Find(&tasks).Error
	if err != nil {
		log.Printf("error: search failed: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "search failed"})
	}
	return c.JSON(http.StatusOK, tasks)
}

func escapeLike(s string) string {
	r := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_")
	return r.Replace(s)
}

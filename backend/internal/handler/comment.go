package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type CommentHandler struct {
	db *gorm.DB
}

func NewCommentHandler(db *gorm.DB) *CommentHandler {
	return &CommentHandler{db: db}
}

// GET /api/tasks/:id/comments
// タスクの紐づくスペースの API キー・ドメインを使い、Backlog の課題コメント一覧を中継して返す。
// レスポンスは Backlog API の形式そのまま。
func (h *CommentHandler) Get(c echo.Context) error {
	taskID := c.Param("id")

	var task model.Task
	if err := h.db.First(&task, taskID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "task not found"})
	}

	var space model.BacklogSpace
	if err := h.db.First(&space, task.SpaceID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "space not found"})
	}

	url := fmt.Sprintf("https://%s/api/v2/issues/%s/comments?apiKey=%s&order=desc&count=100",
		space.Domain, task.IssueKey, space.ApiKeyRef)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("error: comment fetch failed for task %s: %v", taskID, err)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "failed to fetch comments"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("error: backlog comments API status=%d body=%s", resp.StatusCode, string(body))
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": fmt.Sprintf("Backlog API error: status %d", resp.StatusCode),
		})
	}

	// Backlog のレスポンス（配列）をそのまま返す
	var raw json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to decode comments"})
	}
	return c.JSONBlob(http.StatusOK, raw)
}

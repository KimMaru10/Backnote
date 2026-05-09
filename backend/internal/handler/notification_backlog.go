package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type BacklogNotificationHandler struct {
	db *gorm.DB
}

func NewBacklogNotificationHandler(db *gorm.DB) *BacklogNotificationHandler {
	return &BacklogNotificationHandler{db: db}
}

// Backlog API のレスポンス（必要なフィールドだけ）
type backlogNotification struct {
	ID          int  `json:"id"`
	AlreadyRead bool `json:"alreadyRead"`
	Reason      int  `json:"reason"`
	Sender      *struct {
		ID           int    `json:"id"`
		Name         string `json:"name"`
		NulabAccount *struct {
			IconURL string `json:"iconUrl"`
		} `json:"nulabAccount"`
	} `json:"sender"`
	Issue *struct {
		ID       int    `json:"id"`
		IssueKey string `json:"issueKey"`
		Summary  string `json:"summary"`
		Status   struct {
			ID    int    `json:"id"`
			Name  string `json:"name"`
			Color string `json:"color"`
		} `json:"status"`
	} `json:"issue"`
	Comment *struct {
		ID      int    `json:"id"`
		Content string `json:"content"`
	} `json:"comment"`
	Created string `json:"created"`
}

type uiNotificationSender struct {
	ID      int    `json:"id"`
	Name    string `json:"name"`
	IconURL string `json:"iconUrl"`
}

type uiNotification struct {
	ID          int                  `json:"id"`
	SpaceID     uint                 `json:"spaceId"`
	SpaceDomain string               `json:"spaceDomain"`
	AlreadyRead bool                 `json:"alreadyRead"`
	Reason      int                  `json:"reason"`
	ReasonText  string               `json:"reasonText"`
	Sender      uiNotificationSender `json:"sender"`
	IssueID     int                  `json:"issueId"`
	IssueKey    string               `json:"issueKey"`
	IssueTitle  string               `json:"issueTitle"`
	IssueStatus string               `json:"issueStatus"`
	StatusColor string               `json:"statusColor"`
	Excerpt     string               `json:"excerpt"`
	CreatedAt   string               `json:"createdAt"`
	LocalTaskID uint                 `json:"localTaskId,omitempty"`
}

// GET /api/notifications/backlog
// 全 active space の Backlog 通知を集約して返す。各スペースは並列に取得。
func (h *BacklogNotificationHandler) List(c echo.Context) error {
	spaces, err := h.activeSpaces()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch spaces failed"})
	}

	type spaceResult struct {
		notes []uiNotification
	}
	results := make([]spaceResult, len(spaces))
	var wg sync.WaitGroup
	for i, sp := range spaces {
		wg.Add(1)
		go func(idx int, space model.BacklogSpace) {
			defer wg.Done()
			notes, err := h.fetchNotifications(space)
			if err != nil {
				log.Printf("warn: backlog notification fetch failed for %s: %v", space.Domain, err)
				return
			}
			ui := make([]uiNotification, 0, len(notes))
			for _, n := range notes {
				if n.Issue == nil {
					// 課題ベースの通知のみ扱う（PR 等はスコープ外）
					continue
				}
				ui = append(ui, h.toUI(n, space))
			}
			results[idx] = spaceResult{notes: ui}
		}(i, sp)
	}
	wg.Wait()

	all := make([]uiNotification, 0)
	for _, r := range results {
		all = append(all, r.notes...)
	}
	// 新しい順
	sort.Slice(all, func(i, j int) bool { return all[i].CreatedAt > all[j].CreatedAt })

	// 同期済み課題には localTaskId を付ける
	if len(all) > 0 {
		issueIDs := make([]int, 0, len(all))
		seen := make(map[int]struct{})
		for _, n := range all {
			if _, ok := seen[n.IssueID]; ok {
				continue
			}
			seen[n.IssueID] = struct{}{}
			issueIDs = append(issueIDs, n.IssueID)
		}
		var localTasks []model.Task
		if err := h.db.Select("id, backlog_issue_id").
			Where("backlog_issue_id IN ?", issueIDs).Find(&localTasks).Error; err == nil {
			localByBacklog := make(map[int]uint, len(localTasks))
			for _, t := range localTasks {
				localByBacklog[t.BacklogIssueID] = t.ID
			}
			for i := range all {
				if id, ok := localByBacklog[all[i].IssueID]; ok {
					all[i].LocalTaskID = id
				}
			}
		}
	}

	return c.JSON(http.StatusOK, all)
}

// GET /api/notifications/backlog/count
// 未読件数だけを軽量に返す（Tray バッジ用）。
func (h *BacklogNotificationHandler) Count(c echo.Context) error {
	spaces, err := h.activeSpaces()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "fetch spaces failed"})
	}

	var mu sync.Mutex
	total := 0
	var wg sync.WaitGroup
	for _, sp := range spaces {
		wg.Add(1)
		go func(space model.BacklogSpace) {
			defer wg.Done()
			n, err := h.fetchUnreadCount(space)
			if err != nil {
				return
			}
			mu.Lock()
			total += n
			mu.Unlock()
		}(sp)
	}
	wg.Wait()

	return c.JSON(http.StatusOK, map[string]int{"unread": total})
}

// POST /api/notifications/backlog/:spaceId/:id/read
// 個別通知を Backlog 上で既読化する。
func (h *BacklogNotificationHandler) MarkRead(c echo.Context) error {
	spaceID := c.Param("spaceId")
	id := c.Param("id")
	if spaceID == "" || id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "spaceId and id required"})
	}

	var space model.BacklogSpace
	if err := h.db.First(&space, spaceID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "space not found"})
	}

	url := fmt.Sprintf("https://%s/api/v2/notifications/%s/markAsRead?apiKey=%s",
		space.Domain, id, space.ApiKeyRef)
	req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(""))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "request create failed"})
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("error: mark notification read failed: %v", err)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "Backlog API request failed"})
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("warn: mark notification read returned status %d: %s", resp.StatusCode, string(body))
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": fmt.Sprintf("Backlog API error: status %d", resp.StatusCode),
		})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func (h *BacklogNotificationHandler) activeSpaces() ([]model.BacklogSpace, error) {
	var spaces []model.BacklogSpace
	if err := h.db.Where("is_active = ?", true).Find(&spaces).Error; err != nil {
		return nil, err
	}
	return spaces, nil
}

func (h *BacklogNotificationHandler) fetchNotifications(space model.BacklogSpace) ([]backlogNotification, error) {
	url := fmt.Sprintf("https://%s/api/v2/notifications?apiKey=%s&count=20",
		space.Domain, space.ApiKeyRef)
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}
	var notes []backlogNotification
	if err := json.NewDecoder(resp.Body).Decode(&notes); err != nil {
		return nil, err
	}
	return notes, nil
}

func (h *BacklogNotificationHandler) fetchUnreadCount(space model.BacklogSpace) (int, error) {
	url := fmt.Sprintf("https://%s/api/v2/notifications/count?apiKey=%s&alreadyRead=false",
		space.Domain, space.ApiKeyRef)
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("status %d", resp.StatusCode)
	}
	var data struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return 0, err
	}
	return data.Count, nil
}

func (h *BacklogNotificationHandler) toUI(n backlogNotification, space model.BacklogSpace) uiNotification {
	ui := uiNotification{
		ID:          n.ID,
		SpaceID:     space.ID,
		SpaceDomain: space.Domain,
		AlreadyRead: n.AlreadyRead,
		Reason:      n.Reason,
		ReasonText:  reasonText(n.Reason),
		CreatedAt:   n.Created,
	}
	if n.Sender != nil {
		ui.Sender.ID = n.Sender.ID
		ui.Sender.Name = n.Sender.Name
		if n.Sender.NulabAccount != nil {
			ui.Sender.IconURL = n.Sender.NulabAccount.IconURL
		}
	}
	if n.Issue != nil {
		ui.IssueID = n.Issue.ID
		ui.IssueKey = n.Issue.IssueKey
		ui.IssueTitle = n.Issue.Summary
		ui.IssueStatus = n.Issue.Status.Name
		ui.StatusColor = n.Issue.Status.Color
	}
	// 抜粋: コメントがあればコメント、なければ課題タイトル
	if n.Comment != nil && n.Comment.Content != "" {
		ui.Excerpt = n.Comment.Content
	} else if n.Issue != nil {
		ui.Excerpt = n.Issue.Summary
	}
	return ui
}

// Backlog の reason コードを日本語ラベルへマッピング。
// 公式 API: https://developer.nulab.com/docs/backlog/api/2/get-recent-updates/
func reasonText(reason int) string {
	switch reason {
	case 1, 4:
		return "更新"
	case 2, 5:
		return "コメント"
	case 3:
		return "担当者"
	case 6:
		return "ファイル"
	case 9, 10, 11, 12, 13, 14, 15, 16, 17:
		return "PR"
	default:
		return "お知らせ"
	}
}

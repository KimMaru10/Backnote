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

type ChildrenHandler struct {
	db *gorm.DB
}

func NewChildrenHandler(db *gorm.DB) *ChildrenHandler {
	return &ChildrenHandler{db: db}
}

type relatedIssue struct {
	BacklogID   int    `json:"backlogId"`
	IssueKey    string `json:"issueKey"`
	Summary     string `json:"summary"`
	Status      string `json:"status"`
	StatusID    int    `json:"statusId"`
	AssigneeName string `json:"assigneeName,omitempty"`
	DueDate     string `json:"dueDate,omitempty"`
	// アプリ内遷移用: backnote DB に同期済みの場合は ID が入る。
	// 未同期の課題（プロジェクト未登録など）は 0 で返り、その場合はリンクは Backlog Web に飛ばす。
	LocalTaskID uint `json:"localTaskId,omitempty"`
}

type relatedResponse struct {
	Parent   *relatedIssue  `json:"parent"`
	Siblings []relatedIssue `json:"siblings"`
	Children []relatedIssue `json:"children"`
}

// GET /api/tasks/:id/related
// 親課題と子課題をまとめて返す。
// それぞれ Backnote DB に存在すれば LocalTaskID を含み、フロント側でアプリ内遷移できる。
func (h *ChildrenHandler) GetRelated(c echo.Context) error {
	taskID := c.Param("id")

	var task model.Task
	if err := h.db.First(&task, taskID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "task not found"})
	}

	var space model.BacklogSpace
	if err := h.db.First(&space, task.SpaceID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "space not found"})
	}

	resp := relatedResponse{Parent: nil, Siblings: []relatedIssue{}, Children: []relatedIssue{}}

	// 親課題と兄弟課題（自分が子の場合）
	if task.ParentIssueID > 0 {
		parent, err := h.fetchIssueByID(space, task.ParentIssueID)
		if err != nil {
			log.Printf("warn: parent fetch failed: %v", err)
		} else if parent != nil {
			r := h.toRelated(*parent)
			resp.Parent = &r
		}

		// 親の子 = 自分自身 + 兄弟。自分を除外して兄弟リストを作る。
		siblings, err := h.fetchChildren(space, task.ParentIssueID)
		if err != nil {
			log.Printf("warn: siblings fetch failed: %v", err)
		} else {
			for _, s := range siblings {
				if s.ID == task.BacklogIssueID {
					continue
				}
				resp.Siblings = append(resp.Siblings, h.toRelated(s))
			}
		}
	}

	// 子課題
	if task.BacklogIssueID > 0 {
		children, err := h.fetchChildren(space, task.BacklogIssueID)
		if err != nil {
			log.Printf("warn: children fetch failed: %v", err)
		} else {
			for _, ch := range children {
				resp.Children = append(resp.Children, h.toRelated(ch))
			}
		}
	}

	// 自分が親（子を持つトップレベル課題）の場合、自分自身を「親」として表示する。
	// 詳細を見ている課題が親であることを視覚的にも明示するため。
	if resp.Parent == nil && len(resp.Children) > 0 && task.BacklogIssueID > 0 {
		self, err := h.fetchIssueByID(space, task.BacklogIssueID)
		if err != nil {
			log.Printf("warn: self fetch failed: %v", err)
		} else if self != nil {
			r := h.toRelated(*self)
			resp.Parent = &r
		}
	}

	return c.JSON(http.StatusOK, resp)
}

type backlogIssueLite struct {
	ID       int    `json:"id"`
	IssueKey string `json:"issueKey"`
	Summary  string `json:"summary"`
	Status   struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"status"`
	Assignee *struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"assignee"`
	DueDate *string `json:"dueDate"`
}

func (h *ChildrenHandler) fetchChildren(space model.BacklogSpace, parentID int) ([]backlogIssueLite, error) {
	url := fmt.Sprintf(
		"https://%s/api/v2/issues?apiKey=%s&parentIssueId[]=%d&count=100",
		space.Domain, space.ApiKeyRef, parentID,
	)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}
	var issues []backlogIssueLite
	if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
		return nil, err
	}
	return issues, nil
}

func (h *ChildrenHandler) fetchIssueByID(space model.BacklogSpace, id int) (*backlogIssueLite, error) {
	url := fmt.Sprintf("https://%s/api/v2/issues/%d?apiKey=%s", space.Domain, id, space.ApiKeyRef)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	var issue backlogIssueLite
	if err := json.NewDecoder(resp.Body).Decode(&issue); err != nil {
		return nil, err
	}
	return &issue, nil
}

// Backlog レスポンスを front 用 DTO へ変換し、ローカル DB に同じ課題があれば LocalTaskID を付与
func (h *ChildrenHandler) toRelated(b backlogIssueLite) relatedIssue {
	r := relatedIssue{
		BacklogID: b.ID,
		IssueKey:  b.IssueKey,
		Summary:   b.Summary,
		Status:    b.Status.Name,
		StatusID:  b.Status.ID,
	}
	if b.Assignee != nil {
		r.AssigneeName = b.Assignee.Name
	}
	if b.DueDate != nil {
		r.DueDate = *b.DueDate
	}
	// 同期済みなら LocalTaskID を付ける
	var local model.Task
	if err := h.db.Select("id").Where("backlog_issue_id = ?", b.ID).First(&local).Error; err == nil {
		r.LocalTaskID = local.ID
	}
	return r
}

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
//
// パフォーマンス上の注意: 関連課題の LocalTaskID 解決はかつて N+1 クエリだったが、
// 親+兄弟+子をまとめて一度の SELECT で解決するように集約してある。
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

	// 1. Backlog API からの取得は LocalTaskID 付与なしで先に組み立てる
	resp := relatedResponse{Parent: nil, Siblings: []relatedIssue{}, Children: []relatedIssue{}}

	if task.ParentIssueID > 0 {
		if parent, err := h.fetchIssueByID(space, task.ParentIssueID); err != nil {
			log.Printf("warn: parent fetch failed: %v", err)
		} else if parent != nil {
			r := toRelated(*parent)
			resp.Parent = &r
		}

		// 親の子 = 自分自身 + 兄弟。自分を除外して兄弟リストを作る。
		if siblings, err := h.fetchChildren(space, task.ParentIssueID); err != nil {
			log.Printf("warn: siblings fetch failed: %v", err)
		} else {
			for _, s := range siblings {
				if s.ID == task.BacklogIssueID {
					continue
				}
				resp.Siblings = append(resp.Siblings, toRelated(s))
			}
		}
	}

	if task.BacklogIssueID > 0 {
		if children, err := h.fetchChildren(space, task.BacklogIssueID); err != nil {
			log.Printf("warn: children fetch failed: %v", err)
		} else {
			for _, ch := range children {
				resp.Children = append(resp.Children, toRelated(ch))
			}
		}
	}

	// 自分が親（子を持つトップレベル課題）の場合、自分自身を「親」として表示する。
	if resp.Parent == nil && len(resp.Children) > 0 && task.BacklogIssueID > 0 {
		if self, err := h.fetchIssueByID(space, task.BacklogIssueID); err != nil {
			log.Printf("warn: self fetch failed: %v", err)
		} else if self != nil {
			r := toRelated(*self)
			resp.Parent = &r
		}
	}

	// 2. 関連課題の LocalTaskID をまとめて 1 クエリで解決して付与
	h.attachLocalTaskIDs(&resp)

	return c.JSON(http.StatusOK, resp)
}

// attachLocalTaskIDs は parent / siblings / children に含まれる Backlog ID を
// 1 度の SELECT で local task ID にマップして書き戻す。
// 旧実装は関連課題ごとに DB クエリを発行していたが、N が大きい（兄弟数十件）と
// 1 リクエストで N+1 回の SELECT が走り、画面遷移直後の負荷スパイクの一因となっていた。
func (h *ChildrenHandler) attachLocalTaskIDs(resp *relatedResponse) {
	ids := make([]int, 0, 1+len(resp.Siblings)+len(resp.Children))
	if resp.Parent != nil && resp.Parent.BacklogID > 0 {
		ids = append(ids, resp.Parent.BacklogID)
	}
	for _, s := range resp.Siblings {
		if s.BacklogID > 0 {
			ids = append(ids, s.BacklogID)
		}
	}
	for _, c := range resp.Children {
		if c.BacklogID > 0 {
			ids = append(ids, c.BacklogID)
		}
	}
	if len(ids) == 0 {
		return
	}

	type row struct {
		ID             uint
		BacklogIssueID int
	}
	var rows []row
	if err := h.db.Model(&model.Task{}).
		Select("id, backlog_issue_id").
		Where("backlog_issue_id IN ?", ids).
		Find(&rows).Error; err != nil {
		log.Printf("warn: local task lookup failed: %v", err)
		return
	}

	localByBacklog := make(map[int]uint, len(rows))
	for _, r := range rows {
		localByBacklog[r.BacklogIssueID] = r.ID
	}

	if resp.Parent != nil {
		if id, ok := localByBacklog[resp.Parent.BacklogID]; ok {
			resp.Parent.LocalTaskID = id
		}
	}
	for i := range resp.Siblings {
		if id, ok := localByBacklog[resp.Siblings[i].BacklogID]; ok {
			resp.Siblings[i].LocalTaskID = id
		}
	}
	for i := range resp.Children {
		if id, ok := localByBacklog[resp.Children[i].BacklogID]; ok {
			resp.Children[i].LocalTaskID = id
		}
	}
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

// Backlog レスポンスを front 用 DTO へ変換する。
// LocalTaskID は呼び出し元の attachLocalTaskIDs でまとめて 1 クエリ解決するため、
// ここでは 0 のまま返す。
func toRelated(b backlogIssueLite) relatedIssue {
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
	return r
}

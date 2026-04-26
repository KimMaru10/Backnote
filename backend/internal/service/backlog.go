package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/KimMaru10/Backnote/backend/internal/model"
)

const (
	backlogAPITimeout = 30 * time.Second
	issuesPerPage     = 100

	priorityHighID   = 2
	priorityMediumID = 3
	priorityLowID    = 4
)

type BacklogClient struct {
	httpClient *http.Client
}

func NewBacklogClient() *BacklogClient {
	return &BacklogClient{
		httpClient: &http.Client{
			Timeout: backlogAPITimeout,
		},
	}
}

type backlogIssue struct {
	ID       int    `json:"id"`
	IssueKey string `json:"issueKey"`
	Summary  string `json:"summary"`
	Priority struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"priority"`
	EstimatedHours *float64 `json:"estimatedHours"`
	DueDate        *string  `json:"dueDate"`
	Status         struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"status"`
	Milestone []struct {
		ID   int     `json:"id"`
		Name string  `json:"name"`
		Date *string `json:"date"`
	} `json:"milestone"`
	Assignee *struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"assignee"`
	Description string  `json:"description"`
	Created     *string `json:"created"`
}

func (c *BacklogClient) fetchMyUserID(ctx context.Context, domain string, apiKey string) (int, error) {
	url := fmt.Sprintf("https://%s/api/v2/users/myself?apiKey=%s", domain, apiKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, fmt.Errorf("backlog myself request create: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("backlog myself request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("backlog myself API error: status %d", resp.StatusCode)
	}

	var user struct {
		ID int `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return 0, fmt.Errorf("backlog myself decode: %w", err)
	}

	return user.ID, nil
}

// FetchIssues は指定スペースの課題を取得する。
// assigneeID > 0 のときはその担当者のタスクのみ、0 のときはフィルタなしで取得。
func (c *BacklogClient) FetchIssues(ctx context.Context, space model.BacklogSpace, apiKey string, assigneeID int) ([]model.Task, error) {
	// statusId フィルタは付けない:
	// - 標準ステータス (1=未対応, 2=処理中, 3=処理済み, 4=完了) に加え、
	//   プロジェクトごとに異なるカスタムステータス（例: レビュー済み）が ID 5+ で存在する
	// - プロジェクトのカスタムステータスを動的に取得する代わりに、
	//   全件取得してクライアント側で「完了」を除外する方が汎用的
	url := fmt.Sprintf("https://%s/api/v2/issues?apiKey=%s&count=%d",
		space.Domain, apiKey, issuesPerPage)

	if assigneeID > 0 {
		url += fmt.Sprintf("&assigneeId[]=%d", assigneeID)
	}

	// プロジェクトフィルター
	if space.ProjectIDs != "" {
		for _, pid := range strings.Split(space.ProjectIDs, ",") {
			pid = strings.TrimSpace(pid)
			if pid != "" {
				url += fmt.Sprintf("&projectId[]=%s", pid)
			}
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("backlog request create: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("backlog request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("backlog auth failed for space %s: invalid API key", space.Domain)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backlog API error for space %s: status %d", space.Domain, resp.StatusCode)
	}

	var issues []backlogIssue
	if err := json.NewDecoder(resp.Body).Decode(&issues); err != nil {
		return nil, fmt.Errorf("backlog response decode: %w", err)
	}

	tasks := make([]model.Task, 0, len(issues))
	for _, issue := range issues {
		// 完了タスクは除外（標準 status=4 とローカライズ名「完了」両方をチェック）
		if issue.Status.Name == model.TaskStatusCompleted {
			continue
		}

		assigneeID := 0
		if issue.Assignee != nil {
			assigneeID = issue.Assignee.ID
		}

		task := model.Task{
			IssueKey:       issue.IssueKey,
			Title:          issue.Summary,
			Description:    issue.Description,
			Priority:       mapPriority(issue.Priority.ID),
			EstimatedHours: derefFloat(issue.EstimatedHours),
			Status:         issue.Status.Name,
			AssigneeID:     assigneeID,
			SpaceID:        space.ID,
			SyncedAt:       time.Now(),
		}

		if issue.Created != nil {
			t, parseErr := time.Parse("2006-01-02T15:04:05Z", *issue.Created)
			if parseErr != nil {
				log.Printf("warn: failed to parse created date for %s: %v", issue.IssueKey, parseErr)
			} else {
				task.BacklogCreatedAt = &t
			}
		}

		if issue.DueDate != nil {
			t, parseErr := time.Parse("2006-01-02T15:04:05Z", *issue.DueDate)
			if parseErr != nil {
				log.Printf("warn: failed to parse dueDate for %s: %v", issue.IssueKey, parseErr)
			} else {
				task.DueDate = &t
			}
		}

		if len(issue.Milestone) > 0 && issue.Milestone[0].Date != nil {
			task.MilestoneID = fmt.Sprintf("%d", issue.Milestone[0].ID)
			t, parseErr := time.Parse("2006-01-02T15:04:05Z", *issue.Milestone[0].Date)
			if parseErr != nil {
				log.Printf("warn: failed to parse milestone date for %s: %v", issue.IssueKey, parseErr)
			} else {
				task.MilestoneDueDate = &t
			}
		}

		tasks = append(tasks, task)
	}

	return tasks, nil
}

type SyncResult struct {
	SpaceID  uint
	Tasks    []model.Task
	MyUserID int
	Err      error
}

func (c *BacklogClient) FetchAllSpaces(ctx context.Context, spaces []model.BacklogSpace, apiKeys map[uint]string) []SyncResult {
	results := make([]SyncResult, len(spaces))
	var wg sync.WaitGroup

	for i, space := range spaces {
		wg.Add(1)
		go func(idx int, sp model.BacklogSpace) {
			defer wg.Done()

			apiKey, ok := apiKeys[sp.ID]
			if !ok {
				results[idx] = SyncResult{SpaceID: sp.ID, Err: fmt.Errorf("API key not found for space %s", sp.Domain)}
				return
			}

			myUserID, userErr := c.fetchMyUserID(ctx, sp.Domain, apiKey)
			if userErr != nil {
				log.Printf("warn: failed to fetch my user ID for space %s: %v", sp.Domain, userErr)
			}

			// 全体タスク（最近更新の上位 100 件）を取得
			allTasks, fetchErr := c.FetchIssues(ctx, sp, apiKey, 0)

			// 自分担当のタスクは別途取得して merge する。
			// Backlog API は count=100 上限のため、自分担当が 100 件以上ある場合でも
			// 必ず最新 100 件は取得できる。「全体」リストに含まれない自分担当も補完される。
			if myUserID > 0 {
				myTasks, myErr := c.FetchIssues(ctx, sp, apiKey, myUserID)
				if myErr != nil {
					log.Printf("warn: failed to fetch my tasks for space %s: %v", sp.Domain, myErr)
				} else {
					allTasks = mergeTasksByIssueKey(allTasks, myTasks)
				}
			}

			results[idx] = SyncResult{SpaceID: sp.ID, Tasks: allTasks, MyUserID: myUserID, Err: fetchErr}
		}(i, space)
	}

	wg.Wait()
	return results
}

// mergeTasksByIssueKey は IssueKey で重複排除しつつ 2 つのタスクスライスを結合する。
// b 側（自分担当）のデータを優先し、a 側（全体）に同 IssueKey があれば b で上書き。
func mergeTasksByIssueKey(a, b []model.Task) []model.Task {
	indexInA := make(map[string]int, len(a))
	for i, t := range a {
		indexInA[t.IssueKey] = i
	}
	merged := make([]model.Task, len(a))
	copy(merged, a)
	for _, t := range b {
		if idx, ok := indexInA[t.IssueKey]; ok {
			merged[idx] = t
		} else {
			merged = append(merged, t)
		}
	}
	return merged
}

func mapPriority(id int) string {
	switch id {
	case priorityHighID:
		return "高"
	case priorityMediumID:
		return "中"
	case priorityLowID:
		return "低"
	default:
		return "中"
	}
}

func derefFloat(f *float64) float64 {
	if f == nil {
		return 0
	}
	return *f
}


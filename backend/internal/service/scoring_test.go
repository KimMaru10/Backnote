package service

import (
	"math"
	"testing"
	"time"

	"github.com/KimMaru10/PeelTask/backend/internal/model"
)

func timePtr(t time.Time) *time.Time {
	return &t
}

func TestCalcDeadlineUrgency(t *testing.T) {
	now := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name     string
		dueDate  *time.Time
		expected float64
	}{
		{
			name:     "期限なし",
			dueDate:  nil,
			expected: 0.0,
		},
		{
			name:     "残り10日",
			dueDate:  timePtr(now.AddDate(0, 0, 10)),
			expected: 1.0 / 10.0,
		},
		{
			name:     "残り1日",
			dueDate:  timePtr(now.AddDate(0, 0, 1)),
			expected: 1.0 / 1.0,
		},
		{
			name:     "期限切れ（残り0日以下）→ minRemainingDays適用",
			dueDate:  timePtr(now.AddDate(0, 0, -1)),
			expected: 1.0 / minRemainingDays,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalcDeadlineUrgency(tt.dueDate, now)
			if math.Abs(got-tt.expected) > 0.01 {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestCalcPriorityScore(t *testing.T) {
	tests := []struct {
		name     string
		priority string
		expected float64
	}{
		{"高", "高", 1.0},
		{"中", "中", 0.6},
		{"低", "低", 0.3},
		{"未知の値はデフォルト中", "不明", 0.6},
		{"空文字はデフォルト中", "", 0.6},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalcPriorityScore(tt.priority)
			if got != tt.expected {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestCalcEffortPenalty(t *testing.T) {
	tests := []struct {
		name           string
		estimatedHours float64
		expected       float64
	}{
		{"0時間 → minEstimatedHours適用", 0, 1.0 / minEstimatedHours},
		{"1時間", 1.0, 1.0},
		{"4時間", 4.0, 0.25},
		{"8時間", 8.0, 0.125},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalcEffortPenalty(tt.estimatedHours)
			if math.Abs(got-tt.expected) > 0.001 {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestCalcMilestoneProximity(t *testing.T) {
	now := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name             string
		milestoneDueDate *time.Time
		expected         float64
	}{
		{"マイルストーンなし", nil, 0.0},
		{"7日以内", timePtr(now.AddDate(0, 0, 5)), 1.0},
		{"ちょうど7日", timePtr(now.AddDate(0, 0, 7)), 1.0},
		{"8日以上", timePtr(now.AddDate(0, 0, 8)), 0.0},
		{"過去のマイルストーン", timePtr(now.AddDate(0, 0, -1)), 0.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalcMilestoneProximity(tt.milestoneDueDate, now)
			if got != tt.expected {
				t.Errorf("got %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestCalcScore(t *testing.T) {
	now := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name     string
		task     model.Task
		wantMin  float64
		wantMax  float64
	}{
		{
			name: "高優先度・期限近い・マイルストーン近い → 高スコア",
			task: model.Task{
				Priority:         "高",
				DueDate:          timePtr(now.AddDate(0, 0, 1)),
				EstimatedHours:   2.0,
				MilestoneDueDate: timePtr(now.AddDate(0, 0, 3)),
			},
			wantMin: 0.8,
			wantMax: 2.0,
		},
		{
			name: "低優先度・期限なし・マイルストーンなし → 低スコア",
			task: model.Task{
				Priority:       "低",
				DueDate:        nil,
				EstimatedHours: 8.0,
			},
			wantMin: 0.0,
			wantMax: 0.2,
		},
		{
			name: "中優先度・期限10日後・マイルストーンなし → 中スコア",
			task: model.Task{
				Priority:       "中",
				DueDate:        timePtr(now.AddDate(0, 0, 10)),
				EstimatedHours: 4.0,
			},
			wantMin: 0.2,
			wantMax: 0.5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CalcScore(tt.task, now)
			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("got %v, want between %v and %v", got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestScoreAllTasks(t *testing.T) {
	now := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)

	tasks := []model.Task{
		{IssueKey: "A-1", Priority: "高", DueDate: timePtr(now.AddDate(0, 0, 1)), EstimatedHours: 2.0},
		{IssueKey: "A-2", Priority: "低", EstimatedHours: 8.0},
		{IssueKey: "A-3", Priority: "中", DueDate: timePtr(now.AddDate(0, 0, 5)), EstimatedHours: 4.0},
	}

	scored := ScoreAllTasks(tasks, now)

	if len(scored) != 3 {
		t.Fatalf("expected 3 tasks, got %d", len(scored))
	}

	// 高優先度・期限近いタスクが最高スコア
	if scored[0].Score <= scored[1].Score {
		t.Errorf("task A-1 (score: %v) should have higher score than A-2 (score: %v)", scored[0].Score, scored[1].Score)
	}

	// 全タスクにスコアが設定されている
	for _, task := range scored {
		if task.Score < 0 {
			t.Errorf("task %s has negative score: %v", task.IssueKey, task.Score)
		}
	}
}

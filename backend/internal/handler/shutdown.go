package handler

import (
	"crypto/subtle"
	"net/http"

	"github.com/labstack/echo/v4"
)

const ShutdownTokenHeader = "X-Shutdown-Token"

type ShutdownHandler struct {
	trigger chan<- struct{}
	token   string
}

func NewShutdownHandler(trigger chan<- struct{}, token string) *ShutdownHandler {
	return &ShutdownHandler{trigger: trigger, token: token}
}

// Shutdown は Electron 側から終了要求を受け取り、メインゴルーチンに通知する。
// Windows では SIGTERM が強制終了相当になり書き込みが途中で切れるため、
// HTTP 経由で graceful shutdown をトリガする必要がある。
// localhost に bind していても他ローカルアプリ・ブラウザから叩かれる経路があるため、
// 起動時に Electron 側で生成したトークンで照合する。
func (h *ShutdownHandler) Shutdown(c echo.Context) error {
	if h.token == "" {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "shutdown disabled"})
	}
	got := c.Request().Header.Get(ShutdownTokenHeader)
	if subtle.ConstantTimeCompare([]byte(got), []byte(h.token)) != 1 {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid token"})
	}
	select {
	case h.trigger <- struct{}{}:
	default:
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "shutting down"})
}

#!/bin/bash
set -e

cd "$(dirname "$0")/../backend"

echo "Building Backnote backend..."

# macOS arm64
echo "  → darwin/arm64"
CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 \
  CC="clang -arch arm64" CXX="clang++ -arch arm64" \
  go build -o dist/darwin/arm64/backnote-backend ./cmd/main.go

# macOS x64
echo "  → darwin/amd64"
CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 \
  CC="clang -arch x86_64" CXX="clang++ -arch x86_64" \
  go build -o dist/darwin/x64/backnote-backend ./cmd/main.go

# Windows x64
echo "  → windows/amd64"
GOOS=windows GOARCH=amd64 go build -o dist/win32/x64/backnote-backend.exe ./cmd/main.go

# Linux x64
echo "  → linux/amd64"
GOOS=linux GOARCH=amd64 go build -o dist/linux/x64/backnote-backend ./cmd/main.go

echo "Done!"

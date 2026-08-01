#!/bin/bash
# MAKE OS starten — http://localhost:3001/os
export PATH="/tmp/node-v22.16.0-darwin-arm64/bin:$PATH"
cd "$(dirname "$0")"
exec npm run dev -- -p 3001

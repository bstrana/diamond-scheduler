#!/bin/bash
set -eu

export PORT=8000

exec node /app/server.js

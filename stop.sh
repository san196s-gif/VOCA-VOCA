#!/usr/bin/env bash
if [ -f .backend.pid ]; then
    kill -9 $(cat .backend.pid) 2>/dev/null || true
    rm .backend.pid
fi
if [ -f .frontend.pid ]; then
    kill -9 $(cat .frontend.pid) 2>/dev/null || true
    rm .frontend.pid
fi
echo "Podcast AI stopped."

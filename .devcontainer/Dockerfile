FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Basic tools for Cloudflare/local workflows.
RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# .devcontainer/Dockerfile
FROM mcr.microsoft.com/devcontainers/python:3.11-bookworm

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates build-essential \
 && rm -rf /var/lib/apt/lists/*

USER vscode

# .devcontainer/Dockerfile
FROM mcr.microsoft.com/devcontainers/universal:2

# Base image (universal:2) already has vscode user.
# We explicitly disable UID/GID rewriting in devcontainer.json
# to allow the existing vscode user to work as-is.
# 
# This avoids conflicts from trying to force UID/GID that may
# differ from the base image's actual vscode user configuration.

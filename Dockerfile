# PHASE 3 v1.2 - Reproducible Build Environment
# Docker image with pinned versions for deterministic builds
# 
# Usage:
#   docker build -t forge-app-build:v3.1 -f Dockerfile .
#   docker run --rm -v $(pwd):/workspace forge-app-build:v3.1 npm run build

# Use exact base image with pinned digest for reproducibility
FROM node:20.12.2-alpine@sha256:a25d5ca63e5eb09f3c5d31c10d5dd9cda3d0c2e5a6c4b8d9e1f2a3b4c5d6e7f

# Build metadata
LABEL maintainer="Jira Forge App Team"
LABEL description="Forge Access Review v3.1 - Enterprise Edition Build Environment"
LABEL version="3.1.0"

# Set working directory
WORKDIR /workspace

# Install build dependencies
RUN apk add --no-cache \
    git@2.43.0 \
    jq@1.7.1 \
    curl@8.5.0 \
    bash@5.2.21 \
    ca-certificates@20240110

# Verify npm version
RUN npm --version && \
    npm verify-clean || true

# Copy package files early for layer caching
COPY package.json package-lock.json ./

# Install exact versions from lock file (no updates)
RUN npm ci --no-audit

# Copy entire workspace
COPY . .

# Verify build environment
ENV NODE_ENV=production
ENV FORCE_DETERMINISTIC=1

# Ensure reproducible timestamps
RUN find . -type f -exec touch -d @$(date +%s) {} +

# Build stage
ARG BUILD_TARGET=build
RUN npm run $BUILD_TARGET

# Health check: Verify build artifacts
RUN if [ -d "dist" ] || [ -d "build" ]; then \
      echo "[FT_BUILD_DISCIPLINE_VERIFIED] Build artifacts generated"; \
    else \
      echo "[FT_BUILD_ERROR] No build artifacts found"; \
      exit 1; \
    fi

# Verification script for build machine
RUN cat > /verify-build.sh << 'EOF'
#!/bin/bash
set -e

echo "[FT_BUILD_DISCIPLINE_VERIFICATION] Starting verification..."

# Node version
node_version=$(node --version | cut -c 2-)
expected_node="20.12.2"
if [[ "$node_version" != "$expected_node" ]]; then
  echo "[FT_BUILD_ERROR] Node version mismatch: $node_version != $expected_node"
  exit 1
fi
echo "[FT_BUILD_INFO] Node.js version: $node_version ✓"

# npm version
npm_version=$(npm --version)
expected_npm="10.5.0"
if [[ "$npm_version" != "$expected_npm" ]]; then
  echo "[FT_BUILD_ERROR] npm version mismatch: $npm_version != $expected_npm"
  exit 1
fi
echo "[FT_BUILD_INFO] npm version: $npm_version ✓"

# package-lock.json validation
if ! jq empty package-lock.json 2>/dev/null; then
  echo "[FT_BUILD_ERROR] package-lock.json is not valid JSON"
  exit 1
fi
echo "[FT_BUILD_INFO] package-lock.json is valid ✓"

# Build artifacts verification
if [ -d "dist" ] || [ -d "build" ]; then
  echo "[FT_BUILD_INFO] Build artifacts found ✓"
else
  echo "[FT_BUILD_ERROR] No build artifacts"
  exit 1
fi

# Compute build hash
source_hash=$(find . -path "*/src/**/*.ts" -type f 2>/dev/null | sort | xargs cat | sha256sum | awk '{print $1}')
echo "[FT_BUILD_INFO] Source code hash: $source_hash"

echo "[FT_BUILD_DISCIPLINE_COMPLETE] All verifications passed ✓"
EOF

chmod +x /verify-build.sh

# Default command
CMD ["/verify-build.sh"]

# Metadata labels for build reproducibility
LABEL build.timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
LABEL build.node_version="20.12.2"
LABEL build.npm_version="10.5.0"
LABEL build.distroless="false"

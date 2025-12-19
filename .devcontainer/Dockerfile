# .devcontainer/Dockerfile
FROM mcr.microsoft.com/devcontainers/universal:2

ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=1000

SHELL ["/bin/bash", "-lc"]

# Create vscode user/group if missing (idempotent)
RUN set -eux; \
    if ! getent group "${USERNAME}" >/dev/null; then \
      groupadd --gid "${USER_GID}" "${USERNAME}"; \
    fi; \
    if ! id -u "${USERNAME}" >/dev/null 2>&1; then \
      useradd --uid "${USER_UID}" --gid "${USER_GID}" -m -s /bin/bash "${USERNAME}"; \
    fi; \
    mkdir -p /home/${USERNAME}; \
    chown -R ${USERNAME}:${USERNAME} /home/${USERNAME}

# If sudo isn't present, install it (best-effort)
RUN set -eux; \
    if ! command -v sudo >/dev/null 2>&1; then \
      apt-get update && apt-get install -y sudo && rm -rf /var/lib/apt/lists/*; \
    fi; \
    echo "${USERNAME} ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/${USERNAME}; \
    chmod 0440 /etc/sudoers.d/${USERNAME}

"""
app/services/github_service.py
──────────────────────────────
Async GitHub repository context extraction utility.
"""

from __future__ import annotations

import base64
import re
from urllib.parse import urlparse

import httpx


GITHUB_API_BASE = "https://api.github.com"
DEPENDENCY_FILES = ("package.json", "requirements.txt", "pom.xml")
_WHITESPACE_RE = re.compile(r"\n{3,}")


class GitHubContextError(Exception):
    """Base exception for GitHub context extraction failures."""


class InvalidGitHubUrlError(GitHubContextError):
    """Raised when the repository URL is malformed or unsupported."""


class GitHubRepositoryNotFoundError(GitHubContextError):
    """Raised when the repository does not exist (404)."""


class GitHubRateLimitError(GitHubContextError):
    """Raised when GitHub API rate limits are exceeded."""


def parse_github_repo_url(repo_url: str) -> tuple[str, str]:
    """
    Parse a GitHub repository URL and return (owner, repo).

    Supports URLs like:
    - https://github.com/owner/repo
    - https://github.com/owner/repo.git
    - https://github.com/owner/repo/
    """
    raw = (repo_url or "").strip()
    if not raw:
        raise InvalidGitHubUrlError("GitHub repository URL is required.")

    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"}:
        raise InvalidGitHubUrlError("GitHub URL must start with http:// or https://.")
    if parsed.netloc.lower() != "github.com":
        raise InvalidGitHubUrlError("Only github.com repository URLs are supported.")

    parts = [part for part in parsed.path.strip("/").split("/") if part]
    if len(parts) < 2:
        raise InvalidGitHubUrlError(
            "Invalid GitHub repository URL. Expected format: https://github.com/<owner>/<repo>."
        )

    owner = parts[0]
    repo = parts[1][:-4] if parts[1].endswith(".git") else parts[1]
    if not owner or not repo:
        raise InvalidGitHubUrlError(
            "Invalid GitHub repository URL. Owner and repository name are required."
        )
    return owner, repo


def _is_rate_limited(response: httpx.Response) -> bool:
    if response.status_code != 403:
        return False
    remaining = response.headers.get("X-RateLimit-Remaining")
    if remaining == "0":
        return True
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    return "rate limit" in str(payload.get("message", "")).lower()


def _clean_text(value: str) -> str:
    text = value.replace("\r\n", "\n").replace("\r", "\n").strip()
    return _WHITESPACE_RE.sub("\n\n", text)


async def _github_get_json(client: httpx.AsyncClient, endpoint: str) -> dict:
    response = await client.get(endpoint)

    if _is_rate_limited(response):
        raise GitHubRateLimitError(
            "GitHub API rate limit exceeded. Please retry later or authenticate requests."
        )
    if response.status_code == 404:
        raise GitHubRepositoryNotFoundError("GitHub repository not found.")
    if response.is_error:
        raise GitHubContextError(
            f"GitHub API request failed with status {response.status_code}: {response.text}"
        )

    return response.json()


def _decode_content(content: str, encoding: str) -> str:
    if not content:
        return ""
    if encoding == "base64":
        return base64.b64decode(content.encode("utf-8")).decode("utf-8", errors="replace")
    return content


async def _fetch_file_contents(
    client: httpx.AsyncClient, owner: str, repo: str, path: str
) -> str | None:
    endpoint = f"/repos/{owner}/{repo}/contents/{path}"
    try:
        payload = await _github_get_json(client, endpoint)
    except GitHubRepositoryNotFoundError:
        # File missing should not fail whole extraction.
        return None

    if not isinstance(payload, dict):
        return None
    file_type = payload.get("type")
    if file_type != "file":
        return None

    raw = _decode_content(payload.get("content", ""), payload.get("encoding", ""))
    cleaned = _clean_text(raw)
    return cleaned or None


async def extract_github_context(repo_url: str) -> str:
    """
    Build a single text payload from repository context:
    - README.md
    - First existing dependency file among package.json, requirements.txt, pom.xml
    """
    owner, repo = parse_github_repo_url(repo_url)

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "careerai-github-context-extractor",
    }
    async with httpx.AsyncClient(
        base_url=GITHUB_API_BASE,
        headers=headers,
        timeout=httpx.Timeout(15.0),
    ) as client:
        # Validate repository existence explicitly to distinguish repo 404 from file 404.
        await _github_get_json(client, f"/repos/{owner}/{repo}")

        readme_text = await _fetch_file_contents(client, owner, repo, "README.md")

        dependency_text: str | None = None
        dependency_name: str | None = None
        for candidate in DEPENDENCY_FILES:
            dependency_text = await _fetch_file_contents(client, owner, repo, candidate)
            if dependency_text:
                dependency_name = candidate
                break

    parts: list[str] = []
    if readme_text:
        parts.append(f"# README.md\n{readme_text}")
    if dependency_text and dependency_name:
        parts.append(f"# {dependency_name}\n{dependency_text}")

    payload = _clean_text("\n\n".join(parts))
    return payload


# Backwards/alternate naming used by routes.
fetch_github_context = extract_github_context

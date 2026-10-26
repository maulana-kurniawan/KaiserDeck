import os
import subprocess
import sys

def run_git(args):
    try:
        res = subprocess.run(
            ["git"] + args,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        return res.stdout.strip()
    except Exception as e:
        print(f"git command error: {e}")
        return ""

def main():
    github_sha = os.environ.get("GITHUB_SHA", "")
    if not github_sha:
        github_sha = run_git(["rev-parse", "HEAD"])
    short_sha = github_sha[:7] if github_sha else "latest"

    run_number = os.environ.get("GITHUB_RUN_NUMBER", "1")
    server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    repo = os.environ.get("GITHUB_REPOSITORY", "maulana-kurniawan/Card-Collections")
    repo_url = f"{server_url}/{repo}"

    tag = f"build-{short_sha}"
    title = f"Kaiser Deck Build #{run_number} ({short_sha})"

    # Write step outputs for GitHub Actions
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"tag={tag}\n")
            f.write(f"title={title}\n")

    # Determine range for changelog
    tags_output = run_git(["tag", "--sort=-creatordate"])
    all_tags = [t.strip() for t in tags_output.splitlines() if t.strip() and t.strip() != tag]
    prev_tag = all_tags[0] if all_tags else None

    if prev_tag:
        print(f"Found previous release tag: {prev_tag}")
        git_range = f"{prev_tag}..HEAD"
        compare_url = f"{repo_url}/compare/{prev_tag}...{tag}"
        compare_text = f"Full Changelog & Diff: [{prev_tag}...{tag}]({compare_url})"
    else:
        before_sha = os.environ.get("BEFORE_SHA", "").strip()
        if before_sha and not before_sha.startswith("0000000"):
            short_before = before_sha[:7]
            print(f"Comparing against previous push commit: {short_before}")
            git_range = f"{before_sha}..HEAD"
            compare_url = f"{repo_url}/compare/{before_sha}...{short_sha}"
            compare_text = f"Full Changelog & Diff: [{short_before}...{short_sha}]({compare_url})"
        else:
            print("No prior tag/commit found. Defaulting to recent commits.")
            git_range = "HEAD~5..HEAD"
            compare_url = f"{repo_url}/commits/main"
            compare_text = f"Commit History: [View Commits]({compare_url})"

    # Get log entries
    log_format = f"- %s ([%h]({repo_url}/commit/%H))"
    log_entries = run_git(["log", git_range, f"--pretty=format:{log_format}", "--no-merges"])

    if not log_entries:
        log_entries = f"- Release build for commit [`{short_sha}`]({repo_url}/commit/{github_sha})"

    release_notes = f"""## 🎴 Kaiser Deck v2.0

Automatically compiled by GitHub Actions from push commit [`{short_sha}`]({repo_url}/commit/{github_sha}).

### 📝 Changelog
{log_entries}

🔗 **{compare_text}**

---

### 📦 Download Assets:
- **`KaiserDeck.exe`**: Standalone Windows executable.

> **Note:** The `data.json` database and `images/` folder are not bundled as they are auto-generated when you add cards through the application.

---
*Author: [maulana-kurniawan](https://github.com/maulana-kurniawan) | Built with Gemini 3.8 Flash ⚡ | Based on original project by [Bebeq](https://github.com/Bebeq/Card-Collections)*
"""

    with open("release_notes.md", "w", encoding="utf-8") as f:
        f.write(release_notes)

    print("Successfully generated release_notes.md")
    print(f"Tag: {tag}")
    print(f"Title: {title}")

if __name__ == "__main__":
    main()

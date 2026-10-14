# From editing a note to checks and deployment

[中文](static-and-ci.md) · **English**

> Reviewed 2026-10 · Based on this repository's current `site/build.py` and `.github/workflows/site.yml`. The pinned action versions are not described as the latest releases. Use your own fork for the exercise.

You improve a sentence and it looks fine locally. After merging, the English link no longer opens. “I remember checking it” is easy to get wrong. CI repeats the checks you can automate for each change.

**Continuous integration (CI)** checks changes as they enter a shared codebase. **CD** can mean continuous delivery or continuous deployment: delivery prepares releasable output, possibly with a manual release decision; deployment also ships versions that pass the gates. This site's configuration attempts deployment after eligible main builds. An environment that requires approval still waits for it.

## Follow the files through this site {#site-flow}

<figure class="worked-update worked-update--pairs">
<ol>
<li><small>Source</small><strong>Articles and navigation</strong><span>Markdown holds the text; nav.toml orders chapters.</span></li>
<li><small>Build</small><strong>Python generates pages</strong><span>build.py applies the template and produces the search index and static files.</span></li>
<li><small>Output</small><strong>_site/</strong><span>HTML, CSS, and JavaScript ready to publish—not a running Python service.</span></li>
<li><small>Read</small><strong>Pages → browser</strong><span>Pages serves files; the browser displays them and runs interactions.</span></li>
</ol>
<figcaption>Opening a page does not run build.py for that visitor. An article edit needs a new build and deployment.</figcaption>
</figure>

[GitHub Pages hosts static files](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages); it won't run the next lesson's Python API. Static doesn't mean noninteractive: search, theme changes, and animation can all run in the browser.

## Step 1: change something locally and see it {#local}

Fork the repository and clone **your fork**. From its root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install markdown pygments numpy
python site/build.py
python -m http.server 8000 --bind 127.0.0.1 --directory _site
```

On Windows, activate with `.venv\Scripts\activate`. Open `http://127.0.0.1:8000/` and stop the preview with Ctrl+C. This is a local preview command, not a production server. Don't commit `.venv/`; add it to your fork's ignore list.

Edit a sentence in `practice/web-lab/README.md`, rebuild, and refresh. Switch to English: a Chinese edit doesn't translate itself. After updating both versions, run:

```bash
python -m unittest discover -s site/tests -p 'test_web_lab.py'
python site/collaboration.py
python site/paritycheck.py --strict
python site/leakcheck.py
```

These check different things: the reading-list behavior, reviewer configuration, bilingual structure, and known sensitive-content patterns. The release workflow also runs the full suite. **Passing checks doesn't establish factual correctness**, and matching structures don't establish accurate translation.

## Step 2: check a PR without publishing it {#ci}

Read [the existing workflow](../../.github/workflows/site.yml) rather than copying another one. It runs for PRs targeting main, pushes to main, manual dispatch, and a schedule. The `build` job checks out the source, installs dependencies, runs the collaboration, test, leak, and parity checks, builds, then scans the generated `_site/` with `site/htmlcheck.py`; only non-PR runs on main upload the artifact. `deploy` depends on a successful `build`.

| Event | What runs | What it doesn't mean |
| --- | --- | --- |
| Open or update a PR | Tests and build | No deployed PR preview or publication from this workflow |
| An eligible main build | Upload `_site/`; deployment waits for its prerequisites | A successful build doesn't prove the public URL is available |
| A test fails | This build stops; deployment cannot proceed | It won't fix the code or undo an earlier deployment |
| A scheduled main run | Checks, build, and attempted deployment | No push doesn't mean no workflow run |

Enable Actions in your fork if needed. To publish it, select GitHub Actions under **Settings → Pages → Build and deployment**, and inspect the `github-pages` environment's branch and approval rules. If you're unsure what would be public, run CI without enabling publication first. [Official setup](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Try an intentional failure on your practice branch: in `test_web_lab.py`, change the expected creation status from `201` to `200`. Open a PR and find the failed Actions step, then restore the correct expectation. The red check now has a concrete meaning: **a test caught an API contract mismatch**. Don't merge the intentionally broken change.

`needs: build` orders workflow jobs. Preventing a failing PR from merging requires maintainers to configure required checks in branch protection or a ruleset. YAML alone doesn't set repository merge policy.

Before publishing your fork as your own site, check `repo` and `origin` in `site/nav.toml`: `repo` sets where the Edit this page and feedback links go; `origin` sets the canonical and share-image URLs. Pages link to each other with relative paths, and `build.py` does not currently read `base_url`, so the project path needs no separate setting. Inspect generated links so your Edit this page link doesn't still target upstream. Adapt maintainer and credit configuration to the actual people involved, preserving attribution rather than copying this site's review assignments.

## Step 3: know what shipped and how to undo it {#delivery}

A build artifact is the bundle passed to the hosting service. It isn't the source tree. CI should check the output you're going to publish, not a separate folder someone copied by hand.

| Keep this information | Why it helps |
| --- | --- |
| Commit SHA and Actions run | Identify the deployed code and its checks |
| Build logs and deployment result | Distinguish generation, upload, and deployment failures |
| The actual published URL | Smoke-test pages, language switching, navigation, and assets |
| A known-good source revision | Revert the faulty change, then rebuild and publish normally |

If CSS returns 404, inspect its URL in Network. Project sites commonly include a repository path; success at a local root URL doesn't establish that deployed paths work. Reinstalling dependencies isn't the first response to every blank page.

In your repository, a rollback can be a PR reverting a specific commit, followed by the normal checks and deployment. No history-rewriting force push is needed here. A static rollback is relatively simple; an application with a database also needs compatible schemas, not just older code.

## Keep these boundaries even in a demo {#boundaries}

- Treat PR code as untrusted. Don't give fork code deployment credentials for convenience, or execute it directly under `pull_request_target`.
- Grant permissions per job: tests usually read source; the deployment job gets its required Pages permissions. Full commit SHAs pin third-party action code more precisely than movable tags; upgrades still need review. [GitHub security guidance](https://docs.github.com/en/actions/reference/security/secure-use)
- Keep `.env`, databases, API keys, and real user data out of `_site/`. A secret shipped in frontend JavaScript is not secret.
- Skip Docker and multiple environments on the first pass. Make failures visible and releases traceable; consider containers when environment differences become an actual problem.

You can stop here if CI was your goal. For a server that saves data, continue with [the reading list](reading-list.en.md).

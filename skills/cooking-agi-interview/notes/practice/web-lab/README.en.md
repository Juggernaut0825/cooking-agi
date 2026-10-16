<!-- source: https://github.com/tianyi-zhang-02/cooking-agi/blob/main/practice/web-lab/README.en.md -->
# Use this site to learn how to build a small project

[中文](README.md) · **English**

> Original teaching project · Python 3.12 · Reviewed 2026-10. This site is the static-hosting example; the reading list is a separate local exercise. It does not collect data from readers of these notes.

Being able to write a few functions doesn't automatically tell you how to put something in someone else's hands. Where does the code run? Why can a browser open it? How do you check that an edit hasn't broken something else?

Start with the site you're reading, then build a small reading list. Add “BERT,” mark it as read, stop the program, and open it again. The record should still be there. A modest requirement takes you through a frontend, API, database, and tests.

## Two projects, two different kinds of website

| | This site | The reading-list exercise |
| --- | --- | --- |
| Where pages come from | Markdown becomes HTML during the build | The browser loads a page, then requests records from an API |
| Where interaction runs | JavaScript in the browser | Browser requests, Python handlers, SQLite storage |
| Where data lives | Articles in the repo; bookmarks and reading history in browser storage | Records on the computer running the server |
| How it runs | Build output hosted on GitHub Pages | Local only; public hosting requires security and operational work |
| What you practice | Builds, checks, deployment, and rollback | Requests, validation, persistence, and errors |

**Buttons and animations do not imply a backend you operate.** This site is static; the reading list is the full-stack exercise. Here, “full-stack” means following a feature across the layers, not delivering a production-ready multi-user service.

## A small sequence of things to try

- 01 / Follow this siteEdit one noteFind the source, build command, and generated HTML.
- 02 / Automate checksMake a test fail on purposeFind the failing step and fix it before continuing.
- 03 / Connect the layersSave a reading itemFollow its request through the page, API, and database.
- 04 / Change a conditionReload, restart, stop the serverCheck persistence and whether errors make sense.

Get one feature working, then change the conditions. The first version doesn't need accounts, payments, microservices, or Kubernetes.

- [How this site builds and ships](static-and-ci.en.md): practice CI/CD on your own fork, without changing this site's deployment settings.
- [Build a reading list](reading-list.en.md): complete local code and tests, explained through one POST request.
- [Evaluation reports and CI](eval-report.en.md): turn six paired results into a report and see why a higher score can still fail a release check.
- [What to build next](next-projects.en.md): small, finishable search, pagination, and background-job extensions—not just project names.

For the basic idea, read each page's opening example and flow. Continue into the commands, tests, and tradeoffs when you want to implement it.

## What should you be able to explain afterward?

Try answering without looking at the code: “Where does the data go when I click Save? When can I call the operation successful? If the database saved it but the page showed an error, what happens on retry?” Understanding those questions is more useful than installing many frameworks at once.

This isn't a promise of full-stack expertise or a complete SDE interview guide. It covers a step ML projects often need but explanations skip: build a feature, check that it works, and make it usable by someone else.

[Back to engineering practice](../README.en.md)

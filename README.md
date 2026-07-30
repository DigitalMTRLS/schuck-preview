# Schuck Electric — client preview

Static copy of the v2 home page, published for client review at:

**https://digitalmtrls.github.io/schuck-preview/**

## Refresh it

```bash
./stage.sh --publish
```

That rebuilds this folder from `01-SE WEBSITE v2/build/` and pushes. Pages
redeploys in a minute or two. Run `./stage.sh` on its own to rebuild without
publishing.

Every file here except `stage.sh`, `README.md` and `.gitignore` is generated.
Edit the build, not this folder.

## Why this repo is separate

The real work lives in the private `C0-Build` repo. GitHub only allows Pages
from a private repo on the Pro plan and above, so on Free the only free route
is a public repo — and making `C0-Build` public would expose the GHL paste
blocks, media map and archived pages along with it. This repo holds the built
page and nothing else.

**It is public.** The URL is not secret and it is not password-protected;
GitHub offers no access control on Pages below Enterprise. Fine for a design
review, but don't put anything here you wouldn't hand to a stranger.

## What `stage.sh` changes

- **Interior links are redirected.** About, Services, Contact, Privacy Policy
  and Terms of Use are root-absolute (`/about`) in the build, which is correct
  for the live GHL domain. Here the site is served under `/schuck-preview/`, so
  those links would jump off-site to a generic GitHub 404 — and the pages don't
  exist yet anyway. They point at `pending.html`, a branded holding page, so a
  stray click stays inside the review. `href="/"` becomes `href="./"`.
- **`404.html`** is a copy of that page, catching typed URLs too.
- **`HANDOFF.md` is dropped** — internal note, shouldn't be publicly reachable.
- **`.nojekyll`** stops Pages processing the content through Jekyll.

Fonts still come from Google Fonts, and nothing else is altered, so the client
is seeing the real build.

## When the interior pages exist

Drop the link rewrite from `stage.sh` and let the real pages through. Nothing
else needs to change.

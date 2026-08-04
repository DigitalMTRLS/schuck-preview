#!/usr/bin/env bash
#
# Rebuild this preview site from the working build, then optionally publish it.
#
#   ./stage.sh            # refresh the files only
#   ./stage.sh --publish  # refresh, commit and push (the client link goes live)
#
# Everything here except this script, README.md and .gitignore is DERIVED from
# SE WEBSITE-2026/build/. Don't hand-edit it — edit the build and re-run, or
# the change disappears on the next stage.
#
# This repo is PUBLIC so that GitHub Pages can serve it on the Free plan. Only
# the built home page lives here; the GHL code stays in the private C0-Build
# repo. Don't add anything here you wouldn't hand to a stranger.
#
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/../SE WEBSITE-2026/build"

[ -d "$src" ] || { echo "error: build not found at $src" >&2; exit 1; }

# --exclude protects this repo's own files from --delete.
rsync -a --delete \
  --exclude '._*' --exclude '.DS_Store' \
  --exclude '.git' --exclude '.gitignore' \
  --exclude 'stage.sh' --exclude 'README.md' \
  --exclude 'pending.html' --exclude '404.html' --exclude '.nojekyll' \
  "$src"/ "$here"/

# macOS recreates AppleDouble sidecars when writing to this exFAT volume, and
# HANDOFF.md is an internal note that shouldn't sit at a public URL.
find "$here" -name '._*' -not -path '*/.git/*' -delete
rm -f "$here/HANDOFF.md"

# The build's interior links are root-absolute (/about, /services, …), which is
# right for the live GHL domain but wrong here: this is a Pages *project* site
# served under /schuck-preview/, so a root-absolute link leaves the site
# entirely and lands on a generic GitHub 404. Rewrite them to the flat files
# this repo actually serves.
#
# Pages that exist get their real file; the ones still unbuilt keep pointing at
# the holding page. When a new page ships, move it out of the PENDING list — if
# you forget, the link silently goes to "in production" instead of the page you
# just built, which looks like nothing happened.
BUILT_PAGES='about|services|contact'
PENDING_PAGES='privacy-policy|terms-of-use'

for f in "$here"/*.html; do
  case "$(basename "$f")" in
    pending.html|404.html) continue ;;   # generated below, not from the build
  esac
  # Multi-segment paths first, then the bare "/" — the other order would turn
  # href="/services" into href="./services" before the specific rule saw it.
  perl -pi -e "
    s{href=\"/($BUILT_PAGES)\"}{href=\"\$1.html\"}g;
    s{href=\"/($PENDING_PAGES)\"}{href=\"pending.html\"}g;
    s{href=\"/\"}{href=\"./\"}g;
  " "$f"
done

touch "$here/.nojekyll"   # stop Pages running the content through Jekyll

cat > "$here/pending.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>In production | Schuck Electric</title>
<meta name="robots" content="noindex" />
<link rel="icon" href="assets/logo/favicon-32.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400" rel="stylesheet" />
<style>
  html, body { height: 100%; }
  body {
    margin: 0;
    display: grid;
    place-items: center;
    padding: 40px 28px;
    background: #0B0722;
    color: #FFFFFF;
    font-family: "Work Sans", system-ui, -apple-system, sans-serif;
    text-align: center;
  }
  .wrap { max-width: 480px; }
  img { width: 168px; height: auto; margin-bottom: 44px; }
  p.eyebrow {
    margin: 0 0 14px;
    font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    font-weight: 700;
    font-size: 13.5px;
    line-height: 22px;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #4E97D6;
  }
  h1 {
    margin: 0 0 18px;
    font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    font-weight: 800;
    font-size: 46px;
    line-height: 47px;
    letter-spacing: 0.2px;
    text-transform: uppercase;
  }
  p.lede { margin: 0 0 36px; font-size: 17.5px; line-height: 28px; color: #C7C9D1; }
  a.btn {
    display: inline-block;
    padding: 15px 28px;
    border: 1px solid #FFFFFF;
    background: #2D7ABF;
    color: #FFFFFF;
    text-decoration: none;
    font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
    font-weight: 700;
    font-size: 16px;
    line-height: 16px;
    letter-spacing: 1px;
    text-transform: uppercase;
    transition: background 0.2s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  a.btn:hover { background: #00AEEF; }
  @media (max-width: 700px) { h1 { font-size: 30px; line-height: 31px; } }
</style>
</head>
<body>
  <div class="wrap">
    <img src="assets/logo/schuck-logo-white.png" alt="Schuck Electric" />
    <p class="eyebrow">Preview</p>
    <h1>This page is still in production</h1>
    <p class="lede">The home page is the only page ready for review right now. The rest of the site follows once the design here is signed off.</p>
    <a class="btn" href="./">Back to the home page</a>
  </div>
</body>
</html>
HTML

cp "$here/pending.html" "$here/404.html"

echo "staged."

if [ "${1:-}" = "--publish" ]; then
  cd "$here"
  git add -A
  if git diff --cached --quiet; then
    echo "nothing changed — not pushing."
  else
    git commit -q -m "Refresh preview from build ($(date +%Y-%m-%d))"
    git push -q origin main
    echo "published: https://digitalmtrls.github.io/schuck-preview/"
  fi
else
  echo "run again with --publish to push it live."
fi

#!/bin/sh
# Builds the site as a single public/index.html. Requires: pandoc (>= 2.11), node, python3.
set -eu
rm -rf public
mkdir -p public

node tools/make_bg.js public/bg.svg

{
  cat page-head.html
  for slug in about publications projects teaching service contact; do
    level=2; shift=1
    if [ "$slug" = about ]; then level=1; shift=0; fi
    extra=""
    if [ "$slug" = publications ]; then
      extra="--citeproc --bibliography=publications.bib --csl=publications.csl"
    fi
    # shellcheck disable=SC2086
    pandoc "content/$slug.md" \
      --from markdown-smart --to html5 --wrap=none \
      --shift-heading-level-by="$shift" \
      --template section.html \
      --variable slug="$slug" --variable level="$level" \
      $extra
  done
  cat page-foot.html
  sed '1d' public/bg.svg        # inline SVG (drops the XML prolog) so page CSS and hover work
  printf '</body>\n</html>\n'
} > public/index.html

cp style.css publications.bib public/

# Optional: Gemtext version. Needs its own Gemini server (GitHub Pages does not serve gemini://).
python3 tools/md2gmi.py content public/gemini
{
  printf '# Publications\n\n'
  pandoc content/publications.md --from markdown-smart --to plain --wrap=none \
    --citeproc --bibliography=publications.bib --csl=publications.csl \
    | sed '/^Download the publications/d'
  printf '\n=> publications.bib Download the publications as BibTeX\n'
} > public/gemini/publications.gmi
cp publications.bib public/gemini/

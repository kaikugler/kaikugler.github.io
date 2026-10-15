#!/usr/bin/env python3
"""Konvertiert content/*.md nach Gemtext (.gmi).

Aufruf: python3 tools/md2gmi.py content public/gemini

Gemtext kennt keine Inline-Links: Links werden aus dem Text entfernt und als
'=> URL Text'-Zeilen unter den Absatz gesetzt. Absätze stehen in einer Zeile.
"""
import pathlib
import re
import sys

LINK = re.compile(r'\[([^\]]+)\]\(([^)\s]+)\)')
AUTOLINK = re.compile(r'<(https?://[^>]+|[^@\s>]+@[^>\s]+)>')


def inline(text, links):
    def repl(m):
        url = m.group(2)
        links.append((url, m.group(1)))
        return m.group(1)
    text = LINK.sub(repl, text)
    def auto(m):
        target = m.group(1)
        links.append((target if target.startswith('http') else 'mailto:' + target, target))
        return target
    text = AUTOLINK.sub(auto, text)
    text = re.sub(r'\*\*([^*]+)\*\*|\*([^*]+)\*', lambda m: m.group(1) or m.group(2), text)
    text = text.replace('\\[', '[').replace('\\]', ']')
    return text


def convert(src):
    meta = {}
    m = re.match(r'---\n(.*?)\n---\n', src, re.S)
    if m:
        for line in m.group(1).splitlines():
            key, _, val = line.partition(':')
            meta[key.strip()] = val.strip()
        src = src[m.end():]

    out = ['# ' + meta.get('title', ''), '']
    para, links = [], []

    def flush(prefix=''):
        nonlocal para, links
        if para:
            out.append(prefix + inline(' '.join(para), links))
            out.extend('=> %s %s' % (u, label) for u, label in links)
            out.append('')
        para, links = [], []

    for raw in src.splitlines():
        line = raw.rstrip()
        if not line.strip() or line.startswith(':::'):
            flush()
        elif line.startswith('#'):
            flush()
            out.extend([re.sub(r'^#+', lambda x: '#' * min(len(x.group(0)) + 1, 3), line), ''])
        elif line.startswith('- '):
            flush()
            lst = []
            text = inline(line[2:], lst)
            out.append('* ' + text)
            out.extend('=> %s %s' % (u, label) for u, label in lst)
        elif line.startswith(':'):
            para = [' '.join(para) + ': ' + line.lstrip(': ').strip()]
        elif line.endswith('\\'):
            # harter Zeilenumbruch in Markdown: in Gemtext eine eigene Zeile
            flush()
            out.append(inline(line.rstrip('\\').strip(), links))
        else:
            para.append(line.strip())
    flush()
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).strip() + '\n'


def main():
    src_dir, dst_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    dst_dir.mkdir(parents=True, exist_ok=True)
    for path in sorted(src_dir.glob('*.md')):
        (dst_dir / (path.stem + '.gmi')).write_text(convert(path.read_text(encoding='utf-8')), encoding='utf-8')
        print('geschrieben:', dst_dir / (path.stem + '.gmi'))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
import asyncio
import re
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString
from googletrans import Translator


ROOT = Path(__file__).resolve().parent.parent
LANGS = ["en", "es", "fr", "ar", "yue"]
DEST_LANG = {"en": "en", "es": "es", "fr": "fr", "ar": "ar", "yue": "zh-cn"}
HTML_LANG = {"en": "en", "es": "es", "fr": "fr", "ar": "ar", "yue": "zh-CN"}
TRANSLATABLE_ATTRS = ["alt", "title", "aria-label", "placeholder"]
LANG_FILE_RE = re.compile(r"\.(en|es|fr|ar|yue)\.html$")


def is_lang_file(name: str) -> bool:
    return bool(LANG_FILE_RE.search(name))


def should_translate(text: str) -> bool:
    t = text.strip()
    if not t:
        return False
    if t.startswith(("http://", "https://", "mailto:", "tel:")):
        return False
    if re.fullmatch(r"[\d\W_]+", t):
        return False
    if re.fullmatch(r"[A-Za-z0-9._/\-#?=&:%+]+", t):
        return False
    return True


def localize_href(href: str, lang: str, html_set: set[str]) -> str:
    if not href:
        return href
    if href.startswith(("http://", "https://", "#", "mailto:", "tel:", "javascript:", "data:")):
        return href

    match = re.match(r"^([^?#]+)(\?[^#]*)?(#.*)?$", href)
    if not match:
        return href

    pathname, query, hash_part = match.group(1), match.group(2) or "", match.group(3) or ""
    if not pathname.endswith(".html"):
        return href

    if LANG_FILE_RE.search(pathname):
        localized = re.sub(LANG_FILE_RE, f".{lang}.html", pathname)
    else:
        localized = f"index.{lang}.html" if pathname == "index.html" else pathname.replace(".html", f".{lang}.html")

    if localized in html_set:
        return f"{localized}{query}{hash_part}"
    return href


async def translate_chunk(translator: Translator, chunk: list[str], dest: str) -> list[str]:
    if not chunk:
        return []
    result = await asyncio.wait_for(translator.translate(chunk, dest=dest), timeout=20)
    if isinstance(result, list):
        return [r.text for r in result]
    return [result.text]


async def translate_items(
    translator: Translator,
    texts: list[str],
    dest: str,
    cache: dict[str, str],
) -> list[str]:
    resolved = []
    missing = [t for t in dict.fromkeys(texts) if t not in cache]

    i = 0
    while i < len(missing):
        chunk = missing[i : i + 20]
        try:
            translated = await translate_chunk(translator, chunk, dest)
            for src, tr in zip(chunk, translated):
                cache[src] = tr
            i += 20
            continue
        except Exception:
            pass

        for src in chunk:
            try:
                translated_single = await translate_chunk(translator, [src], dest)
                cache[src] = translated_single[0]
            except Exception:
                cache[src] = src
        i += 20

    for text in texts:
        resolved.append(cache.get(text, text))
    return resolved


def replace_header_footer(soup: BeautifulSoup, lang: str) -> None:
    header_path = ROOT / "partials" / f"header.{lang}.html"
    footer_path = ROOT / "partials" / f"footer.{lang}.html"
    if not soup.body:
        return

    if header_path.exists():
        header_tag = soup.body.find("header", class_="site-header")
        parsed = BeautifulSoup(header_path.read_text(encoding="utf-8"), "html.parser")
        partial_header = parsed.find("header", class_="site-header") or parsed.find("header")
        if header_tag and partial_header:
            header_tag.replace_with(partial_header)

    if footer_path.exists():
        footer_tag = soup.body.find("footer", class_="site-footer")
        parsed = BeautifulSoup(footer_path.read_text(encoding="utf-8"), "html.parser")
        partial_footer = parsed.find("footer", class_="site-footer") or parsed.find("footer")
        if footer_tag and partial_footer:
            footer_tag.replace_with(partial_footer)


async def rebuild_language(lang: str, html_files: list[str], html_set: set[str]) -> int:
    translator = Translator()
    cache: dict[str, str] = {}
    changed = 0

    for de_name in [f for f in html_files if not is_lang_file(f)]:
        target_name = de_name.replace(".html", f".{lang}.html")
        if target_name not in html_set:
            continue

        de_path = ROOT / de_name
        target_path = ROOT / target_name
        de_html = de_path.read_text(encoding="utf-8")
        target_html = target_path.read_text(encoding="utf-8")

        de_soup = BeautifulSoup(de_html, "html.parser")
        target_soup = BeautifulSoup(target_html, "html.parser")
        if not de_soup.html or not de_soup.body:
            continue

        de_soup.html["lang"] = HTML_LANG.get(lang, lang)

        # Preserve existing target head metadata (SEO, canonical, hreflang, etc.).
        if target_soup.head:
            de_soup.head.replace_with(target_soup.head)

        for tag in de_soup.body.find_all(True):
            if tag.has_attr("href"):
                tag["href"] = localize_href(tag.get("href", ""), lang, html_set)

        text_nodes = []
        raw_texts = []
        for node in de_soup.body.descendants:
            if isinstance(node, Comment):
                continue
            if not isinstance(node, NavigableString):
                continue
            parent = node.parent.name.lower() if node.parent and node.parent.name else ""
            if parent in {"script", "style", "noscript"}:
                continue
            if node.parent.find_parent("header", class_="site-header") or node.parent.find_parent("footer", class_="site-footer"):
                continue
            raw = str(node)
            if not should_translate(raw):
                continue
            text_nodes.append(node)
            raw_texts.append(raw)

        stripped_texts = [t.strip() for t in raw_texts]
        translated_texts = await translate_items(translator, stripped_texts, DEST_LANG[lang], cache)
        for node, raw, translated in zip(text_nodes, raw_texts, translated_texts):
            lead = re.match(r"^\s*", raw).group(0)
            trail = re.search(r"\s*$", raw).group(0)
            node.replace_with(NavigableString(f"{lead}{translated}{trail}"))

        attr_targets = []
        attr_texts = []
        for tag in de_soup.body.find_all(True):
            if tag.find_parent("header", class_="site-header") or tag.find_parent("footer", class_="site-footer"):
                continue
            for attr in TRANSLATABLE_ATTRS:
                if not tag.has_attr(attr):
                    continue
                value = tag.get(attr, "")
                if isinstance(value, list):
                    continue
                if not should_translate(value):
                    continue
                attr_targets.append((tag, attr, value))
                attr_texts.append(value.strip())

        translated_attrs = await translate_items(translator, attr_texts, DEST_LANG[lang], cache)
        for (tag, attr, raw), translated in zip(attr_targets, translated_attrs):
            lead = re.match(r"^\s*", raw).group(0)
            trail = re.search(r"\s*$", raw).group(0)
            tag[attr] = f"{lead}{translated}{trail}"

        replace_header_footer(de_soup, lang)

        output = str(de_soup)
        if de_html.lstrip().lower().startswith("<!doctype html>"):
            output = "<!DOCTYPE html>\n" + output.lstrip()

        if output != target_html:
            target_path.write_text(output, encoding="utf-8")
            changed += 1
            print(f"[{lang}] rebuilt {target_name}")

    print(f"[{lang}] done: {changed} files, cache={len(cache)}")
    return changed


async def main() -> None:
    html_files = sorted([p.name for p in ROOT.glob("*.html")])
    html_set = set(html_files)
    total = 0
    for lang in LANGS:
        total += await rebuild_language(lang, html_files, html_set)
    print(f"Total rebuilt files: {total}")


if __name__ == "__main__":
    asyncio.run(main())

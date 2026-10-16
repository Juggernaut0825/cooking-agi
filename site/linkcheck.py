"""Check built local links and fragment targets without making network requests."""

from html.parser import HTMLParser
from pathlib import Path
import sys
import tomllib
from urllib.parse import unquote, urljoin, urlsplit


ROOT = Path(__file__).resolve().parents[1]


class PageLinks(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.targets = set()
        self.links = []
        self.redirect = None
        self.feed(source)

    def handle_starttag(self, tag, attributes):
        values = dict(attributes)
        if "id" in values:
            self.targets.add(values["id"])
        if tag == "a" and "name" in values:
            self.targets.add(values["name"])
        for attribute in ("href", "src", "poster"):
            if values.get(attribute):
                self.links.append((self.getpos()[0], values[attribute]))
        if tag == "meta" and values.get("http-equiv", "").lower() == "refresh":
            content = values.get("content", "")
            delay, separator, destination = content.partition(";")
            key, equals, target = destination.strip().partition("=")
            if separator and equals and key.lower() == "url":
                self.redirect = target.strip().strip("'\"")
                self.links.append((self.getpos()[0], self.redirect))


def check_site(directory, origin):
    directory = Path(directory).resolve()
    origin = origin.rstrip("/") + "/"
    base = urlsplit(origin)
    pages = {path: PageLinks(path.read_text(encoding="utf-8"))
             for path in sorted(directory.rglob("*.html"))}
    problems = []
    references = 0

    def local_path(url):
        parsed = urlsplit(url)
        if (parsed.scheme, parsed.netloc) != (base.scheme, base.netloc):
            return None
        if not parsed.path.startswith(base.path):
            return None
        relative = unquote(parsed.path[len(base.path):])
        path = (directory / relative).resolve()
        if not path.is_relative_to(directory):
            raise ValueError("link escapes the build directory")
        return path / "index.html" if path.is_dir() else path

    for source, page in pages.items():
        source_url = urljoin(origin, source.relative_to(directory).as_posix())
        for line, href in page.links:
            try:
                url = urljoin(source_url, href)
                path = local_path(url)
                if path is None:
                    continue
                references += 1
                fragment = urlsplit(url).fragment
                visited = set()
                while path in pages and pages[path].redirect is not None:
                    if path in visited:
                        raise ValueError("redirect cycle")
                    visited.add(path)
                    url = urljoin(url, pages[path].redirect)
                    fragment = urlsplit(url).fragment or fragment
                    path = local_path(url)
                    if path is None:
                        break
                if path is None:
                    continue
                if not path.is_file():
                    raise ValueError("missing file")
                target = unquote(fragment.split(":~:text=", 1)[0])
                if target and path in pages and target not in pages[path].targets:
                    raise ValueError(f"missing anchor #{target}")
            except ValueError as error:
                problems.append(f"{source.relative_to(directory)}:{line}: {error}: {href}")
    return len(pages), references, problems


def main():
    output = ROOT / "_site"
    if not output.is_dir():
        sys.exit("_site does not exist; run python site/build.py first")
    navigation = tomllib.loads((ROOT / "site/nav.toml").read_text(encoding="utf-8"))
    pages, references, problems = check_site(output, navigation["site"]["origin"])
    for problem in problems:
        print(problem)
    print(f"{pages} pages, {references} local references, {len(problems)} broken links")
    return bool(problems)


if __name__ == "__main__":
    sys.exit(main())

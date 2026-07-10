from urllib.parse import urljoin, urlparse
from crawl4ai import AsyncWebCrawler

async def crawl_website(base_url: str, max_pages: int = 30) -> dict[str, str]:
    """
    Crawls a website starting from base_url.
    Returns a dict of {url: page_text_content}
    max_pages prevents infinite crawling on huge sites.
    """
    visited = set()
    to_visit = [base_url]
    results = {}
    base_domain = urlparse(base_url).netloc

    async with AsyncWebCrawler(verbose=False) as crawler:
        while to_visit and len(visited) < max_pages:
            url = to_visit.pop(0)
            if url in visited:
                continue

            try:
                result = await crawler.arun(url=url)
                visited.add(url)

                if result.success:
                    # Store clean markdown text for this page
                    results[url] = result.markdown or ""

                    # Find all internal links and queue them
                    for link in (result.links.get("internal") or []):
                        href = link.get("href", "")
                        full_url = urljoin(base_url, href)
                        parsed = urlparse(full_url)

                        # Only follow links on the same domain
                        if parsed.netloc == base_domain and full_url not in visited:
                            to_visit.append(full_url)

            except Exception as e:
                print(f"Failed to crawl {url}: {e}")
                continue

    print(f"Crawled {len(results)} pages from {base_url}")
    return results
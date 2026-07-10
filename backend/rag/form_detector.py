import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin

async def detect_contact_form(base_url: str) -> dict | None:
    """
    Looks for a contact form on the website.
    Checks /contact, /contact-us, common patterns.
    Returns form fields and action URL if found.
    """
    candidate_paths = [
        "", "/",  # SPA/homepage contact sections
        "/contact", "/contact-us", "/get-in-touch",
        "/reach-us", "/support", "/help"
    ]
    likely_required_names = {"name", "full_name", "email", "message"}
    seen_urls = set()

    async with httpx.AsyncClient(timeout=10) as client:
        for path in candidate_paths:
            url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
            if url in seen_urls:
                continue
            seen_urls.add(url)
            try:
                res = await client.get(url, follow_redirects=True)
                if res.status_code != 200:
                    continue

                soup = BeautifulSoup(res.text, "html.parser")
                form = soup.find("form")
                if not form:
                    continue

                # Extract all input fields
                fields = []
                for inp in form.find_all(["input", "textarea", "select"]):
                    name = inp.get("name") or inp.get("id")
                    field_type = inp.get("type", "text")
                    if name and field_type not in ["hidden", "submit", "button"]:
                        normalized_name = name.strip().lower()
                        # Many modern forms rely on JS validation and omit the HTML
                        # `required` attribute for core fields.
                        is_required = inp.has_attr("required") or normalized_name in likely_required_names
                        fields.append({
                            "name": name,
                            "type": field_type,
                            "required": is_required
                        })

                action = form.get("action", "")
                method = form.get("method", "post").lower()

                if fields:
                    return {
                        "form_url": url,
                        "action": action or url,
                        "method": method,
                        "fields": fields
                    }

            except Exception:
                continue

    return None
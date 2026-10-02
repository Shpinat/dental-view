from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Click "Load demo phantom"
    page.get_by_text("Загрузить демо-фантом челюсти").first.click()
    page.wait_for_timeout(6000)

    # Test Selection Mode / Bulk Delete UI
    page.get_by_text("Выбрать", exact=True).click()
    page.wait_for_timeout(1000)
    page.get_by_role("checkbox").first.click()
    page.wait_for_timeout(1000)
    page.get_by_text("Удалить выбранные").click()
    page.wait_for_timeout(1000)
    page.get_by_role("button", name="Удалить", exact=True).click() # Confirm deletion
    page.wait_for_timeout(2000)

    # Load phantom again and open viewer
    page.get_by_text("Загрузить демо-фантом челюсти").first.click()
    page.wait_for_timeout(6000)

    # Toggle theme on Study Manager
    page.get_by_label("Toggle theme").first.click()
    page.wait_for_timeout(1000)

    page.get_by_text("Открыть", exact=True).first.click()
    page.wait_for_timeout(4000)

    # In viewer, test W/L Adjust Sidebar
    page.get_by_text("Кость", exact=True).click()
    page.wait_for_timeout(1000)

    # Check the theme toggle on Toolbar
    page.get_by_label("Toggle theme").first.click()
    page.wait_for_timeout(1000)

    # Switch layout and wait to capture scrollbars and layout
    page.get_by_text("Панорама", exact=True).click()
    page.wait_for_timeout(2000)

    page.screenshot(path="verification/screenshots/verification.png")
    page.wait_for_timeout(2000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
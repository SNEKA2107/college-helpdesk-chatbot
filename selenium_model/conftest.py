import pytest
import os
import time
import json
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options as ChromeOptions
from webdriver_manager.chrome import ChromeDriverManager

BASE_URL = "http://localhost:5000"
SCREENSHOT_DIR = Path("selenium_model/screenshots")
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

test_runs = []

@pytest.fixture(scope="session")
def browser_options():
    opts = ChromeOptions()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--log-level=3")
    opts.add_experimental_option("excludeSwitches", ["enable-logging"])
    return opts

@pytest.fixture(scope="function")
def driver(browser_options):
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=browser_options)
    driver.set_page_load_timeout(30)
    driver.implicitly_wait(5)
    
    yield driver
    
    # Capture browser console logs
    try:
        console_logs = driver.get_log("browser")
        log_file = Path("selenium_model/browser_console.log")
        with open(log_file, "a", encoding="utf-8") as f:
            for entry in console_logs:
                f.write(f"[{entry.get('level')}] {entry.get('timestamp')}: {entry.get('message')}\n")
    except Exception:
        pass

    driver.quit()

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    
    if rep.when == "call":
        test_id = f"TC-{len(test_runs) + 1:03d}"
        module_name = item.module.__name__.split('.')[-1].replace('test_', '').upper()
        scenario_name = item.name.replace('test_', '').replace('_', ' ').capitalize()
        
        status = "PASSED" if rep.passed else "FAILED"
        exec_time = f"{rep.duration:.2f}s"
        screenshot_path = ""
        
        driver_fixture = item.funcargs.get("driver")
        if driver_fixture:
            test_name = item.name.replace("[", "_").replace("]", "_").replace("/", "_")
            screenshot_file = SCREENSHOT_DIR / f"{status}_{test_name}.png"
            try:
                driver_fixture.save_screenshot(str(screenshot_file))
                screenshot_path = str(screenshot_file)
            except Exception as e:
                print(f"Failed to capture screenshot: {e}")
                
        test_runs.append({
            "test_id": test_id,
            "module": module_name,
            "scenario": scenario_name,
            "expected": "Flow completes successfully without errors",
            "actual": "Flow completed successfully" if rep.passed else f"Error: {rep.longreprtext.splitlines()[-1] if rep.longreprtext else 'Assertion failed'}",
            "status": status,
            "time": exec_time,
            "screenshot": screenshot_path
        })

def pytest_sessionfinish(session, exitstatus):
    # Save the test runs list to a temporary JSON file
    results_file = Path("selenium_model/test_results.json")
    with open(results_file, "w", encoding="utf-8") as f:
        json.dump(test_runs, f, indent=4)


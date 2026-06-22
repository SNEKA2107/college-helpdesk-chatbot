"""Per-page accessibility smoke checks (lang/alt/labels/buttons/headings).

Findings are catalogued for the report; the assertion itself only fails on a
hard error reaching the page, so a finding-rich page still passes (informational).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from selenium.webdriver.common.by import By
import config
import collectors
from session import goto

A11Y_PAGES = config.PUBLIC_ROUTES + config.STUDENT_ROUTES + config.ADMIN_ROUTES


def _audit_page(driver, page_name):
    findings = []
    html = driver.find_element(By.TAG_NAME, "html")
    if not (html.get_attribute("lang") or "").strip():
        findings.append(("Missing <html lang> attribute", "Medium",
                         "Add lang='en' to <html> for screen-reader language detection"))
    imgs = driver.find_elements(By.TAG_NAME, "img")
    no_alt = [i for i in imgs if not (i.get_attribute("alt") or "").strip()]
    if no_alt:
        findings.append((f"{len(no_alt)}/{len(imgs)} <img> without alt text", "Medium",
                         "Provide descriptive alt text or alt='' for decorative images"))
    inputs = driver.find_elements(By.CSS_SELECTOR, "input, select, textarea")
    unlabeled = 0
    for el in inputs:
        if el.get_attribute("type") in ("hidden", "submit", "button"):
            continue
        if (el.get_attribute("aria-label") or el.get_attribute("placeholder") or el.get_attribute("id")):
            continue
        unlabeled += 1
    if unlabeled:
        findings.append((f"{unlabeled} form field(s) without label/aria-label/placeholder", "Medium",
                         "Associate every input with a <label for> or aria-label"))
    btns = driver.find_elements(By.TAG_NAME, "button")
    empty_btn = [b for b in btns if not (b.text.strip() or b.get_attribute("aria-label"))]
    if empty_btn:
        findings.append((f"{len(empty_btn)} icon-only button(s) without aria-label", "Low",
                         "Add aria-label to icon-only buttons"))
    if not driver.find_elements(By.TAG_NAME, "h1"):
        findings.append(("No <h1> heading on page", "Low", "Add a top-level <h1> for document outline"))
    for issue, sev, rec in findings:
        collectors.accessibility.append({
            "page": page_name, "issue": issue, "severity": sev, "recommendation": rec})
    return findings


@pytest.mark.parametrize("route", A11Y_PAGES)
def test_accessibility_page(driver, record_property, route):
    record_property("module", "ACCESSIBILITY")
    record_property("scenario", f"WCAG smoke checks on {route}")
    record_property("expected", "Page is reachable; accessibility findings are catalogued")
    goto(driver, route)
    findings = _audit_page(driver, route)
    record_property("actual", f"{len(findings)} accessibility finding(s) on {route}")
    assert driver.find_elements(By.TAG_NAME, "body")

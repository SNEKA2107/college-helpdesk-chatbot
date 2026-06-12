from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select
from .base_page import BasePage
import time

class RequestsPage(BasePage):
    # Locators
    NEW_REQUEST_BTN = (By.XPATH, "//button[contains(text(), '+ New Request')]")
    REQ_TYPE = (By.ID, "reqType")
    REQ_REASON = (By.ID, "reqReason")
    REQ_URGENCY = (By.ID, "reqUrgency")
    SUBMIT_BTN = (By.XPATH, "//button[contains(text(), 'Submit Request')]")
    REQUESTS_LIST = (By.ID, "reqList")
    
    def __init__(self, driver):
        super().__init__(driver)

    def navigate(self):
        self.navigate_to("requests.html")

    def submit_new_request(self, req_type, reason, urgency):
        self.click_element(self.NEW_REQUEST_BTN)
        time.sleep(0.5)
        
        select_type = Select(self.wait_for_element_visible(self.REQ_TYPE))
        select_type.select_by_visible_text(req_type)
        
        self.send_keys_to_element(self.REQ_REASON, reason)
        
        select_urgency = Select(self.wait_for_element_visible(self.REQ_URGENCY))
        select_urgency.select_by_visible_text(urgency)
        
        self.click_element(self.SUBMIT_BTN)
        time.sleep(1.5)  # Wait for submission API + response
        # Close ALL modal overlays — covers delayed close animations and API timing
        self.driver.execute_script(
            "document.querySelectorAll('.modal-overlay').forEach(function(m) {"
            "    m.classList.remove('show');"
            "});"
        )
        time.sleep(0.5)  # Let browser repaint after style change

    def get_requests_count(self):
        cards = self.driver.find_elements(By.CLASS_NAME, "req-card")
        return len(cards)


class LeavePage(BasePage):
    # Locators
    LEAVE_TYPE = (By.ID, "leaveType")
    FROM_DATE = (By.ID, "fromDate")
    TO_DATE = (By.ID, "toDate")
    LEAVE_REASON = (By.ID, "leaveReason")
    SUBMIT_BTN = (By.XPATH, "//button[contains(text(), 'Submit Application')]")
    SUCCESS_BOX = (By.ID, "successMsg")
    LEAVE_HISTORY = (By.ID, "leaveHistory")
    
    def __init__(self, driver):
        super().__init__(driver)

    def navigate(self):
        self.navigate_to("leave.html")

    def submit_leave(self, leave_type, from_date, to_date, reason):
        select_type = Select(self.wait_for_element_visible(self.LEAVE_TYPE))
        select_type.select_by_visible_text(leave_type)
        
        # Injected script can set date value since standard datepicker UI can be finicky in Selenium
        self.driver.execute_script(f"document.getElementById('fromDate').value = '{from_date}';")
        self.driver.execute_script(f"document.getElementById('toDate').value = '{to_date}';")
        
        self.send_keys_to_element(self.LEAVE_REASON, reason)
        self.click_element(self.SUBMIT_BTN)
        time.sleep(1.5)  # Wait for submission API

    def is_success_visible(self):
        try:
            el = self.driver.find_element(*self.SUCCESS_BOX)
            return el.is_displayed()
        except Exception:
            return False


class ChatPage(BasePage):
    # Locators
    MESSAGE_INPUT = (By.ID, "chatInput")
    SEND_BUTTON = (By.CLASS_NAME, "send-btn")
    CHAT_BOX = (By.ID, "chatBox")
    
    def __init__(self, driver):
        super().__init__(driver)

    def navigate(self):
        self.navigate_to("chat.html")

    def send_message(self, message):
        self.send_keys_to_element(self.MESSAGE_INPUT, message)
        self.click_element(self.SEND_BUTTON)
        time.sleep(1.0)  # Wait for bot answer

    def get_last_response(self):
        # Chat HTML uses class ".msg.bot" wrapper with ".msg-bubble" inner text
        bubbles = self.driver.find_elements(By.CSS_SELECTOR, ".msg.bot .msg-bubble")
        if bubbles:
            return bubbles[-1].text
        return ""

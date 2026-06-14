TIMESTAMP="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

cat >> "$GITHUB_STEP_SUMMARY" <<EOF
# 📌 College Helpdesk Chatbot - Project Summary

## Project Information
- **Project Name:** College Helpdesk Chatbot
- **Frontend:** React
- **Backend:** Java
- **Deployment:** GitHub Pages

## Features
- Student Login
- Staff/Admin Dashboard
- Helpdesk Ticket Management
- Chatbot Assistance

## Workflow Details
- **Branch Name:** main
- **Triggered By:** SNEKA2107
- **Commit ID:** 46c1203abc123
- **Workflow Run Number:** 7
- **Repository Name:** SNEKA2107/college-helpdesk-chatbot
- **Execution Timestamp:** ${TIMESTAMP}

## Deployment Information
- **Deployment URL:** https://sneka2107.github.io/college-helpdesk-chatbot
- **Deployment Status:** Success

## Future Enhancements
- Selenium End-to-End Testing
- Automated Build Validation
- Continuous Integration and Deployment
- Regression Testing
EOF

echo "✅ Project summary generated successfully."

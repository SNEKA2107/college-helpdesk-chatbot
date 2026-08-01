# -*- coding: utf-8 -*-
"""
CampusAssist HelpDesk — intent specification.

Every intent, every seed question and every expected response in this file is
grounded in a capability that actually exists in the repository. See
CAPABILITY_AUDIT.md for the mapping from intent -> model/route/page.

Nothing here describes backend, frontend, database or architecture topics; the
assistant is a campus help desk, not a software assistant. The single intent
`out_of_scope_technical` exists purely so the classifier learns to DECLINE such
questions.

Format of an intent entry:
    key        : intent label
    category   : knowledge category (mirrors backend/utils/intentCategory.js)
    roles      : roles that realistically ask this, in sampling order
    response   : the expected response — describes only real capability
    q          : seed questions, one per line
"""

# ── Slot vocabularies (all drawn from real seed/demo data) ───────────────────
SUBJECTS = [
    "Data Structures", "Operating Systems", "DBMS", "Computer Networks",
    "Artificial Intelligence", "Machine Learning", "Software Engineering",
    "Compiler Design", "Discrete Mathematics", "Web Technology",
    "Cloud Computing", "Digital Electronics",
]
DEPTS = ["IT", "CSE", "AIML", "AIDS", "ECE", "EEE", "MECH", "CIVIL", "Bioinformatics"]
SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"]
COMPANIES = ["TCS", "Wipro", "Capgemini", "Infosys", "Cognizant", "Accenture",
             "Zoho", "Freshworks", "Amazon", "Microsoft"]
CERTIFICATES = ["Bonafide Certificate", "Transfer Certificate", "Migration Certificate",
                "Conduct Certificate", "Provisional Certificate", "Marksheet"]
LEAVE_TYPES = ["Medical Leave", "Personal Leave", "On Duty (OD) – Event",
               "On Duty (OD) – Training", "Emergency Leave", "Family Function"]
GRADES = ["O", "A+", "A", "B+", "B", "RA"]
DESKS = ["Admin Office", "Examination Cell", "Accounts Office", "Student Welfare",
         "Library", "HOD – IT Department", "HOD – CSE Department"]
EVENT_CATS = ["Technical", "Cultural", "Sports", "Workshop", "Seminar"]
SKILLS = ["Java", "Python", "Data Structures", "SQL", "React", "Node.js",
          "Cloud (AWS)", "DBMS", "System Design", "Aptitude"]
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

INTENTS = [

# ══════════════════════════════════════════════════ ATTENDANCE ══════════════
dict(key="attendance_check", category="Attendance", roles=["student"],
response="I can show your overall attendance percentage, calculated across every "
         "session recorded for you (Late is counted as present). The college "
         "requires a minimum of 75% per subject. Full details are on the "
         "Attendance page of your student portal.",
q="""show my attendance
attendance
what is my attendance percentage
how much attendance do i have
can you check my attendance
attendance details
my attendance please
how many classes have i attended
what's my attendance
check attendance
attendance status
tell me my attendance percentage
i want to see my attendance record
could you please tell me my current attendance percentage
what is my overall attendance for this semester
how many periods have i attended so far
give me my attendance summary
attendance report
whats my current attendance standing
i need to know my attendance
show attendance percentage
how many classes did i attend this semester
what percent attendance do i have right now
kindly provide my attendance details
attendance percent
total classes attended
how is my attendance looking
my present percentage
number of days i was present
what does my attendance look like this term
overall attendance
attendance summary for me
how many hours have i attended
show me how many classes i have attended till date"""),

dict(key="attendance_shortage", category="Attendance", roles=["student"],
response="I compare your attendance against the 75% minimum and flag any subject "
         "you have fallen short in. Below 75% is high risk, 75-85% is medium and "
         "above 85% is low risk. If you are short, the Attendance page shows how "
         "many sessions you need to recover, and you should raise it with your "
         "class advisor.",
q="""am i short of attendance
do i have attendance shortage
am i below 75
is my attendance below the required percentage
did my attendance drop
am i in the danger zone for attendance
will i be detained for low attendance
how many more classes do i need to reach 75
am i lacking attendance
attendance shortage
am i at risk because of attendance
is my attendance ok
do i have a shortage in any subject
how many classes can i still miss
am i safe on attendance
what happens if my attendance is less than 75
can i bunk tomorrow without falling below 75
how many leaves can i take without a shortage
am i going to have an attendance problem
is there any subject where i am short
my attendance is falling what should i do
will i be allowed to write the exam with this attendance
how much attendance do i still need
attendance shortage warning
am i condonation eligible
how many classes should i attend to be safe
is my attendance below the minimum requirement
am i failing the attendance criteria
low attendance
did i lose attendance this month
how far am i from 75 percent"""),

dict(key="attendance_subject_wise", category="Attendance", roles=["student"],
response="I can break your attendance down subject by subject and show which "
         "subject is lowest, since the 75% rule applies per subject. The "
         "subject-wise table is on the Attendance page.",
q="""show my subject wise attendance
what is my attendance in {subject}
attendance for {subject}
which subject has my lowest attendance
subject wise attendance breakdown
how many {subject} classes have i missed
per subject attendance
give me attendance for each subject
in which subject is my attendance lowest
{subject} attendance percentage
how am i doing in {subject} attendance
attendance subject by subject
which paper am i short in
show attendance split by subject
my worst attendance subject
how many lab sessions have i attended
compare my attendance across subjects
attendance for all my subjects
what's my attendance in each paper
list attendance per course"""),

# ══════════════════════════════════════════════════ MARKS / CGPA ════════════
dict(key="marks_view", category="Marks", roles=["student"],
response="I can show your internal marks (out of 40), external marks (out of 60) "
         "and the total out of 100 for each subject, along with the grade. The "
         "pass mark is 50. Marks a faculty member has entered stay hidden until "
         "they are published. See the Results page for the full mark sheet.",
q="""show my marks
marks
what are my internal marks
can i see my results
show my exam marks
my marks for {subject}
what did i score in {subject}
internal marks
external marks
how much did i get in {subject}
show my marksheet
what are my subject wise marks
display my scores
i want to check my marks
my total marks
what is my internal assessment score
did i pass {subject}
how many marks did i get out of 100
show me my grades
what grade did i get in {subject}
my result for this semester
marks details
can you show my semester marks
what were my external exam marks
give me my score card
show my assessment marks
did i clear all subjects
what is my highest mark
which subject did i score the most in
my lowest scoring subject"""),

dict(key="cgpa_query", category="Marks", roles=["student"],
response="I calculate your CGPA as the credit-weighted average of your grade "
         "points across all recorded subjects, on the Anna University 10-point "
         "scale (O=10, A+=9, A=8, B+=7, B=6, RA=0). Your CGPA and semester-wise "
         "GPA are on the CGPA page.",
q="""what is my cgpa
cgpa
show my cgpa
calculate my cgpa
what's my gpa
my current cgpa please
tell me my cgpa
how much cgpa do i have
sgpa for this semester
what is my semester gpa
show my grade point average
cgpa details
is my cgpa above 7
what will my cgpa be
my aggregate percentage
how do you calculate cgpa
show semester wise gpa
what is my cgpa out of 10
current gpa
my academic average
did my cgpa improve
cgpa for semester {sem}
what was my gpa last semester
show my cumulative grade point average
how many grade points do i have
what is the grade point for {grade}
my cgpa trend
convert my cgpa to percentage
overall gpa please"""),

dict(key="backlog_query", category="Marks", roles=["student"],
response="A subject with grade RA (grade point 0, total below 50) counts as a "
         "backlog. I can tell you how many backlogs you currently have and which "
         "subjects they are in — this also affects placement eligibility, since "
         "most recruiters allow zero or at most one backlog.",
q="""do i have any backlogs
how many arrears do i have
backlog
show my arrears
am i having any ra
which subjects did i fail
do i have pending arrears
list my backlogs
how many subjects do i need to reappear in
arrear details
did i get ra in any subject
am i clear of backlogs
how many papers have i failed
backlog count
what subjects am i failing
show my re appear subjects
do i have history of arrears
am i arrear free
does my backlog affect placement
how do i clear my arrear
which paper do i have to write again
number of backlogs
supplementary exam subjects
am i eligible with one backlog"""),

dict(key="results_status", category="Marks", roles=["student"],
response="Results appear once a faculty member publishes the marks they entered; "
         "until then they stay hidden. If a subject is missing from your results "
         "page, the marks have not been published yet — check the Notices page "
         "for the result announcement or contact the Examination Cell.",
q="""have the results been published
when will results come out
are my results out
result announcement date
why can't i see my marks
my marks are not showing
result not published yet
when are semester results declared
is the result released
result date
why is one subject missing from my results
when will {subject} marks be published
has the exam result been announced
results status
are marks updated
my result is blank
when do we get our marks
is the result out for semester {sem}
result publication
how long till results
did they publish the marks yet
result delay"""),

# ══════════════════════════════════════════════════ TIMETABLE ═══════════════
dict(key="timetable_today", category="General", roles=["student"],
response="I can show today's class schedule for your department, semester and "
         "section from the published timetable, including the period slots and "
         "subjects. Open the Timetable page for the day view.",
q="""what are my classes today
today's timetable
show today's schedule
which class do i have now
what is my first period today
do i have class today
today classes
next class
what subject is in the first hour
my schedule for today
what class do i have after lunch
is there any lab today
what's my last period today
show me today's periods
do i have {subject} today
class timings for today
what time does my first class start
any free period today
todays time table
what am i having in the third hour
when is my next class
do i have classes this morning"""),

dict(key="timetable_weekly", category="General", roles=["student"],
response="I can show your full published weekly timetable for your department, "
         "semester and section, with the period slots and the subject in each. "
         "Draft timetables are not visible until an admin publishes them.",
q="""show my timetable
timetable
weekly timetable
my class schedule
show the full time table
what is my schedule for this week
when do i have {subject}
which day do i have {subject}
show timetable for {day}
{day} timetable
class schedule for the week
how many periods do i have on {day}
give me my weekly schedule
i need my timetable
time table please
what subjects do i have on {day}
show the period wise timetable
where can i see my timetable
is the new timetable published
has my timetable changed
which days do i have labs
my department timetable
timetable for semester {sem}
full week schedule
how many hours of {subject} per week"""),

# ══════════════════════════════════════════════════ EXAMS ═══════════════════
dict(key="exam_schedule", category="Exams", roles=["student"],
response="I can give you the published exam schedule for your semester — the "
         "theory start and end dates, and the date, subject code and session for "
         "each paper. Only published schedules are visible. The Exam page has the "
         "full table plus the instructions.",
q="""when do exams start
exam timetable
show exam schedule
when is my {subject} exam
exam dates
what is the exam schedule for semester {sem}
when does the theory exam begin
exam time table please
which date is my first exam
show me the exam dates
is the exam schedule published
when do semester exams end
what session is my {subject} paper
forenoon or afternoon exam
exam schedule
how many exams do i have
date of the last exam
when is the model exam
exam calendar
what is the exam pattern
when are internals scheduled
give me the exam date sheet
which subject exam is on {day}
theory exam start date
has the exam timetable been released"""),

dict(key="exam_hall_ticket", category="Exams", roles=["student"],
response="The published exam record carries a hall ticket availability date. Once "
         "that date arrives, the hall ticket becomes available on the Exam page. "
         "Hall tickets are usually withheld if there is a pending fee balance or "
         "an attendance shortage, so clear those first.",
q="""when can i get my hall ticket
hall ticket
how do i download my hall ticket
is my hall ticket available
hall ticket release date
where can i find my hall ticket
why is my hall ticket not available
can i get hall ticket with pending fees
hall ticket download
do i need to collect hall ticket from office
hall ticket for semester {sem}
when will hall tickets be issued
is hall ticket ready
admit card
where is my admit card
hall ticket not showing
can i write the exam without hall ticket
hall ticket availability
i lost my hall ticket what do i do
do i need attendance for hall ticket"""),

dict(key="exam_practicals", category="Exams", roles=["student"],
response="The published exam record lists practical exams separately with the "
         "date, subject, lab and time. You'll find the practicals table alongside "
         "the theory schedule on the Exam page.",
q="""when is my practical exam
practical exam schedule
lab exam dates
which lab is my practical in
practical timetable
what time is my lab exam
show practical exams
lab practical schedule
when does the {subject} lab exam happen
practicals
is the practical before or after theory
which lab has been allotted for my practical
practical exam venue
lab exam timing
how many practical exams do i have
practical exam date for semester {sem}
when are lab externals
show me the practical schedule
is there a practical for {subject}
record submission before practical"""),

# ══════════════════════════════════════════════════ COURSEWORK ══════════════
dict(key="coursework_assignments", category="General", roles=["student"],
response="I can list the assignments your faculty have posted for your "
         "department, semester and section — with the title, subject, due date "
         "and maximum marks — and tell you whether you have submitted. You submit "
         "text or a file attachment from the Coursework page; faculty then grade "
         "it and add remarks.",
q="""what assignments do i have
show my assignments
any pending assignments
assignment due date
when is my {subject} assignment due
did i submit my assignment
how do i submit an assignment
assignment marks
has my assignment been graded
list open assignments
what is the maximum mark for the assignment
show pending submissions
assignment status
can i submit the assignment late
where do i upload my assignment
my assignment grade
what did i get in the assignment
which assignments are still open
assignment deadline
new assignment posted
do i have homework
faculty remarks on my assignment
how many assignments are pending
submit assignment"""),

dict(key="coursework_materials", category="General", roles=["student"],
response="Faculty upload study materials — notes, question banks and reference "
         "files — for your subject, department and semester. I can list what is "
         "available and you can download them from the Coursework page.",
q="""where are the study materials
show notes for {subject}
download study material
any new notes uploaded
class notes
where can i get the question bank
study materials for semester {sem}
has the faculty uploaded notes
lecture notes for {subject}
reference material
show me the uploaded materials
i need notes for my exam
where do i find lecture slides
previous year question papers
material for {subject}
who uploaded the notes
can i download the pdf notes
list all study materials
are there any notes for the unit test
find me the syllabus material"""),

dict(key="academic_calendar", category="General", roles=["student", "faculty", "parent"],
response="The academic calendar lists holidays, exam windows, deadlines, semester "
         "boundaries and events with their dates. I can tell you what is coming "
         "up; the full calendar is on the Calendar page.",
q="""when is the next holiday
academic calendar
show the calendar
what holidays are coming up
when does the semester end
when does the semester start
list upcoming deadlines
is tomorrow a holiday
when is the next exam window
show important dates
academic schedule for this year
when do classes reopen
is there a holiday next week
semester start and end dates
what are the important deadlines
holiday list
when is the last working day
what's on the calendar this month
upcoming events and holidays
when is the semester break
any deadline this week
college holidays"""),

# ══════════════════════════════════════════════════ FEES ════════════════════
dict(key="fees_balance", category="Fees", roles=["student", "parent"],
response="I can show your fee record for the semester — the component-wise "
         "breakdown, the total, how much is paid, the outstanding balance, the due "
         "date and any late fine. The full statement is on the Fees page.",
q="""what is my fee balance
how much fees do i owe
show my fees
fee details
pending fees
how much do i still have to pay
fee balance
what is my total fee
outstanding fee amount
is my fee fully paid
fee status
how much is left to pay
show the fee breakdown
what are the fee components
tuition fee amount
my dues
do i have any pending dues
how much have i paid so far
total fees for this semester
what is the fee for semester {sem}
balance amount
fee summary
am i cleared on fees
exam fee amount
show my fee statement
how much is the hostel fee component
what is included in my fees"""),

dict(key="fees_due_date", category="Fees", roles=["student", "parent"],
response="Your fee record carries a due date and a late fine amount. If payment "
         "goes past the due date the late fine applies. I can tell you the due "
         "date on your record; it is also shown on the Fees page.",
q="""when is the fee due date
last date to pay fees
fee deadline
when do i have to pay my fees
is the fee due date over
how many days left to pay fees
late fee amount
what happens if i pay late
is there a fine for late payment
fee due
when is the last day for fee payment
due date for semester {sem} fees
did i miss the fee deadline
penalty for late fee payment
can i get an extension for the fee payment
how much is the late fine
fee payment last date
when should i clear my dues
is the fine added to my balance
deadline for fees"""),

dict(key="fees_payment", category="Fees", roles=["student", "parent"],
response="You record a payment from the Fees page by entering the amount, the "
         "mode (Online, DD, Cash or NEFT) and the transaction reference. That "
         "creates an entry in your payment history which the Accounts Office then "
         "verifies. The portal records payments — it does not process them "
         "through a payment gateway.",
q="""how do i pay my fees
can i pay fees online
how to make a fee payment
where do i pay my fees
payment options
what modes of payment are accepted
can i pay by dd
is neft accepted for fees
how do i record my payment
i paid the fees how do i update it
add my payment
submit fee payment
can i pay in cash
where do i enter the transaction number
do i need a transaction id
how do i upload my payment receipt
can i pay in installments
i made an online transfer what next
payment mode
how to update fee payment details
paying fees through bank transfer
can my parent pay the fees"""),

dict(key="fees_verification", category="Fees", roles=["student", "parent"],
response="Every payment you record starts as unverified. The Accounts Office "
         "checks it against the bank record and marks it verified, after which "
         "your balance reflects it. If a payment has been sitting unverified, "
         "contact the Accounts Office through the Contact page.",
q="""is my payment verified
why is my payment not reflecting
my fee payment is not updated
payment verification status
how long does fee verification take
i paid but balance is still showing
when will my payment be confirmed
verify my payment
payment pending verification
who verifies the fee payment
my transaction is not showing
fee not updated after payment
payment shows unverified
how do i get my payment approved
balance not reduced after payment
my dd has not been credited
receipt not generated
payment status
is my neft transfer confirmed
accounts office has not verified my fee"""),

dict(key="fees_history", category="Fees", roles=["student", "parent"],
response="Your fee record keeps a payment history — each entry has the date, "
         "description, amount, mode, transaction reference and whether it has "
         "been verified. You can view the full history on the Fees page.",
q="""show my payment history
list all my fee payments
past payments
when did i last pay fees
payment records
show my fee transactions
how many payments have i made
my previous fee payments
transaction history
show all receipts
what was my last payment amount
fee payment log
did i pay last semester
history of my dues
show me every payment i made
receipt history
my payment entries
list my transactions with dates"""),

# ══════════════════════════════════════════════════ LEAVE / OD ═════════════
dict(key="leave_apply", category="General", roles=["student"],
response="You apply for leave from the Leave page by choosing the type — Medical "
         "Leave, Personal Leave, Emergency Leave or Family Function — with the "
         "from and to dates, a reason, and an optional supporting document. The "
         "to date cannot be earlier than the from date. It is submitted as Pending "
         "for approval.",
q="""how do i apply for leave
apply leave
i want to take leave
how to submit a leave application
leave application process
can i apply for medical leave
where do i apply for leave
i need leave for two days
apply for emergency leave
how do i request personal leave
leave for a family function
do i need to upload a medical certificate
can i attach a document with my leave
what types of leave are there
apply leave for tomorrow
submit leave request
how many days leave can i take
i am sick can i apply for leave
leave form
what details are needed for leave
can i apply leave for a past date
how do i cancel my leave application
leave request for next week
do i need proof for medical leave"""),

dict(key="leave_status", category="General", roles=["student"],
response="Every leave application is Pending until it is approved or rejected, "
         "and the approver can add remarks. I can tell you the current status of "
         "your applications; the list is on the Leave page.",
q="""what is my leave status
is my leave approved
has my leave been sanctioned
leave approval status
did they reject my leave
check my leave application
my leave request status
was my leave accepted
is my medical leave approved
who approved my leave
any remarks on my leave
leave pending
show my leave applications
how many leaves have i taken
is my leave still pending
did the hod approve my leave
leave rejected reason
status of my leave for last week
show all my leave requests
why was my leave rejected
approved leaves list"""),

dict(key="od_request", category="General", roles=["student"],
response="On Duty is applied for as a leave type — either On Duty (OD) – Event or "
         "On Duty (OD) – Training — from the OD page, with dates, a reason and a "
         "supporting document. Approved OD is recorded against your leave record.",
q="""how do i apply for od
od request
i need on duty for a symposium
apply on duty
od for a workshop
how to get od for an event
on duty application
od for training programme
will od affect my attendance
is od counted as present
apply od for tomorrow
od approval
what document do i need for od
i am attending an inter college event can i get od
od form
difference between od and leave
who approves od
my od status
od request for a hackathon
can i get od for a placement drive
od for sports meet
apply for on duty event"""),

# ══════════════════════════════════════════════════ REQUESTS / DOCS ════════
dict(key="certificate_request", category="General", roles=["student", "alumni"],
response="You can request a Bonafide Certificate, Transfer Certificate, Migration "
         "Certificate, Conduct Certificate, Provisional Certificate, a Marksheet "
         "or another document from the Requests page, stating the purpose and an "
         "urgency of Normal, Urgent or Emergency. Each request gets a unique "
         "reference number.",
q="""how do i request a bonafide certificate
i need a transfer certificate
apply for a certificate
how to get my marksheet
request migration certificate
i want a conduct certificate
provisional certificate application
where do i apply for documents
certificate request process
how do i get a bonafide for a bank loan
i need a tc
document request
apply for a duplicate marksheet
can i request an urgent certificate
what certificates can i apply for
how do i get a study certificate
i need a certificate for a scholarship application
request a document from college
what is the purpose field for
how do i mark my request as urgent
apply for provisional certificate after graduation
i need my consolidated marksheet
certificate for passport application
how do i request a course completion document"""),

dict(key="request_status", category="General", roles=["student", "alumni"],
response="Your document request moves through Submitted, Under Review, "
         "Processing, Ready for Collection and then Completed — or Rejected, with "
         "remarks. Track it by its reference number on the Status page.",
q="""what is the status of my certificate request
track my request
is my bonafide ready
where is my certificate
request status
has my document been processed
is my tc ready for collection
check request using reference number
my request reference number
how long does a certificate take
is my request still under review
when can i collect my certificate
my request was rejected why
document ready or not
show my pending requests
status of my marksheet request
did they approve my document request
any remarks on my request
my certificate is taking too long
is it ready for collection
what does under review mean
list all my requests
processing status of my certificate"""),

# ══════════════════════════════════════════════════ LIBRARY ═════════════════
dict(key="library_search", category="General", roles=["student", "faculty"],
response="I can search the library catalogue by title, author or category and "
         "tell you whether a copy is Available, Borrowed or Reserved, along with "
         "the number of copies. Browse the full catalogue on the Library page.",
q="""is this book available in the library
search for a book
do you have books on {subject}
find a book by title
library catalogue
how many copies of this book are there
is the book borrowed
search library by author
what books are available on data structures
book availability
can i reserve a book
is there any book on machine learning
show me library books
list books in the computer science category
find books by an author
i am looking for a reference book
does the library have this title
book status
which books can i borrow
search the library"""),

dict(key="library_borrowed", category="General", roles=["student", "faculty"],
response="I can list the books you currently have on loan with their borrowed "
         "date, due date and status — Active, Returned or Overdue. Your loans are "
         "shown on the Library page.",
q="""what books have i borrowed
show my borrowed books
when is my book due
do i have any overdue books
my library loans
how many books do i have
is my book overdue
return date for my book
books i need to return
library due date
did i return that book
show my issued books
am i holding any library book
overdue book fine
when should i return my books
my borrowed list
how many books can i borrow at a time
book issue date
do i owe the library anything
check my library account"""),

dict(key="library_renew", category="General", roles=["student", "faculty"],
response="You can request a renewal for a borrowed book from the Library page. "
         "The system records the request and the librarian confirms it within 24 "
         "hours.",
q="""how do i renew a book
can i renew my library book
renew book
i want to extend my book due date
book renewal
how long does renewal take
can i renew online
renew my borrowed book
extend book loan
is renewal automatic
who approves book renewal
renew before due date
can i renew twice
request renewal
how many times can i renew a book
book renewal confirmation
i need more time with this book
extend my library book"""),

dict(key="library_hours", category="General", roles=["student", "faculty", "visitor", "parent"],
response="The library is open Monday to Friday from 8:00 AM to 6:00 PM and on "
         "Saturday from 9:00 AM to 4:00 PM. It is closed on Sundays and holidays.",
q="""what are the library hours
when does the library open
library timing
is the library open on sunday
library closing time
what time does the library close
is the library open today
library working hours
does the library open on saturday
library timings please
when can i visit the library
is the library open during holidays
library opening time
what time can i return a book
till what time is the library open
saturday library hours
library open or closed now
is the library available in the evening"""),

# ══════════════════════════════════════════════════ NOTICES / EVENTS ═══════
dict(key="notices_latest", category="General", roles=["student", "faculty", "parent"],
response="I can show the latest published notices, with pinned ones first. Each "
         "notice carries a category, an AI-generated summary, key dates and action "
         "items. The full list is on the Notices page.",
q="""any new notices
show latest notices
what's the latest announcement
recent circulars
any updates from college
show notice board
latest news from college
what announcements are there
any important notice today
new circular
show me recent announcements
notices please
what did the college announce
any notification for students
check the notice board
show pinned notices
was there any announcement this week
latest updates
anything new posted
recent notices for my department
any urgent notice
what is the newest notice"""),

dict(key="notice_search", category="General", roles=["student", "faculty", "parent"],
response="Notices are categorised as exam, fee, general, urgent or holiday. I can "
         "find notices in a category or matching a topic, and give you the summary, "
         "key dates and action items from it.",
q="""show exam related notices
any fee notice
holiday notice
find the notice about exams
urgent notices
search notices for {subject}
notice about fee payment
is there a circular about the exam schedule
show holiday announcements
any notice regarding results
filter notices by category
notice about placement drive
what did the notice about fees say
summarize the latest exam notice
key dates in the recent notice
what action do i need to take from that notice
show general notices
notices for semester {sem}
circular about hall tickets
was there a notice about the timetable change"""),

dict(key="events_list", category="General", roles=["student", "faculty", "visitor"],
response="I can list upcoming campus events with their category — Technical, "
         "Cultural, Sports, Workshop or Seminar — plus the date, time, venue, "
         "organizer and how many seats are left. The Events page has the full list.",
q="""what events are coming up
show upcoming events
any technical events
list cultural events
what's happening on campus
any workshop this month
show me the events
sports events
seminar schedule
is there any symposium
where is the event being held
event venue and time
who is organizing the event
how many seats are left for the event
event details
any hackathon coming up
show {evcat} events
what is the date of the next event
campus events this week
any fest happening
event timings
list all seminars"""),

dict(key="events_register", category="General", roles=["student"],
response="You register for an event from the Events page. Seats are capped — if "
         "the cap is reached you'll be told the event is full, and you can't "
         "register twice for the same event. You can also unregister if you change "
         "your mind.",
q="""how do i register for an event
register me for the workshop
event registration
can i still register
is registration open
how do i sign up for the seminar
i want to attend the event
event is showing full
already registered message
how do i cancel my event registration
unregister from event
are seats available
registration closed
can i register for two events
how many people have registered
book my seat for the event
is there a registration fee
withdraw from the event
sign up for the technical fest
event registration deadline"""),

# ══════════════════════════════════════════════════ PEOPLE / CONTACT ═══════
dict(key="faculty_directory", category="Faculty", roles=["student", "parent", "visitor"],
response="I can look up faculty by name or subject and give you their "
         "designation, department, the subjects they teach, their email and office "
         "location.",
q="""who teaches {subject}
faculty for {subject}
who is my {subject} professor
find a faculty member
faculty email
what is the email id of my lecturer
where is the staff room
faculty cabin location
who handles {subject} for our class
staff details
which professor teaches machine learning
faculty contact number
how do i contact my teacher
list faculty in {dept} department
faculty directory
who is the subject handler for {subject}
where can i meet my professor
teacher details
show me the faculty list
what is the designation of my professor
which subjects does this faculty teach
faculty office location
staff email address
who is the class advisor
find professor by name"""),

dict(key="faculty_hod", category="Faculty", roles=["student", "parent", "visitor"],
response="I can identify the Head of Department for your department — or for any "
         "department you name — with their designation, email and office location.",
q="""who is the hod
who is the head of department
hod name
hod of {dept}
who is our hod
head of department email
hod contact details
where is the hod cabin
who is the hod for computer science
how do i meet the hod
hod office location
name of the head of department
who should i approach as hod
hod for my department
is the hod available
head of department for {dept}
hod email id
who signs my certificate as hod
hod room number"""),

dict(key="contact_department", category="General", roles=["student", "parent", "visitor", "applicant", "alumni"],
response="You can send a message to the Admin Office, Examination Cell, Accounts "
         "Office, Student Welfare, Library, HOD – IT Department or HOD – CSE "
         "Department from the Contact page. You'll receive a response within 1-2 "
         "working days.",
q="""how do i contact the college
who do i contact for fee issues
how to reach the exam cell
contact the admin office
whom should i approach for my problem
i want to raise a complaint
how do i send a message to the office
contact details of accounts office
who handles student welfare
how long does it take to get a reply
i have a query whom do i ask
raise a support ticket
contact the examination cell about my result
send a message to the library
how do i get help
i need to speak to someone in the office
whom do i contact about my certificate
office contact
where do i register a grievance
how do i escalate my issue
department contact list
reach out to the college
how do i file a complaint about a mark
who do i talk to about my attendance issue"""),

dict(key="departments_list", category="General", roles=["student", "applicant", "visitor", "parent"],
response="The college has departments including Information Technology, Computer "
         "Science and Engineering, Artificial Intelligence and Machine Learning, "
         "Artificial Intelligence and Data Science, Bioinformatics, Electronics and "
         "Communication, Electrical and Electronics, Mechanical and Civil "
         "Engineering.",
q="""what departments are there
list all departments
which branches does the college have
is there a cse department
do you have an aiml course
what courses are offered
department list
does the college have mechanical engineering
available branches
is bioinformatics offered here
what streams can i join
name the engineering departments
which department should i choose
is there an ai and data science branch
tell me about the departments
how many departments are in the college
does the college offer civil engineering
what is the full form of aids department
departments in this college"""),

# ══════════════════════════════════════════════════ PROFILE / ACCOUNT ══════
dict(key="profile_view", category="General", roles=["student", "faculty"],
response="Your profile holds your name, student ID, email, department, year, "
         "semester, section, phone, photo and your parent/guardian details. You "
         "can view it all on the Profile page.",
q="""show my profile
what is my student id
my details
what section am i in
which semester am i in
show my registration number
what department am i in
my profile information
what year am i studying
show my personal details
what is my roll number
my registered email
which class am i in
display my account details
what batch am i from
my student information
show my parent details
what is my registered phone number
profile page
who is listed as my guardian
my academic year
what is my section and semester"""),

dict(key="profile_update", category="General", roles=["student", "faculty"],
response="You can update your phone number, photo and parent/guardian details "
         "from the Profile page. Core academic fields like your student ID, "
         "department and semester are maintained by the administration — contact "
         "the Admin Office to have those corrected.",
q="""how do i change my phone number
update my profile
i want to change my photo
edit my details
how do i update my parent's contact
change my mobile number
update guardian details
my name is spelled wrong
how do i correct my department
change my email id
update profile picture
my section is wrong how do i fix it
edit parent information
i moved houses how do i change my address
who can change my student id
correct my date of birth
update my personal information
change my father's phone number
how do i upload a profile photo
my semester is showing incorrectly"""),

dict(key="login_help", category="General", roles=["student", "faculty", "admin", "parent"],
response="Everyone signs in at the single login page using their registered email "
         "or ID and password — the portal detects whether you are a student, "
         "faculty member or administrator and takes you to the right dashboard. "
         "After 10 failed attempts the account is locked for 15 minutes.",
q="""how do i login
i can't login
login page
where do i sign in
which login should i use as faculty
is there a separate login for students
i am unable to log in
login not working
my account is locked
too many failed attempts
how many login attempts do i get
why am i locked out
what credentials do i use to log in
do i login with my email or student id
login error
sign in problem
i keep getting invalid credentials
how long is the lockout
can't access my account
help me log in
login issue after registration
where is the faculty login
my password is not being accepted
account locked for 15 minutes"""),

dict(key="password_reset", category="General", roles=["student", "faculty", "admin"],
response="There is no self-service password reset in the portal. If you are "
         "locked out, contact the college Admin Office and they will reset it for "
         "you. If you are already signed in, you can change your password yourself "
         "from the Settings page.",
q="""i forgot my password
how do i reset my password
password reset
forgot password
i lost my password
how do i change my password
reset my login password
can i get a password reset link
i don't remember my password
change password
where is the forgot password option
how do i set a new password
password recovery
who can reset my password
is there an email link to reset password
i need a new password
my password expired
how do i update my password
faculty password reset
reset password for my account
first time login password change
i was asked to change my password
can the admin reset my password
password not working"""),

dict(key="registration_approval", category="General", roles=["applicant", "student"],
response="When you register, a student account is created with a Pending status "
         "and no login is issued yet. An administrator has to approve it before "
         "you can sign in. You'll be able to log in as soon as the approval goes "
         "through.",
q="""i registered but can't login
is my registration approved
how long does approval take
my account is pending approval
who approves my registration
why can't i sign in after registering
registration status
did the admin approve my account
how do i register
new student registration
i signed up yesterday and still can't log in
account pending
approval process for new accounts
what does pending approval mean
was my registration rejected
how do i know when i am approved
sign up for the portal
create an account
registration not approved yet
do i get an email after approval
how do i speed up my approval
my registration is stuck"""),

dict(key="account_status", category="General", roles=["student", "faculty"],
response="An account can be pending approval, approved, rejected with a reason, "
         "or deactivated. If your account has been rejected or deactivated you'll "
         "see the reason at login — contact the Admin Office to have it reviewed.",
q="""my account was rejected
why is my account inactive
account deactivated
is my account active
account status
why was my registration rejected
my access has been removed
i was told my account is disabled
can my account be reactivated
account blocked
what does rejected mean
who deactivated my account
is my account still valid
my login says account inactive
reason for rejection
reactivate my account
account suspended
why can't i access the portal anymore"""),

dict(key="settings_help", category="General", roles=["student", "faculty", "admin"],
response="The Settings page is where you change your password and manage your "
         "account preferences while signed in.",
q="""where are the settings
how do i open settings
change my preferences
account settings
where do i change my password from settings
settings page
how do i log out
sign out
where is the logout button
notification preferences
can i change the theme
app settings
how do i manage my account
where do i find my account options
customize my portal
dark mode
log me out"""),

# ══════════════════════════════════════════════════ AI / PLACEMENT ═════════
dict(key="performance_summary", category="Placements", roles=["student"],
response="Your Student Success Score is out of 100 and combines attendance "
         "health, academic performance (CGPA and backlogs), placement readiness "
         "and engagement. I can give you the score, the sub-scores and the top "
         "recommendation for improving it. It's on your dashboard.",
q="""how am i performing
how am i doing this semester
what is my success score
am i doing well
show my performance summary
how good is my academic standing
what should i improve
give me my overall report
am i on track
how am i
my performance
what's my success score out of 100
where do i stand academically
what is dragging my score down
how can i improve my performance
overall assessment of my progress
am i a good student
what are my weak areas
give me recommendations to improve
my academic health
how does my profile look
rate my performance
what is my engagement score
am i improving or declining"""),

dict(key="placement_readiness", category="Placements", roles=["student"],
response="Your placement readiness score weights Academics (CGPA) 40%, Technical "
         "Skills 25%, Attendance 20% and Projects 15%, and comes with a risk level. "
         "I can show the breakdown and what to strengthen first.",
q="""am i placement ready
what is my placement readiness score
am i ready for placements
how prepared am i for campus placement
placement readiness
will i get placed
what is my chance of getting placed
how do i improve my placement score
am i good enough for placement
placement risk level
what is holding back my placement readiness
how is my placement score calculated
show my readiness breakdown
how much do projects matter for placement
does attendance affect placement
placement preparation status
am i behind in placement prep
what weightage does cgpa have in placement
improve my placement chances
placement score"""),

dict(key="placement_eligibility", category="Placements", roles=["student"],
response="Recruiter eligibility is checked against your CGPA, attendance "
         "percentage and backlog count. I can tell you which companies you "
         "currently qualify for and, for the ones you don't, exactly which "
         "criterion falls short.",
q="""am i eligible for {company}
which companies can i apply to
what is the cgpa cutoff for {company}
am i eligible for placements
do i meet the criteria for {company}
why am i not eligible for {company}
eligibility for campus placement
what cgpa do i need for {company}
can i sit for the {company} drive
minimum attendance for placement drives
does one backlog make me ineligible
list companies i qualify for
placement eligibility criteria
am i eligible with my current cgpa
which drives can i attend
what is stopping me from being eligible
company eligibility check
do i qualify for product companies
eligibility cutoff
can i apply with a backlog
which companies have a 7 cgpa cutoff"""),

dict(key="placement_companies", category="Placements", roles=["student", "parent"],
response="The placement catalogue covers recruiters including TCS, Wipro, "
         "Capgemini, Infosys, Cognizant, Accenture, Zoho, Freshworks, Amazon and "
         "Microsoft, with the role, sector, CTC and eligibility gates for each. I "
         "can also rank the best matches for your profile.",
q="""which companies come for placement
list of recruiters
what is the package offered by {company}
show placement companies
what role does {company} offer
highest package on campus
which company pays the most
what is the ctc for {company}
product based companies visiting
service companies list
which company should i target
best company match for me
average package
what sector is {company} in
top recruiters
recommend companies for my profile
what job role does infosys offer
placement statistics
which companies hire from our department
show me the recruiter list"""),

dict(key="placement_skills", category="Placements", roles=["student"],
response="I compare the skills on your profile against the skills recruiters "
         "screen for, grouped as Programming, CS Fundamentals, Web & Cloud, and "
         "Aptitude & Soft skills, and show your coverage plus the gaps to close.",
q="""what skills am i missing
skill gap analysis
which skills should i learn for placement
do i have the right skills
what technical skills do i need
skills required for {company}
show my skill coverage
am i missing any core skills
what should i learn next
which programming languages should i know
do i need to learn {skill}
skill gap for product companies
how many skills do i have
what skills does {company} screen for
improve my technical profile
what are the cs fundamentals i need
should i learn cloud
recommend skills to add
my skill matrix
which soft skills matter"""),

# ══════════════════════════════════════════════════ KNOWLEDGE BASE ═════════
dict(key="knowledge_base_query", category="General", roles=["student", "faculty", "parent", "applicant"],
response="I can search the college knowledge base — regulations, handbooks, "
         "academic rules, placement policy and FAQs — and answer with the relevant "
         "section, citing the document it came from.",
q="""what does the regulation say about attendance
show me the academic rules
where is the student handbook
what is the college policy on this
find the rule about condonation
what are the exam regulations
placement policy
is there a handbook i can read
college rules and regulations
what does the handbook say about leave
academic regulations for my batch
r2021 regulation
frequently asked questions
policy document
what is the rule for revaluation
where can i read the college policy
attendance policy document
show the fee refund policy
rules for internal assessment
what is the anti ragging policy
disciplinary rules
credit requirements for graduation
what does the regulation say about arrears"""),

dict(key="hostel_info", category="Hostel", roles=["student", "parent", "applicant"],
response="Hostel information is available only through the college knowledge base "
         "documents. There is no hostel booking or room allocation module in the "
         "portal — I can share what the uploaded hostel documents say, and for "
         "anything else you should contact the Admin Office or Student Welfare.",
q="""is there a hostel
hostel facility
how do i apply for hostel
hostel fees
hostel room allocation
what are the hostel rules
hostel timings
can i get a hostel room
is hostel accommodation available
hostel warden contact
mess timings
hostel admission process
girls hostel details
boys hostel
hostel vacancy
can i change my hostel room
hostel curfew
what is the hostel fee per year
hostel facilities available
do i need to book hostel separately"""),

dict(key="transport_info", category="Transport", roles=["student", "parent", "applicant"],
response="Transport information comes from the college knowledge base documents. "
         "There is no bus-pass or route booking module in the portal — I can share "
         "what the uploaded transport documents say, and for route or pass queries "
         "you should contact the Admin Office.",
q="""is there college bus
bus routes
how do i get a bus pass
transport facility
college bus timings
bus fee
which bus goes to my area
transport details
is there a bus from the city
bus stop near my home
how much is the transport fee
apply for bus pass
college van service
bus route number
transport office contact
can i change my bus route
what time does the college bus leave
bus schedule
is transport available for all areas
college transportation"""),

dict(key="scholarship_info", category="Scholarships", roles=["student", "parent", "applicant"],
response="Scholarship information is available from the college knowledge base "
         "documents. There is no scholarship application module in the portal — I "
         "can share what the uploaded scholarship documents say, and applications "
         "are handled by the Admin Office. Note that a Bonafide Certificate for a "
         "scholarship application can be requested from the Requests page.",
q="""are there any scholarships
how do i apply for a scholarship
scholarship eligibility
first graduate scholarship
merit scholarship details
government scholarship
what documents do i need for a scholarship
scholarship amount
is there a fee concession
scholarship application deadline
who handles scholarships
sc st scholarship
can i get financial aid
scholarship for toppers
minority scholarship
do i qualify for a scholarship
scholarship status
how do i get a bonafide for my scholarship
tuition fee waiver
free education scheme"""),

# ══════════════════════════════════════════════════ FACULTY PORTAL ═════════
dict(key="faculty_mark_attendance", category="Attendance", roles=["faculty"],
response="From the faculty portal you can mark attendance for a class you are "
         "assigned to — choosing the subject, date and section, and setting each "
         "student to Present, Absent or Late. You can also do it in bulk for the "
         "whole class.",
q="""how do i mark attendance
mark attendance for my class
where do i take attendance
can i mark attendance for a past date
bulk attendance entry
how do i mark a student late
attendance marking for {subject}
i need to correct attendance i marked
can i edit attendance after saving
mark the whole class present
take attendance for section a
how do i record absentees
attendance entry page
which classes can i mark attendance for
mark attendance for today's period
update attendance for a student
attendance module for faculty
can i mark attendance for another faculty's class
save attendance
attendance not saving"""),

dict(key="faculty_enter_marks", category="Marks", roles=["faculty"],
response="You enter internal marks (out of 40) and external marks (out of 60) for "
         "your assigned subjects; the grade and grade point are computed "
         "automatically. Marks stay hidden from students until you publish them.",
q="""how do i enter marks
where do i upload student marks
enter internal marks
how do i publish results
marks entry for {subject}
can students see marks before i publish
how do i correct a mark i entered
mark entry page
is the grade calculated automatically
what is the maximum internal mark
publish marks for my class
can i unpublish marks
enter external marks
bulk marks upload
how do i enter marks for section b
marks not visible to students
grade computation
which subjects can i enter marks for
save and publish marks
edit a published mark"""),

dict(key="faculty_approve_leave", category="General", roles=["faculty"],
response="Leave and OD applications from students appear in your faculty portal, "
         "where you can approve or reject them and add remarks. Your decision and "
         "name are recorded against the application.",
q="""how do i approve student leave
pending leave requests
where do i see leave applications
approve od request
reject a leave application
how do i add remarks while approving leave
show leave requests for my class
student leave approval
how many leaves are pending my approval
can i see the medical certificate attached
approve leave for a student
od approval for faculty
leave requests inbox
who else can approve leave
did i approve this leave already
bulk approve leaves
reject with a reason
view leave document
student od requests
leave approval history"""),

dict(key="faculty_assignments_manage", category="General", roles=["faculty"],
response="You can create assignments with a title, subject, due date and maximum "
         "marks, view the submissions from your students, download what they "
         "attached, and grade each submission with marks and remarks.",
q="""how do i create an assignment
post a new assignment
where do i see assignment submissions
grade a student's assignment
how do i give marks for an assignment
close an assignment
who has submitted the assignment
download student submissions
set an assignment deadline
edit an assignment i posted
delete an assignment
how many students submitted
assignment grading
add remarks to a submission
can i extend the assignment due date
maximum marks for assignment
list my assignments
reopen a closed assignment
view a submitted file
assignment submission count"""),

dict(key="faculty_materials_upload", category="General", roles=["faculty"],
response="You can upload study materials — notes, question banks or reference "
         "files — against a subject, department, semester and section, and your "
         "students can then download them from their Coursework page.",
q="""how do i upload study material
share notes with my students
upload lecture notes
where do i post materials
can i upload a question bank
delete a material i uploaded
update study material
which students can see my notes
upload notes for {subject}
file upload for materials
share reference material
how do i categorize my material
post syllabus for my class
upload material for semester {sem}
my uploaded materials
replace an old note file
material visibility
can i upload for another section"""),

dict(key="faculty_my_classes", category="General", roles=["faculty"],
response="Your faculty dashboard lists the subjects assigned to you with the "
         "department, semester, section and batch, the students in each class, and "
         "your teaching timetable.",
q="""what classes do i have
show my assigned subjects
my teaching schedule
which sections do i handle
list my students
how many students are in my class
my faculty timetable
what subject am i assigned to
show my class list
which semester do i teach
my periods today
student list for section a
how do i see my class roster
subjects allotted to me
my workload
which department students do i teach
faculty dashboard
show a particular student's details
class strength
my next class"""),

dict(key="faculty_analytics", category="General", roles=["faculty"],
response="The faculty analytics view summarises your classes — attendance trends, "
         "mark distributions and how your students are performing across the "
         "subjects you handle.",
q="""show class analytics
how is my class performing
attendance trend for my class
mark distribution for my subject
which students are at risk
class average
analytics for my subject
show me the performance report
who has the lowest attendance in my class
pass percentage for my subject
class performance summary
identify weak students
subject wise analytics
how many students are below 75
average marks in my class
top performers in my class
attendance statistics for my section
faculty analytics dashboard
performance insights"""),

# ══════════════════════════════════════════════════ ADMIN PORTAL ═══════════
dict(key="admin_approve_students", category="General", roles=["admin"],
response="New self-registrations arrive as Pending in the admin portal. You can "
         "approve them, which lets the student log in, or reject them with a "
         "reason. Every decision is recorded with your name and the timestamp.",
q="""how do i approve new students
show pending registrations
approve a student account
reject a registration
how many students are awaiting approval
where is the approval queue
bulk approve students
reason for rejecting a student
can i undo an approval
pending student list
approve registration request
who approved this student
student approval workflow
reactivate a rejected student
approve all pending
deactivate a student account
new signups
registration approvals pending"""),

dict(key="admin_publish_notice", category="General", roles=["admin"],
response="You create a notice with a title, content, category and audience. It "
         "can be saved as a draft, published, pinned to the top, given an expiry "
         "date, or archived. The summarizer generates a summary, key dates, action "
         "items and a priority for it.",
q="""how do i post a notice
publish an announcement
create a new circular
how do i pin a notice
archive an old notice
set an expiry date for a notice
save a notice as draft
edit a published notice
delete a notice
who can post notices
notice categories
attach a file to a notice
how do i mark a notice urgent
target a notice to one department
notice audience
unpublish a notice
schedule a notice
notice summary generation
list all draft notices
change notice priority"""),

dict(key="admin_manage_timetable", category="General", roles=["admin"],
response="You build a timetable per department, semester, section and academic "
         "year, with the period slots and the subject in each. It starts as a "
         "draft, can be checked for clashes, then published so students and "
         "faculty see it, and archived when superseded.",
q="""how do i create a timetable
publish the timetable
edit an existing timetable
check timetable conflicts
timetable clash detection
archive an old timetable
where do i add period slots
assign a subject to a slot
timetable for a section
draft timetable
how do students see the timetable
change a period in the timetable
academic year for timetable
timetable not visible to students
delete a timetable
copy a timetable to another section
conflict in faculty allotment
publish timetable for semester {sem}
timetable status"""),

dict(key="admin_publish_exam", category="Exams", roles=["admin"],
response="You create an exam record for a semester and academic year with theory "
         "dates, the paper-by-paper schedule, practicals, a hall ticket "
         "availability date and instructions. Students see it only after you "
         "publish it, and you can archive it later.",
q="""how do i publish the exam schedule
create an exam timetable
add practical exam dates
set the hall ticket date
publish exam for semester {sem}
edit exam schedule
archive an exam
add exam instructions
why can't students see the exam schedule
draft exam record
schedule a paper on a date
set forenoon or afternoon session
target exam schedule to a department
delete an exam entry
exam publishing workflow
update theory start date
add a subject to the exam schedule
unpublish an exam"""),

dict(key="admin_verify_fees", category="Fees", roles=["admin"],
response="Payments students record show up unverified. From the admin fee view "
         "you check each against the bank record and mark it verified, which "
         "updates the student's balance. You can also see every student's fee "
         "status.",
q="""how do i verify a fee payment
pending payment verifications
mark a payment as verified
show all student fees
which payments are unverified
fee verification queue
how do i check a transaction reference
student fee report
who verified this payment
reverse a verification
list defaulters
students with pending fees
total fee collected
verify dd payment
fee reconciliation
approve a cash payment entry
outstanding fees report"""),

dict(key="admin_process_requests", category="General", roles=["admin"],
response="Document requests come in as Submitted and you move them through Under "
         "Review, Processing, Ready for Collection and Completed, or Reject them "
         "with remarks. Each has a unique reference number and the student is "
         "notified of the change.",
q="""how do i process certificate requests
show pending document requests
change the status of a request
mark a certificate ready for collection
reject a document request
add remarks to a request
how many requests are pending
urgent requests
request queue
complete a request
find a request by reference number
request statistics
who raised this request
bulk update request status
overdue requests
issue a bonafide certificate
requests by type"""),

dict(key="admin_analytics", category="General", roles=["admin"],
response="The admin analytics view covers portal usage and the assistant itself — "
         "query volume, intent distribution, match rate, response latency, peak "
         "usage hours, thumbs-up/down feedback and the most-accessed knowledge "
         "documents.",
q="""show the analytics dashboard
how many queries has the chatbot answered
what are students asking most
intent distribution
chatbot match rate
peak usage hours
average response time
show feedback ratings
how many thumbs down
most accessed documents
usage statistics
which topics are most searched
unanswered queries
query volume this week
knowledge analytics
how many active users
report on chatbot performance
what category gets the most questions
response latency"""),

dict(key="admin_knowledge_manage", category="General", roles=["admin"],
response="You manage the knowledge base from the admin portal — adding "
         "regulations, handbooks, academic rules, placement policy, faculty info "
         "and FAQs under categories including Admissions, Attendance, Marks, Exams, "
         "Fees, Placements, Faculty, Hostel, Transport and Scholarships. Published "
         "documents become answerable by the assistant.",
q="""how do i upload a knowledge document
add a policy to the knowledge base
what categories can i file a document under
publish a knowledge article
edit a knowledge document
delete a document from the knowledge base
how does the chatbot use these documents
upload the student handbook
add an faq
tag a document
which documents are most used
draft knowledge article
add a section reference
knowledge base management
upload the placement policy
how do i add hostel information
document versioning
make a document searchable
add transport details to the knowledge base"""),

dict(key="admin_audit_log", category="General", roles=["admin"],
response="Administrative actions are written to a tamper-evident audit log with "
         "the actor, action, entity, a contextual snapshot, a timestamp and a hash "
         "chain. You can review it from the admin portal.",
q="""show the audit log
who made this change
audit trail
track admin actions
who published this notice
history of changes
can i see who deleted a record
audit log entries
is the audit log tamper proof
filter audit by action
when was this record modified
who approved this student
action history
audit report
security log
who edited the timetable
list recent admin activity"""),

# ══════════════════════════════════════════════════ OTHER ROLES ════════════
dict(key="parent_ward_progress", category="General", roles=["parent"],
response="The portal does not have a separate parent login — your ward's "
         "attendance, marks, CGPA and fee status are visible when they sign in to "
         "their own student account. Your contact details are held on their "
         "record. For anything you'd like to raise directly, use the Contact page "
         "to reach the Admin Office, the Accounts Office or the HOD, who reply "
         "within 1-2 working days.",
q="""how do i check my son's attendance
can i see my daughter's marks
parent login
i want to know my child's progress
how do parents access the portal
is there a parent portal
can i get updates about my ward
how do i track my son's performance
i am a parent how do i log in
my daughter's fee status
who do i contact as a parent
can i see my child's cgpa
parent access to results
how do i know if my son is attending classes
i want to speak to my ward's teacher
parent teacher meeting
will i be informed if attendance drops
can parents get notifications
my ward's exam results
how do i monitor my child's studies
parents login credentials
i want a progress report for my child"""),

dict(key="admission_enquiry", category="Admissions", roles=["applicant", "parent", "visitor"],
response="The portal doesn't have an online admissions module — it serves "
         "enrolled students, faculty and staff. Any admissions information we hold "
         "comes from the college knowledge base documents, and admission enquiries "
         "should go to the Admin Office through the Contact page.",
q="""how do i get admission
admission process
what is the eligibility for admission
when does admission start
application form for admission
admission fees
can i apply online
cutoff marks for admission
is there an entrance exam
last date to apply
how do i join this college
seats available
management quota
admission enquiry
what documents are needed for admission
counselling process
i want to apply for cse
first year admission
is direct admission possible
admission helpline
how do i get an application form
what percentage do i need to get in"""),

dict(key="alumni_records", category="General", roles=["alumni"],
response="There is no separate alumni login — the portal serves current students, "
         "faculty and staff. For a Provisional Certificate, a Transfer Certificate "
         "or a duplicate marksheet after graduation, contact the Admin Office "
         "through the Contact page and they will process it for you.",
q="""i am an alumnus how do i get my certificate
alumni login
i graduated last year and need my marksheet
how do i get my provisional certificate after passing out
alumni portal access
can old students log in
i need a duplicate degree certificate
former student certificate request
my account was deactivated after graduation
alumni records
how do i get my transcript
i passed out in 2023 and need documents
alumni association
can i still access my results
transcript for higher studies
i need a course completion certificate as an alumnus
degree certificate collection
old student id verification"""),

dict(key="visitor_campus_info", category="General", roles=["visitor"],
response="I mainly serve signed-in students, faculty and staff. For general "
         "enquiries — visiting the campus, meeting a department or reaching an "
         "office — you can use the Contact page to message the Admin Office, and "
         "the library is open Monday to Friday 8:00 AM to 6:00 PM and Saturday "
         "9:00 AM to 4:00 PM.",
q="""where is the college located
campus address
how do i visit the campus
can i meet a professor
visitor information
what facilities does the campus have
college phone number
directions to the college
is there a campus tour
who do i meet at the reception
general enquiry
i want to visit the department
can outsiders use the library
campus map
office working hours
how do i reach the college
is the campus open to public
enquiry about the college
i want information about the college"""),

# ══════════════════════════════════════════════════ CONVERSATIONAL ═════════
dict(key="greeting", category="General", roles=["student", "faculty", "admin", "parent", "visitor"],
response="Hello! I'm Campus HelpDesk, your college assistant. I can help with "
         "attendance, marks and CGPA, timetable, exams, fees, leave and OD, "
         "certificates, library, notices, events, faculty contacts and placements. "
         "What would you like to know?",
q="""hi
hello
hey
good morning
good afternoon
good evening
hi there
hello there
hey there
yo
greetings
hi campus helpdesk
hello bot
is anyone there
are you online
hey assistant
namaste
vanakkam
hi, are you available
hello, i need some help
good morning, i have a question
hey can we talk
hii
helo"""),

dict(key="thanks_goodbye", category="General", roles=["student", "faculty", "admin", "parent"],
response="You're welcome! Come back any time you need help with attendance, "
         "fees, exams, certificates or anything else on the portal.",
q="""thanks
thank you
thank you so much
thanks a lot
ok thanks
got it thanks
bye
goodbye
see you
that's all
no more questions
thanks for the help
appreciate it
perfect thank you
great thanks
cool thanks
thanks bye
that helps
you were helpful
nice, thank you
ok bye
alright thanks
thank u
tysm
thats all i needed"""),

dict(key="bot_capabilities", category="General", roles=["student", "faculty", "admin", "parent", "visitor"],
response="I'm the Campus HelpDesk assistant. I can answer questions about "
         "attendance, marks, CGPA and backlogs, timetable, exam schedules and hall "
         "tickets, fees and payments, leave and OD, certificate requests, library "
         "books and hours, notices, events, faculty and HOD contacts, your profile, "
         "placement readiness and eligibility, and the college knowledge base. "
         "I answer from your own records, so sign in first.",
q="""what can you do
help
how can you help me
what are you
who are you
what questions can i ask
list your features
what do you know
can you help me
what topics do you cover
are you a real person
what is campus helpdesk
show me what you can answer
give me some examples of questions
what all can i ask you
how do you work
what information do you have access to
can you access my records
do you know my marks
what services do you provide
menu
options
commands
what else can you do
i need help"""),

dict(key="out_of_scope_technical", category="General", roles=["student", "faculty", "admin", "visitor"],
response="I'm the Campus HelpDesk assistant, so I only help with college services "
         "— attendance, marks, fees, exams, certificates, library, notices and the "
         "like. I can't discuss how the portal is built or maintained. If "
         "something on the portal isn't working, report it to the Admin Office "
         "through the Contact page.",
q="""what database do you use
how is the backend built
which framework is the frontend using
show me the api endpoint
what is the database schema
how does authentication work
what ai model do you use
explain the system architecture
is this built with react
do you use mongodb
show me the source code
what is the tech stack
how is the password stored
give me the api documentation
which server is this hosted on
what programming language is used
how does the intent classification work
show me the code for attendance
what is the express route for login
how do you store the jwt token
can you explain the mongoose schema
is there a rest api i can call
what version of node is running
how do i deploy this application
show the git repository
what is the endpoint to fetch marks
how is the chatbot implemented
explain the machine learning model
what is the response format of the api
how do i connect to the database
technical documentation
developer guide"""),

dict(key="fallback_unsupported", category="General", roles=["student", "parent", "visitor", "faculty"],
response="I couldn't match that to anything the portal handles. I can help with "
         "attendance, marks and CGPA, timetable, exams, fees, leave and OD, "
         "certificates, library, notices, events, faculty contacts, your profile "
         "and placements. For anything else, the Contact page will reach the right "
         "office and you'll get a reply within 1-2 working days.",
q="""what is the weather today
tell me a joke
who won the match yesterday
can you order food for me
book a cab
what is the capital of france
solve this maths problem for me
write my assignment for me
do my homework
can you sing
what is the meaning of life
recommend a movie
translate this to tamil
what is the stock price
how do i cook biryani
tell me a story
who is the prime minister
play some music
can you call someone for me
send an email for me
what time is it in london
convert currency for me
give me the news headlines
help me with my personal problem
can you buy something online
what is 2 plus 2
random question
i don't know what to ask
something else
can you do anything else"""),
]

# Slot fill values keyed by placeholder name.
SLOTS = {
    "subject": SUBJECTS, "dept": DEPTS, "sem": SEMESTERS, "company": COMPANIES,
    "grade": GRADES, "day": DAYS, "evcat": EVENT_CATS, "skill": SKILLS,
}

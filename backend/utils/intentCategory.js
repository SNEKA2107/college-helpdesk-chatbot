// Maps a Copilot intent to a Knowledge Base category. Used to tag training-data
// rows (QueryLog.category) so the Knowledge Analytics can group queries by topic.
const INTENT_TO_CATEGORY = {
  performance: 'Placements',
  placement:   'Placements',
  exam:        'Exams',
  fees:        'Fees',
  attendance:  'Attendance',
  marks:       'Marks',
  notice:      'General',
  faculty:     'Faculty',
  contact:     'General',
  general:     'General',
};

function categoryForIntent(intent) {
  return INTENT_TO_CATEGORY[intent] || 'General';
}

module.exports = { categoryForIntent, INTENT_TO_CATEGORY };

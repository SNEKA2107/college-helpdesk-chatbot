const mongoose = require('mongoose');
const User = require('./models/User');
const { seedPassword } = require('./utils/seedPassword');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const user = await User.findOne({ studentId: 'ADMIN01' });
    if (!user) { console.log('❌ Admin not found'); return process.exit(1); }
    user.password = seedPassword('admin').password;
    user.mustChangePassword = true;
    await user.save();
    console.log('✅ Password reset to: admin@123');
    process.exit(0);
  })
  .catch(err => { console.error('❌', err.message); process.exit(1); });

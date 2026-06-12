const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const existing = await User.findOne({ studentId: 'ADMIN01' });
    if (existing) {
      console.log('✅ Admin already exists. Login with:');
      console.log('   Student ID : ADMIN01');
      console.log('   Password   : admin@123');
      return process.exit(0);
    }

    await User.create({
      name:       'Administrator',
      studentId:  'ADMIN01',
      email:      'admin@campusassist.edu',
      password:   'admin@123',
      department: 'Admin',
      role:       'admin',
    });

    console.log('✅ Admin account created!');
    console.log('   Student ID : ADMIN01');
    console.log('   Password   : admin@123');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });

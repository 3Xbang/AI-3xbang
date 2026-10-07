const bcrypt = require('bcrypt');

const password = 'admin123';
const hash = '$2b$10$9w9cI0wr1MQ5ceK0.LQhJu37cH2WCewSFT7MFsPsZ6tUk5hMYclRK';

bcrypt.compare(password, hash).then(result => {
  console.log('Password matches:', result);
  if (!result) {
    // 生成新的哈希
    bcrypt.hash(password, 10).then(newHash => {
      console.log('New hash for admin123:', newHash);
    });
  }
});

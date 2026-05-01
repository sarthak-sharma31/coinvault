import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const leaders = await User.find({ isBanned: false })
    .sort({ totalEarned: -1 })
    .limit(50)
    .select('username avatar totalEarned offersCompleted coins createdAt');
  res.json({ leaders });
});

export default router;

import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  const user = req.user.toSafeObject();
  const recentTx = await Transaction.find({ user: req.user._id })
    .sort({ createdAt: -1 }).limit(10);
  res.json({ user, recentTransactions: recentTx });
});

// GET /api/users/transactions
router.get('/transactions', protect, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const total = await Transaction.countDocuments({ user: req.user._id });
  const txs = await Transaction.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  res.json({ transactions: txs, total, pages: Math.ceil(total / limit), page });
});

// GET /api/users/referrals
router.get('/referrals', protect, async (req, res) => {
  const referrals = await User.find({ referredBy: req.user._id })
    .select('username avatar createdAt offersCompleted')
    .sort({ createdAt: -1 });
  res.json({
    referralCode: req.user.referralCode,
    referralLink: `${process.env.FRONTEND_URL}/register?ref=${req.user.referralCode}`,
    referrals,
    totalEarned: req.user.referralEarnings,
  });
});

// PUT /api/users/profile
router.put('/profile', protect, async (req, res) => {
  const { username, avatar } = req.body;
  const updates = {};
  if (username) {
    const exists = await User.findOne({ username, _id: { $ne: req.user._id } });
    if (exists) return res.status(409).json({ error: 'Username taken' });
    updates.username = username;
  }
  if (avatar) updates.avatar = avatar;

  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
  res.json({ user: user.toSafeObject() });
});

export default router;

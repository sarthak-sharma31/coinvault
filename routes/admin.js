import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Withdrawal from '../models/Withdrawal.js';

const router = express.Router();
router.use(protect, adminOnly);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const [totalUsers, totalWithdrawals, pendingWithdrawals, txCount] = await Promise.all([
    User.countDocuments(),
    Withdrawal.aggregate([{ $group: { _id: null, total: { $sum: '$usdValue' } } }]),
    Withdrawal.countDocuments({ status: 'pending' }),
    Transaction.countDocuments({ type: 'offer_complete' }),
  ]);

  res.json({
    totalUsers,
    totalWithdrawn: totalWithdrawals[0]?.total || 0,
    pendingWithdrawals,
    totalOfferCompletions: txCount,
  });
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const search = req.query.search;
  const query = search ? { $or: [{ username: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] } : {};

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(query),
  ]);

  res.json({ users: users.map(u => u.toSafeObject()), total, pages: Math.ceil(total / limit) });
});

// PUT /api/admin/users/:id/ban
router.put('/users/:id/ban', async (req, res) => {
  const { reason } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true, banReason: reason }, { new: true });
  res.json({ user: user.toSafeObject() });
});

// PUT /api/admin/users/:id/unban
router.put('/users/:id/unban', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: false, banReason: null }, { new: true });
  res.json({ user: user.toSafeObject() });
});

// PUT /api/admin/users/:id/adjust-coins
router.put('/users/:id/adjust-coins', async (req, res) => {
  const { coins, reason } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { $inc: { coins } }, { new: true });
  await Transaction.create({
    user: req.params.id, type: 'admin_adjust', coins, note: reason || 'Admin adjustment', status: 'completed',
  });
  res.json({ user: user.toSafeObject() });
});

// GET /api/admin/withdrawals
router.get('/withdrawals', async (req, res) => {
  const status = req.query.status || 'pending';
  const withdrawals = await Withdrawal.find({ status }).populate('user', 'username email').sort({ createdAt: -1 }).limit(100);
  res.json({ withdrawals });
});

// PUT /api/admin/withdrawals/:id
router.put('/withdrawals/:id', async (req, res) => {
  const { status, txHash, rejectionReason } = req.body;
  const w = await Withdrawal.findByIdAndUpdate(req.params.id, {
    status, txHash, rejectionReason, processedAt: new Date(), processedBy: req.user._id,
  }, { new: true });

  // If rejected, refund coins
  if (status === 'rejected') {
    await User.findByIdAndUpdate(w.user, { $inc: { coins: w.coins, totalWithdrawn: -w.coins } });
    await Transaction.create({
      user: w.user, type: 'admin_adjust', coins: w.coins, note: `Withdrawal refunded: ${rejectionReason}`, status: 'completed',
    });
  }

  res.json({ withdrawal: w });
});

export default router;

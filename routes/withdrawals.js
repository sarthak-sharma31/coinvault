import express from 'express';
import { protect } from '../middleware/auth.js';
import Withdrawal from '../models/Withdrawal.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

const router = express.Router();

const COINS_PER_DOLLAR = parseInt(process.env.COINS_PER_DOLLAR) || 1000;
const MIN_COINS = parseInt(process.env.MIN_WITHDRAWAL_COINS) || 10000; // $10 min

const CRYPTO_MINIMUMS = {
  bitcoin: 10000,   // $10
  ethereum: 5000,   // $5
  litecoin: 3000,   // $3
};

// POST /api/withdrawals - Request a withdrawal
router.post('/', protect, async (req, res) => {
  try {
    const { method, address, coins } = req.body;

    if (!['bitcoin', 'ethereum', 'litecoin'].includes(method))
      return res.status(400).json({ error: 'Invalid method' });

    if (!address || address.length < 10)
      return res.status(400).json({ error: 'Invalid crypto address' });

    const minCoins = CRYPTO_MINIMUMS[method] || MIN_COINS;
    if (coins < minCoins)
      return res.status(400).json({ error: `Minimum withdrawal is ${minCoins} coins ($${(minCoins / COINS_PER_DOLLAR).toFixed(2)})` });

    if (req.user.coins < coins)
      return res.status(400).json({ error: 'Insufficient coins' });

    const usdValue = coins / COINS_PER_DOLLAR;

    // Deduct coins
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { coins: -coins, totalWithdrawn: coins }
    });

    // Create withdrawal
    const withdrawal = await Withdrawal.create({
      user: req.user._id,
      coins,
      usdValue,
      method,
      address,
      status: 'pending',
    });

    // Record transaction
    await Transaction.create({
      user: req.user._id,
      type: 'withdrawal',
      coins: -coins,
      usdValue: -usdValue,
      status: 'pending',
      note: `${method} withdrawal to ${address.slice(0, 8)}...`,
    });

    res.status(201).json({ withdrawal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/withdrawals - My withdrawals
router.get('/', protect, async (req, res) => {
  const withdrawals = await Withdrawal.find({ user: req.user._id })
    .sort({ createdAt: -1 }).limit(50);
  res.json({ withdrawals });
});

export default router;

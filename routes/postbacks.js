import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

const router = express.Router();

const COINS_PER_DOLLAR = parseInt(process.env.COINS_PER_DOLLAR) || 1000;

/**
 * POSTBACK ENDPOINTS
 *
 * SETUP IN YOUR OFFERWALL DASHBOARDS:
 *
 * Offerwall.me: https://yourdomain.com/api/postback/offerwallme?user_id={userid}&amount={amount}&transaction_id={transaction_id}&secret=YOUR_OFFERWALLME_SECRET
 * Lootably:     https://yourdomain.com/api/postback/lootably?user_id={USER_ID}&amount={AMOUNT}&transaction_id={TRANSACTION_ID}&sig={SIG}
 * AdGate:       https://yourdomain.com/api/postback/adgate?uid={UID}&amount={AMOUNT}&oid={OID}&hash={HASH}
 * Torox:        https://yourdomain.com/api/postback/torox?user_id={USER_ID}&currency={CURRENCY}&transaction_id={TRANSACTION_ID}&secret=YOUR_TOROX_SECRET
 */

async function creditUser({ postbackId, offerwall, offerId, offerName, usdAmount, txId, ip }) {
  const user = await User.findOne({ postbackId });
  if (!user) return { ok: false, error: 'User not found' };
  if (user.isBanned) return { ok: false, error: 'User banned' };

  if (txId) {
    const existing = await Transaction.findOne({ transactionId: txId });
    if (existing) return { ok: false, error: 'Duplicate transaction' };
  }

  const coins = Math.floor(usdAmount * COINS_PER_DOLLAR);
  if (coins <= 0) return { ok: false, error: 'Zero coins' };

  await User.findByIdAndUpdate(user._id, {
    $inc: { coins, totalEarned: coins, offersCompleted: 1 }
  });

  await Transaction.create({
    user: user._id,
    type: 'offer_complete',
    coins,
    usdValue: usdAmount,
    offerwall,
    offerId,
    offerName: offerName || 'Offer',
    status: 'completed',
    transactionId: txId,
    ip,
  });

  if (user.referredBy) {
    const referralCoins = Math.floor(coins * 0.1);
    if (referralCoins > 0) {
      await User.findByIdAndUpdate(user.referredBy, {
        $inc: { coins: referralCoins, totalEarned: referralCoins, referralEarnings: referralCoins }
      });
      await Transaction.create({
        user: user.referredBy,
        type: 'referral_bonus',
        coins: referralCoins,
        usdValue: usdAmount * 0.1,
        offerwall,
        note: `Referral bonus from ${user.username}`,
        status: 'completed',
      });
    }
  }

  return { ok: true, coins, userId: user._id };
}

// ─── OFFERWALL.ME ────────────────────────────────────────────────
// Paste this into your Offerwall.me postback URL field:
// https://yourdomain.com/api/postback/offerwallme?user_id={userid}&amount={amount}&transaction_id={transaction_id}&secret=YOUR_OFFERWALLME_SECRET
router.get('/offerwallme', async (req, res) => {
  try {
    const { user_id, amount, transaction_id, secret } = req.query;

    if (secret !== process.env.OFFERWALLME_SECRET) {
      console.warn('[Offerwall.me] Invalid secret');
      return res.status(403).send('INVALID');
    }

    if (!user_id || !amount) return res.status(400).send('MISSING_PARAMS');

    const result = await creditUser({
      postbackId: user_id,
      offerwall: 'offerwallme',
      offerId: transaction_id,
      offerName: 'Offerwall.me Offer',
      usdAmount: parseFloat(amount),
      txId: transaction_id,
      ip: req.ip,
    });

    if (!result.ok) {
      console.warn('[Offerwall.me] Credit failed:', result.error);
      if (result.error === 'Duplicate transaction') return res.send('OK');
      return res.status(400).send('ERROR: ' + result.error);
    }

    console.log(`[Offerwall.me] Credited ${result.coins} coins to user ${result.userId}`);
    res.send('OK');
  } catch (err) {
    console.error('[Offerwall.me] Postback error:', err);
    res.status(500).send('ERROR');
  }
});

// ─── LOOTABLY ───────────────────────────────────────────────────
router.get('/lootably', async (req, res) => {
  try {
    const { user_id, amount, transaction_id, sig } = req.query;

    const expected = crypto
      .createHash('md5')
      .update(`${user_id}${amount}${transaction_id}${process.env.LOOTABLY_SECRET}`)
      .digest('hex');

    if (sig !== expected) {
      console.warn('[Lootably] Invalid signature');
      return res.status(403).send('INVALID_SIG');
    }

    const result = await creditUser({
      postbackId: user_id,
      offerwall: 'lootably',
      offerId: transaction_id,
      usdAmount: parseFloat(amount),
      txId: transaction_id,
      ip: req.ip,
    });

    if (!result.ok) return res.send('ERROR: ' + result.error);
    console.log(`[Lootably] Credited ${result.coins} coins to user ${result.userId}`);
    res.send('OK');
  } catch (err) {
    console.error('[Lootably] Postback error:', err);
    res.status(500).send('ERROR');
  }
});

// ─── ADGATE MEDIA ───────────────────────────────────────────────
router.get('/adgate', async (req, res) => {
  try {
    const { uid, amount, oid, hash } = req.query;

    const expected = crypto
      .createHash('sha1')
      .update(`${process.env.ADGATE_SECRET}${uid}${amount}`)
      .digest('hex');

    if (hash !== expected) {
      console.warn('[AdGate] Invalid hash');
      return res.status(403).send('invalid');
    }

    const result = await creditUser({
      postbackId: uid,
      offerwall: 'adgate',
      offerId: oid,
      usdAmount: parseFloat(amount),
      txId: oid,
      ip: req.ip,
    });

    if (!result.ok) return res.send('error');
    res.send('ok');
  } catch (err) {
    console.error('[AdGate] Postback error:', err);
    res.status(500).send('error');
  }
});

// ─── TOROX ──────────────────────────────────────────────────────
router.get('/torox', async (req, res) => {
  try {
    const { user_id, currency, transaction_id, secret } = req.query;

    if (secret !== process.env.TOROX_SECRET) {
      console.warn('[Torox] Invalid secret');
      return res.status(403).send('INVALID');
    }

    const usdAmount = parseFloat(currency) / 100;

    const result = await creditUser({
      postbackId: user_id,
      offerwall: 'torox',
      offerId: transaction_id,
      usdAmount,
      txId: transaction_id,
      ip: req.ip,
    });

    if (!result.ok) return res.send('error');
    res.send('1');
  } catch (err) {
    console.error('[Torox] Postback error:', err);
    res.status(500).send('0');
  }
});

export default router;
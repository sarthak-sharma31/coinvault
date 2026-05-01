import express from 'express';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const COINS_PER_DOLLAR = parseInt(process.env.COINS_PER_DOLLAR) || 1000;

router.get('/config', protect, async (req, res) => {
  const user = req.user;
  const pbId = user.postbackId;

  const config = {
    user: {
      id: user._id,
      username: user.username,
      coins: user.coins,
      postbackId: pbId,
    },
    walls: {
      offerwallme: {
        name: 'Offerwall.me',
        iframeUrl: `https://offerwall.me/offerwall/${process.env.OFFERWALLME_API_KEY}/${pbId}`,
        enabled: !!process.env.OFFERWALLME_API_KEY,
        description: 'Offers, tasks, games & shortlinks',
        color: '#00AEEF',
      },
      lootably: {
        name: 'Lootably',
        iframeUrl: `https://lootably.com/wall?placementid=${process.env.LOOTABLY_API_KEY}&userid=${pbId}`,
        enabled: !!process.env.LOOTABLY_API_KEY,
        description: 'Complete offers and games for coins',
        color: '#6C63FF',
      },
      adgate: {
        name: 'AdGate Media',
        iframeUrl: `https://wall.adgaterewards.com/${process.env.ADGATE_API_KEY}/${pbId}`,
        enabled: !!process.env.ADGATE_API_KEY,
        description: 'Top-rated offers and surveys',
        color: '#00C9A7',
      },
      torox: {
        name: 'Torox',
        iframeUrl: `https://torox.io/ifr/show/${process.env.TOROX_APP_ID}/${pbId}/torox`,
        enabled: !!process.env.TOROX_APP_ID,
        description: 'High-paying mobile offers',
        color: '#FFD60A',
      },
    },
    coinsPerDollar: COINS_PER_DOLLAR,
  };

  res.json(config);
});

export default router;
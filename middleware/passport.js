import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.googleId = profile.id;
        if (!user.avatar) user.avatar = profile.photos[0]?.value;
        await user.save();
      } else {
        // Create new user
        const base = profile.displayName.replace(/\s+/g, '').toLowerCase().slice(0, 15);
        let username = base;
        let count = 0;
        while (await User.findOne({ username })) {
          username = `${base}${++count}`;
        }
        user = await User.create({
          googleId: profile.id,
          email: profile.emails[0].value,
          username,
          avatar: profile.photos[0]?.value || '',
          isVerified: true,
        });
      }
    }

    done(null, user);
  } catch (err) {
    done(err, null);
  }
}));

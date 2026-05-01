import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    select: false,
  },
  googleId: String,
  avatar: { type: String, default: '' },
  
  // Coins & balance
  coins: { type: Number, default: 0, min: 0 },
  totalEarned: { type: Number, default: 0 },
  totalWithdrawn: { type: Number, default: 0 },

  // Referral system
  referralCode: { type: String, unique: true, default: () => uuidv4().slice(0, 8).toUpperCase() },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referralEarnings: { type: Number, default: 0 },

  // Stats
  offersCompleted: { type: Number, default: 0 },
  surveysCompleted: { type: Number, default: 0 },

  // Status
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  banReason: String,

  // Postback unique ID (used in offerwall subid)
  postbackId: { type: String, unique: true, default: () => uuidv4() },

  lastLogin: Date,
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

export default mongoose.model('User', userSchema);

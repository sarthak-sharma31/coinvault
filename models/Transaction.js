import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['offer_complete', 'survey_complete', 'referral_bonus', 'withdrawal', 'bonus', 'admin_adjust'],
    required: true,
  },
  coins: { type: Number, required: true }, // positive = credit, negative = debit
  usdValue: Number,

  // Offerwall info
  offerwall: {
    type: String,
    enum: ['lootably', 'cpalead', 'adgate', 'torox', 'offerwallme', null],
    default: null,
  },
  offerId: String,
  offerName: String,

  // Transaction meta
  status: {
    type: String,
    enum: ['pending', 'completed', 'rejected', 'on_hold'],
    default: 'completed',
  },
  ip: String,
  transactionId: { type: String, unique: true, sparse: true }, // External tx ID from offerwall
  note: String,
}, { timestamps: true });

transactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Transaction', transactionSchema);
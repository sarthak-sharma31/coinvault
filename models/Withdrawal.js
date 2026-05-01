import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coins: { type: Number, required: true },
  usdValue: { type: Number, required: true },

  method: {
    type: String,
    enum: ['bitcoin', 'ethereum', 'litecoin'],
    required: true,
  },
  address: { type: String, required: true },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending',
  },
  txHash: String, // Blockchain transaction hash
  rejectionReason: String,
  processedAt: Date,
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Withdrawal', withdrawalSchema);

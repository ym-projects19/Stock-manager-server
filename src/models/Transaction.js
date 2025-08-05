const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['check-in', 'check-out', 'adjustment', 'transfer'],
    required: true
  },
  inventory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  reference: {
    type: String,
    trim: true
  },
  cost: {
    type: Number,
    min: 0,
    default: 0
  },
  supplier: {
    name: String,
    contact: String
  },
  location: {
    from: String,
    to: String
  }
}, {
  timestamps: true
});

// Indexes for performance
transactionSchema.index({ school: 1 });
transactionSchema.index({ inventory: 1 });
transactionSchema.index({ user: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });

// Virtual for transaction value
transactionSchema.virtual('totalValue').get(function() {
  return Math.abs(this.quantity) * this.cost;
});

module.exports = mongoose.model('Transaction', transactionSchema);
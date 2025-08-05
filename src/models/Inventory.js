const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unit: {
    type: String,
    required: true,
    default: 'pieces'
  },
  minThreshold: {
    type: Number,
    default: 5
  },
  maxThreshold: {
    type: Number,
    default: 100
  },
  cost: {
    type: Number,
    min: 0,
    default: 0
  },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  location: {
    type: String,
    trim: true
  },
  barcode: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
inventorySchema.index({ school: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ name: 'text', description: 'text' });
inventorySchema.index({ quantity: 1 });
inventorySchema.index({ barcode: 1 });

// Virtual for stock status
inventorySchema.virtual('stockStatus').get(function() {
  if (this.quantity <= 0) return 'out-of-stock';
  if (this.quantity <= this.minThreshold) return 'low-stock';
  if (this.quantity >= this.maxThreshold) return 'overstock';
  return 'in-stock';
});

// Virtual for total value
inventorySchema.virtual('totalValue').get(function() {
  return this.quantity * this.cost;
});

// Update lastUpdated on save
inventorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Inventory', inventorySchema);
const express = require('express');
const Transaction = require('../models/Transaction');
const Inventory = require('../models/Inventory');
const { auth, checkPermission } = require('../middleware/auth');
const { validateTransaction } = require('../middleware/validation');

const router = express.Router();

// Get all transactions with pagination and filters
router.get('/', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type = '',
      inventory = '',
      user = '',
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { school: req.user.school._id };
    
    // Type filter
    if (type) {
      query.type = type;
    }
    
    // Inventory filter
    if (inventory) {
      query.inventory = inventory;
    }
    
    // User filter
    if (user) {
      query.user = user;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('inventory', 'name unit')
        .populate('user', 'name email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query)
    ]);

    res.json({
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

// Get single transaction
router.get('/:id', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      school: req.user.school._id
    })
    .populate('inventory', 'name unit category')
    .populate('user', 'name email')
    .populate({
      path: 'inventory',
      populate: {
        path: 'category',
        select: 'name color'
      }
    });
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transaction', error: error.message });
  }
});

// Create transaction (check-in/check-out/adjustment)
router.post('/', auth, checkPermission('canManageTransactions'), validateTransaction, async (req, res) => {
  try {
    const { type, inventory: inventoryId, quantity, reason, notes, cost = 0, supplier } = req.body;
    
    // Get inventory item
    const inventory = await Inventory.findOne({
      _id: inventoryId,
      school: req.user.school._id,
      isActive: true
    });
    
    if (!inventory) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    const previousQuantity = inventory.quantity;
    let newQuantity;
    let transactionQuantity;
    
    // Calculate new quantity based on transaction type
    switch (type) {
      case 'check-in':
        newQuantity = previousQuantity + quantity;
        transactionQuantity = quantity;
        break;
      case 'check-out':
        if (previousQuantity < quantity) {
          return res.status(400).json({ 
            message: 'Insufficient stock',
            available: previousQuantity,
            requested: quantity
          });
        }
        newQuantity = previousQuantity - quantity;
        transactionQuantity = -quantity;
        break;
      case 'adjustment':
        newQuantity = quantity;
        transactionQuantity = quantity - previousQuantity;
        break;
      default:
        return res.status(400).json({ message: 'Invalid transaction type' });
    }
    
    // Create transaction
    const transaction = new Transaction({
      type,
      inventory: inventoryId,
      school: req.user.school._id,
      user: req.user._id,
      quantity: transactionQuantity,
      previousQuantity,
      newQuantity,
      reason,
      notes,
      cost,
      supplier
    });
    
    // Update inventory quantity
    inventory.quantity = newQuantity;
    
    // Save both transaction and inventory
    await Promise.all([
      transaction.save(),
      inventory.save()
    ]);
    
    await transaction.populate([
      { path: 'inventory', select: 'name unit' },
      { path: 'user', select: 'name email' }
    ]);
    
    res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ message: 'Failed to create transaction', error: error.message });
  }
});

// Get transaction summary
router.get('/summary/stats', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = { school: req.user.school._id };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }
    
    const [
      totalTransactions,
      checkInCount,
      checkOutCount,
      adjustmentCount,
      recentTransactions
    ] = await Promise.all([
      Transaction.countDocuments(dateFilter),
      Transaction.countDocuments({ ...dateFilter, type: 'check-in' }),
      Transaction.countDocuments({ ...dateFilter, type: 'check-out' }),
      Transaction.countDocuments({ ...dateFilter, type: 'adjustment' }),
      Transaction.find(dateFilter)
        .populate('inventory', 'name')
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);
    
    res.json({
      summary: {
        total: totalTransactions,
        checkIn: checkInCount,
        checkOut: checkOutCount,
        adjustment: adjustmentCount
      },
      recent: recentTransactions
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transaction summary', error: error.message });
  }
});

module.exports = router;
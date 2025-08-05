const express = require('express');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const { auth, checkPermission } = require('../middleware/auth');
const { validateInventory } = require('../middleware/validation');

const router = express.Router();

// Get all inventory items with pagination and filters
router.get('/', auth, checkPermission('canManageInventory'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const query = { school: req.user.school._id, isActive: true };
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category) {
      query.category = category;
    }
    
    // Status filter
    if (status) {
      switch (status) {
        case 'low-stock':
          query.$expr = { $lte: ['$quantity', '$minThreshold'] };
          break;
        case 'out-of-stock':
          query.quantity = 0;
          break;
        case 'overstock':
          query.$expr = { $gte: ['$quantity', '$maxThreshold'] };
          break;
        case 'in-stock':
          query.$expr = {
            $and: [
              { $gt: ['$quantity', '$minThreshold'] },
              { $lt: ['$quantity', '$maxThreshold'] }
            ]
          };
          break;
      }
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, total] = await Promise.all([
      Inventory.find(query)
        .populate('category', 'name color')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Inventory.countDocuments(query)
    ]);

    res.json({
      items,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ message: 'Failed to fetch inventory', error: error.message });
  }
});

// Get single inventory item
router.get('/:id', auth, checkPermission('canManageInventory'), async (req, res) => {
  try {
    const item = await Inventory.findOne({
      _id: req.params.id,
      school: req.user.school._id
    }).populate('category', 'name color');
    
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch inventory item', error: error.message });
  }
});

// Create inventory item
router.post('/', auth, checkPermission('canManageInventory'), validateInventory, async (req, res) => {
  try {
    const inventoryData = {
      ...req.body,
      school: req.user.school._id
    };
    
    const item = new Inventory(inventoryData);
    await item.save();
    await item.populate('category', 'name color');
    
    // Create initial transaction if quantity > 0
    if (item.quantity > 0) {
      const transaction = new Transaction({
        type: 'check-in',
        inventory: item._id,
        school: req.user.school._id,
        user: req.user._id,
        quantity: item.quantity,
        previousQuantity: 0,
        newQuantity: item.quantity,
        reason: 'Initial stock',
        cost: item.cost || 0
      });
      await transaction.save();
    }
    
    res.status(201).json({
      message: 'Inventory item created successfully',
      item
    });
  } catch (error) {
    console.error('Create inventory error:', error);
    res.status(500).json({ message: 'Failed to create inventory item', error: error.message });
  }
});

// Update inventory item
router.put('/:id', auth, checkPermission('canManageInventory'), validateInventory, async (req, res) => {
  try {
    const item = await Inventory.findOne({
      _id: req.params.id,
      school: req.user.school._id
    });
    
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    const previousQuantity = item.quantity;
    Object.assign(item, req.body);
    await item.save();
    await item.populate('category', 'name color');
    
    // Create adjustment transaction if quantity changed
    if (previousQuantity !== item.quantity) {
      const transaction = new Transaction({
        type: 'adjustment',
        inventory: item._id,
        school: req.user.school._id,
        user: req.user._id,
        quantity: item.quantity - previousQuantity,
        previousQuantity,
        newQuantity: item.quantity,
        reason: 'Manual adjustment',
        cost: item.cost || 0
      });
      await transaction.save();
    }
    
    res.json({
      message: 'Inventory item updated successfully',
      item
    });
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ message: 'Failed to update inventory item', error: error.message });
  }
});

// Delete inventory item (soft delete)
router.delete('/:id', auth, checkPermission('canManageInventory'), async (req, res) => {
  try {
    const item = await Inventory.findOne({
      _id: req.params.id,
      school: req.user.school._id
    });
    
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    item.isActive = false;
    await item.save();
    
    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete inventory item', error: error.message });
  }
});

// Get low stock items
router.get('/alerts/low-stock', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const items = await Inventory.find({
      school: req.user.school._id,
      isActive: true,
      $expr: { $lte: ['$quantity', '$minThreshold'] }
    })
    .populate('category', 'name color')
    .sort({ quantity: 1 });
    
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch low stock items', error: error.message });
  }
});

module.exports = router;
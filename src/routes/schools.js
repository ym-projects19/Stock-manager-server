const express = require('express');
const School = require('../models/School');
const { auth, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Validation middleware for school update
const validateSchool = [
  body('name').trim().isLength({ min: 2 }).withMessage('School name must be at least 2 characters'),
  body('contact.email').optional().isEmail().withMessage('Valid email is required'),
  body('contact.phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
  body('settings.lowStockThreshold').optional().isInt({ min: 1 }).withMessage('Low stock threshold must be a positive integer'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }
    next();
  }
];

// Get school information
router.get('/me', auth, async (req, res) => {
  try {
    const school = await School.findById(req.user.school._id);
    
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    res.json(school);
  } catch (error) {
    console.error('Get school error:', error);
    res.status(500).json({ message: 'Failed to fetch school information', error: error.message });
  }
});

// Update school information (admin only)
router.put('/me', auth, adminOnly, validateSchool, async (req, res) => {
  try {
    const school = await School.findById(req.user.school._id);
    
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }
    
    const {
      name,
      address,
      contact,
      settings
    } = req.body;
    
    // Update school fields
    if (name) school.name = name;
    if (address) school.address = { ...school.address, ...address };
    if (contact) school.contact = { ...school.contact, ...contact };
    if (settings) school.settings = { ...school.settings, ...settings };
    
    await school.save();
    
    res.json({
      message: 'School information updated successfully',
      school
    });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ message: 'Failed to update school information', error: error.message });
  }
});

// Get school statistics (admin only)
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const User = require('../models/User');
    const Inventory = require('../models/Inventory');
    const Category = require('../models/Category');
    const Transaction = require('../models/Transaction');
    
    const schoolId = req.user.school._id;
    
    const [
      totalUsers,
      activeUsers,
      totalInventoryItems,
      totalCategories,
      totalTransactions,
      schoolInfo
    ] = await Promise.all([
      User.countDocuments({ school: schoolId }),
      User.countDocuments({ school: schoolId, isActive: true }),
      Inventory.countDocuments({ school: schoolId, isActive: true }),
      Category.countDocuments({ school: schoolId, isActive: true }),
      Transaction.countDocuments({ school: schoolId }),
      School.findById(schoolId)
    ]);
    
    res.json({
      school: {
        name: schoolInfo.name,
        createdAt: schoolInfo.createdAt
      },
      statistics: {
        users: {
          total: totalUsers,
          active: activeUsers
        },
        inventory: {
          items: totalInventoryItems,
          categories: totalCategories
        },
        transactions: {
          total: totalTransactions
        }
      }
    });
  } catch (error) {
    console.error('Get school stats error:', error);
    res.status(500).json({ message: 'Failed to fetch school statistics', error: error.message });
  }
});

module.exports = router;
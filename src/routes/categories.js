const express = require('express');
const Category = require('../models/Category');
const Inventory = require('../models/Inventory');
const { auth, checkPermission } = require('../middleware/auth');
const { validateCategory } = require('../middleware/validation');

const router = express.Router();

// Get all categories
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.find({
      school: req.user.school._id,
      isActive: true
    }).sort({ name: 1 });
    
    // Get item count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const itemCount = await Inventory.countDocuments({
          category: category._id,
          school: req.user.school._id,
          isActive: true
        });
        
        return {
          ...category.toObject(),
          itemCount
        };
      })
    );
    
    res.json(categoriesWithCount);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
});

// Get single category
router.get('/:id', auth, async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      school: req.user.school._id
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const itemCount = await Inventory.countDocuments({
      category: category._id,
      school: req.user.school._id,
      isActive: true
    });
    
    res.json({
      ...category.toObject(),
      itemCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch category', error: error.message });
  }
});

// Create category
router.post('/', auth, checkPermission('canManageCategories'), validateCategory, async (req, res) => {
  try {
    const categoryData = {
      ...req.body,
      school: req.user.school._id
    };
    
    const category = new Category(categoryData);
    await category.save();
    
    res.status(201).json({
      message: 'Category created successfully',
      category: {
        ...category.toObject(),
        itemCount: 0
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
});

// Update category
router.put('/:id', auth, checkPermission('canManageCategories'), validateCategory, async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      school: req.user.school._id
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    Object.assign(category, req.body);
    await category.save();
    
    const itemCount = await Inventory.countDocuments({
      category: category._id,
      school: req.user.school._id,
      isActive: true
    });
    
    res.json({
      message: 'Category updated successfully',
      category: {
        ...category.toObject(),
        itemCount
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Failed to update category', error: error.message });
  }
});

// Delete category (soft delete)
router.delete('/:id', auth, checkPermission('canManageCategories'), async (req, res) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      school: req.user.school._id
    });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Check if category has items
    const itemCount = await Inventory.countDocuments({
      category: category._id,
      school: req.user.school._id,
      isActive: true
    });
    
    if (itemCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with existing items',
        itemCount
      });
    }
    
    category.isActive = false;
    await category.save();
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete category', error: error.message });
  }
});

module.exports = router;
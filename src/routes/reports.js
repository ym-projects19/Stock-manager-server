const express = require('express');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { auth, checkPermission } = require('../middleware/auth');
const { buildWorkbook } = require('../utils/exporters/excel');
const { buildPdfBuffer } = require('../utils/exporters/pdf');

const router = express.Router();

// Dashboard statistics
router.get('/dashboard', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;
    
    const [
      totalItems,
      totalCategories,
      lowStockItems,
      outOfStockItems,
      totalValue,
      recentTransactions,
      categoryDistribution
    ] = await Promise.all([
      // Total active inventory items
      Inventory.countDocuments({ school: schoolId, isActive: true }),
      
      // Total active categories
      Category.countDocuments({ school: schoolId, isActive: true }),
      
      // Low stock items
      Inventory.countDocuments({
        school: schoolId,
        isActive: true,
        $expr: { $lte: ['$quantity', '$minThreshold'] }
      }),
      
      // Out of stock items
      Inventory.countDocuments({
        school: schoolId,
        isActive: true,
        quantity: 0
      }),
      
      // Total inventory value
      Inventory.aggregate([
        { $match: { school: schoolId, isActive: true } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$cost'] } } } }
      ]),
      
      // Recent transactions (last 5)
      Transaction.find({ school: schoolId })
        .populate('inventory', 'name')
        .populate('user', 'name')
        .sort({ createdAt: -1 })
        .limit(5),
      
      // Category distribution
      Inventory.aggregate([
        { $match: { school: schoolId, isActive: true } },
        { $group: { _id: '$category', count: { $sum: 1 }, totalValue: { $sum: { $multiply: ['$quantity', '$cost'] } } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { name: '$category.name', color: '$category.color', count: 1, totalValue: 1 } }
      ])
    ]);
    
    res.json({
      summary: {
        totalItems,
        totalCategories,
        lowStockItems,
        outOfStockItems,
        totalValue: totalValue[0]?.total || 0
      },
      recentTransactions,
      categoryDistribution
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
});

/**
 * Inventory report (JSON)
 */
router.get('/inventory', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const { category, status } = req.query;
    const schoolId = req.user.school._id;

    const query = { school: schoolId, isActive: true };

    if (category) {
      query.category = category;
    }

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
      }
    }

    const items = await Inventory.find(query)
      .populate('category', 'name color')
      .sort({ name: 1 });

    const summary = {
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + (item.quantity * item.cost), 0),
      lowStockCount: items.filter(item => item.quantity <= item.minThreshold).length,
      outOfStockCount: items.filter(item => item.quantity === 0).length
    };

    res.json({
      summary,
      items,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate inventory report', error: error.message });
  }
});

/**
 * Inventory report (Excel)
 */
router.get('/inventory/excel', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const { category, status } = req.query;
    const schoolId = req.user.school._id;

    const query = { school: schoolId, isActive: true };

    if (category) query.category = category;

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
      }
    }

    const items = await Inventory.find(query).populate('category', 'name color').sort({ name: 1 });

    const columns = ['Item Name', 'Category', 'Quantity', 'Unit', 'Min Threshold', 'Max Threshold', 'Unit Cost', 'Value'];
    const rows = items.map(i => [
      i.name,
      i.category?.name || '',
      i.quantity,
      i.unit,
      i.minThreshold,
      i.maxThreshold,
      i.cost,
      (i.quantity * i.cost),
    ]);

    const buffer = await buildWorkbook({
      type: 'Inventory',
      title: 'Inventory Report',
      columns,
      rows,
      numberFormats: { '3': '#,##0', '5': '#,##0', '6': '#,##0.00', '7': '#,##0.00' },
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-INVENTORY-${dateStr}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export inventory report', error: error.message });
  }
});

/**
 * Inventory report (PDF)
 */
router.get('/inventory/pdf', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const { category, status } = req.query;
    const schoolId = req.user.school._id;

    const query = { school: schoolId, isActive: true };

    if (category) query.category = category;

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
      }
    }

    const items = await Inventory.find(query).populate('category', 'name color').sort({ name: 1 });

    const columns = ['Item Name', 'Category', 'Quantity', 'Unit', 'Min Thresh', 'Max Thresh', 'Unit Cost', 'Value'];
    const rows = items.map(i => [
      i.name,
      i.category?.name || '',
      i.quantity,
      i.unit,
      i.minThreshold,
      i.maxThreshold,
      i.cost,
      (i.quantity * i.cost),
    ]);

    const buffer = await buildPdfBuffer({
      type: 'Inventory',
      title: 'Inventory Report',
      columns,
      rows,
      footerSchool: req.user.school?.name,
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-INVENTORY-${dateStr}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export inventory report PDF', error: error.message });
  }
});

/**
 * Transaction report (JSON)
 */
router.get('/transactions', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const { startDate, endDate, type, user } = req.query;
    const schoolId = req.user.school._id;

    const query = { school: schoolId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (type) query.type = type;
    if (user) query.user = user;

    const [transactions, summary] = await Promise.all([
      Transaction.find(query)
        .populate('inventory', 'name unit')
        .populate('user', 'name email')
        .sort({ createdAt: -1 }),

      Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalValue: { $sum: { $multiply: [{ $abs: '$quantity' }, '$cost'] } }
          }
        }
      ])
    ]);

    const summaryData = {
      totalTransactions: transactions.length,
      totalValue: summary.reduce((sum, item) => sum + item.totalValue, 0),
      byType: summary.reduce((acc, item) => {
        acc[item._id] = { count: item.count, value: item.totalValue };
        return acc;
      }, {})
    };

    res.json({
      summary: summaryData,
      transactions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate transaction report', error: error.message });
  }
});

/**
 * Transaction report (Excel)
 */
router.get('/transactions/excel', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const { startDate, endDate, type, user } = req.query;
    const schoolId = req.user.school._id;

    const query = { school: schoolId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (type) query.type = type;
    if (user) query.user = user;

    const transactions = await Transaction.find(query)
      .populate('inventory', 'name unit')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const columns = ['Date', 'Type', 'Item', 'Quantity', 'Unit', 'User', 'Unit Cost', 'Value'];
    const rows = transactions.map(t => {
      const qty = t.quantity;
      const cost = t.cost || 0;
      return [
        new Date(t.createdAt).toLocaleDateString(),
        t.type,
        t.inventory?.name || '',
        qty,
        t.inventory?.unit || '',
        t.user?.name || '',
        cost,
        Math.abs(qty) * cost,
      ];
    });

    const buffer = await buildWorkbook({
      type: 'Transactions',
      title: 'Transaction Report',
      columns,
      rows,
      numberFormats: { '4': '#,##0', '6': '#,##0.00', '7': '#,##0.00' },
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-TRANSACTIONS-${dateStr}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export transaction report', error: error.message });
  }
});

/**
 * Transaction report (PDF)
 */
router.get('/transactions/pdf', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const { startDate, endDate, type, user } = req.query;
    const schoolId = req.user.school._id;

    const query = { school: schoolId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (type) query.type = type;
    if (user) query.user = user;

    const transactions = await Transaction.find(query)
      .populate('inventory', 'name unit')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    const columns = ['Date', 'Type', 'Item', 'Quantity', 'Unit', 'User', 'Unit Cost', 'Value'];
    const rows = transactions.map(t => {
      const qty = t.quantity;
      const cost = t.cost || 0;
      return [
        new Date(t.createdAt).toLocaleDateString(),
        t.type,
        t.inventory?.name || '',
        qty,
        t.inventory?.unit || '',
        t.user?.name || '',
        cost,
        Math.abs(qty) * cost,
      ];
    });

    const buffer = await buildPdfBuffer({
      type: 'Transactions',
      title: 'Transaction Report',
      columns,
      rows,
      footerSchool: req.user.school?.name,
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-TRANSACTIONS-${dateStr}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export transaction report PDF', error: error.message });
  }
});

/**
 * Low stock report (JSON)
 */
router.get('/low-stock', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;
    
    const items = await Inventory.find({
      school: schoolId,
      isActive: true,
      $expr: { $lte: ['$quantity', '$minThreshold'] }
    })
    .populate('category', 'name color')
    .sort({ quantity: 1 });
    
    const recommendations = items.map(item => ({
      ...item.toObject(),
      recommendedOrder: Math.max(item.maxThreshold - item.quantity, item.minThreshold * 2),
      daysUntilEmpty: item.quantity > 0 ? Math.floor(item.quantity / (item.minThreshold * 0.1)) : 0
    }));
    
    res.json({
      summary: {
        totalLowStockItems: items.length,
        criticalItems: items.filter(item => item.quantity === 0).length,
        estimatedRestockValue: recommendations.reduce((sum, item) => 
          sum + (item.recommendedOrder * item.cost), 0)
      },
      items: recommendations,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate low stock report', error: error.message });
  }
});

/**
 * Low stock report (Excel)
 */
router.get('/low-stock/excel', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;

    const items = await Inventory.find({
      school: schoolId,
      isActive: true,
      $expr: { $lte: ['$quantity', '$minThreshold'] }
    })
      .populate('category', 'name color')
      .sort({ quantity: 1 });

    // Compute recommendedOrder same as JSON endpoint for parity
    const data = items.map(item => ({
      name: item.name,
      category: item.category?.name || '',
      quantity: item.quantity,
      unit: item.unit,
      minThreshold: item.minThreshold,
      recommendedOrder: Math.max(item.maxThreshold - item.quantity, item.minThreshold * 2),
      estimatedCost: Math.max(item.maxThreshold - item.quantity, item.minThreshold * 2) * (item.cost || 0),
      cost: item.cost || 0,
    }));

    const columns = ['Item Name', 'Category', 'Current Stock', 'Unit', 'Min Threshold', 'Recommended Order', 'Estimated Cost'];
    const rows = data.map(d => [
      d.name,
      d.category,
      d.quantity,
      d.unit,
      d.minThreshold,
      d.recommendedOrder,
      d.estimatedCost,
    ]);

    const buffer = await buildWorkbook({
      type: 'Low Stock',
      title: 'Low Stock Report',
      columns,
      rows,
      numberFormats: { '3': '#,##0', '5': '#,##0', '6': '#,##0.00' },
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-LOW-STOCK-${dateStr}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export low stock report', error: error.message });
  }
});

/**
 * Low stock report (PDF)
 */
router.get('/low-stock/pdf', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;

    const items = await Inventory.find({
      school: schoolId,
      isActive: true,
      $expr: { $lte: ['$quantity', '$minThreshold'] }
    })
      .populate('category', 'name color')
      .sort({ quantity: 1 });

    const columns = ['Item Name', 'Category', 'Current Stock', 'Unit', 'Min Threshold', 'Recommended Order', 'Estimated Cost'];
    const rows = items.map(item => {
      const recommendedOrder = Math.max(item.maxThreshold - item.quantity, item.minThreshold * 2);
      const estimatedCost = recommendedOrder * (item.cost || 0);
      return [
        item.name,
        item.category?.name || '',
        item.quantity,
        item.unit,
        item.minThreshold,
        recommendedOrder,
        estimatedCost,
      ];
    });

    const buffer = await buildPdfBuffer({
      type: 'Low Stock',
      title: 'Low Stock Report',
      columns,
      rows,
      footerSchool: req.user.school?.name,
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-LOW-STOCK-${dateStr}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export low stock report PDF', error: error.message });
  }
});

/**
 * Category performance report (JSON)
 */
router.get('/categories', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;

    const categoryStats = await Inventory.aggregate([
      { $match: { school: schoolId, isActive: true } },
      {
        $group: {
          _id: '$category',
          itemCount: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$cost'] } },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ['$quantity', '$minThreshold'] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          color: '$category.color',
          itemCount: 1,
          totalQuantity: 1,
          totalValue: 1,
          lowStockItems: 1,
          averageValue: { $divide: ['$totalValue', '$itemCount'] }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    res.json({
      categories: categoryStats,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate category report', error: error.message });
  }
});

/**
 * Category performance report (Excel)
 */
router.get('/categories/excel', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;

    const categoryStats = await Inventory.aggregate([
      { $match: { school: schoolId, isActive: true } },
      {
        $group: {
          _id: '$category',
          itemCount: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$cost'] } },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ['$quantity', '$minThreshold'] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          color: '$category.color',
          itemCount: 1,
          totalQuantity: 1,
          totalValue: 1,
          lowStockItems: 1,
          averageValue: { $divide: ['$totalValue', '$itemCount'] }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    const columns = ['Category', 'Item Count', 'Total Quantity', 'Total Value', 'Low Stock Items', 'Avg Value'];
    const rows = categoryStats.map(c => [
      c.name,
      c.itemCount,
      c.totalQuantity,
      c.totalValue,
      c.lowStockItems,
      c.averageValue,
    ]);

    const buffer = await buildWorkbook({
      type: 'Categories',
      title: 'Category Performance Report',
      columns,
      rows,
      numberFormats: { '2': '#,##0', '3': '#,##0.00', '5': '#,##0.00' },
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report-CATEGORIES-${dateStr}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export category report', error: error.message });
  }
});

/**
 * Category performance report (PDF)
 */
router.get('/categories/pdf', auth, checkPermission('canViewReports'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;

    const categoryStats = await Inventory.aggregate([
      { $match: { school: schoolId, isActive: true } },
      {
        $group: {
          _id: '$category',
          itemCount: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$cost'] } },
          lowStockItems: {
            $sum: {
              $cond: [{ $lte: ['$quantity', '$minThreshold'] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $project: {
          name: '$category.name',
          color: '$category.color',
          itemCount: 1,
          totalQuantity: 1,
          totalValue: 1,
          lowStockItems: 1,
          averageValue: { $divide: ['$totalValue', '$itemCount'] }
        }
      },
      { $sort: { totalValue: -1 } }
    ]);

    const columns = ['Category', 'Item Count', 'Total Quantity', 'Total Value', 'Low Stock Items', 'Avg Value'];
    const rows = categoryStats.map(c => [
      c.name,
      c.itemCount,
      c.totalQuantity,
      c.totalValue,
      c.lowStockItems,
      c.averageValue,
    ]);

    const buffer = await buildPdfBuffer({
      type: 'Categories',
      title: 'Category Performance Report',
      columns,
      rows,
      footerSchool: req.user.school?.name,
      createdAt: new Date(),
    });

    const dateStr = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-CATEGORIES-${dateStr}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ message: 'Failed to export category report PDF', error: error.message });
  }
});

module.exports = router;

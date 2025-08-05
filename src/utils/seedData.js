const mongoose = require('mongoose');
const School = require('../models/School');
const User = require('../models/User');
const Category = require('../models/Category');
const Inventory = require('../models/Inventory');
const Transaction = require('../models/Transaction');

const seedData = async () => {
  try {
    console.log('Starting database seeding...');
    
    // Clear existing data
    await Promise.all([
      School.deleteMany({}),
      User.deleteMany({}),
      Category.deleteMany({}),
      Inventory.deleteMany({}),
      Transaction.deleteMany({})
    ]);
    
    // Create demo school
    const school = new School({
      name: 'Demo',
      address: {
        street: '123 Education Street',
        city: 'Learning City',
        state: 'Knowledge State',
        zipCode: '12345',
        country: 'Education Land'
      },
      contact: {
        phone: '+1-555-0123',
        email: 'info@playschool.com',
        website: 'www.playschool.com'
      },
      settings: {
        lowStockThreshold: 10,
        currency: 'INR',
        timezone: 'IST'
      }
    });
    await school.save();
    console.log('✓ School created');
    
    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@playschool.com',
      password: 'admin123',
      role: 'admin',
      school: school._id
    });
    adminUser.setAdminPermissions();
    await adminUser.save();
    console.log('✓ Admin user created');
    
    // Create staff user
    const staffUser = new User({
      name: 'Jane Smith',
      email: 'jane@playschool.com',
      password: 'staff123',
      role: 'staff',
      school: school._id,
      permissions: {
        canManageInventory: true,
        canManageCategories: false,
        canManageUsers: false,
        canViewReports: true,
        canManageTransactions: true
      }
    });
    await staffUser.save();
    console.log('✓ Staff user created');
    
    // Create categories
    const categories = [
      { name: 'Classroom 1', description: 'Items for Classroom 1', color: '#FF5722' },
      { name: 'Arts & Crafts', description: 'Art supplies and craft materials', color: '#9C27B0' },
      { name: 'Outdoor Play', description: 'Outdoor playground equipment', color: '#4CAF50' },
      { name: 'Kitchen Supplies', description: 'Kitchen and food preparation items', color: '#FF9800' },
      { name: 'Office Supplies', description: 'Administrative and office materials', color: '#2196F3' }
    ];
    
    const createdCategories = [];
    for (const categoryData of categories) {
      const category = new Category({
        ...categoryData,
        school: school._id
      });
      await category.save();
      createdCategories.push(category);
    }
    console.log('✓ Categories created');
    
    // Create inventory items
    const inventoryItems = [
      {
        name: 'Colored Pencils',
        description: '24-pack colored pencils for art activities',
        category: createdCategories[1]._id, // Arts & Crafts
        quantity: 15,
        unit: 'packs',
        minThreshold: 5,
        maxThreshold: 30,
        cost: 3.99,
        supplier: { name: 'Art Supply Co', contact: '555-0101' },
        location: 'Art Room Cabinet A'
      },
      {
        name: 'Construction Paper',
        description: 'Assorted colors construction paper',
        category: createdCategories[1]._id, // Arts & Crafts
        quantity: 8,
        unit: 'packs',
        minThreshold: 10,
        maxThreshold: 25,
        cost: 5.49,
        supplier: { name: 'Paper Plus', contact: '555-0102' },
        location: 'Art Room Shelf B'
      },
      {
        name: 'Soccer Balls',
        description: 'Size 3 soccer balls for outdoor play',
        category: createdCategories[2]._id, // Outdoor Play
        quantity: 4,
        unit: 'pieces',
        minThreshold: 3,
        maxThreshold: 8,
        cost: 12.99,
        supplier: { name: 'Sports Equipment Ltd', contact: '555-0103' },
        location: 'Equipment Shed'
      },
      {
        name: 'Playground Chalk',
        description: 'Sidewalk chalk for outdoor activities',
        category: createdCategories[2]._id, // Outdoor Play
        quantity: 12,
        unit: 'boxes',
        minThreshold: 6,
        maxThreshold: 20,
        cost: 2.99,
        supplier: { name: 'Outdoor Fun Co', contact: '555-0104' },
        location: 'Outdoor Storage'
      },
      {
        name: 'Paper Towels',
        description: 'Absorbent paper towels for cleanup',
        category: createdCategories[3]._id, // Kitchen Supplies
        quantity: 24,
        unit: 'rolls',
        minThreshold: 12,
        maxThreshold: 40,
        cost: 1.99,
        supplier: { name: 'Cleaning Supplies Inc', contact: '555-0105' },
        location: 'Kitchen Storage'
      },
      {
        name: 'Disposable Cups',
        description: '8oz disposable cups for snack time',
        category: createdCategories[3]._id, // Kitchen Supplies
        quantity: 2,
        unit: 'packs',
        minThreshold: 5,
        maxThreshold: 15,
        cost: 4.99,
        supplier: { name: 'Party Supply Store', contact: '555-0106' },
        location: 'Kitchen Cabinet'
      },
      {
        name: 'Copy Paper',
        description: 'White copy paper for printing',
        category: createdCategories[4]._id, // Office Supplies
        quantity: 6,
        unit: 'reams',
        minThreshold: 3,
        maxThreshold: 12,
        cost: 7.99,
        supplier: { name: 'Office Depot', contact: '555-0107' },
        location: 'Office Supply Closet'
      },
      {
        name: 'Markers',
        description: 'Washable markers for classroom activities',
        category: createdCategories[0]._id, // Classroom 1
        quantity: 18,
        unit: 'sets',
        minThreshold: 8,
        maxThreshold: 25,
        cost: 6.99,
        supplier: { name: 'School Supply Co', contact: '555-0108' },
        location: 'Classroom 1 Supply Cabinet'
      }
    ];
    
    const createdItems = [];
    for (const itemData of inventoryItems) {
      const item = new Inventory({
        ...itemData,
        school: school._id
      });
      await item.save();
      createdItems.push(item);
      
      // Create initial stock transaction
      const transaction = new Transaction({
        type: 'check-in',
        inventory: item._id,
        school: school._id,
        user: adminUser._id,
        quantity: item.quantity,
        previousQuantity: 0,
        newQuantity: item.quantity,
        reason: 'Initial stock',
        cost: item.cost
      });
      await transaction.save();
    }
    console.log('✓ Inventory items and initial transactions created');
    
    // Create some additional sample transactions
    const sampleTransactions = [
      {
        type: 'check-out',
        inventory: createdItems[0]._id, // Colored Pencils
        user: staffUser._id,
        quantity: 3,
        reason: 'Art class activity'
      },
      {
        type: 'check-out',
        inventory: createdItems[5]._id, // Disposable Cups
        user: staffUser._id,
        quantity: 1,
        reason: 'Snack time'
      },
      {
        type: 'check-in',
        inventory: createdItems[4]._id, // Paper Towels
        user: adminUser._id,
        quantity: 6,
        reason: 'Weekly supply delivery'
      }
    ];
    
    for (const transData of sampleTransactions) {
      const item = await Inventory.findById(transData.inventory);
      const previousQuantity = item.quantity;
      let newQuantity;
      
      if (transData.type === 'check-out') {
        newQuantity = previousQuantity - transData.quantity;
        item.quantity = newQuantity;
      } else if (transData.type === 'check-in') {
        newQuantity = previousQuantity + transData.quantity;
        item.quantity = newQuantity;
      }
      
      await item.save();
      
      const transaction = new Transaction({
        ...transData,
        school: school._id,
        previousQuantity,
        newQuantity,
        quantity: transData.type === 'check-out' ? -transData.quantity : transData.quantity,
        cost: item.cost
      });
      await transaction.save();
    }
    console.log('✓ Sample transactions created');
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\nDemo Credentials:');
    console.log('Admin: admin@playschool.com / admin123');
    console.log('Staff: jane@playschool.com / staff123');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

// Run seeding if called directly
if (require.main === module) {
  require('dotenv').config();
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/playschool-stock')
    .then(() => {
      console.log('Connected to MongoDB');
      return seedData();
    })
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Seeding error:', error);
      process.exit(1);
    });
}

module.exports = seedData;
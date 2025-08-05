const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('schoolName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('School name must be at least 2 characters long'),
  handleValidationErrors
];

const validateInventory = [
  body('name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Item name is required'),
  body('quantity')
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  body('unit')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Unit is required'),
  body('minThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Minimum threshold must be a non-negative integer'),
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost must be a non-negative number'),
  handleValidationErrors
];

const validateCategory = [
  body('name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Category name is required'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color'),
  handleValidationErrors
];

const validateTransaction = [
  body('type')
    .isIn(['check-in', 'check-out', 'adjustment', 'transfer'])
    .withMessage('Invalid transaction type'),
  body('inventory')
    .isMongoId()
    .withMessage('Valid inventory ID is required'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),
  handleValidationErrors
];

module.exports = {
  validateLogin,
  validateRegister,
  validateInventory,
  validateCategory,
  validateTransaction,
  handleValidationErrors
};
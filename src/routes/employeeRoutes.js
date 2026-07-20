const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const agencyMiddleware = require('../middlewares/agencyMiddleware');
const employeeController = require('../controllers/employeeController');

const router = express.Router();

router.use(authMiddleware, agencyMiddleware);

router.post('/', employeeController.createEmployee);
router.get('/', employeeController.listEmployees);
router.get('/:id', employeeController.getEmployee);
router.patch('/:id/permissions', employeeController.updatePermissions);
router.patch('/:id/password', employeeController.changePassword);
router.patch('/:id/disable', employeeController.disableEmployee);
router.patch('/:id/enable', employeeController.enableEmployee);
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;

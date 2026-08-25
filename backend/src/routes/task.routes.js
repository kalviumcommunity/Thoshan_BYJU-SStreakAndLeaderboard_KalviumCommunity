const express = require('express');
const { verifyFirebaseToken } = require('../middlewares/auth.middleware');
const taskController = require('../controllers/task.controller');

const router = express.Router();

// Apply auth middleware to all task routes
router.use(verifyFirebaseToken);

// Task CRUD
router.post('/', taskController.createTask);
router.get('/', taskController.getTasks);
router.get('/completions', taskController.getCompletions);
router.post('/toggle', taskController.toggleCompletion);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;

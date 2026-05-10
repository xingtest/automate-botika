const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all workflow routes
router.use(authenticateToken);

// Node types
router.get('/node-types', workflowController.listNodeTypes);
router.get('/node-types/:type', workflowController.getNodeTypeSchema);
router.get('/node-registry/status', workflowController.getNodeRegistryStatus);

// Templates
router.get('/templates', workflowController.listTemplates);
router.get('/templates/:id', workflowController.getTemplate);
router.post('/templates', workflowController.createTemplate);

// Executions (General)
router.get('/executions', workflowController.listExecutions);

// Validation
router.post('/validate', workflowController.validateWorkflow);

// Workflow CRUD
router.post('/', workflowController.createWorkflow);
router.get('/', workflowController.listWorkflows);
router.get('/shared', workflowController.listSharedWorkflows);
router.get('/:id', workflowController.getWorkflow);
router.put('/:id', workflowController.updateWorkflow);
router.delete('/:id', workflowController.deleteWorkflow);
router.post('/:id/duplicate', workflowController.duplicateWorkflow);

// Workflow-specific Executions
router.post('/:id/execute', workflowController.executeWorkflow);
router.get('/executions/:executionId', workflowController.getExecutionDetails);
router.post('/executions/:executionId/cancel', workflowController.cancelExecution);
router.get('/executions/:executionId/logs', workflowController.getExecutionLogs);

// Version history
router.get('/:id/versions', workflowController.getVersionHistory);
router.post('/:id/revert/:version', workflowController.revertToVersion);

// Sharing and permissions
router.post('/:id/share', workflowController.shareWorkflow);
router.get('/:id/permissions', workflowController.getPermissions);
router.post('/:id/permissions', workflowController.grantPermission);
router.delete('/:id/permissions/:userId', workflowController.revokePermission);

module.exports = router;

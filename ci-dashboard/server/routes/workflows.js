const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/workflow.controller');

// Workflow CRUD
router.post('/', workflowController.createWorkflow);
router.get('/', workflowController.listWorkflows);
router.get('/shared', workflowController.listSharedWorkflows);
router.get('/:id', workflowController.getWorkflow);
router.put('/:id', workflowController.updateWorkflow);
router.delete('/:id', workflowController.deleteWorkflow);
router.post('/:id/duplicate', workflowController.duplicateWorkflow);

// Version history
router.get('/:id/versions', workflowController.getVersionHistory);
router.post('/:id/revert/:version', workflowController.revertToVersion);

// Execution
router.post('/:id/execute', workflowController.executeWorkflow);
router.get('/executions', workflowController.listExecutions);
router.get('/executions/:executionId', workflowController.getExecutionDetails);
router.post('/executions/:executionId/cancel', workflowController.cancelExecution);
router.get('/executions/:executionId/logs', workflowController.getExecutionLogs);

// Validation
router.post('/validate', workflowController.validateWorkflow);

// Node types
router.get('/node-types', workflowController.listNodeTypes);
router.get('/node-types/:type', workflowController.getNodeTypeSchema);

// Templates
router.get('/templates', workflowController.listTemplates);
router.get('/templates/:id', workflowController.getTemplate);
router.post('/templates', workflowController.createTemplate);

// Sharing and permissions
router.post('/:id/share', workflowController.shareWorkflow);
router.get('/:id/permissions', workflowController.getPermissions);
router.post('/:id/permissions', workflowController.grantPermission);
router.delete('/:id/permissions/:userId', workflowController.revokePermission);

module.exports = router;

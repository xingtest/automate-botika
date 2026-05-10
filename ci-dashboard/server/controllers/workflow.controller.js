const { pool: db } = require('../db');
const { v4: uuidv4 } = require('uuid');
const workflowValidator = require('../services/workflow-validator');
const executionEngine = require('../services/execution-engine');
const nodeRegistry = require('../services/node-registry');

// Helper function to check workflow ownership or permissions
async function checkWorkflowAccess(workflowId, userId, requiredPermission = 'view') {
  const workflowResult = await db.queryOriginal(
    'SELECT user_id FROM workflows WHERE id = $1',
    [workflowId]
  );
  
  if (workflowResult.rows.length === 0) {
    return { hasAccess: false, isOwner: false };
  }
  
  const workflow = workflowResult.rows[0];
  const isOwner = workflow.user_id === userId;
  
  if (isOwner) {
    return { hasAccess: true, isOwner: true };
  }
  
  // Check permissions
  const permResult = await db.queryOriginal(
    'SELECT permission FROM workflow_permissions WHERE workflow_id = $1 AND user_id = $2',
    [workflowId, userId]
  );
  
  if (permResult.rows.length === 0) {
    return { hasAccess: false, isOwner: false };
  }
  
  const permissions = permResult.rows.map(r => r.permission);
  const hasAccess = permissions.includes(requiredPermission) || 
                    (requiredPermission === 'view' && permissions.length > 0);
  
  return { hasAccess, isOwner: false };
}

// Create workflow
exports.createWorkflow = async (req, res) => {
  try {
    const userId = req.user?.id || 1; // Default to user 1 if no auth
    const { name, description, definition, canvas_state, is_template } = req.body;
    
    if (!name || !definition) {
      return res.status(400).json({ error: 'Name and definition are required' });
    }
    
    // Validate workflow definition (warnings only for saving)
    const validation = workflowValidator.validate(definition);
    // We allow saving even if invalid, but you won't be able to run it
    
    const result = await db.queryOriginal(
      `INSERT INTO workflows (user_id, name, description, definition, canvas_state, is_template, version)
       VALUES ($1, $2, $3, $4, $5, $6, 1)
       RETURNING id, name, version, created_at`,
      [userId, name, description || null, JSON.stringify(definition), JSON.stringify(canvas_state || {}), is_template || false]
    );
    
    const workflow = result.rows[0];
    
    // Create initial version
    await db.queryOriginal(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by, change_description)
       VALUES ($1, 1, $2, $3, 'Initial version')`,
      [workflow.id, JSON.stringify(definition), userId]
    );
    
    // Log activity
    await db.queryOriginal(
      `INSERT INTO activity_logs (user_id, title, description, type)
       VALUES ($1, $2, $3, 'workflow')`,
      [userId, 'Workflow Created', `Created workflow: ${name}`]
    );
    
    res.status(201).json(workflow);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Failed to create workflow', message: error.message });
  }
};

// List workflows
exports.listWorkflows = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { is_template, search, sort_by = 'updated_at', sort_order = 'DESC' } = req.query;
    
    let query = `
      SELECT id, name, description, version, is_template, is_public, 
             thumbnail_path, created_at, updated_at,
             (SELECT COUNT(*) FROM jsonb_array_elements(definition->'nodes')) as node_count
      FROM workflows
      WHERE user_id = $1
    `;
    
    const params = [userId];
    
    if (is_template !== undefined) {
      params.push(is_template === 'true');
      query += ` AND is_template = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR description ILIKE $${params.length})`;
    }
    
    query += ` ORDER BY ${sort_by} ${sort_order}`;
    
    const result = await db.queryOriginal(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing workflows:', error);
    res.status(500).json({ error: 'Failed to list workflows', message: error.message });
  }
};

// List shared workflows
exports.listSharedWorkflows = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    
    const result = await db.queryOriginal(
      `SELECT w.id, w.name, w.description, w.version, w.thumbnail_path, 
              w.created_at, w.updated_at, wp.permission,
              u.username as owner_username,
              (SELECT COUNT(*) FROM jsonb_array_elements(w.definition->'nodes')) as node_count
       FROM workflows w
       JOIN workflow_permissions wp ON w.id = wp.workflow_id
       JOIN users u ON w.user_id = u.id
       WHERE wp.user_id = $1
       ORDER BY w.updated_at DESC`,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing shared workflows:', error);
    res.status(500).json({ error: 'Failed to list shared workflows', message: error.message });
  }
};

// Get workflow by ID
exports.getWorkflow = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    
    const access = await checkWorkflowAccess(id, userId, 'view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await db.queryOriginal(
      `SELECT w.*, u.username as owner_username
       FROM workflows w
       JOIN users u ON w.user_id = u.id
       WHERE w.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting workflow:', error);
    res.status(500).json({ error: 'Failed to get workflow', message: error.message });
  }
};

// Update workflow
exports.updateWorkflow = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const { name, description, definition, canvas_state } = req.body;
    
    const access = await checkWorkflowAccess(id, userId, 'edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Validate if definition is provided (warnings only for saving)
    if (definition) {
      const validation = workflowValidator.validate(definition);
    }
    
    // Get current version
    const currentResult = await db.queryOriginal('SELECT version, definition FROM workflows WHERE id = $1', [id]);
    const currentVersion = currentResult.rows[0].version;
    const newVersion = currentVersion + 1;
    
    // Update workflow
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (name) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(description);
    }
    if (definition) {
      updateFields.push(`definition = $${paramIndex++}`);
      updateValues.push(JSON.stringify(definition));
      updateFields.push(`version = $${paramIndex++}`);
      updateValues.push(newVersion);
    }
    if (canvas_state) {
      updateFields.push(`canvas_state = $${paramIndex++}`);
      updateValues.push(JSON.stringify(canvas_state));
    }
    
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(id);
    
    const result = await db.queryOriginal(
      `UPDATE workflows SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateValues
    );
    
    // Create version snapshot if definition changed
    if (definition) {
      await db.queryOriginal(
        `INSERT INTO workflow_versions (workflow_id, version, definition, created_by, change_description)
         VALUES ($1, $2, $3, $4, 'Updated workflow')`,
        [id, newVersion, JSON.stringify(definition), userId]
      );
    }
    
    // Log activity
    await db.queryOriginal(
      `INSERT INTO activity_logs (user_id, title, description, type)
       VALUES ($1, $2, $3, 'workflow')`,
      [userId, 'Workflow Updated', `Updated workflow: ${name || id}`]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Failed to update workflow', message: error.message });
  }
};

// Delete workflow
exports.deleteWorkflow = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    
    const access = await checkWorkflowAccess(id, userId);
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only owner can delete workflow' });
    }
    
    await db.queryOriginal('DELETE FROM workflows WHERE id = $1', [id]);
    
    // Log activity
    await db.queryOriginal(
      `INSERT INTO activity_logs (user_id, title, description, type)
       VALUES ($1, $2, $3, 'workflow')`,
      [userId, 'Workflow Deleted', `Deleted workflow ID: ${id}`]
    );
    
    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Failed to delete workflow', message: error.message });
  }
};

// Duplicate workflow
exports.duplicateWorkflow = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const { name } = req.body;
    
    const access = await checkWorkflowAccess(id, userId, 'view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const sourceResult = await db.queryOriginal('SELECT * FROM workflows WHERE id = $1', [id]);
    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    const source = sourceResult.rows[0];
    const newName = name || `${source.name} (Copy)`;
    
    const result = await db.queryOriginal(
      `INSERT INTO workflows (user_id, name, description, definition, canvas_state, version)
       VALUES ($1, $2, $3, $4, $5, 1)
       RETURNING id, name, version, created_at`,
      [userId, newName, source.description, source.definition, source.canvas_state]
    );
    
    const newWorkflow = result.rows[0];
    
    // Create initial version
    await db.queryOriginal(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by, change_description)
       VALUES ($1, 1, $2, $3, 'Duplicated from workflow ${id}')`,
      [newWorkflow.id, source.definition, userId]
    );
    
    res.status(201).json(newWorkflow);
  } catch (error) {
    console.error('Error duplicating workflow:', error);
    res.status(500).json({ error: 'Failed to duplicate workflow', message: error.message });
  }
};

// Get version history
exports.getVersionHistory = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    
    const access = await checkWorkflowAccess(id, userId, 'view');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await db.queryOriginal(
      `SELECT wv.*, u.username as created_by_username
       FROM workflow_versions wv
       LEFT JOIN users u ON wv.created_by = u.id
       WHERE wv.workflow_id = $1
       ORDER BY wv.version DESC`,
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting version history:', error);
    res.status(500).json({ error: 'Failed to get version history', message: error.message });
  }
};

// Revert to version
exports.revertToVersion = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id, version } = req.params;
    
    const access = await checkWorkflowAccess(id, userId, 'edit');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get the version to revert to
    const versionResult = await db.queryOriginal(
      'SELECT definition FROM workflow_versions WHERE workflow_id = $1 AND version = $2',
      [id, version]
    );
    
    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Version not found' });
    }
    
    const definition = versionResult.rows[0].definition;
    
    // Get current version
    const currentResult = await db.queryOriginal('SELECT version FROM workflows WHERE id = $1', [id]);
    const newVersion = currentResult.rows[0].version + 1;
    
    // Update workflow
    await db.queryOriginal(
      `UPDATE workflows SET definition = $1, version = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [definition, newVersion, id]
    );
    
    // Create new version entry
    await db.queryOriginal(
      `INSERT INTO workflow_versions (workflow_id, version, definition, created_by, change_description)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, newVersion, definition, userId, `Reverted to version ${version}`]
    );
    
    res.json({ message: 'Workflow reverted successfully', version: newVersion });
  } catch (error) {
    console.error('Error reverting workflow:', error);
    res.status(500).json({ error: 'Failed to revert workflow', message: error.message });
  }
};

// Execute workflow
exports.executeWorkflow = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const { trigger_data } = req.body;
    
    const access = await checkWorkflowAccess(id, userId, 'execute');
    if (!access.hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get workflow
    const workflowResult = await db.queryOriginal('SELECT * FROM workflows WHERE id = $1', [id]);
    if (workflowResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    const workflow = workflowResult.rows[0];
    
    // Validate workflow
    const validation = workflowValidator.validate(workflow.definition);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid workflow', details: validation.errors });
    }
    
    // Create execution record
    const executionId = uuidv4();
    await db.queryOriginal(
      `INSERT INTO workflow_executions (execution_id, workflow_id, user_id, status, trigger_data, start_time)
       VALUES ($1, $2, $3, 'pending', $4, CURRENT_TIMESTAMP)`,
      [executionId, id, userId, JSON.stringify(trigger_data || {})]
    );
    
    // Start execution asynchronously
    executionEngine.execute(executionId, workflow, userId, trigger_data || {})
      .catch(error => {
        console.error('Execution error:', error);
      });
    
    res.status(202).json({
      execution_id: executionId,
      status: 'pending',
      workflow_id: id,
      message: 'Workflow execution started'
    });
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ error: 'Failed to execute workflow', message: error.message });
  }
};

// List executions
exports.listExecutions = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { workflow_id, status, limit = 50 } = req.query;
    
    let query = `
      SELECT we.*, w.name as workflow_name
      FROM workflow_executions we
      JOIN workflows w ON we.workflow_id = w.id
      WHERE we.user_id = $1
    `;
    
    const params = [userId];
    
    if (workflow_id) {
      params.push(workflow_id);
      query += ` AND we.workflow_id = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND we.status = $${params.length}`;
    }
    
    params.push(limit);
    query += ` ORDER BY we.created_at DESC LIMIT $${params.length}`;
    
    const result = await db.queryOriginal(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing executions:', error);
    res.status(500).json({ error: 'Failed to list executions', message: error.message });
  }
};

// Get execution details
exports.getExecutionDetails = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { executionId } = req.params;
    
    const result = await db.queryOriginal(
      `SELECT we.*, w.name as workflow_name, w.definition
       FROM workflow_executions we
       JOIN workflows w ON we.workflow_id = w.id
       WHERE we.execution_id = $1 AND we.user_id = $2`,
      [executionId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    const execution = result.rows[0];
    
    // Query per-node execution results
    const nodeExecResult = await db.queryOriginal(
      `SELECT node_id, node_type, status, duration_ms, output_data, error_message
       FROM node_executions
       WHERE execution_id = $1
       ORDER BY created_at ASC`,
      [executionId]
    );
    
    // Build node_results map
    const nodeResults = {};
    nodeExecResult.rows.forEach(row => {
      nodeResults[row.node_id] = {
        status: row.status,
        duration_ms: row.duration_ms,
        output: row.output_data
          ? (typeof row.output_data === 'string' ? JSON.parse(row.output_data) : row.output_data)
          : null,
        error_message: row.error_message
      };
    });
    
    res.json({
      ...execution,
      node_results: nodeResults
    });
  } catch (error) {
    console.error('Error getting execution details:', error);
    res.status(500).json({ error: 'Failed to get execution details', message: error.message });
  }
};

// Cancel execution
exports.cancelExecution = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { executionId } = req.params;
    
    const result = await db.queryOriginal(
      `UPDATE workflow_executions 
       SET status = 'cancelled', end_time = CURRENT_TIMESTAMP
       WHERE execution_id = $1 AND user_id = $2 AND status IN ('pending', 'running')
       RETURNING *`,
      [executionId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Execution not found or cannot be cancelled' });
    }
    
    res.json({ message: 'Execution cancelled', execution: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling execution:', error);
    res.status(500).json({ error: 'Failed to cancel execution', message: error.message });
  }
};

// Get execution logs
exports.getExecutionLogs = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { executionId } = req.params;
    
    // Verify access
    const execResult = await db.queryOriginal(
      'SELECT user_id FROM workflow_executions WHERE execution_id = $1',
      [executionId]
    );
    
    if (execResult.rows.length === 0 || execResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const nodeExecs = await db.queryOriginal(
      `SELECT * FROM node_executions 
       WHERE execution_id = $1 
       ORDER BY created_at ASC`,
      [executionId]
    );

    const technicalLogs = await db.queryOriginal(
      `SELECT * FROM workflow_node_logs 
       WHERE execution_id = $1 
       ORDER BY created_at ASC`,
      [executionId]
    );
    
    // Combine logs
    const combinedLogs = [
      ...nodeExecs.rows.map(l => ({ ...l, type: 'node_status' })),
      ...technicalLogs.rows.map(l => ({ 
        created_at: l.created_at,
        node_id: l.node_id,
        level: l.level,
        message: l.message,
        type: 'technical'
      }))
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.json(combinedLogs);
  } catch (error) {
    console.error('Error getting execution logs:', error);
    res.status(500).json({ error: 'Failed to get execution logs', message: error.message });
  }
};

// Validate workflow (enhanced with node registry)
exports.validateWorkflow = async (req, res) => {
  try {
    const { definition } = req.body;
    
    if (!definition) {
      return res.status(400).json({ error: 'Definition is required' });
    }
    
    // Validate both structure and node availability
    const structureValidation = workflowValidator.validate(definition);
    const nodeValidation = nodeRegistry.validateWorkflow(definition);
    
    const combinedValidation = {
      ...structureValidation,
      node_validation: nodeValidation,
      valid: structureValidation.valid && nodeValidation.valid,
      all_errors: [
        ...(structureValidation.errors || []),
        ...(nodeValidation.missingNodes.length > 0 
          ? [`Missing nodes: ${nodeValidation.missingNodes.join(', ')}`] 
          : [])
      ]
    };
    
    res.json(combinedValidation);
  } catch (error) {
    console.error('Error validating workflow:', error);
    res.status(500).json({ error: 'Failed to validate workflow', message: error.message });
  }
};

// Get node registry status
exports.getNodeRegistryStatus = async (req, res) => {
  try {
    const allNodes = nodeRegistry.getAllNodeTypes();
    const missingNodes = nodeRegistry.getMissingNodes();
    
    res.json({
      registered_nodes: allNodes,
      missing_nodes: missingNodes,
      total_nodes: allNodes.length,
      available_nodes: allNodes.filter(n => !missingNodes.includes(n.type)).length
    });
  } catch (error) {
    console.error('Error getting node registry status:', error);
    res.status(500).json({ error: 'Failed to get node registry status', message: error.message });
  }
};

// List node types
exports.listNodeTypes = async (req, res) => {
  try {
    const nodeRegistry = require('../services/node-registry');
    const nodeTypes = nodeRegistry.getAllNodeTypes();
    res.json(nodeTypes);
  } catch (error) {
    console.error('Error listing node types:', error);
    res.status(500).json({ error: 'Failed to list node types', message: error.message });
  }
};

// Get node type schema
exports.getNodeTypeSchema = async (req, res) => {
  try {
    const { type } = req.params;
    const nodeRegistry = require('../services/node-registry');
    const schema = nodeRegistry.getNodeTypeSchema(type);
    
    if (!schema) {
      return res.status(404).json({ error: 'Node type not found' });
    }
    
    res.json(schema);
  } catch (error) {
    console.error('Error getting node type schema:', error);
    res.status(500).json({ error: 'Failed to get node type schema', message: error.message });
  }
};

// List templates
exports.listTemplates = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const result = await db.queryOriginal(
      `SELECT id, name, description, thumbnail_path, created_at,
              (SELECT COUNT(*) FROM jsonb_array_elements(definition->'nodes')) as node_count
       FROM workflows
       WHERE is_template = true
         AND (is_public = true OR user_id = $1)
       ORDER BY created_at DESC`
      ,
      [userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates', message: error.message });
  }
};

// Get template
exports.getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || 1;
    
    const result = await db.queryOriginal(
      `SELECT * FROM workflows
       WHERE id = $1
         AND is_template = true
         AND (is_public = true OR user_id = $2)`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: 'Failed to get template', message: error.message });
  }
};

// Create template
exports.createTemplate = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { workflow_id } = req.body;
    
    const access = await checkWorkflowAccess(workflow_id, userId);
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only owner can create template' });
    }
    
    await db.queryOriginal(
      'UPDATE workflows SET is_template = true, is_public = true WHERE id = $1',
      [workflow_id]
    );
    
    res.json({ message: 'Template created successfully' });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template', message: error.message });
  }
};

// Share workflow
exports.shareWorkflow = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const { is_public } = req.body;
    
    const access = await checkWorkflowAccess(id, userId);
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only owner can share workflow' });
    }
    
    await db.queryOriginal(
      'UPDATE workflows SET is_public = $1 WHERE id = $2',
      [is_public || false, id]
    );
    
    const shareLink = `${req.protocol}://${req.get('host')}/workflows/${id}`;
    
    res.json({ message: 'Workflow shared successfully', share_link: shareLink });
  } catch (error) {
    console.error('Error sharing workflow:', error);
    res.status(500).json({ error: 'Failed to share workflow', message: error.message });
  }
};

// Get permissions
exports.getPermissions = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    
    const access = await checkWorkflowAccess(id, userId);
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only owner can view permissions' });
    }
    
    const result = await db.queryOriginal(
      `SELECT wp.*, u.username, u.email
       FROM workflow_permissions wp
       JOIN users u ON wp.user_id = u.id
       WHERE wp.workflow_id = $1`,
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting permissions:', error);
    res.status(500).json({ error: 'Failed to get permissions', message: error.message });
  }
};

// Grant permission
exports.grantPermission = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id } = req.params;
    const { user_id, permission } = req.body;
    
    const access = await checkWorkflowAccess(id, userId);
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only owner can grant permissions' });
    }
    
    if (!['view', 'edit', 'execute'].includes(permission)) {
      return res.status(400).json({ error: 'Invalid permission type' });
    }
    
    await db.queryOriginal(
      `INSERT INTO workflow_permissions (workflow_id, user_id, permission, granted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workflow_id, user_id, permission) DO NOTHING`,
      [id, user_id, permission, userId]
    );
    
    res.json({ message: 'Permission granted successfully' });
  } catch (error) {
    console.error('Error granting permission:', error);
    res.status(500).json({ error: 'Failed to grant permission', message: error.message });
  }
};

// Revoke permission
exports.revokePermission = async (req, res) => {
  try {
    const userId = req.user?.id || 1;
    const { id, userId: targetUserId } = req.params;
    
    const access = await checkWorkflowAccess(id, userId);
    if (!access.isOwner) {
      return res.status(403).json({ error: 'Only owner can revoke permissions' });
    }
    
    await db.queryOriginal(
      'DELETE FROM workflow_permissions WHERE workflow_id = $1 AND user_id = $2',
      [id, targetUserId]
    );
    
    res.json({ message: 'Permission revoked successfully' });
  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({ error: 'Failed to revoke permission', message: error.message });
  }
};

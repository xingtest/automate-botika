/**
 * Graph Utilities for Workflow
 */

/**
 * Get all node IDs reachable from trigger nodes
 * @param {Array} nodes - Array of nodes
 * @param {Array} connections - Array of connections
 * @returns {Set<string>} - Set of active node IDs
 */
function getActiveNodeIds(nodes, connections) {
  const activeIds = new Set();
  const adj = {};
  
  // Initialize adjacency list
  nodes.forEach(n => adj[n.id] = []);
  connections.forEach(c => {
    if (adj[c.source_node_id]) {
      adj[c.source_node_id].push(c.target_node_id);
    }
  });
  
  // Find trigger nodes
  const triggers = nodes.filter(n => {
    // A node is a trigger if its type includes 'trigger' or it has no inputs in schema
    // Since we don't have schemas here, we rely on type naming convention
    return n.type && n.type.toLowerCase().includes('trigger');
  });
  
  // If no trigger nodes found, but we have a 'manual-trigger' type node, use it
  // This is a fallback for different naming conventions
  if (triggers.length === 0) {
    const manualTriggers = nodes.filter(n => n.type === 'manual-trigger');
    triggers.push(...manualTriggers);
  }

  // BFS from each trigger
  const queue = triggers.map(t => t.id);
  triggers.forEach(t => activeIds.add(t.id));
  
  while (queue.length > 0) {
    const u = queue.shift();
    (adj[u] || []).forEach(v => {
      if (!activeIds.has(v)) {
        activeIds.add(v);
        queue.push(v);
      }
    });
  }
  
  return activeIds;
}

module.exports = {
  getActiveNodeIds
};

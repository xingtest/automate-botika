/**
 * History Manager for Workflow Builder
 * Manages undo/redo stacks
 */

const HistoryManager = {
  undoStack: [],
  redoStack: [],
  maxHistory: 50,
  
  /**
   * Save current state to history
   */
  saveState(nodes, connections) {
    // Deep clone state
    const state = JSON.stringify({
      nodes: nodes,
      connections: connections
    });
    
    // Only push if state changed from last
    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === state) {
      return;
    }
    
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    
    // Clear redo stack on new action
    this.redoStack = [];
  },
  
  /**
   * Undo last action
   */
  undo(currentNodes, currentConnections) {
    if (this.undoStack.length <= 1) return null;
    
    // Current state is at the top of undoStack, move it to redoStack
    const currentState = this.undoStack.pop();
    this.redoStack.push(currentState);
    
    // Return previous state
    const previousState = this.undoStack[this.undoStack.length - 1];
    return JSON.parse(previousState);
  },
  
  /**
   * Redo last undone action
   */
  redo() {
    if (this.redoStack.length === 0) return null;
    
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);
    
    return JSON.parse(nextState);
  },
  
  /**
   * Clear history
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
};

/**
 * Template Engine
 * Resolve template variables for node configuration and runtime values.
 */

function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    return current[key];
  }, obj);
}

function resolveTemplate(template, input = {}, context = null) {
  if (template === undefined || template === null) {
    return template;
  }

  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
    const path = expression.trim();

    if (!path) {
      return match;
    }

    if (path.startsWith('$json.')) {
      return getNestedValue(input, path.substring(6)) ?? match;
    }

    if (path.startsWith('$input.')) {
      return getNestedValue(input, path.substring(7)) ?? match;
    }

    if (path.startsWith('$context.')) {
      const contextKey = path.substring(9);
      return getNestedValue(context, contextKey) ?? match;
    }

    const parts = path.split('.');
    const nodeId = parts[0];
    const nodeOutput = context?.getNodeOutput(nodeId);
    if (nodeOutput !== undefined) {
      const value = getNestedValue(nodeOutput, parts.slice(1).join('.'));
      return value !== undefined ? value : match;
    }

    return match;
  });
}

module.exports = {
  getNestedValue,
  resolveTemplate
};

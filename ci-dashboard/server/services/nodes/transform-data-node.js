const BaseNode = require('./base-node');

class TransformDataNode extends BaseNode {
  constructor() {
    super({
      type: 'transform-data',
      category: 'transform',
      label: 'Transform Data',
      description: 'Map and transform data between nodes',
      icon: 'fa-exchange-alt',
      color: '#06b6d4',
      inputs: [
        { id: 'input', name: 'Input', dataType: 'any', required: true }
      ],
      outputs: [
        { id: 'output', name: 'Output', dataType: 'any', required: true }
      ],
      config_schema: [
        {
          key: 'jsCode',
          label: 'JavaScript Code',
          type: 'textarea',
          required: false,
          default: '// Transform data\nreturn items.map(item => {\n  item.processed = true;\n  return item;\n});',
          description: 'Kode JavaScript untuk transformasi data. Gunakan variabel `items` untuk mengakses data input',
          placeholder: 'return items;'
        }
      ]
    });
  }

  async execute(context, config, node) {
    const vm = require('vm');
    const input = this.getInput(context, 'input');
    const items = Array.isArray(input) ? input : (input ? [input] : []);

    const jsCode = config.jsCode || config.expression || 'return items;';

    const sandbox = {
      items,
      context: { execution_id: context.execution_id, user_id: context.user_id },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      parseInt,
      parseFloat,
      console: { log: (...args) => this.log('info', args.join(' ')) }
    };

    try {
      const script = new vm.Script(`(function() { ${jsCode} })()`);
      const vmContext = vm.createContext(sandbox);

      const result = await Promise.race([
        Promise.resolve(script.runInContext(vmContext)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transform code execution timeout (10s)')), 10000)
        )
      ]);

      return result !== undefined ? result : items;
    } catch (err) {
      if (err.message.includes('timeout')) throw err;
      throw new Error(`Transform code execution failed: ${err.message}`);
    }
  }
}

module.exports = TransformDataNode;

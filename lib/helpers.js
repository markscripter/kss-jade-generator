var path = require('path');
var Kss = require('kss');
var jade = require('jade');
var _isFunction = require('lodash/lang/isFunction');
var _assign = require('lodash/object/assign');

var JadeHelpers = function(data, helpers) {
  this.data = data;

  if (helpers) {
    for (var name in helpers) {
      this.registerHelper(name, helpers[name]);
    }
  }
};

JadeHelpers.prototype.registerHelper = function(name, helper) {
  !_isFunction(helper) ?
    console.error('second argument must be a function!') :
    this[name] = helper;
};

JadeHelpers.prototype.section = function(reference) {
  var section = this.data.styleguide.section(reference);

  return section ? section.data : {};
};

JadeHelpers.prototype.eachSection = function(query) {
  var styleguide = this.data.styleguide;
  var buffer = [];
  var sections;
  var i;
  var l;
  query = query || '';

  !query.match(/\bx\b|\*/g) ?
    query = query + '.*' :
    0;

  sections = styleguide.section(query);
  if (!sections) {
    return buffer;
  }

  l = sections.length;
  for (i = 0; i < l; i += 1) {
    buffer.push(sections[i].data);
  }

  return buffer;
};

JadeHelpers.prototype.eachRoot = function() {
  var buffer = [];
  var sections = this.data.styleguide.section('x');
  var i;
  var l;

  if (!sections) {
    return buffer;
  }

  l = sections.length;
  for (i = 0; i < l; i += 1) {
    buffer.push(sections[i].data);
  }

  return buffer;
};

JadeHelpers.prototype.ifNumeric = function(reference) {
  return (typeof reference === 'number' || typeof reference === 'string' && reference.match(/^[\.\d]+$/));
};

JadeHelpers.prototype.ifReference = function(reference, context) {
  return (context.reference && reference === context.reference);
};

JadeHelpers.prototype.unlessReference = function(reference, context) {
  return (!context.reference || reference !== context.reference);
};

JadeHelpers.prototype.ifDepth = function(depth, context) {
  return (context.depth && depth === context.depth);
};

JadeHelpers.prototype.unlessDepth = function(depth, context) {
  return (!context.depth || depth !== context.depth);
};

JadeHelpers.prototype.eachModifier = function(section) {
  var modifiers;
  var buffer = [];
  var i;
  var l;

  // set modifiers
  modifiers = section.modifiers || [];

  if (!modifiers) {
    return buffer;
  }

  l = modifiers.length;
  for (i = 0; i < l; i++) {
    buffer.push(modifiers[i].data || {});
  }

  return buffer;
};

JadeHelpers.prototype.eachParameter = function(section) {
  var parameters;
  var buffer = [];
  var i;
  var l;

  // set parameters
  parameters = section.parameters || [];

  if (!parameters) {
    return buffer;
  }

  l = parameters.length;
  for (i = 0; i < l; i++) {
    buffer.push(parameters[i].data || {});
  }

  return buffer;
};

JadeHelpers.prototype.eachColor = function(section) {
  var colors;
  var buffer = [];
  var i;
  var l;
  var tmp;

  // set parameters
  colors = section.colors || '';

  colors = colors.split('\n');
  l = colors.length;
  for (i = 0; i < l; i++) {
    tmp = colors[i].split(' - ');
    buffer.push({
      color: tmp[0],
      description: tmp[1],
    });
  }

  return buffer;
};

JadeHelpers.prototype.markup = function(context) {
  var partials = this.data.partials;
  var section;
  var modifier = false;
  var template;
  var partial;
  var data;
  var renderer;

  if (!context) {
    return '';
  }

  // Determine if the element is a section object or a modifier object.
  if (context.modifiers) {
    // If this is the section object, use the default markup without a modifier class.
    section = new Kss.KssSection(context);
  } else {
    // If this is the markup object, find the modifier class and the section object.
    modifier = new Kss.KssModifier(context);
    section = modifier.section();
  }

  // Load the information about this section's markup partial.
  partial = partials[section.reference()];

  // Prepare the sample data for the partial.
  data = JSON.parse(JSON.stringify(partial.data));

  data.modifier_class ?
    data.modifier_class += ' ' :
    data.modifier_class = '';

  data.modifier_description ?
    data.modifier_description += ' ' :
    data.modifier_description = '';

  modifier ?
    data.modifier_class += modifier.className() :
    section.firstModifier() !== false ?
      data.modifier_class += this.data.config.placeholder :
      0;

  modifier ?
    data.modifier_description += modifier.description() :
    data.modifier_description += '';

  // Compile the section's markup partial into a template.
  if (partial.file) {
    template = jade.compile('include ' + path.relative(process.cwd(), partial.file), {
      filename: path.basename(partial.file),
    });
  } else {
    template = jade.compile(partial.markup);
  }

  // beautify (for react component)
  return template(data);
};

module.exports = JadeHelpers;

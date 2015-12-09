var KssGenerator = require('kss/generator');
var KssSection = require('kss/lib/kss_section.js');
var fs = require('fs');
var glob = require('glob');
var marked = require('marked');
var path = require('path');
var wrench = require('wrench');
var mkdirp = require('mkdirp');

var kssJadeGenerator = new KssGenerator('2.0', {
  helpers: {
    string: true,
    path: true,
    describe: 'Location of helpers; see http://bit.ly/kss-wiki'
  },
  homepage: {
    string: true,
    multiple: false,
    describe: 'File name of the homepage\'s Markdown file',
    default: 'styleguide.md'
  },
  placeholder: {
    string: true,
    multiple: false,
    describe: 'Placeholder text to use for modifier classes',
    default: '[modifier class]'
  }
});

kssJadeGenerator.init = function(config) {
  var i, j, helper;

  // Save the configuration parameters.
  this.config = config;
  this.config.helpers = this.config.helpers || [];

  if (this.config.verbose) {
    console.log('');
    console.log('Generating your KSS style guide!');
    console.log('');
    console.log(' * KSS Source  : ' + this.config.source.join(', '));
    console.log(' * Destination : ' + this.config.destination);
    console.log(' * Template    : ' + this.config.template);
    if (this.config.helpers.length) {
      console.log(' * Helpers     : ' + this.config.helpers.join(', '));
    }
    console.log('');
  }

  // Create a new destination directory.
  try {
    mkdirp.sync(this.config.destination);
  } catch (e) {
    // empty
  }

  // Store the global jade object.
  this.Jade = require('jade');

  // Compile the Jade template.
  this.template = this.Jade.compileFile(this.config.template + '/index.jade', {
    pretty: true
  });
};

kssJadeGenerator.generate = function(styleguide) {
  var sections = styleguide.section(),
    sectionCount = sections.length,
    sectionRoots = [],
    rootCount,
    currentRoot,
    childSections = [],
    partials = {},
    partial,
    files = [],
    i,
    key;

  if (this.config.verbose) {
    console.log(styleguide.data.files.map(function(file) {
      return ' - ' + file;
    }).join('\n'));
  }

  // Throw an error if no KSS sections are found in the source files.
  if (sectionCount === 0) {
    throw new Error('No KSS documentation discovered in source files.');
  }

  if (this.config.verbose) {
    console.log('...Determining section markup:');
  }

  for (i = 0; i < sectionCount; i += 1) {
    // Register all the markup blocks as Handlebars partials.
    if (sections[i].markup()) {
      partial = {
        name: sections[i].reference(),
        reference: sections[i].reference(),
        file: '',
        markup: sections[i].markup(),
        data: {}
      };
      // If the markup is a file path, attempt to load the file.
      if (partial.markup.match(/^[^\n]+\.(html|hbs)$/)) {
        partial.file = partial.markup;
        partial.name = path.basename(partial.file, path.extname(partial.file));
        files = [];
        for (key in this.config.source) {
          if (!files.length) {
            files = glob.sync(this.config.source[key] + '/**/' + partial.file);
          }
        }
        // If the markup file is not found, note that in the style guide.
        if (!files.length) {
          partial.markup += ' NOT FOUND!';
          if (!this.config.verbose) {
            console.log('WARNING: In section ' + partial.reference + ', ' + partial.markup);
          }
        }
        if (this.config.verbose) {
          console.log(' - ' + partial.reference + ': ' + partial.markup);
        }
        if (files.length) {
          // Load the partial's markup from file.
          partial.file = files[0];
          partial.markup = fs.readFileSync(partial.file, 'utf8');
          // Load sample data for the partial from the sample .json file.
          if (fs.existsSync(path.dirname(partial.file) + '/' + partial.name + '.json')) {
            try {
              partial.data = require(path.dirname(partial.file) + '/' + partial.name + '.json');
            } catch (e) {
              partial.data = {};
            }
          }
        }
      } else if (this.config.verbose) {
        console.log(' - ' + partial.reference + ': inline markup');
      }
      // Register the partial using the filename (without extension) or using
      // the style guide reference.
      this.Handlebars.registerPartial(partial.name, partial.markup);
      // Save the name of the partial and its data for retrieval in the markup
      // helper, where we only know the reference.
      partials[partial.reference] = {
        name: partial.name,
        data: partial.data
      };
    }

    // Accumulate all of the sections' first indexes
    // in case they don't have a root element.
    currentRoot = sections[i].reference().split(/(?:\.|\ \-\ )/)[0];
    if (sectionRoots.indexOf(currentRoot) === -1) {
      sectionRoots.push(currentRoot);
    }
  }

  if (this.config.verbose) {
    console.log('...Generating style guide sections:');
  }

  // Now, group all of the sections by their root
  // reference, and make a page for each.
  rootCount = sectionRoots.length;
  for (i = 0; i < rootCount; i += 1) {
    childSections = styleguide.section(sectionRoots[i] + '.*');

    this.generatePage(styleguide, childSections, sectionRoots[i], sectionRoots, partials);
  }

  // Generate the homepage.
  childSections = [];
  this.generatePage(styleguide, childSections, 'styleguide.homepage', sectionRoots, partials);
};

kssJadeGenerator.generatePage = function(styleguide, sections, root, sectionRoots, partials) {
  var filename = '', files,
    homepageText = false,
    styles = '',
    scripts = '',
    customFields = this.config.custom,
    key;

  if (root === 'styleguide.homepage') {
    filename = 'index.html';
    if (this.config.verbose) {
      console.log(' - homepage');
    }
    // Ensure homepageText is a non-false value.
    for (key in this.config.source) {
      if (!homepageText) {
        try {
          files = glob.sync(this.config.source[key] + '/**/' + this.config.homepage);
          if (files.length) {
            homepageText = ' ' + marked(fs.readFileSync(files[0], 'utf8'));
          }
        } catch (e) {
          // empty
        }
      }
    }
    if (!homepageText) {
      homepageText = ' ';
      if (this.config.verbose) {
        console.log('   ...no homepage content found in ' + this.config.homepage + '.');
      } else {
        console.log('WARNING: no homepage content found in ' + this.config.homepage + '.');
      }
    }
  } else {
    filename = 'section-' + KssSection.prototype.encodeReferenceURI(root) + '.html';
    if (this.config.verbose) {
      console.log(
        ' - section ' + root + ' [',
        styleguide.section(root) ? styleguide.section(root).header() : 'Unnamed',
        ']'
      );
    }
  }
  // Create the HTML to load the optional CSS and JS.
  for (key in this.config.css) {
    if (this.config.css.hasOwnProperty(key)) {
      styles = styles + '<link rel="stylesheet" href="' + this.config.css[key] + '">\n';
    }
  }
  for (key in this.config.js) {
    if (this.config.js.hasOwnProperty(key)) {
      scripts = scripts + '<script src="' + this.config.js[key] + '"></script>\n';
    }
  }

  /* eslint-disable key-spacing */
  fs.writeFileSync(this.config.destination + '/' + filename,
    this.template({
      partials:     partials,
      styleguide:   styleguide,
      sectionRoots: sectionRoots,
      sections:     sections.map(function(section) {
        return section.toJSON(customFields);
      }),
      rootName:     root,
      options:      this.config || {},
      homepage:     homepageText,
      styles:       styles,
      scripts:      scripts
    })
  );
  /* eslint-enable key-spacing */
};

module.exports = kssHandlebarsGenerator;

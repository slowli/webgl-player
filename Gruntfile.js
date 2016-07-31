var jade = require('jade');
var fs = require('fs');

module.exports = function(grunt) {
	
	var pkg = grunt.file.readJSON('package.json');

	var config = {
		pkg: pkg,

		jshint: {
			server: [ 'app.js', 'Gruntfile.js' ],
			player: [ 'src/<%= pkg.name %>.js' ],
			common: [ 'src/common/*.js' ]
		},

		uglify: {
			options: {
				banner: '/*! <%= pkg.name %>; License: <%= pkg.license %> */\n'
			},
			player: {
				src: [ 'src/<%= pkg.name %>.js' ],
				dest: 'public/<%= pkg.name %>-<%= pkg.version %>.min.js'
			}
		},

		cssmin: {
			player: {
				files: {
					'public/<%= pkg.name %>-<%= pkg.version %>.min.css': [ 
						'tmp/embed.css'
					]
				}
			}
		},

		compress: {
			all: {
				options: {
					mode: 'zip',
					archive: 'public/<%= pkg.name %>-<%= pkg.version %>.zip'
				},
				files: [
					{ 
						expand: true, 
						cwd: 'public',
						src: [ '<%= pkg.name %>*.min.js', '<%= pkg.name %>*.min.css' ]
					}
				]
			}
		},

		copy: {
			pub: {
				files: [
					{ expand: true, cwd: 'src/', src: [ 'main.css', 'three/*', 'common/*' ], dest: 'public/' }
				]
			},
			static_html: {
				files: [
					{ expand: true, cwd: 'public/', src: [ '**' ], dest: 'static-html/static/' }
				]
			}
		},

		clean: {
			pub: [ 'public/' ],
			static_html: [ 'static-html/' ],
			tmp: [ 'tmp/' ]
		}
	};
	
	// Add demo-specific tasks
	var demos = [ 'cube', 'planets', 'lake', 'gasoline' ];
	demos.forEach(function(demoName) {
		config.jshint[demoName] = [ 'src/' + demoName + '/*.js' ];
		config.copy.pub.files[0].src.push(demoName + '/*');
	});
	
	grunt.initConfig(config);

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-contrib-compress');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-clean');

	grunt.registerTask('cssembed', 'Embeds font into the CSS file', function() {
		var css = fs.readFileSync('src/webgl-player.css').toString('utf8');
		var data = fs.readFileSync('src/icons.woff');
		data = new Buffer(data).toString('base64');
		css = css.replace("icons.woff?refresh", "data:application/font-woff;base64," + data);
		
		try {
			fs.writeFileSync('tmp/embed.css', css);
		} catch(e) {
			if (e.code === 'ENOENT') {
				// tmp/ directory is missing
				fs.mkdirSync('tmp');
				fs.writeFileSync('tmp/embed.css', css);
			} else {
				throw e;
			}
		}
	});

	grunt.registerTask('html', 'Generates static HTML pages for the site', function(urlRoot) {
		if (urlRoot === undefined) urlRoot = '.';
		
		var pages = [ 'index' ];
		pages = pages.concat(demos);
		pages.forEach(function(page) {
			var html = jade.renderFile('./views/' + page + '.jade', { 
				app_version: pkg.version,
				static_html: true,
				url_root: urlRoot,
				debug: false,
				dpRatio: 1
			});
			fs.writeFileSync('static-html/' + page + '.html', html);
		});
	});

	grunt.registerTask('test', [ 'jshint' ]);
	grunt.registerTask('pub', [ 'jshint', 'uglify', 'cssembed', 'cssmin', 'compress', 'copy:pub' ]);
	grunt.registerTask('static', [ 'pub', 'copy:static_html', 'html' ]);
	grunt.registerTask('default', [ 'pub' ]);
};

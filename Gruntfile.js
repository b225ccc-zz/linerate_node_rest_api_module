'use strict';

module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            all: [
                'Gruntfile.js',
                'lib/*.js',
                'test/*.js'
            ],
            options: {
              jshintrc: '.jshintrc'
            }
        },
        tape: {
          options: {
            pretty: true,
            output: 'console'
          },
          //files: ['test/**/*.js']
          files: ['test/test.js']
        },
        watch: {
            files: ['<%= jshint.files %>'],
            tasks: ['jshint']
        },
        doxx: {
          all: {
            src: 'lib',
            target: 'docs',
            options: {
              title: 'LineRate Node.js REST API module',
              template: 'doxx.jade',
              readme: 'README.md'
            }
          }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-doxx');
    grunt.loadNpmTasks('grunt-tape');

    grunt.registerTask('test', ['tape']);
    grunt.registerTask('jshint', ['jshint']);
    grunt.registerTask('default', ['jshint', 'tape', 'doxx']);

};

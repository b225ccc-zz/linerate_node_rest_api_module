'use strict';

var test =      require('tape');
var Linerate = require('../lib/index.js');
var config = require('../config.json');
var path = require('path');

test(path.basename(__filename, '.js') + '()', function(t) {
  var l = new Linerate();
  l.connect(config, function(err, msg) {
    t.notOk(err, 'callback error value is non-null');
    t.ok(msg, 'msg is present');
    t.end();
  });
});

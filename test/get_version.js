'use strict';

var test =      require('tape');
var Linerate =  require('../lib/index.js');
var config =    require('../config.json');
var path = require('path');

test(path.basename(__filename, '.js') + '()', function(t) {
  var l = new Linerate();
  l.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password
  }, function() {
    l.get_version(function(err, msg) {
      if (err) { t.comment(err); }
      t.notOk(err, 'callback error value is non-null');
      t.ok(msg, 'msg is present');
      t.end();
      console.log(msg);
    });
  });
});

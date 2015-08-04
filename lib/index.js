'use strict';

var request = require('request');
var url = require('url');
var qs = require('querystring');
var fs = require('fs');
var async = require('async');
var semver = require('semver');

/**
 * @class
 */
function Linerate() {

  this.rest_url = '/lrs/api/v1.0';

  this.defaults = {
    rest_url: '/lrs/api/v1.0',
    headers: {
      'content-type': 'application/json'
    }
  };

  // wrap request with defaults
  this.request = request.defaults({
    rejectUnauthorized: false
  });

}

Linerate.prototype.STATUS_CODES = {
    'DELETE': { 
      'ok': [ 204 ] 
    },
    'GET': {
      'ok': [ 200 ]
    },
    'PUT': {
      'ok': [ 200 ]
    },
    'POST': {
      'ok': [ 200 ]
    }
};

/**
 * Creates a session with a LineRate host
 *
 * @function
 * @param {Object} opts The connection options object.  Supported object 
 * properties:
 * @param {string} opts.host Hostname or IP address
 * @param {integer} opts.port Port number
 * @param {string} opts.username Username
 * @param {string} opts.password Password
 * @param {function} callback
 *
 * @example
 * connect({
 *    host: '127.0.0.1',
 *    port: 8443,
 *    username: 'admin',
 *    password: 'changeme'
 *  }, function(error, message) {
 *    // code here
 *  });
 *
 */
Linerate.prototype.connect = function(opts, callback) {

  this.base_url = 'https://' + opts.host + ':' + opts.port;

  this.jar = request.jar();
  
  var options = {
    url: this.base_url + '/login',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: 'username=' + opts.username + '&password=' + opts.password,
    jar: this.jar,
    timeout: 30000
  };

  this.request.post(options, function(error, response) {
    if (error) {
      //throw new Error('connection error: ' + error);
      callback(error);
      return;
    }

    // successful login always returns a 302
    if (response.statusCode !== 302) {
      //throw new Error('Login failure: ' + response.statusCode);
      callback(error);
      return;
    }

    // and, conveniently, a failed login attempt returns a 302.
    // check for 302 and redirect back to login page for failed login
    if (response.statusCode === 302 && 
        url.parse(response.headers.location).pathname === '/login') {
      callback('Login failed');
      return;
    }


    //console.log(self.jar.getCookies(options.url));
    callback(null, 'connected');
    return;
  });

};

/**
 * Initiates a GET request
 *
 * @param {string} node The REST API node
 * @param {Object=} opts GET options
 * @param {Object=} opts.query An object containing a list of key, value
 * pairs to be used as the query string
 * @param {function} callback
 *
 * @example
 * get('/config/ntp/server', {
 *   query: {
 *     level: 'recurse'
 *   }
 *  }, function(error, message) {
 *    // code here
 *  });
 *
 */
Linerate.prototype.get = function(node, opts, callback) {

  // arguments fixup
  if (typeof opts === 'function') {
    callback = opts;
    opts = null;
  }

  if (!check_node(node)) {
    callback('\'node\' must be a string');
    return;
  }

  var path = this.rest_url + node;

  if (opts) {
    if (opts.query) {
      path += '?' + qs.stringify(opts.query);
    }
  }

  this.request({
      url: this.base_url + path,
      jar: this.jar,
      headers: this.defaults.headers,
      json: true
    },
    function(error, response) {
      if (error) { 
        // TODO: don't throw from module
        throw new Error('err');
      }

      if (!check_response(response)) {
        callback('Response contained an error code');
        return;
      }

      callback(null, format_response_get(response.body));
      return;
    });
};

/**
 * Initiates a PUT request
 *
 * @param {string} node The REST API node
 * @param {Object|string} opts PUT options.  opts is always required for PUT
 * @param {Object=} opts.data The data for the node's PUT operation as 
 * defined by the LineRate REST API documentation.  If passed as a string, 
 * value is converted to proper object syntax
 * @param {boolean} opts.default Set default key.  
 * **Default**: `false`
 * @param {Object=} opts.query An object containing a list of key, value
 * pairs to be used as the query string.  Some API nodes accept a query string
 * @param {function} callback
 *
 * @example
 * put('/exec/system/util/delete', 
 *  '/tmp/a',
 *  function(error, message) {
 *    // code here
 *  });
 *
 */
Linerate.prototype.put = function(node, opts, callback) {

  if (!check_node(node)) {
    callback('\'node\' must be a string');
    return;
  }

  var path = this.rest_url + node;

  if (opts) {

    // if opts is a string, assuming all defaults except 'data'
    if (typeof opts === 'string') {
      opts = {
        data: opts,
        type: 'string',
        default: false
      };
    }
    else if (typeof opts === 'object') {
      if (!opts.data) {
        callback('missing data');
        return;
      }
      if (opts.query) {
        path += '?' + qs.stringify(opts.query);
      }

      opts.type = opts.type || 'string';
      opts.default = opts.default || false;

    }
    else {
      callback('unrecognized opts argument');
      return;
    }
  }

  if (!validate_data(opts.data, opts.type)) {
    callback('input data failed validation');
    return;
  }


  // note that json: true does 3 things:
  // formats body data as json
  // sets content-type header to application/json
  // parses response body as JSON
  this.request.put(
      {
        url: this.base_url + path,
        jar: this.jar,
        headers: this.defaults.headers,
        json: true,
        body: opts
      },
      function(error, response) {
        if (error) { 
          throw new Error('err');
        }

        if (!check_response(response)) {
          callback('Response contained an error code');
          return;
        }

        callback(null, format_response_put(response.body));
        return;
      });
};

/**
 * Initiates a DELETE request
 *
 * @param {string} node The REST API node
 * @param {function} callback
 *
 * @example
 * delete('/config/app/proxy/virtualIP/vip01',
 *  function(error, message) {
 *    // code here
 *  });
 *
 */
Linerate.prototype.delete = function(node, callback) {

  if (!check_node(node)) {
    callback('\'node\' must be a string');
    return;
  }

  var path = this.rest_url + node;

  this.request.del({
      url: this.base_url + path,
      jar: this.jar,
      json: true,
    },
    function(error, response) {
      if (error) { 
        // TODO: don't throw from module
        throw new Error(error);
      }
      if (!check_response(response)) {
        callback('Response contained an error code');
        return;
      }

      // a successful DELETE request results in a 204 with no 
      // response body, so handle format_response differently
      // for DELETE
      callback(null, format_response_delete(
            { message: 'node deleted',
              node: node
            }
          ));
      return;

    });
};

/**
 * @private
 * Checks response object for any errors
 */
function check_response(response) {

  var ok = ok_codes(response.req.method);

  if (ok.indexOf(response.statusCode) === -1) {
    return false;
  } else {
    return true;
  }

}

/**
 * @private
 * Get OK status codes for given method
 */
function ok_codes(method) {
  return Linerate.prototype.STATUS_CODES[method].ok;
}

/**
 * @private
 * Validate provided data against data_type
 * http://goo.gl/STlT5B
 */
function validate_data(data, data_type) {

  switch (data_type) {
    case 'string':
      //return /^[0-9a-zA-Z-_\.]+$/.test(data) ? true : false;
      //return /^[\x20-0x7E]+$/.test(data) ? true : false;
      return true;
    
    default:
      // TODO: add check for all data types
      return true;
      
  }

}

/**
 * @private
 * Check type of 'node' is a string
 */
function check_node(node) {
  return typeof node === 'string' ? true : false;
}

/**
 * @private
 * Massage response before returning to caller
 */
function format_response_get(response) {

  //console.log(response);

  // strip the node path from the object and return
  // all the child items
  return response[Object.keys(response)[0]];


  //  var r = {};
  //  r.requestPath = response.requestPath;
  //  r.httpResponseCode = response.httpResponseCode;
  //  r.recurse = response.recurse;
  //  return r;
}

/**
 * @private
 * Massage response before returning to caller
 */
function format_response_put(response) {
  return response;
}

/**
 * @private
 * Massage response before returning to caller
 */
function format_response_delete(response) {
  return response;
}

/**
 * Convenience method - util_delete
 *
 */
Linerate.prototype.util_delete = function(file, callback) {
  var node = '/exec/system/util/delete';
  this.put(node, file, callback);
};

/**
 * Convenience method - get_version
 *
 */
Linerate.prototype.get_version = function(callback) {
  var node = '/status/system/version';
  this.get(node, callback);
};

/**
 * Convenience method - get_hostname
 *
 */
Linerate.prototype.get_hostname = function(callback) {
  var node = '/config/system/hostname';
  this.get(node, callback);
};

/**
 * Convenience method - set_hostname
 *
 */
Linerate.prototype.set_hostname = function(name, callback) {
  var node = '/config/system/hostname';
  this.put(node, name, callback);
};

/**
 * Convenience method - backup_list
 *
 */
Linerate.prototype.backup_list = function(callback) {
  var node = '/status/system/util/backup/list';
  this.get(node, callback);
};

/**
 * Convenience method - backup_home
 *
 */
Linerate.prototype.backup_home = function(destination, callback) {
  var node = '/exec/system/util/backup/home';
  this.put(node, destination, callback);
};

/**
 * Convenience method - backup_full
 *
 */
Linerate.prototype.backup_full = function(destination, callback) {
  var node = '/exec/system/util/backup/full';
  this.put(node, destination, callback);
};

/**
 * Convenience method - backup
 *
 * @param backup_type must be one of 'full' or 'home'
 *
 */
Linerate.prototype.backup = function(backup_type, destination, callback) {

  switch (backup_type) {
    case 'home':
      this.backup_home(destination, function(err, response) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, response);
        return;
      
      });
      break;
    
    case 'full':
      this.backup_full(destination, function(err, response) {
        if (err) {
          callback(err);
          return;
        }

        callback(null, response);
        return;
      
      }) ;
      
      break;
    
    default:
      callback('Need to specify \'home\' or \'full\' for backup_type.');
      
  }

};

/**
 * Convenience method - write_mem
 *
 */
Linerate.prototype.write_mem = function(callback) {
  var node = '/exec/system/util/copy';
  this.put(node, 'running-config|startup-config', callback);
};

/**
 * Convenience method - get_regkey
 *
 */
Linerate.prototype.get_regkey = function(callback) {
  var node = '/status/licensing/regKey';
  this.get(node, callback);
};

/**
 * Convenience method - set_regkey
 *
 */
Linerate.prototype.set_regkey = function(regkey, callback) {
  var node = '/config/licensing/regKey';
  this.put(node, regkey, callback);
};

/**
 * Convenience method - get_activation_mode
 *
 */
Linerate.prototype.get_activation_mode = function(callback) {
  var node = '/status/licensing/activationMode';
  this.get(node, callback);
};

/**
 * Convenience method - set_activation_mode
 *
 */
Linerate.prototype.set_activation_mode = function(mode, callback) {
  var node = '/config/licensing/activationMode';
  //if (whitelist_verify(node, mode)) {
    this.put(node, mode, callback);
  //} else {
  //  callback('data failed verification');
 //}
};

Linerate.prototype._format_license_info = function(d) {
  function f(e) {
    if (e && e.trim() !== '' && e.match(/^-+$/) === null) { 
      return true;
    }
  }

  var d2 = (d.split(/(\s{2,})|(\n)/)).filter(f);
  var l = d2.length;
  var i;
  var o = {};

  for (i = 0; i<l/2; i++) {
    o[d2[i]] = d2[i+l/2];
  }

  return o;
  
};

/**
 * Convenience method - get_license_info
 *
 * Assumes feature base (the only currently supported
 * license type)
 *
 * TODO: test when multiple licenses are present
 */
Linerate.prototype.get_license_info = function(callback) {
  var self = this;
  var node = '/status/app/licensing/brief';
  this.get(node, function(err, msg) {
    if (err) {
      callback(err);
      return;
    }
    // the API returns this data in an ASCII table, 
    // convert it to JSON
    msg.data = self._format_license_info(msg.data);
    callback(null, msg);
    return;
  });
};

/**
 * Convenience method - install_license
 *
 * Assumes feature base (the only currently supported
 * license type)
 *
 * license param can be a string with the license or a
 * filepath to the license file
 *
 */
Linerate.prototype.install_license = function(license, callback) {
  var node = '/config/licensing/feature/base';
  var license_string = get_file_or_data(license);
  console.log(license_string);
  this.put(node, license_string, callback);
};

/**
 * Convenience method - create_user
 *
 */
Linerate.prototype.create_user = function(username, callback) {
  var node = '/config/users/' + username;
  this.put(node, username, callback);
};

/**
 * Convenience method - change_password
 *
 */
Linerate.prototype.change_password = function(username, password, callback) {

  var self = this;

  // the REST node/path for user password changed in 2.6.0
  // dynamically handle this to maintain compatibility with 2.5
  this.get_version(function(err, response) {
    if (err) {
      callback(err);
      return;
    }

    var version = response.data;
    var node = '/config/users/' + username;

    if (semver.satisfies(version, '>=2.6.0')) {
      node += '/authenication';
    }

    node += '/password/clear';

    self.put(node, password, callback);

  });

};

/**
 * Convenience method - get_real
 *
 */
Linerate.prototype.get_real = function(real, callback) {
  var node = '/config/app/proxy/realServer/' + real;
  this.get(node, function (err, msg) { callback(err, msg); });
};

/**
 * Convenience method - get_vip
 *
 */
Linerate.prototype.get_vip = function(vip, callback) {
  var node = '/config/app/proxy/virtualIP/' + vip;
  this.get(node, function (err, msg) { callback(err, msg); });
};

/**
 * Convenience method - get_reals
 *
 */
Linerate.prototype.get_reals = function(callback) {
  var node = '/config/app/proxy/realServer';
  var opts = {
    query: {
      op: 'list'
    }
  };
  this.get(node, opts, callback);
};

/**
 * Method to batch work
 *
 */
Linerate.prototype.work = function (node, obj, cb) {
  var self = this;

  // slots will run in series, tasks in slots will run in parallel
  var tasks = [
    [], // queue first
    [],
    [],
    [], // recursive tasks
    []  // queue last
  ];

  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {

      // custom handling for interesting keys
      if (key === 'name') {
        tasks[0].push({name: obj[key]});
      }

      else if (key === 'adminStatus') {
        if (obj[key] === 0) {
          tasks[1].push({ 'adminStatus': obj[key] });
        }
        else if (obj[key] === 1) {
          tasks[4].push({ 'adminStatus': obj[key] });
        }
      }

      // these keys contain a subtree
      else if (['serviceHttp'].indexOf(key) > -1) {
        tasks[3].push({ serviceHttp: obj[key] });
      }

      else {
        var tmp = {};
        tmp[key] = obj[key];
        tasks[2].push(tmp);
      }

    }
  }

  async.forEachOfSeries(tasks, function (value, key, callback) {

    async.each(value, function (item, cb_each) {
      var leaf = Object.keys(item)[0];

      var d = {
        node: null,
        value: {
          data: null,
          type: null
        }
      };

      if (key === 0 && leaf === 'name') {
        // set node for future iterations
        node = node + '/' + item['name'];
        d.node = node;
        d.value.data = item['name'];
        d.value.type = self.get_type('name');
      }
      // recursive
      else if (key === 3) {
        self.work(node + '/' + leaf, item[leaf], function(err, results) {
          if (err) {
            cb_each(err);
            return;
          }
        });
      }
      else {
        d.node = node + '/' + leaf;
        d.value.data = item[leaf];
        d.value.type = self.get_type(leaf);
      }

      self.put(d.node, d.value, function(err, response) {
        if (err) {
          cb_each(err);
          return;
        }
        console.log(response);
        cb_each();
        return;
      });

    },
    function (err) {
      if (err) {
        console.log(err);
      }
      callback();
      return;
    });
  }, 
  function (err) {
    if (err) {
      console.log(err);
    }
    cb();
    return;
  });

};

Linerate.prototype.get_type = function (key) {

  switch (key) {
    case 'adminStatus':
      return 'uint32';
    case 'backlog':
      return 'uint32';
    case 'ipAddress':
      return 'socket-addr';
    case 'isProxy':
      return 'uint32';
    case 'keepAliveTimeout':
      return 'double';
    case 'maxConnections':
      return 'uint32';
    case 'maxEmbryonicConns':
      return 'uint32';
    case 'maxHeaderSize':
      return 'uint32';
    case 'maxInFlight':
      return 'uint32';
    case 'serviceHttp':
      return 'sub';
    case 'serviceType':
      return 'uint32';
    default:
      return 'string';
  }

};

/**
 * Convenience method - create_vip
 *
 * @function
 * @param {Object} data The data object.  Supported object 
 * properties:
 * @param {string} data.name VIP name
 * @param {integer} data.adminStatus Administrative status
 * @param {Object} data.ipAddress An IP address object in socket-addr format
 * @param {string} data.sslProfile SSL profile name
 * @param {string} data.base base template
 * @param {string} data.ipFilter ip filter
 * @param {string} data.tcpOptions 
 * @param {integer} data.serviceType Service type (TCP, HTTP)
 * @param {integer} data.backlog incoming queue length
 * @param {integer} data.maxEmbryonicConns maxEmbryonicConns
 * @param {Object} data.serviceHttp An object containing http service settings
 * @param {function} callback
 *
 * @example
 * create_vip({
 *   name: 'vip_https', 
 *   adminStatus: 1,
 *   ipAddress: { 
 *     addr: '172.16.87.196', 
 *     family: 'af-inet', 
 *     port: 9443 
 *   },
 *   sslProfile: 'self-signed',
 *   serviceType: 1,
 *   serviceHttp: { 
 *     maxInFlight: 2, 
 *     maxHeaderSize: 4096 
 *   }
 *  }, function(err, response) {
 *    // code here
 *  });
 *
 */
Linerate.prototype.create_vip = function(data, callback) {

  var self = this;

  if (!data.name) {
    callback('VIP name required');
    return;
  }

  async.series([
    // check for vip
    function (cb) {
      self.get_vip(data.name, function (err, msg) {

        // if vip exists, bail
        if (msg && msg.httpResponseCode !== 404) {
          console.log(msg);
          cb('vip already exists!');
          return;
        }
       
        cb(null, 'vip does not already exist, ok to create');

      });
    },
    function (cb) {
      var node = '/config/app/proxy/virtualIP';

      self.work(node, data, function (err) {
        if (err) {
          cb(err);
          return;
        }

        cb(null, 'sub-nodes created');
        return;
      });

    }
  ],
  function(err, results) {
    if (err) {
      console.log(err); 
      return;
    }
    
    callback(null, 'vip created');
    return;
  });
 
};
function get_file_or_data(path) {
  var data = path;

  if (fs.existsSync(path)) {
    try {
      data = fs.readFileSync(path, { encoding: 'utf-8' } );
    } catch (e) {
      throw new Error(e);
    }
  }

  return data;
}

module.exports = Linerate;

'use strict';

var request = require('request');
var url = require('url');
var qs = require('querystring');
var fs = require('fs');

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
    }


    //console.log(self.jar.getCookies(options.url));
    callback(null, 'connected');
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
    return callback('\'node\' must be a string');
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
      // pass callback in case of error, we can return
      // directly from check_response
      check_response(response, callback);
      return callback(null, format_response(response.body));
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
    return callback('\'node\' must be a string');
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
    console.log('uh-oh');
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
        // pass callback in case of error, we can return
        // directly from check_response
        if (!check_response(response, callback)) {
          // we should have already called back from check_response(),
          // so just return here
          return;
        }
        callback(null, format_response(response.body));
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
    return callback('\'node\' must be a string');
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
      // pass callback in case of error, we can return
      // directly from check_response
      if (!check_response(response, callback)) {
        // we should have already called back from check_response(),
        // so just return here
        return;
      }

      // a successful DELETE request results in a 204 with no 
      // response body, so handle format_response differently
      // for DELETE
      return callback(null, format_response(
            { message: 'node deleted',
              node: node
            }
          ));

    });
};

/**
 * @private
 * Checks response object for any errors
 */
function check_response(response, cb) {

  var ok = ok_codes(response.req.method);

  if (ok.indexOf(response.statusCode) === -1) {
    cb('Got NOT OK HTTP status code (' +
          response.statusCode +
          ').  Error text: ' +
          JSON.stringify(response.body)
          );
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
function format_response(response) {
  // remember, response is already parsed JSON
  // let's just return the full output for now
  return response;
  //return response[response.requestPath].data;
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

# LineRate Node.js REST API Module

---

### Usage

```js
var Linerate = require('linerate_node_rest_api_module');

var linerate = new Linerate();

linerate.connect({
   host: '127.0.0.1',
   port: 8443,
   username: 'admin',
   password: 'changeme'
 }, function(err, msg) {
 	if (err) {
 		throw new Error(err);
 	}
 	linerate.get_version(function(err, msg) {
 		if (err) {
 			throw new Error(err);
 		}
 		console.log(msg);
 	});
 });
```

### Methods

* connect()
* get()
* put()
* delete()

### Convenience Functions

* get_version()
* get_hostname()
* set_hostname()
* backup_list()
* backup_home()
* util_delete()
* write_mem()
* get_regkey()
* set_regkey()
* get_activation_mode()
* set_activation_mode()
* install_license()
* create_user()

---

### References
* [F5 LineRate](https://linerate.f5.com/)
* [F5 LineRate REST API reference](https://docs.lineratesystems.com/087Release_2.6/250REST_API_Reference_Guide)

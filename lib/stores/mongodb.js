/*
** © 2013 by Philipp Dunkel. Licensed under MIT-License.
*/

module.exports = Create;

var MongoClient = require('mongodb').MongoClient;
var Url = require('url');
var Utils = require('../utils');
var Merge = require('merge').bind(null, true);

function Create(url, options, callback) {
  options = Merge({}, options);
  options.collection = options.collection || Url.parse(url, true).query.collection;
  options.secure = undefined === options.secure ? false : options.secure;
  var store = Object.create(null, {
    url: { value:url },
    options:{ value:options }
  });
  Utils.common(store, get, put, del, key);
  setImmediate(function() { callback(null, store); });
}

function get(key, callback) {
  key = Utils.transformKey(key, this.options);
  var store = this;
  MongoClient.connect(this.url, this.options, function(err, db) {
    if (err) return callback(err);
    db.collection(store.options.collection, function(err, coll) {
      if (err) return callback(err);
      coll.findOne({ id:key }, function(err, data) {
        if (err) return callback(err);
        if (!data) return callback(null, null);
        if ('string' !== typeof data.storage_type) return callback(null, data);
        switch(data.storage_type) {
          case 'string': return callback(null, data.content);
          case 'buffer': return callback(null, new Buffer(data.content, 'binary'));
          case 'json':
            try {
              data.content = JSON.parse(data.content);
            } catch(ex) {
              return callback(ex);
            }
            return callback(null, data);
          default: return callback(new Error('invalid storage type'));
        }
      });
    });
  });
}

function put(key, value, callback) {
  key = Utils.transformKey(key, this.options);
  if ('string' === typeof value) {
    value = { storage_type:'string', content:value };
  } else if (Buffer.isBuffer(value)) {
    value = { storage_type:'buffer', content:value.toString('binary') };
  } else if ('object' === typeof value) {
    if (!this.options.keepJSON) {
      value = { storage_type:'json', content:JSON.stringify(value).trim() };
    }
  } else {
    return setImmediate(function() { callback(new Error('invalid data type: '+(typeof value))); });
  }
  var store = this;
  MongoClient.connect(this.url, this.options, function(err, db) {
    if (err) return callback(err);
    db.collection(store.options.collection, function(err, coll) {
      if (err) return callback(err);
      coll.update({ id:key }, value, { upsert:true }, callback);
    });
  });
}

function del(key, callback) {
  key = Utils.transformKey(key, this.options);
  var store = this;
  MongoClient.connect(this.url, this.options, function(err, db) {
    if (err) return callback(err);
    db.collection(store.options.collection, function(err, coll) {
      if (err) return callback(err);
      coll.remove({ id:key }, callback);
    });
  });
}

function key(pre, callback) {
  pre = Utils.transformKey(pre, this.options);
  var store = this;
  MongoClient.connect(this.url, this.options, function(err, db) {
    if (err) return callback(err);
    db.collection(store.options.collection, function(err, coll) {
      if (err) return callback(err);
      coll.find({ id:new RegExp('^'+pre) }, { id:1 }, function(err, cursor) {
        if (err) return callback(err);
        cursor.toArray(function(err, data) {
          if (err) return callback(err);
          data = data.map(function(item) {
            return item.id;
          });
          callback(null, data);
        });
      });
    });
  });
}

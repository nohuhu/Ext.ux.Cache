/*
 * General purpose caching facility for Ext JS applications. Sophisticated and fast,
 * it ensures that values are stored and retrieved correctly, preserving perfect
 * round-trip compatibility. Uses webStorage in newer browsers, with automatic
 * fallback to in-memory storage in older browsers.
 *
 * Version 0.99.1, compatible with Ext JS 4.0 and 4.1
 *
 * Copyright (c) 2011-2012 Alexander Tokarev.
 *  
 * This code is licensed under the terms of the Open Source LGPL 3.0 license.
 * Commercial use is permitted to the extent that the code/component(s) do NOT
 * become part of another Open Source or Commercially licensed development library
 * or toolkit without explicit permission.
 * 
 * License details: http://www.gnu.org/licenses/lgpl.html
 * Github repo: https://github.com/nohuhu/Ext.ux.Cache
 */

Ext.ns('Ext.ux');

Ext.define('Ext.ux.Cache', {

    // Prefix to use with Web Storage
    keyPrefix: 'Ext.ux.Cache.',
    
    // Default in-memory storage implements API compatible with webStorage
    storage: {
        items:  {},
        keys:   [],
        length: 0,
        
        key: function(index) {
            return this.keys[index];
        },
        
        getItem: function(key) {
            return this.items[key];
        },
        
        setItem: function(key, value) {
            var me = this;
            
            if ( !me.items[key] ) {
                me.keys.push(key);
                me.length++;
            };
            
            me.items[key] = value;
        },
        
        removeItem: function(key) {
            var me = this;
            
            if ( !me.items[key] ) return;
            
            Ext.Array.remove(me.keys, key);
            delete me.items[key];
            me.length--;
        },
        
        clear: function() {
            var me = this;
            
            me.items  = {};
            me.keys   = [];
            me.length = 0;
        }
    },

    /**
     * @constructor
     *
     * @param {Object} config
     * @param {String} .storage Storage type: 'permanent' or 'session'. Default: 'session'.
     * @param {String} .keyPrefix (optional) Key prefix to prepend to webStorage keys.
     *      Default: 'Ext.ux.Cache.'
     */
    constructor: function(config) {
        var me = this;
        
        if ( config.storage === 'permanent' ) {
            if ( !Ext.isIE6 && !Ext.isIE7 && (window.localStorage != undefined) ) {
                me.storage    = window.localStorage;
                me.webStorage = true;
            };
        }
        else if ( config.storage === 'session' || !config.storage ) {
            if ( !Ext.isIE6 && !Ext.isIE7 && (window.sessionStorage != undefined) ) {
                me.storage    = window.sessionStorage;
                me.webStorage = true;
            };
        };
        
        delete config['storage'];
        
        if ( !me.webStorage ) {
            delete config['keyPrefix'];    // Not used with memory storage
            me.keyPrefix = '';
        };
        
        Ext.apply(me, config);
        
        me.functionTable = {
            'undefined': function() { return undefined },
            'null':      function() { return null      },
            'string':    me._deserialize_string,
            'number':    me._deserialize_number,
            'boolean':   me._deserialize_boolean,
            'date':      me._deserialize_date,
            'array':     me._deserialize_array,
            'object':    me._deserialize_object
        };
    },
    
    /**
     * set
     *
     * Adds specified key/value pair to cache, with optional expiration modifier.
     * Items with no expiration are considered persistent and are placed in localStorage;
     * items with specified expiration date or time-to-live value will be placed in sessionStorage.
     * It is possible to add a non-expiring item to sessionStorage.
     *
     * Existence of the key is not checked, so if new value is passed with old key,
     * old value gets replaced.
     *
     * @param {String} key Cache key
     * @param {Mixed} value Cache value, can be of any primitive type, Array or Object
     * @param {Int/Date} expires Can be a Date object for particular date and time of
     *      item expiration, or number of milliseconds to live.
     *
     * @return {Mixed} Input value
     */
     set: function(key, value, expires) {
        var me = this,
            type, exp;
        
        // Check for invalid input first
        if ( !Ext.isString(key) || key === '' )
            Ext.Error.raise('Cache key must be a non-empty string');
        
        if ( value === undefined )
            Ext.Error.raise('Cache value must be defined primitive, object or null');
        
        type = me._get_value_type(value);
        if ( type == 'function' || type == 'regexp' || type == 'element' ||
             type == 'textnode' || type == 'whitespace' )
                Ext.Error.raise('Cache cannot store ' + type + ' type values');
        
        if ( expires !== undefined && (!Ext.isNumber(expires) && !Ext.isDate(expires)) )
            Ext.Error.raise('Cache expiration modifier must be a number of milliseconds or Date object');
        
        // Ensure there is no value with the same key
        me.remove(key);

        exp = Ext.isDate(expires)    ? expires
            : Ext.isNumeric(expires) ? Ext.Date.add(new Date(), Ext.Date.MILLI, expires)
            :                          undefined
            ;

        me.storage.setItem( me.keyPrefix + key, me._freeze({ value: value, expires: exp }) );
        
        return value;
    },
     
    /**
     * get
     *
     * Returns value for specified key from the cache.
     *
     * @param {String} key The key to look up in cache.
     *
     * @return {Mixed} Value
     */
    get: function(key) {
        var me = this,
            item;
        
        // In order to see if it's expired, we need to fetch it first
        item = me._fetch_value(key);
        
        if ( item === undefined ) return;   // Not found
        
        // If it has expired, remove it and return failure
        if ( item.expires && item.expires < +Ext.Date.now() ) {
            me.remove(key);
            return undefined;
        };
        
        // We got the value and it's not expired! Cool.
        return item.value;
    },
    
    /**
     * has
     *
     * Returns true if there is an item for such key in the cache.
     *
     * @param {String} key The key to look up in cache.
     *
     * @return {Boolean}
     */
    has: function(key) {
        var me = this;

        return me._fetch_value(key) !== undefined;
    },
    
    /**
     * keys
     *
     * Returns the list of keys in cache.
     *
     * @return {String[]} Array of keys
     */
    keys: function() {
        var me = this,
            keys;
        
        // Key soup
        keys = me._get_keys(me.storage) || [];
        
        return keys;
    },
    
    /**
     * remove
     *
     * Removes an item with specified key from the cache.
     *
     * @param {String} key The key to remove from cache.
     */
    remove: function(key) {
        var me = this;

        me.storage.removeItem(me.keyPrefix + key);
    },
    
    /**
     * clear
     *
     * Removes all items from cache
     */
    clear: function() {
        var me = this,
            keys;
            
        if ( !me.webStorage ) {
            me.storage.clear();     // Memory storage is never shared
            return;
        };
        
        keys = me.keys();
        
        for ( var i = 0, l = keys.length; i < l; i++ ) {
            me.remove( keys[i] );
        };
    },
    
    /**
     * @private Returns all keys from given Storage object
     */
    _get_keys: function(storage) {
        var me   = this,
            pfx  = me.keyPrefix,
            keys = [];
        
        for ( var i = 0, l = storage.length; i < l; i++ ) {
            var key = storage.key(i),
                idx;
            
            // Ugh. All this stupidity just because regexen suck in JavaScript :/
            idx = key.indexOf(pfx);
            
            if ( idx != -1 ) {
                var short_key = key.substr(idx + pfx.length);
                keys.push(short_key);
            };
        };
        
        return keys;
    },
    
    /**
     * @private Returns value type
     */
    _get_value_type: function(value) {
        return Ext.typeOf(value);
    },
    
    /**
     * @private Serializes an undefined value
     */
    _serialize_undefined: function(value) {
        return { 'type': 'undefined' };
    },
    
    /**
     * @private Serializes a null value
     */
    _serialize_null: function(value) {
        return { 'type': 'null' };
    },
    
    /**
     * @private Serializes a string value
     */
    _serialize_string: function(value) {
        return { 'type': 'string', 'value': value };
    },
    
    /**
     * @private Serializes a number value
     */
    _serialize_number: function(value) {
        if ( value !== -Infinity && value !== Infinity && value.toString() !== 'NaN' )
            return { 'type': 'number', 'value': value }
        else
            return { 'type': 'number', 'value': value+'' };
    },
    
    /**
     * @private Serializes a boolean value
     */
    _serialize_boolean: function(value) {
        return { 'type': 'boolean', 'value': value ? 'true' : 'false' };
    },
    
    /**
     * @private Serializes a date value
     */
    _serialize_date: function(value) {
        return { 'type': 'date', 'value': (value-0)+'' };
    },
    
    /**
     * @private Serializes array of values
     */
    _serialize_array: function(array) {
        var me = this,
            result = [];
        
        for ( var i = 0, l = array.length; i < l; i++ ) {
            var item = array[i];
            
            result.push( me._serialize_value( me._get_value_type(item), item ) );
        };
        
        return { 'type': 'array', 'value': result };
    },
    
    /**
     * @private Serializes object (hash)
     */
    _serialize_object: function(object) {
        var me = this,
            result = {};
        
        for ( var i in object ) {
            if ( !object.hasOwnProperty(i) ) continue;
            
            var item = object[i];
            
            result[i] = me._serialize_value( me._get_value_type(item), item );
        };
        
        return { 'type': 'object', 'value': result };
    },
    
    /**
     * @private Serializes value of specified type into storage format
     */
    _serialize_value: function(type, value) {
        var me = this;
        
        switch ( type ) {
        case 'undefined':   return me._serialize_undefined(value);
        case 'null':        return me._serialize_null(value);
        case 'string':      return me._serialize_string(value);
        case 'number':      return me._serialize_number(value);
        case 'boolean':     return me._serialize_boolean(value);
        case 'date':        return me._serialize_date(value);
        case 'object':      return me._serialize_object(value);
        case 'array':       return me._serialize_array(value);
        default:
            Ext.Error.raise({ msg: 'Invalid value type', type: type });
        };
    },
    
    /**
     * @private Serializes a value in depth into storage format and then to string
     */
    _freeze: function(value) {
        var me = this,
            result;
            
        if ( !me.webStorage ) return value;     // Always fresh from the memory garden.
        
        result = me._serialize_value( me._get_value_type(value), value);
        
        return Ext.JSON.encode(result);
    },
    
    /**
     * @private Checks if serialized value is in proper storage format.
     * Throws an exception if value is invalid, otherwise returns true.
     */
    _check_serialized: function(value) {
        if ( !Ext.isObject(value) || !value.hasOwnProperty('type') ||
             ((value.type != 'undefined' && value.type != 'null') &&
                !value.hasOwnProperty('value')) )
        {
            Ext.Error.raise({
                msg:   'Invalid serialized value',
                value: value
            });
        };
        
        return true;
    },
    
    /**
     * @private Deserializes string value
     */
    _deserialize_string: function(value) {
        return value+'';
    },
    
    /**
     * @private Deserializes number value
     */
    _deserialize_number: function(value) {
        switch ( value ) {
        case '-Infinity':   return -Infinity;
        case 'Infinity':    return Infinity;
        case 'NaN':         return NaN;
        default:            return +value;
        };
    },
    
    /**
     * @private Deserializes boolean value
     */
    _deserialize_boolean: function(value) {
        switch ( value ) {
        case 'true':    return true;
        case 'false':   return false;
        default:
            Ext.Error.raise({ msg: 'Invalid serialized boolean value', value: value });
        };
    },
    
    /**
     * @private Deserializes date value
     */
    _deserialize_date: function(value) {
        return new Date( value-0 );
    },
    
    /**
     * @private Deserializes an array
     */
    _deserialize_array: function(value) {
        var me     = this,
            result = [];
        
        for ( var i = 0, l = value.length; i < l; i++ ) {
            var item       = value[i],
                item_type  = item['type'],     // Next level deep
                item_value = item['value'];
            
            if ( !me._check_serialized(item) ) return;      // Pure formality
            
            result.push( me._deserialize_value(item_type, item_value) );
        };
        
        return result;
    },
    
    /**
     * @private Deserializes an object
     */
    _deserialize_object: function(value) {
        var me     = this,
            result = {};
        
        for ( var i in value ) {
            var item       = value[i],
                item_type  = item['type'],     // Next level deep
                item_value = item['value'];
            
            if ( !me._check_serialized(item) ) return;      // Will go boom
            
            result[i] = me._deserialize_value(item_type, item_value);
        };
        
        return result;
    },
    
    /**
     * @private Deserializes string value to specified type
     */
    _deserialize_value: function(type, value) {
        var me = this,
            functionTable = me.functionTable,
            fn;
        
        fn = functionTable[type];

        if ( fn ) {
            return fn.call(me, value);
        }
        else {
            Ext.Error.raise({ msg: 'Invalid serialized value type', type: type });
        };
    },
    
    /**
     * @private Deserializes deeply frozen structure and returns native data types
     */
    _thaw: function(value) {
        var me = this,
            thawed;
        
        if ( !me.webStorage ) return value;     // Already fresh!
        
        thawed = Ext.JSON.decode(value);
        
        return me._deserialize_value( thawed['type'], thawed['value'] );
    },
    
    /**
     * @private Returns deserialized value from cache
     */
    _fetch_value: function(key) {
        var me = this,
            value;

        value = me.storage.getItem(me.keyPrefix + key);
        
        return value ? me._thaw(value) : undefined;
    }
});

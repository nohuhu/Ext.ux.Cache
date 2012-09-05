/*
 * @title Ext.ux.Cache test suite
 *
 * @css ../extjs/resources/css/ext-all.css
 * @script ../extjs/ext-debug-w-comments.js
 *
 * @script ../ux/Cache.js
 */

describe('Ext.ux.Cache test suite', function() {
    var cache;
    
    beforeEach(function() {
        if ( window.localStorage )
            window.localStorage.clear();
        if ( window.sessionStorage )
            window.sessionStorage.clear();
    });
    
    /*
        Basic tests
    */
    it('should be able to create Cache object', function() {
        cache = Ext.create('Ext.ux.Cache', {
            keyPrefix: 'Ext.ux.test.Cache.',
            storage:   'permanent'
        });
        
        expect(cache).toBeDefined();
        
        if ( Ext.isIE6 || Ext.isIE7 )
            expect(cache.keyPrefix).toEqual('')
        else
            expect(cache.keyPrefix).toEqual('Ext.ux.test.Cache.');
        
        if ( Ext.isIE6 || Ext.isIE7 ) {     // No Web Storage
            expect( cache.storage.remainingSpace ).toBeUndefined(); // No such property
        }
        else if ( Ext.isIE8 ) {
            expect ( cache.storage.remainingSpace > 0 ).toBeTruthy();
        }
        else {
            expect( cache.storage === window.localStorage ).toBeTruthy();
        };
    });
    
    /*
        Invalid input
    */
    it('should choke without key', function() {
        expect(function(){ cache.set()         }).toThrow('Cache key must be a non-empty string');
        expect(function(){ cache.set(1)        }).toThrow('Cache key must be a non-empty string');
        expect(function(){ cache.set(new Date) }).toThrow('Cache key must be a non-empty string');
        expect(function(){ cache.set('')       }).toThrow('Cache key must be a non-empty string');
        expect(function(){ cache.set(null)     }).toThrow('Cache key must be a non-empty string');
    });
    
    it('should not accept undefined value', function() {
        expect(function(){ cache.set('foo', undefined) }).
            toThrow('Cache value must be defined primitive, object or null');
    });
    
    it('should not cache functions', function() {
        expect(function(){ cache.set('foo', function(){'foo'}) }).
            toThrow('Cache cannot store function type values');
    });
    
    it('should not cache regexps', function() {
        expect(function(){ cache.set('foo', /foo!/) }).
            toThrow('Cache cannot store regexp type values');
    });
    
    it('should not cache DOM elements', function() {
        var el = Ext.getBody().createChild({ id: 'testDiv' }).dom;
        
        expect(function(){ cache.set('foo', el) }).
            toThrow('Cache cannot store element type values');
    });
    
    it('should not accept wrong expiration modifier', function() {
        expect(function(){ cache.set('foo', 'bar', null) }).
            toThrow('Cache expiration modifier must be a number of milliseconds or Date object');
        expect(function(){ cache.set('foo', 'bar', 'qux') }).
            toThrow('Cache expiration modifier must be a number of milliseconds or Date object');
        expect(function(){ cache.set('foo', 'bar', {}) }).
            toThrow('Cache expiration modifier must be a number of milliseconds or Date object');
        expect(function(){ cache.set('foo', 'bar', []) }).
            toThrow('Cache expiration modifier must be a number of milliseconds or Date object');
    });
    
    /*
        Basic set/remove
    */
    if ( Ext.isIE6 || Ext.isIE7 ) {     // No Web Storage support
        it('should be able to add and remove items', function() {
            var key   = 'test_add_remove',
                value = 'foo';
            
            cache.set(key, value);
            expect( cache.storage.items[key] ).toEqual({ value: value, expires: undefined });
            cache.remove(key);
            expect( cache.storage.items[key] ).toEqual( null );
            
            cache.set(key, value, -1);
            expect( cache.storage.items[key] ).toEqual({ value: value, expires: undefined });
            cache.remove(key);
            expect( cache.storage.items[key] ).toEqual( null );
        });
        
        it('should be able to clear the cache', function() {
            cache.set('test_clear_0', 'foo');
            cache.set('test_clear_1', 'bar');
            
            cache.clear();
            
            expect( Ext.Object.getKeys(cache.items).length ).toEqual(0);
        });
        
        it('should be able to tell if item is there', function() {
            var key   = 'test_has',
                value = 'splurge';
            
            cache.set(key, value);
            expect( cache.has(key) ).toBeTruthy();
            
            cache.set(key, value, -1);
            expect( cache.has(key) ).toBeTruthy();
            
            cache.clear();
        });
        
        it('should be able to list all keys in cache', function() {
            cache.set('foo', 'ugh!');
            cache.set('bar', 'argh!', -1);
            cache.set('qux', 'oops!', Ext.Date.add(new Date(), Ext.Date.MINUTE, 15));
            
            var keys = cache.keys();
            
            expect( Ext.Array.sort(keys) ).toEqual( Ext.Array.sort(['foo', 'bar', 'qux']) );
        });
    }
    else {
        it('should be able to add and remove items', function() {
            var key   = 'test_add_remove',
                value = 'foo',
                pfx   = cache.keyPrefix;
            
            cache.set(key, value);
            expect( Ext.JSON.decode(window.localStorage.getItem(pfx + key)) ).toEqual({
                type: 'object',
                value: {
                    value:   { type: 'string', value: value },
                    expires: { type: 'undefined' }
                }
            });
            cache.remove(key);
            expect( window.localStorage.getItem(pfx + key) ).toEqual( null );
        });
        
        it('should be able to clear the cache', function() {
            cache.set('test_clear_0', 'foo');
            cache.set('test_clear_1', 'bar');
            
            cache.clear();
            
            expect( window.sessionStorage.length ).toEqual(0);
            expect( window.localStorage.length   ).toEqual(0);
        });
        
        it('should clear only our items from the cache', function() {
            window.sessionStorage.setItem('session_foo', 'bar');
            window.localStorage.setItem('local_foo', 'qux');
            
            cache.set('test_clear_2', 'mumbles');
            cache.set('test_clear_3', 'splurge', -1);
            
            expect( window.sessionStorage.length ).toEqual(1);
            expect( window.localStorage.length   ).toEqual(3);
            
            cache.clear();
            
            expect( window.sessionStorage.length ).toEqual(1);
            expect( window.localStorage.length   ).toEqual(1);
        });
        
        it('should be able to tell if item is there', function() {
            var key   = 'test_has',
                value = 'splurge';
            
            cache.set(key, value);
            expect( cache.has(key) ).toBeTruthy();
            
            cache.set(key, value, -1);
            expect( cache.has(key) ).toBeTruthy();
        });
        
        it('should be able to list all keys in cache', function() {
            window.sessionStorage.setItem('session_foo_0', 'bar');
            window.sessionStorage.setItem('session_foo_1', 'mumbles');
            window.localStorage.setItem('local_foo_0', 'qux');
            window.localStorage.setItem('local_foo_1', 'splurge');
            
            cache.set('foo', 'ugh!');
            cache.set('bar', 'argh!', -1);
            cache.set('qux', 'oops!', Ext.Date.add(new Date(), Ext.Date.MINUTE, 15));
            
            var keys = cache.keys();
            
            expect( Ext.Array.sort(keys) ).toEqual( Ext.Array.sort(['foo', 'bar', 'qux']) );
        });
    };
    
    /*
        Valid input
    */
    it('should work with numbers', function() {
        var ints = [-Infinity, -10, -1, 0, 1, 10, 42, +Infinity, NaN, 0.25];
        
        for ( var i = 0, l = ints.length; i < l; i++ ) {
            var set_val = ints[i],
                get_val = undefined;
            
            cache.set('int_' + i, set_val);
            get_val = cache.get('int_' + i);
            
            expect(typeof get_val).toEqual('number');
            if ( get_val === -Infinity || get_val === Infinity || get_val.toString() === 'NaN' )
                expect( Ext.isNumber(get_val) ).toBeFalsy();
            else
                expect( Ext.isNumber(get_val) ).toBeTruthy();
            if ( get_val.toString() !== 'NaN' )
                expect(get_val).toEqual(set_val);
        };
    });
    
    it('should work with strings', function() {
        var strs = ['foo', 'bar', ''];
        
        for ( var i = 0, l = strs.length; i < l; i++ ) {
            var set_val = strs[i],
                get_val = undefined;
            
            cache.set('str_' + i, set_val);
            get_val = cache.get('str_' + i);
            
            expect(typeof get_val).toEqual('string');
            expect( Ext.isString(get_val) ).toBeTruthy();
            expect(get_val).toEqual(set_val);
        };
    });
    
    it('should work with dates', function() {
        var dates = [new Date()];
        
        for ( var i = 0, l = dates.length; i < l; i++ ) {
            var set_val = dates[i],
                get_val = undefined;
            
            cache.set('date_' + i, set_val);
            get_val = cache.get('date_' + i);
            
            expect(typeof get_val).toEqual('object');
            expect( Ext.isDate(get_val) ).toBeTruthy();
            expect(get_val).toEqual(set_val);
        };
    });
    
    it('should work with null', function() {
        cache.set('null', null);
        var n = cache.get('null');
        
        expect(typeof n).toEqual('object');     // JavaScript is so JavaScriptey!
        expect(n).toBeNull();
    });
    
    it('should work with arrays', function() {
        var arrs = [
                        [], ['foo', 'bar', Infinity], [undefined, -Infinity, 'qux', null],
                        [ 'foo', [ Infinity, new Date(), true, [ 'bar', undefined, 'qux' ] ] ]
                   ];
        
        for ( var i = 0, l = arrs.length; i < l; i++ ) {
            var set_val = arrs[i],
                get_val = undefined;
            
            cache.set('arr_' + i, set_val);
            get_val = cache.get('arr_' + i);
            
            expect(typeof get_val).toEqual('object');
            expect( Ext.isArray(get_val) ).toBeTruthy();
            expect(get_val).toEqual(set_val);
        };
    });
    
    it('should work with objects', function() {
        var objs = [ {}, { foo: 'bar' }, { answer: 42, name: 'Quux', money: +Infinity } ];
        
        for ( var i = 0, l = objs.length; i < l; i++ ) {
            var set_val = objs[i],
                get_val = undefined;
            
            cache.set('obj_' + i, set_val);
            get_val = cache.get('obj_' + i);
            
            expect(typeof get_val).toEqual('object');
            expect( Ext.isObject(get_val) ).toBeTruthy();
            expect(get_val).toEqual(set_val);
        };
    });
    
    it('should work with booleans', function() {
        var bools = [ true, false ];
        
        for ( var i = 0; i < bools.length; i++ ) {
            var set_val = bools[i],
                get_val = undefined;
            
            cache.set('bool_' + i, set_val);
            get_val = cache.get('bool_' + i);
            
            expect(typeof get_val).toEqual('boolean');
            expect( Ext.isBoolean(get_val) ).toBeTruthy();
            expect(get_val).toEqual(set_val);
        };
    });
    
    /*
        Expiration tests
    */
    it('should expire in 20 ms', function() {
        var key   = 'expires_in_20_ms',
            value = 'foo',
            ttl   = Ext.isGecko ? 50 : 20;
            
        runs(function() {
            cache.set(key, value, ttl);
        });
        
        waits(ttl/2);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeDefined();
            expect(get_val).toEqual(value);
        });
        
        waits(ttl/2 + ttl*0.2);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeUndefined();
        });
    });
    
    it('should expire in 100 ms', function() {
        var key   = 'expires_in_100_ms',
            value = 'bar',
            ttl   = 100;
            
        runs(function() {
            cache.set(key, value, ttl);
        });
        
        waits(ttl/2);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeDefined();
            expect(get_val).toEqual(value);
        });
        
        waits(ttl/2 + ttl*0.2);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeUndefined();
        });
    });
    
    it('should expire in 1000 ms', function() {
        var key   = 'expires_in_1000_ms',
            value = 'qux',
            ttl   = 1000;
            
        runs(function() {
            cache.set(key, value, ttl);
        });
        
        waits(ttl/2);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeDefined();
            expect(get_val).toEqual(value);
        });
        
        waits(ttl/2 + ttl*0.2);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeUndefined();
        });
    });
    
    it('should expire at specified date/time', function() {
        var key   = 'expires_at_date',
            value = 'fubar',
            ttl   = 1000;
        
        runs(function() {
            var dt = Ext.Date.add(new Date(), Ext.Date.SECOND, 1);
            cache.set(key, value, dt);
        });
        
        waits(ttl - ttl*0.1);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeDefined();
            expect(get_val).toEqual(value);
        });
        
        waits(ttl*0.1 + 1);
        
        runs(function() {
            var get_val = cache.get(key);
            expect(get_val).toBeUndefined();
        });
    });
    
    /*
        Check if items are stored where they should
    */
    if ( Ext.isIE6 || Ext.isIE7 ) {
        it('should store permanent items in memory', function() {
            cache.set('ie_permanent_item', 'foo');
            
            var cache_item = cache.storage.items['ie_permanent_item'];
            
            expect(cache_item).toEqual({
                value: 'foo',
                expires: undefined
            });
        });
        
        it('should store volatile items in memory', function() {
            cache.set('ie_volatile_item', 'bar', 1000);
            
            var cache_item = cache.storage.items['ie_volatile_item'],
                expiration = Ext.Date.add(new Date(), Ext.Date.SECOND, 1);
            
            expect(cache_item).toEqual({
                value: 'bar',
                expires: expiration
            });
        });
    }
    else {
        it('should store items in permanent localStorage', function() {
            cache.set('ls_permanent_item', 'foo');
            
            var cache_item = localStorage.getItem(cache.keyPrefix + 'ls_permanent_item');
            
            cache_item = Ext.JSON.decode(cache_item);
            
            expect(cache_item).toEqual({
                type: 'object',
                value: {
                    value: { value: 'foo', type: 'string' },
                    expires: { type: 'undefined' }
                }
            });
        });
    };
});

/*!
 * @overview  Ember Data Model Fragments
 * @copyright Copyright 2015 Lytics Inc. and contributors
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/lytics/ember-data.model-fragments/master/LICENSE
 * @version   0.3.3+be9c8c8b
 */

(function() {
    "use strict";
    var ember$lib$main$$default = Ember;
    var ember$data$lib$main$$default = DS;
    var ember$data$lib$system$model$states$$default = DS.RootState;
    var ember$data$lib$system$model$$default = DS.Model;
    var ember$data$lib$system$snapshot$$default = DS.Snapshot;
    var ember$data$lib$system$store$$default = DS.Store;
    var ember$data$lib$system$transform$$default = DS.Transform;

    /**
      @module ember-data.model-fragments
    */

    var model$fragments$lib$fragments$ext$$get = Ember.get;

    /**
      @class Store
      @namespace DS
    */
    ember$data$lib$system$store$$default.reopen({
      /**
        Build a new fragment of the given type with injections
        applied that starts in the 'empty' state.

        @method buildFragment
        @private
        @param {subclass of DS.ModelFragment} type
        @return {DS.ModelFragment} fragment
      */
      buildFragment: function(type) {
        type = this.modelFor(type);

        // TODO: ModelFragment should be able to be referenced by an import here,
        // but because CoreModel depends on the changes to DS.Model in this file,
        // it would create a circular reference
        Ember.assert("The '" + type + "' model must be a subclass of DS.ModelFragment", DS.ModelFragment.detect(type));

        return type.create({
          store: this
        });
      },

      /**
        Create a new fragment that does not yet have an owner record.
        The properties passed to this method are set on the newly created
        fragment.

        To create a new instance of the `name` fragment:

        ```js
        store.createFragment('name', {
          first: "Alex",
          last: "Routé"
        });
        ```

        @method createRecord
        @param {String} type
        @param {Object} properties a hash of properties to set on the
          newly created fragment.
        @return {DS.ModelFragment} fragment
      */
      createFragment: function(type, props) {
        var fragment = this.buildFragment(type);

        if (props) {
          fragment.setProperties(props);
        }

        fragment.send('loadedData');

        return fragment;
      }
    });

    /**
      @class Model
      @namespace DS
      */
    ember$data$lib$system$model$$default.reopen({
      _setup: function() {
        this._super();
        this._fragments = {};
      },

      /**
        Override parent method to snapshot fragment attributes before they are
        passed to the `DS.Model#serialize`.

        @method _createSnapshot
        @private
      */
      _createSnapshot: function() {
        var snapshot = this._super.apply(this, arguments);
        var attrs = snapshot._attributes;

        Ember.keys(attrs).forEach(function(key) {
          var attr = attrs[key];

          // If the attribute has a `_createSnapshot` method, invoke it before the
          // snapshot gets passed to the serializer
          if (attr && typeof attr._createSnapshot === 'function') {
            attrs[key] = attr._createSnapshot();
          }
        });

        return snapshot;
      },

      /**
        If the adapter did not return a hash in response to a commit,
        merge the changed attributes and relationships into the existing
        saved data and notify all fragments of the commit.

        @method adapterDidCommit
      */
      adapterDidCommit: function(data) {
        this._super.apply(this, arguments);

        var fragment;

        // Notify fragments that the record was committed
        for (var key in this._fragments) {
          if (fragment = this._fragments[key]) {
            fragment.adapterDidCommit();
          }
        }
      },

      /**
        Returns an object, whose keys are changed properties, and value is
        an [oldProp, newProp] array. When the model has fragments that have
        changed, the property value is simply `true`.

        Example

        ```javascript
        App.Mascot = DS.Model.extend({
          type: DS.attr('string'),
          name: DS.hasOneFragment('name')
        });

        App.Name = DS.Model.extend({
          first : DS.attr('string'),
          last  : DS.attr('string')
        });

        var person = store.createRecord('person');
        person.changedAttributes(); // {}
        person.get('name').set('first', 'Tomster');
        person.set('type', 'Hamster');
        person.changedAttributes(); // { name: true, type: [undefined, 'Hamster'] }
        ```

        @method changedAttributes
        @return {Object} an object, whose keys are changed properties,
          and value is an [oldProp, newProp] array.
      */
      changedAttributes: function() {
        var diffData = this._super();

        Ember.keys(this._fragments).forEach(function(name) {
          // An actual diff of the fragment or fragment array is outside the scope
          // of this method, so just indicate that there is a change instead
          if (name in this._attributes) {
            diffData[name] = true;
          }
        }, this);

        return diffData;
      },

      /**
        If the model `isDirty` this function will discard any unsaved
        changes, recursively doing the same for all fragment properties.

        Example

        ```javascript
        record.get('name'); // 'Untitled Document'
        record.set('name', 'Doc 1');
        record.get('name'); // 'Doc 1'
        record.rollback();
        record.get('name'); // 'Untitled Document'
        ```

        @method rollback
      */
      rollback: function() {
        this._super();

        // Rollback fragments after data changes -- otherwise observers get tangled up
        this.rollbackFragments();
      },

      /**
        @method rollbackFragments
        @private
        */
      rollbackFragments: function() {
        for (var key in this._fragments) {
          if (this._fragments[key]) {
            this._fragments[key].rollback();
          }
        }
      },

      /**
        @method fragmentDidDirty
        @private
      */
      fragmentDidDirty: function(key, fragment) {
        if (!model$fragments$lib$fragments$ext$$get(this, 'isDeleted')) {
          // Add the fragment as a placeholder in the owner record's
          // `_attributes` hash to indicate it is dirty
          this._attributes[key] = fragment;

          this.send('becomeDirty');
        }
      },

      /**
        @method fragmentDidReset
        @private
        */
      fragmentDidReset: function(key, fragment) {
        // Make sure there's no entry in the owner record's
        // `_attributes` hash to indicate the fragment is dirty
        delete this._attributes[key];

        // Don't reset if the record is new, otherwise it will enter the 'deleted' state
        // NOTE: This case almost never happens with attributes because their initial value
        // is always undefined, which is *usually* not what attributes get 'reset' to
        if (!model$fragments$lib$fragments$ext$$get(this, 'isNew')) {
          this.send('propertyWasReset', key);
        }
      }
    });

    /**
      @module ember-data.model-fragments
    */

    // Ember object prototypes are lazy-loaded
    ember$data$lib$system$model$$default.proto();

    // TODO: is it easier to extend from DS.Model and disable functionality than to
    // cherry-pick common functionality?
    var model$fragments$lib$core$model$$protoProps = [
      '_setup',
      '_unhandledEvent',
      '_createSnapshot',
      'send',
      'transitionTo',
      'isEmpty',
      'isLoading',
      'isLoaded',
      'isDirty',
      'isSaving',
      'isDeleted',
      'isNew',
      'isValid',
      'serialize',
      'changedAttributes',
      'eachAttribute',
      'fragmentDidDirty',
      'fragmentDidReset',
      'rollbackFragments'
    ].reduce(function(props, name) {
      props[name] = ember$data$lib$system$model$$default.prototype[name] || ember$lib$main$$default.meta(ember$data$lib$system$model$$default.prototype).descs[name];
      return props;
    }, {});

    var model$fragments$lib$core$model$$classProps = [
      'attributes',
      'eachAttribute',
      'transformedAttributes',
      'eachTransformedAttribute'
    ].reduce(function(props, name) {
      props[name] = ember$data$lib$system$model$$default[name] || ember$lib$main$$default.meta(ember$data$lib$system$model$$default).descs[name];
      return props;
    }, {});

    /**
      CoreModel is a base model class that has state management, but no relation or
      persistence logic.

      @class CoreModel
    */
    var model$fragments$lib$core$model$$CoreModel = ember$lib$main$$default.Object.extend(model$fragments$lib$core$model$$protoProps, {
      eachRelationship: ember$lib$main$$default.K,
      updateRecordArraysLater: ember$lib$main$$default.K
    });

    model$fragments$lib$core$model$$CoreModel.reopenClass(model$fragments$lib$core$model$$classProps, {
      eachRelationship: ember$lib$main$$default.K
    });

    var model$fragments$lib$core$model$$default = model$fragments$lib$core$model$$CoreModel;

    /**
      @module ember-data.model-fragments
    */

    var model$fragments$lib$fragments$array$stateful$$get = ember$lib$main$$default.get;
    var model$fragments$lib$fragments$array$stateful$$set = ember$lib$main$$default.set;
    var model$fragments$lib$fragments$array$stateful$$splice = Array.prototype.splice;

    /**
      A state-aware array that is tied to an attribute of a `DS.Model` instance.

      @class StatefulArray
      @namespace DS
      @extends Ember.ArrayProxy
    */
    var model$fragments$lib$fragments$array$stateful$$StatefulArray = ember$lib$main$$default.ArrayProxy.extend({
      /**
        A reference to the array's owner record.

        @property owner
        @private
        @type {DS.Model}
      */
      owner: null,

      /**
        The array's property name on the owner record.

        @property name
        @private
        @type {String}
      */
      name: null,

      init: function() {
        this._super();
        this._pendingData = undefined;
        model$fragments$lib$fragments$array$stateful$$set(this, '_originalState', []);
      },

      content: function() {
        return ember$lib$main$$default.A();
      }.property(),

      /**
        @method setupData
        @private
        @param {Object} data
      */
      setupData: function(data) {
        // Since replacing the contents of the array can trigger changes to fragment
        // array properties, this method can get invoked recursively with the same
        // data, so short circuit here once it's been setup the first time
        if (this._pendingData === data) {
          return;
        }

        this._pendingData = data;

        var processedData = this._processData(data);

        // This data is canonical, so create rollback point
        model$fragments$lib$fragments$array$stateful$$set(this, '_originalState', processedData);

        // Completely replace the contents with the new data
        this.replaceContent(0, model$fragments$lib$fragments$array$stateful$$get(this, 'content.length'), processedData);

        this._pendingData = undefined;
      },

      /**
        @method _processData
        @private
        @param {Object} data
      */
      _processData: function(data) {
        // Simply ensure that the data is an actual array
        return ember$lib$main$$default.makeArray(data);
      },

      /**
        @method _createSnapshot
        @private
      */
      _createSnapshot: function() {
        // Since elements are not models, a snapshot is simply a mapping of raw values
        return this.toArray();
      },

      /**
        @method adapterDidCommit
      */
      adapterDidCommit: function() {
        // Fragment array has been persisted; use the current state as the original state
        model$fragments$lib$fragments$array$stateful$$set(this, '_originalState', this.toArray());
      },

      /**
        If this property is `true` the contents of the array do not match its
        original state. The array has local changes that have not yet been saved by
        the adapter. This includes additions, removals, and reordering of elements.

        Example

        ```javascript
        array.toArray(); // [ 'Tom', 'Yehuda' ]
        array.get('isDirty'); // false
        array.popObject(); // 'Yehuda'
        array.get('isDirty'); // true
        ```

        @property isDirty
        @type {Boolean}
        @readOnly
      */
      isDirty: function() {
        return ember$lib$main$$default.compare(this.toArray(), model$fragments$lib$fragments$array$stateful$$get(this, '_originalState')) !== 0;
      }.property('[]', '_originalState'),

      /**
        This method reverts local changes of the array's contents to its original
        state.

        Example

        ```javascript
        array.toArray(); // [ 'Tom', 'Yehuda' ]
        array.popObject(); // 'Yehuda'
        array.toArray(); // [ 'Tom' ]
        array.rollback();
        array.toArray(); // [ 'Tom', 'Yehuda' ]
        ```

        @method rollback
      */
      rollback: function() {
        this.setObjects(model$fragments$lib$fragments$array$stateful$$get(this, '_originalState'));
      },

      /**
        Method alias for `toArray`.

        @method serialize
        @return {Array}
      */
      serialize: function() {
        return this.toArray();
      },

      arrayContentDidChange: function() {
        this._super.apply(this, arguments);

        var record = model$fragments$lib$fragments$array$stateful$$get(this, 'owner');
        var key = model$fragments$lib$fragments$array$stateful$$get(this, 'name');

        // Any change to the size of the fragment array means a potential state change
        if (this.get('isDirty')) {
          record.fragmentDidDirty(key, this);
        } else {
          record.fragmentDidReset(key, this);
        }
      },

      toStringExtension: function() {
        return 'owner(' + model$fragments$lib$fragments$array$stateful$$get(this, 'owner.id') + ')';
      }
    });

    var model$fragments$lib$fragments$array$stateful$$default = model$fragments$lib$fragments$array$stateful$$StatefulArray;

    /**
      @module ember-data.model-fragments
    */

    var model$fragments$lib$fragments$states$$get = ember$lib$main$$default.get;

    var model$fragments$lib$fragments$states$$didSetProperty = ember$data$lib$system$model$states$$default.loaded.saved.didSetProperty;
    var model$fragments$lib$fragments$states$$propertyWasReset = ember$data$lib$system$model$states$$default.loaded.updated.uncommitted.propertyWasReset;

    var model$fragments$lib$fragments$states$$dirtySetup = function(fragment) {
      var record = model$fragments$lib$fragments$states$$get(fragment, '_owner');
      var key = model$fragments$lib$fragments$states$$get(fragment, '_name');

      // A newly created fragment may not have an owner yet
      if (record) {
        record.fragmentDidDirty(key, fragment);
      }
    };

    /**
      Like `DS.Model` instances, all fragments have a `currentState` property
      that reflects where they are in the model lifecycle. However, there are much
      fewer states that a fragment can be in, since the `loading` state doesn't
      apply, `inFlight` states are no different than the owner record's, and there
      is no concept of a `deleted` state.

      This is the simplified hierarchy of valid states for a fragment:

      ```text
      * root
        * empty
        * loaded
          * created
          * saved
          * updated
      ```

      Note that there are no `uncommitted` sub-states because it's implied by the
      `created` and `updated` states (since there are no `inFlight` substates).

      @class FragmentRootState
    */
    var model$fragments$lib$fragments$states$$FragmentRootState = {
      // Include all `DS.Model` state booleans for consistency
      isEmpty: false,
      isLoading: false,
      isLoaded: false,
      isDirty: false,
      isSaving: false,
      isDeleted: false,
      isNew: false,
      isValid: true,

      didSetProperty: model$fragments$lib$fragments$states$$didSetProperty,

      propertyWasReset: ember$lib$main$$default.K,

      becomeDirty: ember$lib$main$$default.K,

      rolledBack: ember$lib$main$$default.K,

      empty: {
        isEmpty: true,

        loadedData: function(fragment) {
          fragment.transitionTo('loaded.created');
        },

        pushedData: function(fragment) {
          fragment.transitionTo('loaded.saved');
        }
      },

      loaded: {
        pushedData: function(fragment) {
          fragment.transitionTo('saved');
        },

        saved: {
          setup: function(fragment) {
            var record = model$fragments$lib$fragments$states$$get(fragment, '_owner');
            var key = model$fragments$lib$fragments$states$$get(fragment, '_name');

            // Abort if fragment is still initializing
            if (!record._fragments[key] || fragment._isInitializing) { return; }

            // Reset the property on the owner record if no other siblings
            // are dirty (or there are no siblings)
            if (!model$fragments$lib$fragments$states$$get(record, key + '.isDirty')) {
              record.fragmentDidReset(key, fragment);
            }
          },

          pushedData: ember$lib$main$$default.K,

          becomeDirty: function(fragment) {
            fragment.transitionTo('updated');
          }
        },

        created: {
          isDirty: true,

          setup: model$fragments$lib$fragments$states$$dirtySetup,
        },

        updated: {
          isDirty: true,

          setup: model$fragments$lib$fragments$states$$dirtySetup,

          propertyWasReset: model$fragments$lib$fragments$states$$propertyWasReset,

          rolledBack: function(fragment) {
            fragment.transitionTo('saved');
          }
        }
      }
    };

    function model$fragments$lib$fragments$states$$mixin(original, hash) {
      for (var prop in hash) {
        original[prop] = hash[prop];
      }

      return original;
    }

    // Wouldn't it be awesome if this was public?
    function model$fragments$lib$fragments$states$$wireState(object, parent, name) {
      object = model$fragments$lib$fragments$states$$mixin(parent ? ember$lib$main$$default.create(parent) : {}, object);
      object.parentState = parent;
      object.stateName = name;

      for (var prop in object) {
        if (!object.hasOwnProperty(prop) || prop === 'parentState' || prop === 'stateName') {
          continue;
        }
        if (typeof object[prop] === 'object') {
          object[prop] = model$fragments$lib$fragments$states$$wireState(object[prop], object, name + "." + prop);
        }
      }

      return object;
    }

    model$fragments$lib$fragments$states$$FragmentRootState = model$fragments$lib$fragments$states$$wireState(model$fragments$lib$fragments$states$$FragmentRootState, null, 'root');

    var model$fragments$lib$fragments$states$$default = model$fragments$lib$fragments$states$$FragmentRootState;

    /**
      @module ember-data.model-fragments
    */

    var model$fragments$lib$fragments$model$$get = ember$lib$main$$default.get;

    /**
      The class that all nested object structures, or 'fragments', descend from.
      Fragments are bound to a single 'owner' record (an instance of `DS.Model`)
      and cannot change owners once set. They behave like models, but they have
      no `save` method since their persistence is managed entirely through their
      owner. Because of this, a fragment's state directly influences its owner's
      state, e.g. when a record's fragment `isDirty`, its owner `isDirty`.

      Example:

      ```javascript
      App.Person = DS.Model.extend({
        name: DS.hasOneFragment('name')
      });

      App.Name = DS.ModelFragment.extend({
        first  : DS.attr('string'),
        last   : DS.attr('string')
      });
      ```

      With JSON response:

      ```json
      {
        "id": "1",
        "name": {
          "first": "Robert",
          "last": "Jackson"
        }
      }
      ```

      ```javascript
      var person = store.getbyid('person', '1');
      var name = person.get('name');

      person.get('isDirty'); // false
      name.get('isDirty'); // false
      name.get('first'); // 'Robert'

      name.set('first', 'The Animal');
      name.get('isDirty'); // true
      person.get('isDirty'); // true

      person.rollback();
      name.get('first'); // 'Robert'
      person.get('isDirty'); // false
      person.get('isDirty'); // false
      ```

      @class ModelFragment
      @namespace DS
      @extends CoreModel
      @uses Ember.Comparable
      @uses Ember.Copyable
    */
    var model$fragments$lib$fragments$model$$ModelFragment = model$fragments$lib$core$model$$default.extend(ember$lib$main$$default.Comparable, ember$lib$main$$default.Copyable, {
      /**
        The fragment's property name on the owner record.

        @property _name
        @private
        @type {String}
      */
      _name: null,

      /**
        A reference to the fragment's owner record.

        @property _owner
        @private
        @type {DS.Model}
      */
      _owner: null,

      /**
        A reference to a state object descriptor indicating fragment's current state.

        @property currentState
        @private
        @type {Object}
      */
      currentState: model$fragments$lib$fragments$states$$default.empty,

      /**
        @method setupData
        @private
        @param {Object} data
      */
      setupData: function(data) {
        var store = model$fragments$lib$fragments$model$$get(this, 'store');
        var type = store.modelFor(this.constructor);
        var serializer = store.serializerFor(type);

        // Setting data means the record is now clean
        this._attributes = {};

        // TODO: do normalization in the transform, not on the fly
        this._data = serializer.normalize(type, data);

        // Initiate state change
        this.send('pushedData');

        // Changed properties must be notified manually
        model$fragments$lib$fragments$model$$notifyProperties(this, ember$lib$main$$default.keys(data));
      },

      /**
        Like `DS.Model#rollback`, if the fragment `isDirty` this function will
        discard any unsaved changes, recursively doing the same for all fragment
        properties.

        Example

        ```javascript
        fragment.get('type'); // 'Human'
        fragment.set('type', 'Hamster');
        fragment.get('type'); // 'Hamster'
        fragment.rollback();
        fragment.get('type'); // 'Human'
        ```

        @method rollback
      */
      rollback: function() {
        var toNotify = ember$lib$main$$default.keys(this._attributes);
        this._attributes = {};

        // Rollback fragments from the bottom up
        this.rollbackFragments();

        // Initiate state change
        this.send('rolledBack');

        // Changed properties must be notified manually
        model$fragments$lib$fragments$model$$notifyProperties(this, toNotify);
      },

      /**
        Compare two fragments by identity to allow `FragmentArray` to diff arrays.

        @method compare
        @param a {DS.ModelFragment} the first fragment to compare
        @param b {DS.ModelFragment} the second fragment to compare
        @return {Integer} the result of the comparison
      */
      compare: function(f1, f2) {
        return f1 === f2 ? 0 : 1;
      },

      /**
        Create a new fragment that is a copy of the current fragment. Copied
        fragments do not have the same owner record set, so they may be added
        to other records safely.

        @method copy
        @return {DS.ModelFragment} the newly created fragment
      */
      copy: function() {
        var store = model$fragments$lib$fragments$model$$get(this, 'store');
        var type = store.modelFor(this.constructor);
        var data = {};

        // TODO: handle copying sub-fragments
        ember$lib$main$$default.merge(data, this._data);
        ember$lib$main$$default.merge(data, this._attributes);

        return this.store.createFragment(type, data);
      },

      /**
        @method adapterDidCommit
      */
      adapterDidCommit: function() {
        // Merge in-flight attributes if any
        if (ember$lib$main$$default.keys(this._inFlightAttributes).length) {
          ember$lib$main$$default.mixin(this._data, this._inFlightAttributes);
          this._inFlightAttributes = {};
        }

        var fragment;

        // Notify fragments that the owner record was committed
        for (var key in this._fragments) {
          if (fragment = this._fragments[key]) {
            fragment.adapterDidCommit();
          }
        }

        // Transition directly to a clean state
        this.transitionTo('saved');
      },

      toStringExtension: function() {
        return 'owner(' + model$fragments$lib$fragments$model$$get(this, '_owner.id') + ')';
      },

      init: function() {
        this._super();
        this._setup();
      }
    });

    function model$fragments$lib$fragments$model$$notifyProperties(context, propNames) {
      ember$lib$main$$default.beginPropertyChanges();
      for (var i = 0, l = propNames.length; i < l; i++) {
        context.notifyPropertyChange(propNames[i]);
      }
      ember$lib$main$$default.endPropertyChanges();
    }

    /**
     * `getActualFragmentType` returns the actual type of a fragment based on its declared type
     * and whether it is configured to be polymorphic.
     *
     * @private
     * @param {String} declaredType the type as declared by `DS.hasOneFragment` or `DS.hasManyFragments`
     * @param {Object} options the fragment options
     * @param {Object} data the fragment data
     * @return {String} the actual fragment type
     */
    function model$fragments$lib$fragments$model$$getActualFragmentType(declaredType, options, data) {
      if (!options.polymorphic || !data) {
        return declaredType;
      }

      var typeKey = options.typeKey || 'type';
      var actualType = data[typeKey];

      return actualType || declaredType;
    }

    var model$fragments$lib$fragments$model$$default = model$fragments$lib$fragments$model$$ModelFragment;

    /**
      @module ember-data.model-fragments
    */

    var model$fragments$lib$fragments$array$fragment$$get = ember$lib$main$$default.get;
    var model$fragments$lib$fragments$array$fragment$$map = ember$lib$main$$default.EnumerableUtils.map;

    /**
      A state-aware array of fragments that is tied to an attribute of a `DS.Model`
      instance. `FragmentArray` instances should not be created directly, instead
      use the `DS.hasManyFragments` attribute.

      @class FragmentArray
      @namespace DS
      @extends StatefulArray
    */
    var model$fragments$lib$fragments$array$fragment$$FragmentArray = model$fragments$lib$fragments$array$stateful$$default.extend({
      /**
        The type of fragments the array contains

        @property type
        @private
        @type {String}
      */
      type: null,

      options: null,

      init: function() {
        this._super();
        this._isInitializing = false;
      },

      /**
        @method _processData
        @private
        @param {Object} data
      */
      _processData: function(data) {
        var record = model$fragments$lib$fragments$array$fragment$$get(this, 'owner');
        var store = model$fragments$lib$fragments$array$fragment$$get(record, 'store');
        var declaredType = model$fragments$lib$fragments$array$fragment$$get(this, 'type');
        var options = model$fragments$lib$fragments$array$fragment$$get(this, 'options');
        var key = model$fragments$lib$fragments$array$fragment$$get(this, 'name');
        var content = model$fragments$lib$fragments$array$fragment$$get(this, 'content');

        // Mark the fragment array as initializing so that state changes are ignored
        // until after all fragments' data is setup
        this._isInitializing = true;

        // Map data to existing fragments and create new ones where necessary
        var processedData = model$fragments$lib$fragments$array$fragment$$map(ember$lib$main$$default.makeArray(data), function(data, i) {
          var fragment = content[i];

          // Create a new fragment from the data array if needed
          if (!fragment) {
            var actualType = model$fragments$lib$fragments$model$$getActualFragmentType(declaredType, options, data);
            fragment = store.buildFragment(actualType);

            fragment.setProperties({
              _owner : record,
              _name  : key
            });
          }

          // Initialize the fragment with the data
          fragment.setupData(data);

          return fragment;
        });

        this._isInitializing = false;

        return processedData;
      },

      /**
        @method _createSnapshot
        @private
      */
      _createSnapshot: function() {
        // Snapshot each fragment
        return model$fragments$lib$fragments$array$fragment$$map(this, function(fragment) {
          return fragment._createSnapshot();
        });
      },

      /**
        @method adapterDidCommit
      */
      adapterDidCommit: function() {
        this._super();

        // Notify all records of commit
        this.invoke('adapterDidCommit');
      },

      /**
        If this property is `true`, either the contents of the array do not match
        its original state, or one or more of the fragments in the array are dirty.

        Example

        ```javascript
        array.toArray(); // [ <Fragment:1>, <Fragment:2> ]
        array.get('isDirty'); // false
        array.get('firstObject').set('prop', 'newValue');
        array.get('isDirty'); // true
        ```

        @property isDirty
        @type {Boolean}
        @readOnly
      */
      isDirty: function() {
        return this._super() || this.isAny('isDirty');
      }.property('@each.isDirty', '_originalState'),

      /**
        This method reverts local changes of the array's contents to its original
        state, and calls `rollback` on each fragment.

        Example

        ```javascript
        array.get('firstObject').get('isDirty'); // true
        array.get('isDirty'); // true
        array.rollback();
        array.get('firstObject').get('isDirty'); // false
        array.get('isDirty'); // false
        ```

        @method rollback
      */
      rollback: function() {
        this._super();
        this.invoke('rollback');
      },

      /**
        Serializing a fragment array returns a new array containing the results of
        calling `serialize` on each fragment in the array.

        @method serialize
        @return {Array}
      */
      serialize: function() {
        return this.invoke('serialize');
      },

      replaceContent: function(idx, amt, fragments) {
        var array = this;
        var record = model$fragments$lib$fragments$array$fragment$$get(this, 'owner');
        var key = model$fragments$lib$fragments$array$fragment$$get(this, 'name');

        // Since all array manipulation methods end up using this method, ensure
        // ensure that fragments are the correct type and have an owner and name
        if (fragments) {
          fragments.forEach(function(fragment) {
            var owner = model$fragments$lib$fragments$array$fragment$$get(fragment, '_owner');

            ember$lib$main$$default.assert("Fragments can only belong to one owner, try copying instead", !owner || owner === record);
            ember$lib$main$$default.assert("You can only add '" + model$fragments$lib$fragments$array$fragment$$get(array, 'type') + "' fragments to this property", (function (type) {
              if (fragment instanceof type) {
                return true;
              } else if (ember$lib$main$$default.MODEL_FACTORY_INJECTIONS) {
                return fragment instanceof type.superclass;
              }

              return false;
            })(model$fragments$lib$fragments$array$fragment$$get(record, 'store').modelFor(model$fragments$lib$fragments$array$fragment$$get(array, 'type'))));

            if (!owner) {
              fragment.setProperties({
                _owner : record,
                _name  : key
              });
            }
          });
        }

        return model$fragments$lib$fragments$array$fragment$$get(this, 'content').replace(idx, amt, fragments);
      },

      /**
        Adds an existing fragment to the end of the fragment array. Alias for
        `addObject`.

        @method addFragment
        @param {DS.ModelFragment} fragment
        @return {DS.ModelFragment} the newly added fragment
      */
      addFragment: function(fragment) {
        return this.addObject(fragment);
      },

      /**
        Removes the given fragment from the array. Alias for `removeObject`.

        @method removeFragment
        @param {DS.ModelFragment} fragment
        @return {DS.ModelFragment} the removed fragment
      */
      removeFragment: function(fragment) {
        return this.removeObject(fragment);
      },

      /**
        Creates a new fragment of the fragment array's type and adds it to the end
        of the fragment array

        @method createFragment
        @param {DS.ModelFragment} fragment
        @return {DS.ModelFragment} the newly added fragment
        */
      createFragment: function(props) {
        var record = model$fragments$lib$fragments$array$fragment$$get(this, 'owner');
        var store = model$fragments$lib$fragments$array$fragment$$get(record, 'store');
        var type = model$fragments$lib$fragments$array$fragment$$get(this, 'type');
        var fragment = store.createFragment(type, props);

        return this.pushObject(fragment);
      }
    });

    var model$fragments$lib$fragments$array$fragment$$default = model$fragments$lib$fragments$array$fragment$$FragmentArray;
    var model$fragments$lib$util$ember$new$computed$$Ember = window.Ember;
    var model$fragments$lib$util$ember$new$computed$$computed = model$fragments$lib$util$ember$new$computed$$Ember.computed;
    var model$fragments$lib$util$ember$new$computed$$supportsSetterGetter;

    try {
      model$fragments$lib$util$ember$new$computed$$Ember.computed({
        set: function() { },
        get: function() { }
      });
      model$fragments$lib$util$ember$new$computed$$supportsSetterGetter = true;
    } catch(e) {
      model$fragments$lib$util$ember$new$computed$$supportsSetterGetter = false;
    }

    var model$fragments$lib$util$ember$new$computed$$default = function() {
      var polyfillArguments = [];
      var config = arguments[arguments.length - 1];

      if (typeof config === 'function' || model$fragments$lib$util$ember$new$computed$$supportsSetterGetter) {
        return model$fragments$lib$util$ember$new$computed$$computed.apply(this, arguments);
      }

      for (var i = 0, l = arguments.length - 1; i < l; i++) {
        polyfillArguments.push(arguments[i]);
      }

      var func;
      if (config.set) {
        func = function(key, value) {
          if (arguments.length > 1) {
            return config.set.call(this, key, value);
          } else {
            return config.get.call(this, key);
          }
        };
      } else {
        func = function(key) {
          return config.get.call(this, key);
        };
      }

      polyfillArguments.push(func);

      return model$fragments$lib$util$ember$new$computed$$computed.apply(this, polyfillArguments);
    };

    /**
      @module ember-data.model-fragments
    */

    var model$fragments$lib$fragments$attributes$$get = ember$lib$main$$default.get;

    function model$fragments$lib$fragments$attributes$$setFragmentOwner(fragment, record, key) {
      ember$lib$main$$default.assert("Fragments can only belong to one owner, try copying instead", !model$fragments$lib$fragments$attributes$$get(fragment, '_owner') || model$fragments$lib$fragments$attributes$$get(fragment, '_owner') === record);
      return fragment.setProperties({
        _owner : record,
        _name  : key
      });
    }


    /**
      `DS.hasOneFragment` defines an attribute on a `DS.Model` or `DS.ModelFragment`
      instance. Much like `DS.belongsTo`, it creates a property that returns a
      single fragment of the given type.

      `DS.hasOneFragment` takes an optional hash as a second parameter, currently
      supported options are:

      - `defaultValue`: An object literal or a function to be called to set the
        attribute to a default value if none is supplied. Values are deep copied
        before being used. Note that default values will be passed through the
        fragment's serializer when creating the fragment.

      Example

      ```javascript
      App.Person = DS.Model.extend({
        name: DS.hasOneFragment('name', { defaultValue: {} })
      });

      App.Name = DS.ModelFragment.extend({
        first  : DS.attr('string'),
        last   : DS.attr('string')
      });
      ```

      @namespace
      @method hasOneFragment
      @for DS
      @param {String} type the fragment type
      @param {Object} options a hash of options
      @return {Attribute}
    */
    function model$fragments$lib$fragments$attributes$$hasOneFragment(declaredTypeName, options) {
      options = options || {};

      var meta = {
        type: 'fragment',
        isAttribute: true,
        isFragment: true,
        options: options
      };

      function setupFragment(record, key, value) {
        var store = record.store;
        var data = record._data[key] || model$fragments$lib$fragments$attributes$$getDefaultValue(record, options, 'object');
        var fragment = record._fragments[key];
        var actualTypeName = model$fragments$lib$fragments$model$$getActualFragmentType(declaredTypeName, options, data);

        // Regardless of whether being called as a setter or getter, the fragment
        // may not be initialized yet, in which case the data will contain a
        // raw response or a stashed away fragment

        // If we already have a processed fragment in _data and our current fragmet is
        // null simply reuse the one from data. We can be in this state after a rollback
        // for example
        if (!fragment && model$fragments$lib$fragments$attributes$$isInstanceOfType(store.modelFor(actualTypeName), data)) {
          fragment = data;
        // Else initialize the fragment
        } else if (data && data !== fragment) {
          fragment || (fragment = model$fragments$lib$fragments$attributes$$setFragmentOwner(store.buildFragment(actualTypeName), record, key));
          //Make sure to first cache the fragment before calling setupData, so if setupData causes this CP to be accessed
          //again we have it cached already
          record._data[key] = fragment;
          fragment.setupData(data);
        } else {
          // Handle the adapter setting the fragment to null
          fragment = data;
        }

        return fragment;
      }

      return model$fragments$lib$util$ember$new$computed$$default({
        set: function(key, value) {
          var fragment = setupFragment(this, key, value);
          var store = this.store;

          ember$lib$main$$default.assert("You can only assign a '" + declaredTypeName + "' fragment to this property", value === null || model$fragments$lib$fragments$attributes$$isInstanceOfType(store.modelFor(declaredTypeName), value));
          fragment = value ? model$fragments$lib$fragments$attributes$$setFragmentOwner(value, this, key) : null;

          if (this._data[key] !== fragment) {
            this.fragmentDidDirty(key, fragment);
          } else {
            this.fragmentDidReset(key, fragment);
          }

          return this._fragments[key] = fragment;
        },
        get: function(key) {
          var fragment = setupFragment(this, key);
          return this._fragments[key] = fragment;
        }
      }).meta(meta);
    }

    // Check whether a fragment is an instance of the given type, respecting model
    // factory injections
    function model$fragments$lib$fragments$attributes$$isInstanceOfType(type, fragment) {
      if (fragment instanceof type) {
        return true;
      } else if (ember$lib$main$$default.MODEL_FACTORY_INJECTIONS) {
        return fragment instanceof type.superclass;
      }

      return false;
    }

    /**
      `DS.hasManyFragments` defines an attribute on a `DS.Model` or
      `DS.ModelFragment` instance. Much like `DS.hasMany`, it creates a property
      that returns an array of fragments of the given type. The array is aware of
      its original state and so has a `isDirty` property and a `rollback` method.
      If a fragment type is not given, values are not converted to fragments, but
      passed straight through.

      `DS.hasOneFragment` takes an optional hash as a second parameter, currently
      supported options are:

      - `defaultValue`: An array literal or a function to be called to set the
        attribute to a default value if none is supplied. Values are deep copied
        before being used. Note that default values will be passed through the
        fragment's serializer when creating the fragment.

      Example

      ```javascript
      App.Person = DS.Model.extend({
        addresses: DS.hasManyFragments('name', { defaultValue: [] })
      });

      App.Address = DS.ModelFragment.extend({
        street  : DS.attr('string'),
        city    : DS.attr('string'),
        region  : DS.attr('string'),
        country : DS.attr('string')
      });
      ```

      @namespace
      @method hasManyFragments
      @for DS
      @param {String} type the fragment type (optional)
      @param {Object} options a hash of options
      @return {Attribute}
    */
    function model$fragments$lib$fragments$attributes$$hasManyFragments(declaredTypeName, options) {
      // If a declaredTypeName is not given, it implies an array of primitives
      if (ember$lib$main$$default.typeOf(declaredTypeName) !== 'string') {
        options = declaredTypeName;
        declaredTypeName = null;
      }

      options = options || {};

      var meta = {
        type: 'fragment',
        isAttribute: true,
        isFragment: true,
        options: options,
        kind: 'hasMany'
      };

      function createArray(record, key) {
        var arrayClass = declaredTypeName ? model$fragments$lib$fragments$array$fragment$$default : model$fragments$lib$fragments$array$stateful$$default;

        return arrayClass.create({
          type    : declaredTypeName,
          options : options,
          name    : key,
          owner   : record
        });
      }

      function setupArrayFragment(record, key, value) {
        var data = record._data[key] || model$fragments$lib$fragments$attributes$$getDefaultValue(record, options, 'array');
        var fragments = record._fragments[key] || null;

        //If we already have a processed fragment in _data and our current fragmet is
        //null simply reuse the one from data. We can be in this state after a rollback
        //for example
        if (data instanceof model$fragments$lib$fragments$array$stateful$$default && !fragments) {
          fragments = data;
        // Create a fragment array and initialize with data
        } else if (data && data !== fragments) {
          fragments || (fragments = createArray(record, key));
          record._data[key] = fragments;
          fragments.setupData(data);
        } else {
          // Handle the adapter setting the fragment array to null
          fragments = data;
        }

        return fragments;
      }

      return model$fragments$lib$util$ember$new$computed$$default({
        set: function(key, value) {
          var fragments = setupArrayFragment(this, key, value);

          if (ember$lib$main$$default.isArray(value)) {
            fragments || (fragments = createArray(this, key));
            fragments.setObjects(value);
          } else if (value === null) {
            fragments = null;
          } else {
            ember$lib$main$$default.assert("A fragment array property can only be assigned an array or null");
          }

          if (this._data[key] !== fragments || model$fragments$lib$fragments$attributes$$get(fragments, 'isDirty')) {
            this.fragmentDidDirty(key, fragments);
          } else {
            this.fragmentDidReset(key, fragments);
          }

          return this._fragments[key] = fragments;
        },
        get: function(key) {
          var fragments = setupArrayFragment(this, key);
          return this._fragments[key] = fragments;
        }
      }).meta(meta);
    }

    // Like `DS.belongsTo`, when used within a model fragment is a reference
    // to the owner record
    /**
      `DS.fragmentOwner` defines a read-only attribute on a `DS.ModelFragment`
      instance. The attribute returns a reference to the fragment's owner
      record.

      Example

      ```javascript
      App.Person = DS.Model.extend({
        name: DS.hasOneFragment('name')
      });

      App.Name = DS.ModelFragment.extend({
        first  : DS.attr('string'),
        last   : DS.attr('string'),
        person : DS.fragmentOwner()
      });
      ```

      @namespace
      @method fragmentOwner
      @for DS
      @return {Attribute}
    */
    function model$fragments$lib$fragments$attributes$$fragmentOwner() {
      // TODO: add a warning when this is used on a non-fragment
      return ember$lib$main$$default.computed.alias('_owner').readOnly();
    }

    // The default value of a fragment is either an array or an object,
    // which should automatically get deep copied
    function model$fragments$lib$fragments$attributes$$getDefaultValue(record, options, type) {
      var value;

      if (typeof options.defaultValue === "function") {
        value = options.defaultValue();
      } else if (options.defaultValue) {
        value = options.defaultValue;
      } else {
        return null;
      }

      ember$lib$main$$default.assert("The fragment's default value must be an " + type, ember$lib$main$$default.typeOf(value) == type);

      // Create a deep copy of the resulting value to avoid shared reference errors
      return ember$lib$main$$default.copy(value, true);
    }

    /**
      @module ember-data.model-fragments
    */

    var model$fragments$lib$fragments$transform$$get = Ember.get;
    var model$fragments$lib$fragments$transform$$isArray = Ember.isArray;
    var model$fragments$lib$fragments$transform$$map = Ember.EnumerableUtils.map;

    /**
      Transform for all fragment attributes which delegates work to
      fragment serializers.

      @class FragmentTransform
      @namespace DS
      @extends DS.Transform
    */
    var model$fragments$lib$fragments$transform$$FragmentTransform = ember$data$lib$system$transform$$default.extend({
      deserialize: function(data) {
        // TODO: figure out how to get a handle to the fragment type here
        // without having to patch `DS.JSONSerializer#applyTransforms`
        return data;
      },

      serialize: function(snapshot) {
        if (!snapshot) {
          return null;
        } else if (model$fragments$lib$fragments$transform$$isArray(snapshot)) {
          return model$fragments$lib$fragments$transform$$map(snapshot, model$fragments$lib$fragments$transform$$serializeSnapshot);
        } else {
          return model$fragments$lib$fragments$transform$$serializeSnapshot(snapshot);
        }
      }
    });

    function model$fragments$lib$fragments$transform$$serializeSnapshot(snapshot) {
      // The snapshot can be a primitive value (which could be an object)
      if (!(snapshot instanceof ember$data$lib$system$snapshot$$default)) {
        return snapshot;
      }

      var modelName = snapshot.modelName || snapshot.typeKey;

      return model$fragments$lib$fragments$transform$$get(snapshot, 'record.store').serializerFor(modelName).serialize(snapshot);
    }

    var model$fragments$lib$fragments$transform$$default = model$fragments$lib$fragments$transform$$FragmentTransform;

    var model$fragments$lib$initializers$$initializers = [
      {
        name: "fragmentTransform",
        before: "store",

        initialize: function(container, application) {
          application.register('transform:fragment', model$fragments$lib$fragments$transform$$default);
        }
      }
    ];

    var model$fragments$lib$initializers$$default = model$fragments$lib$initializers$$initializers;

    function model$fragments$lib$main$$exportMethods(scope) {
      scope.ModelFragment = model$fragments$lib$fragments$model$$default;
      scope.FragmentArray = model$fragments$lib$fragments$array$fragment$$default;
      scope.FragmentTransform = model$fragments$lib$fragments$transform$$default;
      scope.hasOneFragment = model$fragments$lib$fragments$attributes$$hasOneFragment;
      scope.hasManyFragments = model$fragments$lib$fragments$attributes$$hasManyFragments;
      scope.fragmentOwner = model$fragments$lib$fragments$attributes$$fragmentOwner;
    }

    /**
      Ember Data Model Fragments

      @module ember-data.model-fragments
      @main ember-data.model-fragments
    */
    var model$fragments$lib$main$$MF = ember$lib$main$$default.Namespace.create({
      VERSION: '0.3.3+be9c8c8b'
    });

    model$fragments$lib$main$$exportMethods(model$fragments$lib$main$$MF);

    // This will be removed at some point in favor of the `MF` namespace
    model$fragments$lib$main$$exportMethods(ember$data$lib$main$$default);

    ember$lib$main$$default.onLoad('Ember.Application', function(Application) {
      model$fragments$lib$initializers$$default.forEach(Application.initializer, Application);
    });

    if (ember$lib$main$$default.libraries) {
      ember$lib$main$$default.libraries.register('Model Fragments', model$fragments$lib$main$$MF.VERSION);
    }

    var model$fragments$lib$main$$default = model$fragments$lib$main$$MF;
}).call(this);

//# sourceMappingURL=ember-data.model-fragments.map
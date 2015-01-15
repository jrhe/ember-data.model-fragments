var env, store, Person, Name, Address;

module("integration/fragments - Persisting Records With Fragments", {
  setup: function() {
    Person = DS.Model.extend({
      name      : DS.hasOneFragment("name"),
      addresses : DS.hasManyFragments("address")
    });

    Name = DS.ModelFragment.extend({
      first  : DS.attr("string"),
      last   : DS.attr("string")
    });

    Address = DS.ModelFragment.extend({
      street  : DS.attr("string"),
      city    : DS.attr("string"),
      region  : DS.attr("string"),
      country : DS.attr("string")
    });

    env = setupStore({
      person  : Person,
      name    : Name,
      address : Address
    });

    store = env.store;
  },

  teardown: function() {
    env = null;
    store = null;
    Name = null;
    Person = null;
    Address = null;
  }
});

test("persisting the owner record in a clean state maintains clean state", function() {
  store.push(Person, {
    id: 1,
    name: {
      first: "Tyrion",
      last: "Lannister"
    },
    addresses: [
      {
        street: "1 Sky Cell",
        city: "Eyre",
        region: "Vale of Arryn",
        country: "Westeros"
      }
    ]
  });

  env.adapter.updateRecord = function(store, type, record) {
    return Ember.RSVP.resolve();
  };

  store.find(Person, 1).then(async(function(person) {
    return person.save();
  })).then(async(function(person) {
    var name = person.get('name');
    var addresses = person.get('addresses');

    ok(!name.get('isDirty'), "`DS.hasOneFragment` fragment is clean");
    ok(!addresses.isAny('isDirty'), "all `DS.hasManyFragments` fragments are clean");
    ok(!addresses.get('isDirty'), "fragment array is clean");
    ok(!person.get('isDirty'), "owner record is clean");
  }));
});

test("persisting the owner record when a fragment is dirty moves owner record, fragment array, and all fragments into clean state", function() {
  store.push(Person, {
    id: 1,
    name: {
      first: "Eddard",
      last: "Stark"
    },
    addresses: [
      {
        street: "1 Great Keep",
        city: "Winterfell",
        region: "North",
        country: "Westeros"
      }
    ]
  });

  env.adapter.updateRecord = function(store, type, record) {
    return Ember.RSVP.resolve();
  };

  store.find(Person, 1).then(async(function(person) {
    var name = person.get('name');
    var address = person.get('addresses.firstObject');

    name.set('first', 'Arya');
    address.set('street', '1 Godswood');

    return person.save();
  })).then(async(function(person) {
    var name = person.get('name');
    var addresses = person.get('addresses');
    var address = addresses.get('firstObject');

    equal(name.get('first'), 'Arya', "`DS.hasOneFragment` change is persisted");
    equal(address.get('street'), '1 Godswood', "`DS.hasManyFragments` change is persisted");
    ok(!name.get('isDirty'), "`DS.hasOneFragment` fragment is clean");
    ok(!addresses.isAny('isDirty'), "all `DS.hasManyFragments` fragments are clean");
    ok(!addresses.get('isDirty'), "fragment array is clean");
    ok(!person.get('isDirty'), "owner record is clean");
  }));
});

test("persisting a new owner record moves the owner record, fragment array, and all fragments into clean state", function() {
  var payload = {
    id: 3,
    name: {
      first: "Daenerys",
      last: "Targaryen"
    },
    addresses: [
      store.createFragment('address', {
        street: "1 Stone Drum",
        city: "Dragonstone",
        region: "Crownlands",
        country: "Westeros"
      })
    ]
  };

  var person = store.createRecord('person');
  person.set('name', store.createFragment('name', payload.name));
  person.set('addresses', payload.addresses);

  env.adapter.createRecord = function(store, type, record) {
    return Ember.RSVP.resolve(payload);
  };

  person.save().then(async(function(person) {
    var name = person.get('name');
    var addresses = person.get('addresses');

    ok(!name.get('isDirty'), "`DS.hasOneFragment` fragment is clean");
    ok(!addresses.isAny('isDirty'), "all `DS.hasManyFragments` fragments are clean");
    ok(!addresses.get('isDirty'), "fragment array is clean");
    ok(!person.get('isDirty'), "owner record is clean");
  }));
});

test("a new record can be persisted with null fragments", function() {
  var person = store.createRecord('person');

  equal(person.get('name'), null, "`DS.hasOneFragment` property is null");
  equal(person.get('addresses'), null, "`DS.hasManyFragments` property is null");

  env.adapter.createRecord = function(store, type, record) {
    return Ember.RSVP.resolve({ id: 1 });
  };

  person.save().then(async(function(person) {
    equal(person.get('name'), null, "`DS.hasOneFragment` property is still null");
    equal(person.get('addresses'), null, "`DS.hasManyFragments` property is still null");
    ok(!person.get('isDirty'), "owner record is clean");
  }));
});

test("the adapter can update fragments on save", function() {
  var data = {
    id: 1,
    name: {
      first: "Eddard",
      last: "Stark"
    },
    addresses: [
      {
        street: "1 Great Keep",
        city: "Winterfell",
        region: "North",
        country: "Westeros"
      }
    ]
  };

  store.push(Person, data);

  env.adapter.updateRecord = function(store, type, record) {
    var payload = Ember.copy(data, true);

    payload.name.first = 'Ned';
    payload.addresses[0].street = '1 Godswood';

    return Ember.RSVP.resolve(payload);
  };

  store.find(Person, 1).then(async(function(person) {
    return person.save();
  })).then(async(function(person) {
    var name = person.get('name');
    var addresses = person.get('addresses');

    ok(!name.get('isDirty'), "`DS.hasOneFragment` fragment is clean");
    ok(!addresses.isAny('isDirty'), "all `DS.hasManyFragments` fragments are clean");
    ok(!addresses.get('isDirty'), "fragment array is clean");
    ok(!person.get('isDirty'), "owner record is clean");
    equal(name.get('first'), 'Ned', "`DS.hasOneFragment` fragment correctly updated");
    equal(addresses.get('firstObject.street'), '1 Godswood', "`DS.hasManyFragments` fragment correctly updated");
  }));
});

test("the adapter can update fragments on reload", function() {
  var data = {
    id: 1,
    name: {
      first: "Brandon",
      last: "Stark"
    },
    addresses: [
      {
        street: "1 Great Keep",
        city: "Winterfell",
        region: "North",
        country: "Westeros"
      }
    ]
  };

  store.push(Person, data);

  env.adapter.find = function(store, type, id, record) {
    var payload = Ember.copy(data, true);

    payload.name.first = 'Bran';
    payload.addresses[0].street = '1 Broken Tower';

    return Ember.RSVP.resolve(payload);
  };

  return store.find(Person, 1).then(function(person) {
    // Access values that will change to prime CP cache
    person.get('name.first');
    person.get('addresses.firstObject.street');

    return person.reload();
  }).then(function(person) {
    var name = person.get('name');
    var addresses = person.get('addresses');

    equal(name.get('first'), 'Bran', "`DS.hasOneFragment` fragment correctly updated");
    equal(addresses.get('firstObject.street'), '1 Broken Tower', "`DS.hasManyFragments` fragment correctly updated");
  });
});

test("`DS.hasManyFragments` array properties are notified on save", function() {
  expect(2);

  var data = {
    id: 1,
    name: {
      first: "Eddard",
      last: "Stark"
    },
    addresses: [
      {
        street: "1 Great Keep",
        city: "Winterfell",
        region: "North",
        country: "Westeros"
      }
    ]
  };

  var PersonProxy = Ember.ObjectProxy.extend({
    observer: function() {
      ok(true, "The array change was observed");
    }.observes('addresses.[]')
  });

  store.push(Person, data);

  env.adapter.updateRecord = function(store, type, record) {
    return Ember.RSVP.resolve(data);
  };

  return store.find(Person, 1).then(function(person) {
    var controller = PersonProxy.create({ content: person });
    return person.save();
  });
});

test("`DS.hasManyFragments` properties are notifed on reload", function() {
  expect(2);

  var Army = DS.Model.extend({
    name     : DS.attr('string'),
    soldiers : DS.hasManyFragments()
  });

  var data = {
    id: 1,
    name: "Golden Company",
    soldiers: [
      "Aegor Rivers",
      "Jon Connington",
      "Tristan Rivers"
    ]
  };

  var ArmyProxy = Ember.ObjectProxy.extend({
    observer: function() {
      equal(this.get('soldiers.length'), 2, "The array change to was observed");
    }.observes('soldiers.[]')
  });

  store.push(Army, data);

  env.adapter.find = function(store, type, record) {
    var updated = Ember.copy(data, true);
    updated.soldiers.shift();

    return Ember.RSVP.resolve(updated);
  };

  return store.find(Army, 1).then(function(army) {
    var proxy = ArmyProxy.create({ content: army });
    return army.reload();
  });
});

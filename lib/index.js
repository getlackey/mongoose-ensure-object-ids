/*jslint node:true, nomen:true */
'use strict';
/*
    Copyright 2015 Enigma Marketing Services Limited

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

var Q = require('q'),
    mongoose = require('mongoose');

module.exports = function (mongoSchema, options) {
    var SchemaModel;

    if (!options) {
        options = {};
    } else {
        // convert space separated values into array
        Object.keys(options).forEach(function (key) {
            options[key] = options[key].split(' ');
        });
    }

    mongoSchema.on('init', function (Model) {
        SchemaModel = Model;
    });

    mongoSchema.statics.ensureObjectIds = function (doc) {
        var promise = new mongoose.Promise(),
            promises = [];

        function searchInDb(item, ref) {
            var RefModel = SchemaModel.model(ref),
                fields = options[ref],
                f = {},
                val;

            if (!RefModel) {
                promise.error(new Error('Unable to find model ' + ref));
                return false;
            }

            if (!fields) {
                promise.error(new Error('Unable to find model\'s (' + ref + ') fields in options'));
                return false;
            }

            if (typeof item === 'string') {
                f.$or = [];

                fields.forEach(function (fieldName) {
                    var q = {};
                    q[fieldName] = item;
                    f.$or.push(q);
                });

                return RefModel
                    .findOne(f)
                    .exec()
                    .then(function (doc) {
                        return doc._id;
                    });
            }

            // assuming it's an object that may contain a matching
            // field to the options
            fields.some(function (fieldName) {
                val = item[fieldName];
                if (val) {
                    f[fieldName] = val;
                    return true;
                }
            });

            if (val) {
                return RefModel
                    .findOne(f)
                    .exec()
                    .then(function (doc) {
                        return doc._id;
                    });
            }

            promise.error(new Error('Unable to find a match to perform a query.'));
            return false;
        }

        function convertToObjId(item, ref) {
            var err;

            if (mongoose.Types.ObjectId.isValid(item)) {
                return item;
            }

            if (item._id) {
                return item._id;
            }

            if (item.id) {
                return item.id;
            }

            if (options[ref]) {
                return searchInDb(item, ref);
            }

            err = new Error('Unable to convert to ObjectId. Please, ensure the schema is valid.');
            promise.error(err);

            return '';
        }

        function convertData(data, schemaPaths) {
            Object.keys(schemaPaths).forEach(function (key) {
                var value = schemaPaths[key],
                    dataValue = data[key],
                    id;

                //  no need to ensure ids in something that doesn't exist
                if (dataValue === undefined || dataValue === null) {
                    return;
                }

                if (value.instance === 'ObjectID' && value.options.ref) {
                    id = convertToObjId(dataValue, value.options.ref);

                    if (id.then !== undefined) {
                        promises.push(id);
                        id.then(function (promisedId) {
                            data[key] = promisedId;
                        }, function (err) {
                            promise.error(err);
                        });
                    } else {
                        data[key] = id;
                    }
                    return;
                }

                if (value.caster && value.caster.instance === 'ObjectID' && value.caster.options.ref) {
                    if (Array.isArray(dataValue)) {
                        dataValue.forEach(function (item, index, arr) {
                            id = convertToObjId(item, value.caster.options.ref);

                            if (id.then !== undefined) {
                                promises.push(id);
                                id.then(function (promisedId) {
                                    arr[index] = promisedId;
                                }, function (err) {
                                    promise.error(err);
                                });
                            } else {
                                arr[index] = id;
                            }
                        });
                    }

                    return;
                }

                if (value.schema) {
                    if (Array.isArray(dataValue) && dataValue.length > 0) {
                        dataValue.forEach(function (item) {
                            convertData(item, value.schema.paths);
                        });
                    } else {
                        convertData(dataValue, value.schema.paths);
                    }
                }
            });

            return true;
        }

        convertData(doc, SchemaModel.schema.paths);

        if (promises.length) {
            Q.all(promises).then(function () {
                promise.complete(doc);
            }, function (err) {
                promise.error(err);
            });
        } else {
            promise.complete(doc);
        }

        return promise;
    };
};
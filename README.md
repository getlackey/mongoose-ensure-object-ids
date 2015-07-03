# Mongoose ensure object ids
Cleans up an object so that all properties that were defined as being a ref in the schema hold a valid ObjectId instead of the provided value.

Let's assume this is your schema:
```
	{
		title: String,
		tags: [{
	        type: Schema.Types.ObjectId,
    	    ref: 'tag'
		}]
	}
```

If your GET routes use [mongoose populate](http://mongoosejs.com/docs/populate.html) this is the objects your users will see:

```
	{
		"_id": "5583e7eb4e6c66874b90ff70"
		"title": "test document"
		"tags": [
			{
				"_id": "5583e7eb4e6c66874b90ff71"
				"name": "my test tag",
				"slug": "my-test-tag"
			}
		]
	}
```

Bu trying to submit that into mongoose will issue a CastError: *'Cast to ObjectId failed for value "xxxxxxx" at path "xxxxxx"'*

By using our plugin the object would be converted into:

```
	{
		"_id": "5583e7eb4e6c66874b90ff70"
		"title": "test document"
		"tags": ["5583e7eb4e6c66874b90ff71"]
	}
```
**_id** or **id** are searched in the tag object and returned in its place.

## Basic usage

Add the plugin to a Mongoose schema:

```
var ensureObjectIds = require('lackey-mongoose-ensure-object-ids'), 
	mongoSchema = new Schema({
		title: String,
		tags: [{
       		type: Schema.Types.ObjectId,
   	    	ref: 'tag'
		}]
	});

mongoSchema.plugin(ensureObjectIds);
```

Then use it on the controller:

```
router.post('/',
    handler(handlerOptions, function (o) {
        o.getBody()
            .then(Product.ensureObjectIds)
            .then(function (doc) {
                Product
                    .create(doc)
                    .then(o.formatOutput('_id:id'))
                    .then(o.handleOutput())
                    .then(o.handle404(), o.handleError());
            }, o.handleError());
    }));
```

The previous example uses our request handler. A more simple example, without the request handler would look something like this:

```
Product
	.ensureObjectIds(req.body)
	.then(function (doc) {
		Product.create(doc, function(err){
			// do something with the error...
			// or reply to the request
		});
	}, function (err) {
		// do something with the error...
	});
```

## With Options - Searching for ids
Our basic example assumes we were provided with an object that contains either an **id** or an **_id** property. To allow any other property that is unique, like a **slug** or a **code**, we would have to search the database to recover the ObjectId.

Setting the plugin:

```
mongoSchema.plugin(ensureObjectIds, {
	// key: Model name
	// value: Space separated field names
	tag: 'slug code'
});
```

By providing the options we define what fields are searchable for each model. The plugin will search them using an **$or** query. Just be careful with collisions when using several searchable fields per model.


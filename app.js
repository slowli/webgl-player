var express = require('express');
var app = express();

app.use('/static', express.static('./public'));

app.set('view engine', 'jade');
app.set('views', './views');

var viewOptions = {
	app_version: process.env.npm_package_version,
	url_root: '',
	static_html: false
};

function setOptions(req, options) {
	options.debug = !!req.query.debug;
	options.dpRatio = (req.query.dp === undefined) ? 1 : parseFloat(req.query.dp);
	return options;
}

app.get('/', function(req, res) {
	res.render('index', viewOptions);
});
['cube', 'planets', 'lake', 'gasoline'].forEach(function(view) {
	app.get('/' + view, function(req, res) {
		var options = setOptions(req, viewOptions);
		res.render(view, options);
	});
});

app.set('port', process.env.PORT || 4000);
var server = app.listen(app.get('port'), function() {
	var host = server.address().address;
	var port = server.address().port;
	console.log('%s-%s is running on port %s', process.env.npm_package_name, 
		process.env.npm_package_version, 
		app.get('port'));
});
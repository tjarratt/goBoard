exports.config = 
{
	production: {url: "table.no.de", port: 80},
	debug: {url: "localhost", port: 8000}
}

exports.debug = function() {
  return this.config.debug;
}

exports.prod = function() {
  return this.config.production;
}
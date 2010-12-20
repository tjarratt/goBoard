var express = require("express"),
    app = express.createServer(
      express.compiler({src: __dirname, enable: ["sass"]}),
      express.staticProvider(__dirname)
    ),
    sys = require("sys");
require(__dirname + "/lib/underscore");
    
//in case we aren't in the latest node
console = console? console : {log: function(message) { sys.puts(message); } 

var controllers = ["board"];

    
app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.listen(8080);
console.log("express server started on port 8080");

app.get("/", function(req, res) {
  res.render("board.jade");
});
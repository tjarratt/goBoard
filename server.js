var express = require("express"),
    app = express.createServer(
      express.compiler({src: __dirname, enable: ["sass"]}),
      express.staticProvider(__dirname)
    ),
    sys = require("sys"),
    redisClient = require("lib/redis-client").createClient(),
    cookie = require("cookie");
    
cookie.secret = "thisIsABadSecret!"; //TODO: set this in a .gitignore file when deploying
require(__dirname + "/lib/uuid");
require(__dirname + "/lib/underscore-min");

//register a global reference to expressApp, for controllers
_app = app; //TODO: find out why it isn't just sufficient for controllers to simply require("express");
_appRoot = __dirname;
_emptyCallback = function() {return;};    //NB: redisClient doesn't like `false` callbacks

//clean up any old data
sys.puts("cleaning up any old games...");
redisClient.keys("room:*", function(e, oldGames) {
  oldGames = oldGames && oldGames.length? oldGames : [];
  _.each(oldGames, function(oldKey, index, context) {
    redisClient.del(oldKey, function(e, result) {
      if (e || !result) {sys.puts("couldn't delete this key: " + oldKey)}
    });
  });
});
redisClient.set("games", 0, _emptyCallback);
    
//in case we aren't in the latest node
console = console? console : {log: function(message) { sys.puts(message); } };

//instantiate controllers
var controllers = ["board", "socket"];
_.each(controllers, function(ctl, index, context) {
  require(__dirname + "/controllers/" + ctl);
});
    
app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.listen(8000);
console.log("express server started on port 8000");

app.get("/", function(req, res) {
  var renderCallback = function(localVars) {
    res.render("index.jade", {locals: localVars});
  }
  
  //look for cookied user
  var cookieValue = req.getCookie("uuid");
  if (!cookieValue) {
    sys.puts("got uncookied user");
    var tempId = Math.uuid();
    res.setCookie("uuid", tempId);
    redisClient.hset("cookie:" + tempId, "name", "unknown", function(e, result) {
      renderCallback({xid: tempId, name: "new user"});
    });
  }
  else {
    sys.puts("got cookied user");
    redisClient.hget("cookie:" + cookieValue, "name", function(e, possibleName) {
      //TODO: check to see if this user has an existing game, in which case we should redirect them to /board/#
      
      possibleName = possibleName ? possibleName : "unknown user";
      renderCallback({xid: cookieValue, name: possibleName});
    });
  }
});

app.get("/logout", function(req, res) {
  res.clearCookie("uuid");
  res.redirect("/");
});
try {
  var express = require("express"),
    app = express.createServer(
      express.compiler({src: __dirname, enable: ["sass"]}),
      express.staticProvider(__dirname)
    ),
    config = require("./config/config"),
    sys = require("sys"),
    redisClient = require("redis").createClient(),
    cookie = require("cookie");
    
  cookie.secret = "thisIsABadSecret!"; //TODO: set this in a .gitignore file when deploying
  require(__dirname + "/lib/uuid");
  require(__dirname + "/lib/underscore-min");
  
  //check command line args for debug
  var args = process.argv.slice(2), //slice out node and script name
      isDebug = args[0];
  isDebug = isDebug == "debug" ? true : false;
}
catch (e) {
  require("sys").puts("error while starting up server, probably external dependencies.");
  require("sys").puts(e);
  return;
}        

/* shamelessly stolen from express docs */
function NotFound(msg){
    this.name = 'NotFound';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

sys.inherits(NotFound, Error);

app.get('/404', function(req, res){
    throw new NotFound;
});

app.get('/500', function(req, res){
    throw new Error('keyboard cat!');
});

app.error(function(err, req, res){
  if (err instanceof NotFound) {
    res.render('404.jade', {locals: { error: err, xid: false} });
  }
  else {
    res.render('500.jade', {
       locals: { error: err, xid: false } 
    });
  }
});
app.use(express.errorHandler({ dumpExceptions: isDebug }));

//register a global reference to expressApp, for controllers
_app = app; //TODO: find out why it isn't just sufficient for controllers to simply require("express");
_appRoot = __dirname;
_config = isDebug? config.debug() : config.prod();
_port = parseInt(_config.port);
_hostname = _config.hostname;
_emptyCallback = function() {return;};    //NB: redisClient doesn't like bool `false` callbacks

//clean up any old data
if (isDebug) {
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
}    
//in case we aren't in the latest node
console = console? console : {log: function(message) { sys.puts(message); } };

//instantiate controllers
var controllers = ["board", "socket"];
_.each(controllers, function(ctl, index, context) {
  require(__dirname + "/controllers/" + ctl);
});
    
app.set("views", __dirname + "/views");
app.set("view engine", "jade");
app.listen(_port);
console.log("express server started on port " + _port.toString());

app.get("/", function(req, res) {
  var renderCallback = function(localVars) {
    localVars.hostname = _hostname;
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

app.get('/*', function(req, res) { //this is kind of misleading, all non-handled routes get redirected to 404
  sys.puts("got unhandled page");
  res.redirect("/404");
});
var expressApp = _app,
    express = require("express"),
    sys = require("sys"),
    redisClient = require(_appRoot + "/lib/redis-client").createClient();
    
require(_appRoot + "/lib/underscore-min");

//init cookieJar and secret for signed cookies
var cookie = require("cookie");
//cookie secret should be set by server.js

exports.renderJSON = function(message, response) {
  /*message = message? JSON.stringify(message) : "";
  response.writeHead(200, {
    'Content-Length': message.length,
    'Content-Type': "application/json"
  });*/
  sys.puts("going to render message " + message);
  sys.puts(sys.inspect(message));
  expressApp.use(express.bodyDecoder());
  response.send(message);
  response.end();
}

exports.getAjaxData = function(req, callback) {
  requestData = "";
  req.on("data", function(chunk) {
    console.log("got chunk:" + chunk);
    requestData += chunk;
  })
  req.on("end", function() {
    console.log("all together now:" + requestData);
    return callback(requestData);
  });
}

//these two should maybe be 404'd, or the path scheme should change, kind of pointless
expressApp.get("/board", function(req, res) {
  res.render("board", {locals: {message: "uhnn-uhnnn-uhh You didn't say the magic word!"}});
});

expressApp.get("/board/new", function(req, res) {
  res.render("board", {locals: {message: "You really shouldn't be here..."}});
});

//interesting stuff starts here
expressApp.post("/board/new", function(req, res) {
  requestData = "";
  req.on("data", function(chunk) {
    console.log("got chunk:" + chunk);
    requestData += chunk;
  })
  req.on("end", function() {
    var params = require('url').parse("board/new?" + requestData, true).query;
    sys.puts("got ajax data for /board/new here: " + requestData);
    
    //requestData = JSON.parse(requestData);
    var userName = params.name;
    var cookie = params.cookie;
    if (!userName || !cookie) {
      sys.puts("got no name, or no cookie on this request for new board");
    }
    sys.puts("creating a game for " + userName + " with cookie: " + cookie);
    
    redisClient.get("games", function(e, result) {
      if (e || !result) {
        sys.puts("got bad result for redis get games");
        thisRoomId = 0;
      } //handle that edge case
      else { thisRoomId = result; }
      sys.puts("get games: " + result);
      
      //redis vs mongodb? incremental counter needed
      redisClient.incr("games", function(e, result) {
        if (e || !result) {
          sys.puts("damn, failed to increment game counter");
        }
      });
      
      var users = JSON.stringify({username: false});
      redisClient.hset("room:" + thisRoomId, "users", users, function(e, result) {
        if (e || (!result && result != 0)) { //daaaaamn you redis
          var badRes = JSON.stringify({"error": e, "result": result});
          return exports.renderJSON(badRes, res);
        }
        
        sys.puts("writing cookie and rendering JSON");
        res.setCookie("room", thisRoomId);
        var jsonResponse = {"roomId": thisRoomId};
        sys.puts("this roomId: " + thisRoomId);
        thisRoomId = parseInt(thisRoomId);
        exports.renderJSON(jsonResponse, res);
        
        redisClient.hmset("cookie:" + cookie, "name", userName, "room", thisRoomId, function(e, result) {
          if (e || !result) {
            sys.puts("error when setting cookie for user: " + userName);
          }
        });
      });
    });
  });
});

expressApp.post("/board/:roomId/start", function(req, res) {
  var roomId = req.params.roomId;
  
  //register color, set up a buffer for play and return true
  var gotAjaxData = function(color) {
    var colors = ["black", "white"];
    if (color in colors) {
      sys.puts("selected valid color: " + color);
      var otherColor = _.without(colors, color)[0];
      redisClient.hset("room:" + roomId, "availableColor", otherColor, function(e, result) {
        return exports.renderJSON(e || !result ? true : false, res); //too much in one line?
      })
    }
    else {
      exports.renderJSON(false, res);
    }
  }
  exports.getAjaxData(req, gotAjaxData);
});

expressApp.get("/board/{roomId}", function(req, res) {
  //check that this room exists
  var roomId = req.params.roomId;
  
  //assumes that this is someone joining a game they were invited to
  //in order for this to be more general, we should inspect their cookie, find the game, figure out what color they should be, THEN render
  redisClient.hget("room:" + roomId, "availableColor", function(e, color) {
    if (e || !color) {
      var errMsg = "An error occurred. This room is not active";
      res.render("board.jade", {locals: {message: errMsg, spectate: false, color: color}});
    }
    if (color == "spectate") {
      var joinMessage = "Two players have already joined. You are spectating.";
      res.render("board.jade", {loclas: {message: joinMessage, spectate: true, color: false}});
    }
  });
  //render page, let the client do the rest
});
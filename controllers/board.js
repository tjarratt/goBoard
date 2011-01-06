var expressApp = _app,
    express = require("express"),
    sys = require("sys"),
    redisClient = require("redis").createClient(),
    assert = require("assert"),
    jStringify = JSON.stringify, 
    jParse = JSON.parse;
    
require(_appRoot + "/lib/underscore-min");

//init cookieJar and secret for signed cookies
var cookie = require("cookie");
//cookie secret should be set by server.js

//TODO: move this into a more convenient place
function hashResultMaybe(hash, key) {
  //short circuit, but be becareful if value is a bool false value like zero
  if (!hash || (!key && typeof key != "number")) {return false;}
  
  var maybeValue = hash[key];
  maybeValue = maybeValue? maybeValue.toString('utf8') : false;
  return maybeValue;
}
function isValidReturn(e, result) {
  return (e || (!result && typeof result != "number") ) ? false : true;
}

//NB: rendering message true or "true" seems to fail, this should be actual json
//and not a primitive string, array, boolean, integer or float
exports.renderJSON = function(message, response) {
  sys.puts("going to render message " + JSON.stringify(message));
  
  expressApp.use(express.bodyDecoder());
  response.header("Content-Length", JSON.stringify(message).length);
  response.header("Content-Type", "application/json");
  
  response.send(message);
  response.end();
  sys.puts("rendered response");
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
  res.render("board", {locals: {xid: false, room: false, known: false, color: false, message: "uhnn-uhnnn-uhh You didn't say the magic word!"}});
});

expressApp.get("/board/new", function(req, res) {
  res.render("board", {locals: {xid: false, room: false, known: false, color: false, message: "You really shouldn't be here..."}});
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
      
      var users = {};
      users[userName] = false;
      
      redisClient.hset("room:" + thisRoomId, "users", JSON.stringify(users), function(e, result) {
        if (e || (!result && result != 0)) { //daaaaamn you redis
          var badRes = JSON.stringify({"error": e, "result": result});
          return exports.renderJSON(badRes, res);
        }
        
        sys.puts("writing cookie and rendering JSON");
        res.setCookie("room", thisRoomId);
        
        var jsonResponse = {"roomId": thisRoomId.toString()};
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
  var cookieValue = req.getCookie("uuid");
  if (!roomId || !cookieValue) {
    //TODO: should also check cookieValue is active, can start this room
    return exports.renderJSON({"error": "did not supply enough params to this call"}, res);
  }
  
  //register color, set up a buffer for play and return true
  var gotAjaxData = function(choseColor) {
    sys.puts("starting game: " + roomId + " with first player color: " + choseColor);
    var colorsObj = {"black" : "", "white" : ""}; //must be object because 'in' will not work with arrays
    var colorsArray = ["black", "white"];         //0 in colors -> true && 1 in colors -> true (lame)
    if (choseColor in colorsObj) {                      
      sys.puts("selected valid color: " + choseColor);
      var otherColor = _.without(colorsArray, choseColor);
      
      redisClient.hset("room:" + roomId, "availableColor", otherColor, function(e, result) {
        if (e || !result) {
          sys.puts("error when setting available color for joining user");
        }
        
        redisClient.hget("room:" + roomId, "users", function(e, usersObStr) {
          var users = JSON.parse(usersObStr);
          redisClient.hget("cookie:" + cookieValue, "name", function(e, username) {
            users[username] = {color: choseColor};
            sys.puts("in room:" + roomId + " updating users to " + jStringify(users));
            redisClient.hset("room:" + roomId, "users", jStringify(users), function(e, result) {
              if ( ! isValidReturn(e, result) ) {
                sys.puts("error when updating users obj in room hash with chosen color (board/#/start)");
                sys.puts("e: " + e);
                sys.puts("result: " + result);
              }
              
              return exports.renderJSON({result: true}, res);
            })
          });
        });
      })
    }
    else {
      sys.puts(color + " must not be in array " + colors);
      exports.renderJSON(false, res);
    }
  }
  exports.getAjaxData(req, gotAjaxData);
});

expressApp.get("/board/:roomId", function(req, res) {
  //check that this room exists
  var roomId = req.params.roomId;
  var joinAsPlayer = function(xidValue, colorChoice, joinMessage, isKnown, isSpectate, thisRoom) {
    isKnown = isKnown? "true" : "false";
    var locals = {locals: {xid: xidValue, 
                          message: joinMessage, 
                          spectate: isSpectate, 
                          color: colorChoice, 
                          room: thisRoom, 
                          known: isKnown,
                          hostname: _hostname,
                          port: _port,
                }};
    
    res.render("board", locals);
    
    if (!isSpectate) {
      redisClient.hset("room:" + roomId, "availableColor", "spectate", function(e, result) {
        if (e) { sys.puts("FATAL: could not set availableColor as spectate after a player joined"); }
      }); //is it too early to set this here? technically we've only rendered the client, we might want to do this as part of the {join} message
    }
  }
  
  var cookieValue = req.getCookie("uuid");
  if (cookieValue) {
    sys.puts("got cookied user joining game: " + roomId);
    //check what color, name this user has
    redisClient.hgetall("cookie:" + cookieValue, function(e, result) {
      var name = hashResultMaybe(result, "name");
      sys.puts("hgetall cookie:" + cookieValue);
      sys.puts(result);
      sys.puts(sys.inspect(result));
      sys.puts("cookied user: " + cookieValue + " aka " + name + " is joining game " + roomId);
      
      redisClient.hgetall("room:" + roomId, function(e, roomInfo) {
        sys.puts("joining game with info: " + roomInfo);
        var users = hashResultMaybe(roomInfo, "users"),
            usersObj = JSON.parse(users),
            availableColor = hashResultMaybe(roomInfo, "availableColor"),
            userInfo = usersObj && usersObj[name] ? users[name] : {};
            
        sys.puts("joining game with users: " + users);    
            
        if (!users || !usersObj) {          //bad game
          res.clearCookie("uuid");
          return joinAsPlayer(cookieValue, false, "This game doesn't appear to exist", false, true, false);
        }
        
        //check if this user has already joined and is returning, or if they are just joining for the first time
        if (name in usersObj) {
          sys.puts("a user from this game is joining again, joy!");
          var thisUser = usersObj[name];
          //TODO: do we need to check if this user has picked a color yet? probably
          return joinAsPlayer(cookieValue, thisUser.color, "Welcome back to your game", true, false, roomId);
        }
        else {
          sys.puts( name + " is not in keys " + _.keys(usersObj));
          //user is joining for the first time, so spectator or second player
          var userColor = userInfo && userInfo.color? userInfo.color : availableColor,
              otherUser = _.without(_.keys(usersObj), name)[0]; //too much? seems safe
              welcomeBack = "Welcome to your game against " + otherUser + ", " + name;
              known = false; //assumption, checked below
            
          if (name && name != "unknown") {
            usersObj[name] = {color: userColor};
            known = true;
          }
            
          sys.puts("updating users for room: " + roomId, " with obj: " + jStringify(usersObj));
          redisClient.hset("room:" + roomId, "users", jStringify(usersObj), function(e, result) {
            joinAsPlayer(cookieValue, availableColor, welcomeBack, known, availableColor == "spectate", roomId);
          });
        }
      });
    });
  }
  else {
    //assumes that this is someone joining a game they were invited to
    //in order for this to be more general, we should inspect their cookie, find the game, figure out what color they should be, THEN render
    redisClient.hmget("room:" + roomId, "availableColor", "users", function(e, results) {
      sys.puts("joining room, got results: " + results);
      var availableColor = hashResultMaybe(results, 0);
      var usersList = hashResultMaybe(results, 1);
      usersList = usersList? jParse(usersList) : {};
    
      var otherUser = _.keys(usersList)[0];
      assert.equal(1, _.keys(usersList).length);
    
      sys.puts("user joining as color: " + availableColor);
      if (e || !availableColor) {
        var errMsg = "An error occurred. This room is not active";
        return res.render("board", {locals: {xid: false, message: errMsg, spectate: false, color: false}});
      }
      if (!availableColor || availableColor == "spectate") {
        var joinMessage = "Two players have already joined. You are spectating.";
        return res.render("board", {locals: {xid: false, message: joinMessage, spectate: true, color: false}});
      }
      else {
        sys.puts("new user joining for the first time");
        assert.ok(availableColor == "black" || availableColor == "white", "Available colors should only be black and white");
      
        var newId = Math.uuid();
        redisClient.hset("cookie:" + newId, "name", "unknown", function(e, result) {
          var newPlayerMessage = "Joining game. You are playing against " + otherUser;
          res.setCookie("uuid", newId, {path: "/"});
          return joinAsPlayer(newId, availableColor, newPlayerMessage, false, availableColor == "spectate", roomId);
        });
      }
    });
  }
});
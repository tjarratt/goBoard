_init = {
        socket: false,
        board: false,
        }

_xid = $("input.xss").val();
console.log("got temp id: " + _xid);

function initIndex() {
  //TODO: check to see if we had an existing game in a cookie, join it
  //setup socket.io
  io.setPath("/");
  _url = "table.no.de";//TODO: get this from hostname()
  //should probably be http://www.table.no.de at some point
  
  _socket = new io.Socket(_url, {port: 80});
  initSocket(_socket);
    
  var selectEle = document.createElement("select");
  var optBase = "<option name='";
  var optEnd = "</option>";
  selectEle.innerHTML = optBase + "select a color" + "'select a color" + optEnd;
  selectEle.innerHTML += optBase + "black" + "'>black" + optEnd;
  selectEle.innerHTML += optBase + "white" + "'>white" + optEnd;
  $("div#gamePieces").append(selectEle);
  $("div#gamePieces>select").change(function(e) {
    var startSuccess = function(transport) {
      console.log("success when choosing color: " + _color);
      console.log(transport);
      $("div#gamePieces").html("<img class='myGamePiece' src='/public/image/" + _color + ".png' />");
      
      //let's put a link for other people to join on the page though.
      var $join = $("div#joinLink");
      $join.html("<p>Send a link to this game to a friend (or bookmark it for yourself)</p>"); 
      $join.append("<a href='board/" + _roomId + "'>Play Go!</a>");
      
      //setup board before we much more...
      console.log("initializing game board");
      initGameBoard();
      
      //set up some event handlers on the board
      initDragDrop();
      
      $("canvas").show();
    }
    var startFailure = function(transport) {
      console.log("failure when choosing color");
      console.log(transport);
    }
    
    _color = $(this).val();
    if (_color != "black" && _color != "white") {
      return; // bad, bad user. How did you even do this? 
    }         // Give me back my shoes, they don't even fit
    
    $.ajax({
      async: true,
      type: "POST",
      url: "/board/" + _roomId + "/start",
      success: startSuccess,
      failure: startFailure,
      data: _color,
      contentType: "json",
      dataType: "application/json",
      timeout: 2000,
    });
  });
  _color = false;
  _roomId = false;
  
  console.log("initializing index page");
  //set up a on submit event for the name input
  function gotNewGame(transport) {
    console.log("got new game: " + JSON.stringify(transport));
    //redirect user
    var response = JSON.parse(transport);
    _roomId = response.roomId;//can we use this as a link for other users?
    sendMessage("join", {room: _roomId, name: _username, color: _color}); //announce join so we can set up a socket reference
    
    //won't need this anymore
    $("div#nameForm").remove();
    
    //show gameContainer
    $("div#gameContainer").css("visibility", "visible");
    $("div#gameContainer").children().css("visibility", "inherit");
    
    $("select").focus();
  }
  function failedNewGame(transport) {
    console.log("got failure: " + JSON.stringify(transport));
  }
  
  $("input#nameInput").keypress(function(e) {
    if (e.which == 13) {
      _username = $(this).val();
      console.log("hello " + _username);
      var cookieVal = $.cookie("uuid"),
          postData = {name: _username, cookie: cookieVal};
            
      //make an ajax request for a page
      $.ajax({
        async: true,
        type: "POST",
        url: "/board/new",
        success: gotNewGame,
        failure: failedNewGame,
        data: postData,
        contentType: "json",
        dataType: "application/json",
        timeout: 2000,
      });
    }
  });

  $("input#nameInput").focus();
}
function createNewImage(imgSrc, x, y) {
  console.log("creating a new image from src: " + imgSrc);
  console.log("at x: " + x + " y: " + y);
  
  if (x 25 0) {
    x = 25;
  }
  if (y 25 0) {
    y = 25;
  }
  if (x > 1000) { x = 975;}
  if (y > 1000) { y = 975;}
  
  sendMessage("move", "x:" + x + ",y:" + y, false);
      
  var canvas = $("canvas#gameBoard")[0];
  var ctx = canvas.getContext("2d");
  var img = new Image();
  img.src = imgSrc;
  
  img.onload = function(){
    ctx.drawImage(img, x, y);
  }
  
  var coords = {x: x, y: y};
  var newImage = {
    source: imgSrc,
    coords: coords,
    user: _username,
  };
  
  //add this to the array of images
  _images.push(newImage);
  //and store it for quick access in _positions
  var key = x + "_" + y;
  _gameBoard[key] = newImage;
}

function findMousePosition(e) {
  // srcElement = IE
  var parentNode = (e.srcElement) ? e.srcElement.parentNode : e.target.parentNode;
  var scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
  var scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  
  var x = e.clientX + scrollLeft - parentNode.offsetLeft + 350; //ugh magic number
  var y = e.clientY + scrollTop - parentNode.offsetTop;         //where is this coming from?

  //return actual x, y positions, the center of the nearest grid, and the location on screen
  var closest = {x: parseInt(x / 50) * 50, y: parseInt(y / 50) * 50};
  
  return {
      x: x,
      y: y, 
      closestX : closest.x,
      closestY : closest.y,
      gridX: closest.x - 25, //also need closest on grid point 
      gridY: closest.y - 25, //to support some games like Go
  };                         //this should work, but we're still hard coding values like WHOAH
}                           //how is this supposed to work with a variable sized board? ugh

function onDragMove(position) {
  _draggingImage.coords.x = position.x - 25;
  _draggingImage.coords.y = position.y - 25;
  
  var image = new Image();
  image.src = _draggingImage.source;
  
  image.onload = function() {    
    //wipe and redraw the top canvas layer
    var $top = $("canvas#top");
  
    var ctx = $top[0].getContext("2d");
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.drawImage(image, position.x - 25, position.y - 25); //really? dang
  };
}

function renderAll(wipeTop) {
  if (wipeTop === true) {
    var topContext = $("textarea")[0].getContext("2d");
    topContext.clearRect(0, 0, 700, 700);
  }
  var $context = $("canvas#gameBoard");
  
  //get the context of the canvas where we are drawing the players, wipe it clean
  var mapContext = $canvas[0].getContext("2d");
  mapContext.clearRect(0, 0, 700, 700);
  
  //render all _gameBoard on middle canvas
  $.each(_gameBoard, function(index, imageObj) {
    if (!imageObj || !imageObj.source || !imageObj.coords) {
      //should return true, and continue drawing other objects
      return delete _gameBoard[index];
    }
    
    var img = new Image();
    img.src = imageObj.source;
    
    img.onload = function() {
      mapContext.drawImage(img, imageObj.coords.x, imageObj.coords.y); //probably need to update this
    }
  });
  
  return false;
}

function initGameBoard(gridType, rows, columns) {
  gridType = gridType ? gridType : "square";
  rows = rows ? parseInt(rows) : 19;
  columns = columns ? parseInt(columns) : 19;
  
  _init.board = true;
  _images = [];
  _draggingImage = false;
  
  var $gameboard = $("canvas#gameBoard");
  var context = $gameboard[0].getContext("2d");
  context.beginPath();
  //going to assume we want a 19 x 19 grid
  context.moveTo(0, 0);
	//might it not be easier to do this with a series of transparent squares?
	for (var i = 1; i <= 20; i ++) {
		context.lineTo(i * 50, 0);
		context.lineTo(i * 50, 1000);
		context.lineTo(i * 50 + 50, 1000);
		context.lineTo(i * 50 + 50, 0);
	}
	context.stroke();

	context.moveTo(0, 0);
	for (var j = 1; j <= 20; j++) {
		context.lineTo(0, j * 50);
		context.lineTo(1000, j*50);
		context.lineTo(1000, j*50 + 50);
		context.lineTo(0, j*50 + 50);
	}
	context.stroke();

	context.moveTo(0, 500);
	context.lineTo(0,0);
	context.lineTo(1000, 0);
	context.stroke();
}

function initDragDrop() {
  _gameBoard = {}; //holds game pieces by point on board
  var $textArea = $("textarea");
  //need to watch for image drops on the textarea
  $textArea.mouseover(function(e) {
    console.log("got mouseover on textarea");
    
    //if this wasn't a drag event from a player image 
    if (!e.fromElement || !e.fromElement.src) {return false;}
    
    //timing issue, see if the event wrote to the text area yet
    var newImg = $textArea.val();
    $textArea.val("");
    
    //look for the image source in event.fromElement 
    newImg = newImg? newImg : e.fromElement.src;
    
    if (!newImg) {
      return false;
    }
    
    var position = findMousePosition(e);
    createNewImage(newImg, position.gridX, position.gridY);   
    
    return false;
  });
  
  $textArea.mousemove(function(e) {
    console.log("got mousemove on textarea");
  });
  
  //watch for mouse down on textarea, pass onto canvas
  $textArea.mousedown(function(e) {
    e.stopPropagation();
    
    //find image, if it exists
    var position = findMousePosition(e);
    var fixedX = position.gridX - 50;
    var fixedY = position.gridY - 50;
    
    var key = fixedX + "_" + fixedY; //this may break
    //this doesn't work so well, conceptually, with Go pieces ON the grid 
    //we could optionally look one square up, left, down and right
    //or we could also look for the closest grid point to our click
    //hint: it would be a multiple of 25
    // (value % 50) * 50 + 25 ??
    
    var oImg = _gameBoard[key];
    if (!oImg) {
      console.log("found no image stored at (" + fixedX + ", " + fixedY + ")");      
      return false;
    }
    
    //stash this away for now
    _draggingImage = oImg;
    _originalCoords = oImg.coords;
    
    //remove this object for now, so we don't draw it
    delete _gameBoard[key] 
    
    //handle drag action
    onDragMove(position);
    
    //push it to the top canvas
    renderAll(false);
  });

  //watch for mouse up on textarea, pass onto canvas
  $textArea.mouseup(function(e) {
    if (!_draggingImage) {
      return false;
    }
    
    //find the closest position
    var atPosition = findMousePosition(e);
    var key = atPosition.gridX + "_" +  atPosition.gridY;
    
    /*
    For now, instead of allowing users to put their pieces on the same square and having to deal with that UI nightmare, forbid it
    at some point this will might be useful to allow, but it's easier to opt out of it for now.
    */
    if (_gameBoard[key]) {
      console.log("found an image at mousedown, reverting to where the dragging image originated");
      var oldKey = _originalCoords.x + "_" + _originalCoords.y;
      _gameBoard[oldKey] = _draggingImage;
      _draggingImage = null;
      
      return renderAll(true);
    }
    
    //update _draggingImage and re-add it to the _gameBoard array
    _draggingImage.coords = {x: atPosition.gridX, y: atPosition.gridY};
    _gameBoard[atPosition.gridX + "_" +  atPosition.gridY] = _draggingImage;
    _draggingImage = null;
    
    //send this message to the server, and other clients
    //TODO: replace this with a call to sendMessage from socket.js
    send("_move_x:" + atPosition.gridX + ",y:" + atPosition.gridY, false);
    
    //wipe the context of the top canvas and redraw
    renderAll(true);
  });
  
  //prevent users from typing in this field
  $textArea.keydown(function(e) {
    e.stopPropagation();
    return false;
  });
  
  //stop any attempts by the user to push input into the textarea, put focus on the chat field for now
  $textArea.focus(function(e) {
    e.stopPropagation();
    
    $(document).focus();
    return false;
  });
}

function handleWindowRezie() {
  //capture resize event, change size of board, etc
  window.onresize = function(e) {
    console.log("welp, window resize");
  }
}
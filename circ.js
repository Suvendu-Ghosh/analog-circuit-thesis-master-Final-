// Maxwell -- Javascript Circuit Simulator
// Copyright 2008 Phil Sung
//
// This file is part of Maxwell.
//
// Maxwell is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version.
//
// Maxwell is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
// details.
//
// You should have received a copy of the GNU General Public License along with
// Maxwell. If not, see <http://www.gnu.org/licenses/>.

// TODO: Allow editing values inline and show some indicator that the values
// are editable

// TODO: Save and restore from HTML fragments

// TODO: Move the leads around appropriately when the window is resized.

// TODO: allow rotating components

// TODO: fix bug where small wire lengths cannot be selected

var isMouseDown = false;
var canvasWidth = 800;
var canvasHeight = 400;

// The element or wire with focus
var selectedObject = null;
var tentativelySelectedObject = null;
var bDraggedOutsideThreshold = false;
// The element or wire being dragged
var draggedObject = null;

// Node that the cursor is near, or null
var highlightedNode = null;

var dragOffsetx = null;
var dragOffsety = null;
// Original coordinates of thing being dragged
var dragOriginalx = null;
var dragOriginaly = null;
// Cursor position at drag start
var dragStartx = null;
var dragStarty = null;

var blackLeadObj = null;
var redLeadObj = null;
var bBothLeadsConnected = false;

var previousSnapPosition = '';

var objects = [];

function nodeToStr(n) {
  return n[0] + ',' + n[1];
}

// Meter leads ----------------------------------------------------------------
var LEAD_ANGLE = Math.PI / 12;
var LEAD_PIN_LENGTH = 45;
var LEAD_HALFWIDTH = 8;
var LEAD_LENGTH = 240;
function Lead(xpos, ypos, black) {
  this.xpos = xpos;
  this.ypos = ypos;
  this.black = black;
}
function lead_draw(ctx) {
  var x = this.xpos;
  var y = this.ypos;
  ctx.save();
  // Switch to a rotated coordinate system to draw the leads
  ctx.translate(x, y);
  ctx.rotate(LEAD_ANGLE);
  ctx.translate(-x, -y);
  ctx.strokeStyle = '#aaa';
  ctx.beginPath();
  ctx.moveTo(x, y);

  var lineargradient = ctx.createLinearGradient(x - 8, y, x + 8, y);
  if (this.black) {
    lineargradient.addColorStop(0, '#999');
    lineargradient.addColorStop(1, '#222');
  } else {
    lineargradient.addColorStop(0, '#d00');
    lineargradient.addColorStop(1, '#600');
  }
  ctx.fillStyle = lineargradient;
  if (this.black) {
    ctx.lineTo(x, y + LEAD_PIN_LENGTH);
    ctx.fillRect(x - LEAD_HALFWIDTH, y + LEAD_PIN_LENGTH, 2 * LEAD_HALFWIDTH, LEAD_LENGTH);
  } else {
    ctx.lineTo(x, y - LEAD_PIN_LENGTH);
    ctx.fillRect(x - LEAD_HALFWIDTH, y - LEAD_PIN_LENGTH - LEAD_LENGTH, 2 * LEAD_HALFWIDTH, LEAD_LENGTH);
  }
  ctx.stroke();
  ctx.restore();
}
function lead_getType() {
  return 'lead';
}
function lead_getNodes() {
  return [[this.xpos, this.ypos]];
}
function lead_isClickInArea(x, y) {
  // Model the lead area as an axis-aligned rectangle rotated by LEAD_ANGLE.
  var dx = x - this.xpos;
  var dy = y - this.ypos;

  var tx = Math.cos(LEAD_ANGLE) * dx + Math.sin(LEAD_ANGLE) * dy;
  var ty = Math.sin(LEAD_ANGLE) * dx - Math.cos(LEAD_ANGLE) * dy;

  if (tx < -LEAD_HALFWIDTH || tx > LEAD_HALFWIDTH) {
    return false;
  }
  if (this.black) {
    return ty < -5 && ty > -(LEAD_LENGTH + LEAD_PIN_LENGTH);
  } else {
    return ty > 5 && ty < (LEAD_LENGTH + LEAD_PIN_LENGTH);
  }
}
function lead_isGraphElement() {
  return true;
}
function lead_getMessage() {
  if (bBothLeadsConnected) {
    return '';
  } else {
    return 'Drag the leads onto nodes to measure voltages.';
  }
}
Lead.prototype.draw = lead_draw;
Lead.prototype.getType = lead_getType;
Lead.prototype.getNodes = lead_getNodes;
Lead.prototype.isClickInArea = lead_isClickInArea;
Lead.prototype.isGraphElement = lead_isGraphElement;
Lead.prototype.isLead = true;
Lead.prototype.getMessage = lead_getMessage;

// Resistor -------------------------------------------------------------------
function Resistor(xpos, ypos, value, template) {
  this.xpos = xpos;
  this.ypos = ypos;
  this.value = value;
  this.isTemplate = template;
}
function resistor_draw(ctx) {
  var x = this.xpos;
  var y = this.ypos;
  ctx.beginPath();
  ctx.moveTo(x + 30, y);
  ctx.lineTo(x + 30, y + 9);
  ctx.lineTo(x + 22, y + 15);
  ctx.lineTo(x + 38, y + 21);
  ctx.lineTo(x + 22, y + 27);
  ctx.lineTo(x + 38, y + 33);
  ctx.lineTo(x + 22, y + 39);
  ctx.lineTo(x + 38, y + 45);
  ctx.lineTo(x + 30, y + 51);
  ctx.lineTo(x + 30, y + 60);
  ctx.stroke();

  // Fall back gracefully when canvas text API isn't available
  if (ctx.textBaseline) {
    ctx.font = "12pt serif";
    ctx.textBaseline = "middle";
    ctx.fillText(this.value + " \u03a9", x + 45, y + 30);
  }
}
function resistor_clone(x, y) {
  return new Resistor(x, y, 1, false);
}
function resistor_getType() {
  return 'resistor';
}
function resistor_getValue() {
  return this.value;
}
function resistor_getNodes() {
  if (this.isTemplate) {
    return [];
  } else {
    return [[this.xpos + 30, this.ypos], [this.xpos + 30, this.ypos + 60]];
  }
}
function resistor_isClickInArea(x, y) {
  return normSquared(x - (this.xpos + 30), y - (this.ypos + 30)) < 20 * 20;
}
function resistor_isGraphElement() {
  return !this.isTemplate;
}
function resistor_getMessage() {
  if (!this.isTemplate) {
    return this.value + " &Omega; resistor";
  } else {
    return "Drag to add a resistor.";
  }
}
Resistor.prototype.draw = resistor_draw;
Resistor.prototype.clone = resistor_clone;
Resistor.prototype.getType = resistor_getType;
Resistor.prototype.getValue = resistor_getValue;
Resistor.prototype.getNodes = resistor_getNodes;
Resistor.prototype.isClickInArea = resistor_isClickInArea;
Resistor.prototype.isGraphElement = resistor_isGraphElement;
Resistor.prototype.getMessage = resistor_getMessage;

// VoltageSource --------------------------------------------------------------
function VoltageSource(xpos, ypos, value, template) {
  this.xpos = xpos;
  this.ypos = ypos;
  this.value = value;
  this.isTemplate = template;
}
function vs_draw(ctx) {
  var x = this.xpos;
  var y = this.ypos;
  ctx.beginPath();
  ctx.moveTo(x + 30, y);
  ctx.lineTo(x + 30, y + 27);
  ctx.moveTo(x + 15, y + 27);
  ctx.lineTo(x + 45, y + 27);
  ctx.moveTo(x + 22, y + 33);
  ctx.lineTo(x + 38, y + 33);
  ctx.moveTo(x + 30, y + 33);
  ctx.lineTo(x + 30, y + 60);
  ctx.stroke();

  // Fall back gracefully when canvas text API isn't available
  if (ctx.textBaseline) {
    ctx.font = "12pt serif";
    ctx.textBaseline = "middle";
    ctx.fillText(this.value + " V", x + 45, y + 30);
  }
}
function vs_clone(x, y) {
  return new VoltageSource(x, y, 5, false);
}
function vs_getType() {
  return 'voltagesource';
}
function vs_getValue() {
  return this.value;
}
function vs_getNodes() {
  if (this.isTemplate) {
    return [];
  } else {
    return [[this.xpos + 30, this.ypos + 60], [this.xpos + 30, this.ypos]];
  }
}
function vs_isClickInArea(x, y) {
  return normSquared(x - (this.xpos + 30), y - (this.ypos + 30)) < 20 * 20;
}
function vs_isGraphElement() {
  return !this.isTemplate;
}
function vs_getMessage() {
  if (!this.isTemplate) {
    return this.value + " V source";
  } else {
    return "Drag to add a voltage source.";
  }
}
VoltageSource.prototype.draw = vs_draw;
VoltageSource.prototype.clone = vs_clone;
VoltageSource.prototype.getType = vs_getType;
VoltageSource.prototype.getValue = vs_getValue;
VoltageSource.prototype.getNodes = vs_getNodes;
VoltageSource.prototype.isClickInArea = vs_isClickInArea;
VoltageSource.prototype.isGraphElement = vs_isGraphElement;
VoltageSource.prototype.getMessage = vs_getMessage;

// Wire -----------------------------------------------------------------------
function Wire(x1, y1, x2, y2) {
  this.x1 = x1;
  this.y1 = y1;
  this.x2 = x2;
  this.y2 = y2;
}
function w_draw(ctx) {
  ctx.beginPath();
  ctx.moveTo(this.x1, this.y1);
  ctx.lineTo(this.x2, this.y2);
  ctx.stroke();
}
function w_getType() {
  return 'wire';
}
function w_getNodes() {
  return [[this.x1, this.y1], [this.x2, this.y2]];
}
function w_isClickInArea(x, y) {
  var d2 = minimumDistanceSquaredToSegment(
    x, y, this.x1, this.y1, this.x2, this.y2);
  return d2 < 10 * 10;
}
function w_isGraphElement(x, y) {
  return true;
}
function w_getOtherNode(n) {
  for (var nodeIndex in this.getNodes()) {
    var m = this.getNodes[nodeIndex];
    if (nodeToStr(m) != n) {
      return nodeToStr(m);
    }
  }
  return null;
}
Wire.prototype.draw = w_draw;
Wire.prototype.getType = w_getType;
Wire.prototype.getNodes = w_getNodes;
Wire.prototype.isClickInArea = w_isClickInArea;
Wire.prototype.isGraphElement = w_isGraphElement;
Wire.prototype.getOtherNode = w_getOtherNode;
Wire.prototype.isWire = true;

// ----------------------------------------------------------------------------

function redraw() {
  var canvas = document.getElementById('circarea');
  if (!canvas.getContext) {
    return;
  }
  var ctx = canvas.getContext('2d');

  // Clear the canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw all the placed objects
  for (var objIndex in objects) {
    var obj = objects[objIndex];
    // Draw templates in green, others in black
    if (obj.isTemplate) {
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = "rgb(0, 160, 0)";
    } else if (obj === selectedObject) {
      ctx.lineWidth = 3.0;
      ctx.strokeStyle = "rgb(180, 0, 0)";
    } else {
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = "rgb(0, 0, 0)";
    }
    obj.draw(ctx);
  }

  // Draw a circle at the highlighted node.
  if (highlightedNode !== null) {
    ctx.beginPath();
    ctx.arc(highlightedNode[0], highlightedNode[1], 3, 0, Math.PI*2, true);
    ctx.closePath();
    ctx.fill();
  }
}

function setCanvasDimensions(w, h) {
  document.getElementById('leadoutput').style.left = (w - 310) + 'px';
  document.getElementById('circarea').width = w;
  document.getElementById('circarea').height = h;
  canvasWidth = w;
  canvasHeight = h;
}

// Size the drawing area.
function sizeCanvas() {
  setCanvasDimensions(window.innerWidth - 8, window.innerHeight - 45);

  redraw();
}

// Return a node (on some object, somewhere) that is close to (xpos, ypos), if
// one exists. Otherwise, return null. If excludeDragged is true, do not allow
// nodes on draggedObject.
function findNearbyNode(xpos, ypos, excludeDragged) {
  var nearestNode = null;
  for (var objIndex in objects) {
    var obj = objects[objIndex];
    // Don't try to snap to a node on an object that is being moved
    if (excludeDragged && (obj === draggedObject)) {
      continue;
    }
    for (var nodeIndex in obj.getNodes()) {
      var node = obj.getNodes()[nodeIndex];
      if (normSquared(xpos - node[0], ypos - node[1]) < 10 * 10) {
        nearestNode = node;
      }
    }
  }
  return nearestNode;
}

// Return an object that is under the cursor, or null if there is no such
// object.
function findNearestObject(xpos, ypos) {
  var nearestObject = null;
  for (var objIndex in objects) {
    var obj = objects[objIndex];
    if (obj.isClickInArea(xpos, ypos)) {
      nearestObject = obj;
    }
  }
  return nearestObject;
}

// Return the name of the variable associated with the voltage at NODE.
function voltageVariable(node) {
  return 'v[' + nodeToStr(node) + ']';
}

// Simulation-related logic ---------------------------------------------------

// Initialize everything.
function init() {
  sizeCanvas();

  // Place the objects.
  var horizLeadMargin = 75;
  var vertLeadMargin = 75;
  blackLeadObj = new Lead(horizLeadMargin, canvasHeight - vertLeadMargin, true);
  redLeadObj = new Lead(canvasWidth - horizLeadMargin - 30, vertLeadMargin, false);
  objects.push(blackLeadObj);
  objects.push(redLeadObj);
  objects.push(new VoltageSource(0, 0, 5, true));
  objects.push(new Resistor(60, 0, 1, true));

  printMessage("Welcome!", true);

  redraw();
}

function simulateCircuit(debug) {
  // Process the drawing data to associate x-y coordinates with nodes of
  // circuit elements.

  // Determine which nodes are adjacent to which elements.

  // This will be an associative array mapping a node-string to an array of
  // elements that touch that node.
  var nodes = [];
  // We'll add all the real circuit elements to this array.
  var placedObjects = [];

  for (var objIndex in objects) {
    var obj = objects[objIndex];
    if (!obj.isGraphElement() || obj.isLead) {
      continue;
    }
    placedObjects.push(obj);
    for (var nodeIndex in obj.getNodes()) {
      var node = obj.getNodes()[nodeIndex];
      // Put all the distinct nodes in a hashtable.
      var nodeStr = nodeToStr(node);
      if (!nodes[nodeStr]) {
        nodes[nodeStr] = [];
      }
      nodes[nodeStr].push(obj);
    }
  }

  // Determine whether the scope leads are connected to nodes.
  var redLeadConnected = false;
  var blackLeadConnected = false;
  for (var nodeStr in nodes) {
    if (nodeStr == nodeToStr(redLeadObj.getNodes()[0])) {
      redLeadConnected = true;
    }
    if (nodeStr == nodeToStr(blackLeadObj.getNodes()[0])) {
      blackLeadConnected = true;
    }
  }
  bBothLeadsConnected = (redLeadConnected && blackLeadConnected) ||
    nodeToStr(redLeadObj.getNodes()[0]) == nodeToStr(blackLeadObj.getNodes()[0]);

  // If both leads are connected, formulate and solve a system of linear
  // equations to find the red lead voltage.
  if (bBothLeadsConnected) {
    var system = [];

    // Write an equation for KCL on each node.
    for (var nstr in nodes) {
      var orientations = [];
      var currents = [];
      // Enumerate all placed objects that touch the node.
      for (var objIndex in nodes[nstr]) {
        var obj = nodes[nstr][objIndex];
        // Use the index of the object in placedObjects to uniquely name the
        // associated current variable.
        var objectId = placedObjects.indexOf(obj);
        if (objectId > -1) {
          // Determine the orientation of the current into this object.
          orientations.push((nstr == nodeToStr(obj.getNodes()[0])) ? 1 : -1);
          currents.push('i[' + objectId + ']');
        }
      }
      // sum_currents = 0 when orientations are respected
      system.push(new AffineExpression(orientations, currents, 0));
    }

    // Write a voltage equation on each element.
    for (var objectId in placedObjects) {
      var obj = placedObjects[objectId];
      nodes = obj.getNodes();
      var node1name = voltageVariable(nodes[0]);
      var node2name = voltageVariable(nodes[1]);
      if (obj.getType() == 'resistor') {
        var currentname = 'i[' + objectId + ']';
        // V1 - V2 - R i == 0
        system.push(
          new AffineExpression([1, -1, -obj.getValue()],
                               [node1name, node2name, currentname],
                               0));
      } else if (obj.getType() == 'wire') {
        // V1 == V2
        system.push(new AffineExpression([1, -1], [node1name, node2name], 0));
      } else if (obj.getType() == 'voltagesource') {
        // V1 - V2 == V_s
        system.push(new AffineExpression([1, -1],
                                         [node1name, node2name],
                                         obj.getValue()));
      }
    }

    // Ground the black lead.
    var blackLeadVoltageName = voltageVariable(blackLeadObj.getNodes()[0]);
    system.push(new AffineExpression([1], [blackLeadVoltageName], 0));

    // If debug info is requested, dump the system of equations that we
    // generated.
    if (debug) {
      var debugOutputStr = "";
      for (var exprIndex in system) {
        debugOutputStr = debugOutputStr + system[exprIndex].toString() + "; ";
      }
      printMessage(debugOutputStr);
    }

    // Display the voltage at the red lead.
    var voltageMsg;
    try {
      var soln = solveLinearSystem(system);
      var v = soln[voltageVariable(redLeadObj.getNodes()[0])];
      if (isNaN(v)) {
        voltageMsg = '<em>v</em><sub>+</sub> = ?? (floating)';
      } else {
        voltageMsg = '<em>v</em><sub>+</sub> = ' + v.toPrecision(6) + ' V';
      }
    } catch (e) {
      if (e.message == 'inconsistent') {
        voltageMsg = '<em>v</em><sub>+</sub> = ?? (short circuit?)';
      } else {
        throw e;
      }
    }
    printOutput(voltageMsg);
  } else {
    printOutput('<em>v</em><sub>+</sub> = ?? (floating)');
  }
}

// Event handlers -------------------------------------------------------------

// Handle a mousedown event.
function md(e) {
  isMouseDown = true;

  var cursorX = e.clientX - e.target.offsetLeft;
  var cursorY = e.clientY - e.target.offsetTop;
  dragStartx = cursorX;
  dragStarty = cursorY;

  // If the selected element is a wire and we are near its endpoints, allow
  // dragging by the endpoints.
  if (selectedObject !== null && selectedObject.isWire) {
    var nodes = selectedObject.getNodes();
    for (var nodeIndex in nodes) {
      var node = nodes[nodeIndex];
      if (normSquared(cursorX - node[0], cursorY - node[1]) < 10 * 10) {
        draggedObject = selectedObject;
        if (node === nodes[0]) {
          // Switch the endpoints of the segment, because code in mm
          // assumes we're dragging by the second endpoint.
          var tmp_coord_x = draggedObject.x1;
          draggedObject.x1 = draggedObject.x2;
          draggedObject.x2 = tmp_coord_x;
          var tmp_coord_y = draggedObject.y1;
          draggedObject.y1 = draggedObject.y2;
          draggedObject.y2 = tmp_coord_y;
        }
        return;
      }
    }
  }

  // Mark an object for possible drag or selection if the cursor is close
  // enough to the center of it. Dragging occurs if the cursor moves outside
  // a given radius.
  var nearestNode = findNearbyNode(cursorX, cursorY, false);
  var nearestObject = findNearestObject(cursorX, cursorY);

  if (nearestObject !== null && !(nearestObject.isWire && nearestNode !== null)) {
    tentativelySelectedObject = nearestObject;
    bDraggedOutsideThreshold = false;
    dragOffsetx = nearestObject.xpos - cursorX;
    dragOffsety = nearestObject.ypos - cursorY;
    dragOriginalx = nearestObject.xpos;
    dragOriginaly = nearestObject.ypos;
  } else if (nearestNode !== null) {
    // If we're near an endpoint, create a new wire starting there.
    draggedObject = new Wire(nearestNode[0], nearestNode[1],
                             nearestNode[0], nearestNode[1]);
    objects.push(draggedObject);
  } else {
    // Otherwise, deselect all objects.
    selectedObject = null;
    tentativelySelectedObject = null;
  }

  redraw();
}

// Handle a mouseup event.
function mu(e) {
  isMouseDown = false;

  // Select an object if the mouse has not moved far since the mousedown.
  if (tentativelySelectedObject !== null && !bDraggedOutsideThreshold) {
    selectedObject = tentativelySelectedObject;
  }
  // If we were dragging a template, restore its original position.
  if (draggedObject !== null && draggedObject.isTemplate) {
    draggedObject.xpos = dragOriginalx;
    draggedObject.ypos = dragOriginaly;
  }
  draggedObject = null;

  redraw();
}

// Handle a mousemove event.
function mm(e) {
  var cursorX = e.clientX - e.target.offsetLeft;
  var cursorY = e.clientY - e.target.offsetTop;

  var needsRedraw = false;

  // Update the mouseover hints as necessary.
  var nearestObject = findNearestObject(cursorX, cursorY);
  var nearbyNode = null;
  if (nearestObject !== null && nearestObject.getMessage) {
    // If we're over a real element, display the tooltip for that object
    // and set the hand cursor.
    printMessage(nearestObject.getMessage(), true);
    // TODO: refactor this into a separate function.
    document.getElementById('circarea').className = "clickable";
  } else {
    // Otherwise, if we're near a node, highlight that node.
    nearbyNode = findNearbyNode(cursorX, cursorY, false);
    if (nearbyNode !== null) {
      document.getElementById('circarea').className = "clickable";
    } else {
      document.getElementById('circarea').className = "";
    }
    // TODO: indicate to the user when they can drag a node to create or resize
    // a wire.
    printMessage('', true);
  }
  // Check whether the highlighted node moved, and if so, force a redraw.
  if (nearbyNode != highlightedNode) {
    highlightedNode = nearbyNode;
    needsRedraw = true;
  }

  if (isMouseDown) {
    if (draggedObject === null) {
      // Initiate a drag if applicable.
      if (normSquared(cursorX - dragStartx, cursorY - dragStarty) > 5 * 5) {
        if (tentativelySelectedObject !== null &&
            !tentativelySelectedObject.isWire) {
          draggedObject = tentativelySelectedObject;
        }
        bDraggedOutsideThreshold = true;
      }
    } else {
      var bRecompute = false;

      if (draggedObject.isTemplate) {
        // If we've dragged a template sufficiently far from its original
        // position, clone it. Otherwise, just move the template.
        if (normSquared(cursorX - dragStartx, cursorY - dragStarty) < 60 * 60) {
          draggedObject.xpos = cursorX + dragOffsetx;
          draggedObject.ypos = cursorY + dragOffsety;
        } else {
          var newObj = draggedObject.clone(
            cursorX + dragOffsetx, cursorY + dragOffsety);
          draggedObject.xpos = dragOriginalx;
          draggedObject.ypos = dragOriginaly;
          draggedObject = newObj;
          objects.push(newObj);
          bRecompute = true;
        }
      } else {
        var snapPosition;
        if (draggedObject.isWire) {
          // Snap the endpoint being dragged to a nearby node, if possible.
          var wireSnapTargetNode = findNearbyNode(cursorX, cursorY, true);
          if (wireSnapTargetNode !== null) {
            draggedObject.x2 = wireSnapTargetNode[0];
            draggedObject.y2 = wireSnapTargetNode[1];
            snapPosition = nodeToStr(wireSnapTargetNode);
          } else {
            draggedObject.x2 = cursorX;
            draggedObject.y2 = cursorY;
            snapPosition = null;
          }
        } else {
          // Snap some node on this object to a nearby node, if possible
          var nodes = draggedObject.getNodes();
          var snapped = false;
          for (var nodeIndex in nodes) {
            var node = nodes[nodeIndex];
            var nodeRelx = node[0] - draggedObject.xpos;
            var nodeRely = node[1] - draggedObject.ypos;
            var objectSnapTargetNode = findNearbyNode(
              cursorX + dragOffsetx + nodeRelx,
              cursorY + dragOffsety + nodeRely,
              true);
            if (objectSnapTargetNode !== null) {
              draggedObject.xpos = objectSnapTargetNode[0] - nodeRelx;
              draggedObject.ypos = objectSnapTargetNode[1] - nodeRely;
              snapPosition = objectSnapTargetNode[0] + ',' +
                objectSnapTargetNode[1] + ',' + nodeRelx + ',' + nodeRely;
              snapped = true;
              break;
            }
          }
          if (!snapped) {
            draggedObject.xpos = cursorX + dragOffsetx;
            draggedObject.ypos = cursorY + dragOffsety;
            snapPosition = null;
          }
        }
        bRecompute = (snapPosition != previousSnapPosition);
        previousSnapPosition = snapPosition;
      }

      if (bRecompute) {
        simulateCircuit(false);
      }
    }

    needsRedraw = true;
  }

  if (needsRedraw) {
    redraw();
  }
}

function mover(e) { }

function mout(e) { }

function kdown(e) {
  // Delete selected element when DEL is pressed.
  if (e.keyCode == 46) {
    if (selectedObject !== null && selectedObject.isGraphElement() &&
        !selectedObject.isLead) {
      objects.splice(objects.indexOf(selectedObject), 1);
      selectedObject = null;
      simulateCircuit(false);
      redraw();
    }
    return false;
  } else if (e.keyCode == 8 || (e.keyCode >= 48 && e.keyCode <= 57)) {
    if (selectedObject !== null && selectedObject.isGraphElement() &&
        !selectedObject.isLead) {
      if (e.keyCode == 8) {
        // Backspace
        selectedObject.value = Math.floor(selectedObject.value / 10);
        redraw();
      } else {
        // Some digit
        var digit = e.keyCode - 48;
        selectedObject.value = selectedObject.value * 10 + digit;
        redraw();
      }
      printMessage(selectedObject.getMessage(), true);
      simulateCircuit(false);
    }
    return false;
  }
}

function selectstart(e) {
  // TODO: be more selective about returning false, so that the user can
  // still select the actual text on the page.
  return false;
}

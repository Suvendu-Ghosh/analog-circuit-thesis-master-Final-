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

var permanentMessage = '';
var transientMessage = '';
var lastMessageShown = '';

// Print the specified status message. If isTransient is not set, the message
// is saved and reappears after all any other transient messages are cleared.
function printMessage(msg, isTransient) {
  if (isTransient) {
    transientMessage = msg;
  } else {
    permanentMessage = msg;
  }
  var textToShow = transientMessage != '' ? transientMessage : permanentMessage;
  if (lastMessageShown != textToShow) {
    document.getElementById("statusmsg").innerHTML = textToShow;
  }
  lastMessageShown = textToShow;
}

function printOutput(msg) {
  document.getElementById("leadoutput").innerHTML = msg;
}

// Return dx^2 + dy^2.
function normSquared(dx, dy) {
  return dx * dx + dy * dy;
}

// Return the extreme value (max or min) attained by a x^2 + b x + c
function quadraticMinimum(a, b, c) {
  // Compute location of minimum
  var x = - b / (2 * a);
  return a * x * x + b * x + c;
}

// Return the lesser of a and b.
function min(a, b) {
  return (a < b) ? a : b;
}

// Return the square of the minimum length from the point (x, y) to the segment
// (x1, y1) to (x2, y2).
function minimumDistanceSquaredToSegment(x, y, x1, y1, x2, y2) {
  var cx = x2 - x1;
  var cy = y2 - y1;
  var dx = x1 - x;
  var dy = y1 - y;
  var alpha = - (cx * dx + cy * dy) / normSquared(cx, cy);
  if (0 < alpha && alpha < 1) {
    return quadraticMinimum(normSquared(cx, cy), 2 * (cx * dx + cy * dy),
                            normSquared(dx, dy));
  } else {
    return min(normSquared(x - x1, y - y1), normSquared(x - x2, y - y2));
  }
}

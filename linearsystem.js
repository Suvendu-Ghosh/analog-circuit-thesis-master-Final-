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

// Error that is thrown when the system is inconsistent (associated with a
// short in the circuit).
var inconsistentSystemError = new Error('inconsistent');

function nearZero(a) {
  return Math.abs(a) < 1e-9;
}

// Represents a linear combination of a number of variables and a constant.
// coeffs: a list of coefficients for the variables in vars.
// vars: a list of strings naming variables.
// c: constant term
function AffineExpression(coeffs, vars, c) {
  this.coeffs = [];
  this.empty = true;
  for (var i in vars) {
    if (!nearZero(coeffs[i])) {
      this.coeffs[vars[i]] = coeffs[i];
      this.empty = false;
    }
  }
  this.constant = c;
}

// Return the coefficient associated with the variable v.
function AE_getCoefficient(v) {
  if (v in this.coeffs) {
    return this.coeffs[v];
  } else {
    return 0;
  }
}

// Return a variable we can pivot on. If this AffineExpression has no
// variables, then return null.
function AE_getLargestPivot() {
  // For numerical stability, choose the largest pivot.
  var maxPivot = 0;
  var pivotVar = null;
  for (var v in this.coeffs) {
    if (Math.abs(this.coeffs[v]) >= maxPivot) {
      maxPivot = Math.abs(this.coeffs[v]);
      pivotVar = v;
    }
  }
  return pivotVar;
}

function AE_getScalarValue() {
  return this.constant;
}

// Return true iff this expression consists of only a constant term (no
// variables).
function AE_isScalar() {
  return this.empty;
}

// Return a new AffineExpression containing the value of v in terms of the
// other variables. Assumes that v has a nonzero coefficient.
function AE_solveFor(v) {
  var newCoeffs = [];
  var newVars = [];
  var vCoeff = this.coeffs[v];
  for (var w in this.coeffs) {
    if (w != v) {
      newVars.push(w);
      newCoeffs.push(-this.coeffs[w] / vCoeff);
    }
  }
  return new AffineExpression(newCoeffs, newVars, -this.constant / vCoeff);
}

// Substitute, in the current expression, the variable V with the expression
// EXPR and return the resulting expression.
function AE_substitute(v, expr) {
  var newCoeffs = [];
  var newConstant = 0;
  var oldVCoeff = 0;
  // Copy the terms over from the existing expression, except for the one
  // we're substituting away.
  for (var w in this.coeffs) {
    if (w == v) {
      oldVCoeff = this.coeffs[w];
    } else {
      newCoeffs[w] = this.coeffs[w];
    }
  }
  newConstant = this.constant;
  // Add the expression to substitute, scaled appropriately.
  for (var x in expr.coeffs) {
    if (x in newCoeffs) {
      newCoeffs[x] += expr.coeffs[x] * oldVCoeff;
    } else {
      newCoeffs[x] = expr.coeffs[x] * oldVCoeff;
    }
  }
  newConstant += expr.constant * oldVCoeff;
  // Construct a new expression.
  var coeffs = [];
  var vars = [];
  for (var y in newCoeffs) {
    vars.push(y);
    coeffs.push(newCoeffs[y]);
  }
  return new AffineExpression(coeffs, vars, newConstant);
}

function AE_toString() {
  var s = '';
  for (var v in this.coeffs) {
    var coeff = this.coeffs[v];
    s += coeff + "*" + v + " + ";
  }
  s += this.constant;
  return s;
}

AffineExpression.prototype.getCoefficient = AE_getCoefficient;
AffineExpression.prototype.getLargestPivot = AE_getLargestPivot;
AffineExpression.prototype.getScalarValue = AE_getScalarValue;
AffineExpression.prototype.isScalar = AE_isScalar;
AffineExpression.prototype.solveFor = AE_solveFor;
AffineExpression.prototype.substitute = AE_substitute;
AffineExpression.prototype.toString = AE_toString;

// Solves a system of simultaneous linear equations. The equations are given by
// X == 0 for each X in SYSTEM (a list of AffineExpressions).
//
// Throw inconsistentSystemError if the system is inconsistent.
//
// Otherwise, return an array with a key for each variable. If the variable has
// a unique solution S, then the associated value is S. Otherwise, if the
// variable is underconstrained, then the associated value is NaN.
function solveLinearSystem(system) {
  var backVars = [];
  var backExprs = [];

  // Perform forward elimination.
  for (var i = 0; i < system.length; i++) {
    var e = system[i];
    var pivotVar = e.getLargestPivot();
    if (pivotVar !== null && !nearZero(e.getCoefficient(pivotVar))) {
      // Eliminate the pivot variable
      var subExpr = e.solveFor(pivotVar);
      // Remember the variable and an expression for it in terms of other
      // variables, for later substitution.
      backVars.push(pivotVar);
      backExprs.push(subExpr);
      // Substitute in all subsequent equations.
      for (var j = i + 1; j < system.length; j++) {
        system[j] = system[j].substitute(pivotVar, subExpr);
      }
    } else {
      // There's no pivot here. We have an equation of the form c == 0,
      // for some constant c. That equation is either a tautology or a
      // contradiction.
      if (nearZero(e.constant)) {
        // This equation is redundant, we'll just ignore it
      } else {
        // This equation yields an inconsistent system!
        throw inconsistentSystemError;
      }
    }
  }
  // Perform back substitution.
  for (var m = backVars.length - 1; m >= 0; m--) {
    for (var n = m + 1; n < backVars.length; n++) {
      backExprs[m] = backExprs[m].substitute(backVars[n], backExprs[n]);
    }
  }
  // Copy the output into a new array and return it.
  var soln = [];
  for (var v in backVars) {
    if (backExprs[v].isScalar()) {
      soln[backVars[v]] = backExprs[v].getScalarValue();
    } else {
      // We don't have an explicit expression that doesn't depend on
      // other variables. This variable is underconstrained.
      soln[backVars[v]] = NaN;
    }
  }

  return soln;
}

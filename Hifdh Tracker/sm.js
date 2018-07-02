/*
 * SM.js
 * (c) 2014 Kazuaki Tanida
 * This software can be freely distributed under the MIT license.
 */
var FI_G, ForgettingCurves, Item, MAX_AF, MAX_GRADE, MIN_AF, NOTCH_AF, OFM, RANGE_AF, RANGE_REPETITION, RFM, THRESHOLD_RECALL, error, exponentialRegression, fixedPointPowerLawRegression, linearRegression, linearRegressionThroughOrigin, main, mse, powerLawModel, powerLawRegression, ref, sum;

this.SM = class SM {
    constructor() {
        this._findIndexToInsert = this._findIndexToInsert.bind(this);
        this.addItem = this.addItem.bind(this);
        this.nextItem = this.nextItem.bind(this);
        this.answer = this.answer.bind(this);
        this._update = this._update.bind(this);
        this.discard = this.discard.bind(this);
        this.data = this.data.bind(this);
        this.requestedFI = 10;
        this.intervalBase = 3 * 60 * 60 * 1000;
        this.q = []; // items sorted by dueDate
        this.fi_g = new FI_G(this);
        this.forgettingCurves = new ForgettingCurves(this);
        this.rfm = new RFM(this);
        this.ofm = new OFM(this);
    }
    
    _findIndexToInsert(item, r = (function() {
                                  var results = [];
                                  for (var j = 0, ref = this.q.length; 0 <= ref ? j < ref : j > ref; 0 <= ref ? j++ : j--){ results.push(j); }
                                  return results;
                                  }).apply(this)) {
        var i, v;
        if (r.length === 0) {
            return 0;
        }
        v = item.dueDate;
        i = Math.floor(r.length / 2);
        if (r.length === 1) {
            if (v < this.q[r[i]].dueDate) {
                return r[i];
            } else {
                return r[i] + 1;
            }
        }
        return this._findIndexToInsert(item, (v < this.q[r[i]].dueDate ? r.slice(0, i) : r.slice(i)));
    }
    
    addItem(value) {
        var item;
        item = new Item(this, value);
        this.q.splice(this._findIndexToInsert(item), 0, item);
        return item
    }
    
    nextItem(isAdvanceable = false) {
        if (0 === this.q.length) {
            return null;
        }
        if (isAdvanceable || this.q[0].dueDate < new Date()) {
            return this.q[0];
        }
        return null;
    }
    
    answer(grade, item, now = new Date()) {
        this._update(grade, item, now);
        this.discard(item);
        return this.q.splice(this._findIndexToInsert(item), 0, item);
    }
    
    _update(grade, item, now = new Date()) {
        if (item.repetition >= 0) {
            this.forgettingCurves.registerPoint(grade, item, now);
            this.ofm.update();
            this.fi_g.update(grade, item, now);
        }
        return item.answer(grade, now);
    }
    
    discard(item) {
        var index;
        index = this.q.indexOf(item);
        if (index >= 0) {
            return this.q.splice(index, 1);
        }
    }
    
    data() {
        var item;
        return {
        requestedFI: this.requestedFI,
        intervalBase: this.intervalBase,
        q: (function() {
            var j, len, ref1, results;
            ref1 = this.q;
            results = [];
            for (j = 0, len = ref1.length; j < len; j++) {
            item = ref1[j];
            results.push(item.data());
            }
            return results;
            }).call(this),
        fi_g: this.fi_g.data(),
        forgettingCurves: this.forgettingCurves.data(),
        version: 1
        };
    }
    
    static load(data) {
        var d, sm;
        sm = new SM();
        sm.requestedFI = data.requestedFI;
        sm.intervalBase = data.intervalBase;
        sm.q = (function() {
                var j, len, ref1, results;
                ref1 = data.q;
                results = [];
                for (j = 0, len = ref1.length; j < len; j++) {
                d = ref1[j];
                results.push(Item.load(sm, d));
                }
                return results;
                })();
        sm.fi_g = FI_G.load(sm, data.fi_g);
        sm.forgettingCurves = ForgettingCurves.load(sm, data.forgettingCurves);
        sm.ofm.update();
        return sm;
    }
    
};

RANGE_AF = 20;

RANGE_REPETITION = 20;

MIN_AF = 1.2;

NOTCH_AF = 0.3;

MAX_AF = MIN_AF + NOTCH_AF * (RANGE_AF - 1);

MAX_GRADE = 5;

THRESHOLD_RECALL = 3;

Item = (function() {
        var MAX_AFS_COUNT;
        
        class Item {
        constructor(sm1, value1) {
        this.interval = this.interval.bind(this);
        this.uf = this.uf.bind(this);
        // A-Factor
        this.af = this.af.bind(this);
        this.afIndex = this.afIndex.bind(this);
        // 1. Obtain optimum interval
        // This algorithm employs a slightly different approach from the original description of SM-15.
        // It derives the optimum interval from the acutual interval and O-Factor instead of the previously calculated interval and O-Factor.
        // This approach may make it possible to conduct advanced repetition and delayed repetition without employing a complicated way.
        this._I = this._I.bind(this);
        // 9. 11. Update A-Factor
        this._updateAF = this._updateAF.bind(this);
        this.answer = this.answer.bind(this);
        this.data = this.data.bind(this);
        this.sm = sm1;
        this.value = value1;
        this.lapse = 0;
        this.repetition = -1;
        this.of = 1;
        this.optimumInterval = this.sm.intervalBase;
        this.dueDate = new Date(0);
        this._afs = [];
        }
        
        interval(now = new Date()) {
        if (this.previousDate == null) {
        return this.sm.intervalBase;
        }
        return now - this.previousDate;
        }
        
        uf(now = new Date()) {
        return this.interval(now) / (this.optimumInterval / this.of);
        }
        
        af(value = void 0) {
        var a;
        if (value == null) {
        return this._af;
        }
        a = Math.round((value - MIN_AF) / NOTCH_AF);
        return this._af = Math.max(MIN_AF, Math.min(MAX_AF, MIN_AF + a * NOTCH_AF));
        }
        
        afIndex() {
        var afs, i;
        afs = (function() {
               var j, ref1, results;
               results = [];
               for (i = j = 0, ref1 = RANGE_AF; (0 <= ref1 ? j < ref1 : j > ref1); i = 0 <= ref1 ? ++j : --j) {
               results.push(MIN_AF + i * NOTCH_AF);
               }
               return results;
               })();
        return (function() {
                var results = [];
                for (var j = 0; 0 <= RANGE_AF ? j < RANGE_AF : j > RANGE_AF; 0 <= RANGE_AF ? j++ : j--){ results.push(j); }
                return results;
                }).apply(this).reduce((a, b) => {
                                      if (Math.abs(this.af() - afs[a]) < Math.abs(this.af() - afs[b])) {
                                      return a;
                                      } else {
                                      return b;
                                      }
                                      });
        }
        
        _I(now = new Date()) {
        var of_;
        of_ = this.sm.ofm.of(this.repetition, this.repetition === 0 ? this.lapse : this.afIndex());
        this.of = Math.max(1, (of_ - 1) * (this.interval(now) / this.optimumInterval) + 1);
        this.optimumInterval = Math.round(this.optimumInterval * this.of);
        this.previousDate = now;
        return this.dueDate = new Date(now.getTime() + this.optimumInterval);
        }
        
        _updateAF(grade, now = new Date()) {
        var correctedUF, estimatedAF, estimatedFI, ref1;
        estimatedFI = Math.max(1, this.sm.fi_g.fi(grade));
        correctedUF = this.uf(now) * (this.sm.requestedFI / estimatedFI);
        estimatedAF = this.repetition > 0 ? this.sm.ofm.af(this.repetition, correctedUF) : Math.max(MIN_AF, Math.min(MAX_AF, correctedUF));
        this._afs.push(estimatedAF);
        this._afs = this._afs.slice((Math.max(0, this._afs.length - MAX_AFS_COUNT)));
        return this.af(sum(this._afs.map(function(a, i) {
                                         return a * (i + 1);
                                         })) / sum((function() {
                                                    var results = [];
                                                    for (var j = 1, ref1 = this._afs.length; 1 <= ref1 ? j <= ref1 : j >= ref1; 1 <= ref1 ? j++ : j--){ results.push(j); }
                                                    return results;
                                                    }).apply(this)));
        }
        
        answer(grade, now = new Date()) {
        if (this.repetition >= 0) {
        this._updateAF(grade, now);
        }
        if (grade >= THRESHOLD_RECALL) {
        if (this.repetition < (RANGE_REPETITION - 1)) {
        this.repetition++;
        }
        return this._I(now);
        } else {
        if (this.lapse < (RANGE_AF - 1)) {
        this.lapse++;
        }
        this.optimumInterval = this.sm.intervalBase;
        this.previousDate = null; // set interval() to @sm.intervalBase
        this.dueDate = now;
        return this.repetition = -1;
        }
        }
        
        data() {
        return {
        value: this.value,
        repetition: this.repetition,
        lapse: this.lapse,
        of: this.of,
        optimumInterval: this.optimumInterval,
        dueDate: this.dueDate,
        previousDate: this.previousDate,
        _afs: this._afs
        };
        }
        
        static load(sm, data) {
        var item, k, v;
        item = new Item(sm);
        for (k in data) {
        v = data[k];
        item[k] = v;
        }
        item.dueDate = new Date(item.dueDate);
        if (item.previousDate != null) {
        item.previousDate = new Date(item.previousDate);
        }
        return item;
        }
        
        };
        
        MAX_AFS_COUNT = 30;
        
        return Item;
        
        }).call(this);

FI_G = (function() {
        var GRADE_OFFSET, MAX_POINTS_COUNT;
        
        class FI_G {
        constructor(sm1, points1 = void 0) {
        var j, len, p, ref1;
        this._registerPoint = this._registerPoint.bind(this);
        
        //10. Update regression of FI-G graph
        this.update = this.update.bind(this);
        // Estimated forgetting index
        this.fi = this.fi.bind(this);
        this.grade = this.grade.bind(this);
        this.data = this.data.bind(this);
        this.sm = sm1;
        this.points = points1;
        if (this.points == null) {
        this.points = [];
        ref1 = [[0, MAX_GRADE], [100, 0]];
        for (j = 0, len = ref1.length; j < len; j++) {
        p = ref1[j];
        this._registerPoint(p[0], p[1]);
        }
        }
        }
        
        _registerPoint(fi, g) {
        this.points.push([fi, g + GRADE_OFFSET]);
        return this.points = this.points.slice((Math.max(0, this.points.length - MAX_POINTS_COUNT)));
        }
        
        update(grade, item, now = new Date()) {
        var expectedFI;
        expectedFI = () => {
        return (item.uf(now) / item.of) * this.sm.requestedFI; // assuming linear forgetting curve for simplicity
        };
        /* A way to get the expected forgetting index using a forgetting curve
         curve = @sm.forgettingCurves.curves[item.repetition][item.afIndex()]
         uf = curve.uf (100 - @sm.requestedFI)
         return 100 - curve.retention (item.uf() / uf)
         */
        this._registerPoint(expectedFI(), grade);
        return this._graph = null;
        }
        
        fi(grade) {
        var ref1;
        if (this._graph == null) {
        this._graph = exponentialRegression(this.points);
        }
        return Math.max(0, Math.min(100, (ref1 = this._graph) != null ? ref1.x(grade + GRADE_OFFSET) : void 0));
        }
        
        grade(fi) {
        var ref1;
        if (this._graph == null) {
        this._graph = exponentialRegression(this.points);
        }
        return ((ref1 = this._graph) != null ? ref1.y(fi) : void 0) - GRADE_OFFSET;
        }
        
        data() {
        return {
        points: this.points
        };
        }
        
        static load(sm, data) {
        return new FI_G(sm, data.points);
        }
        
        };
        
        MAX_POINTS_COUNT = 5000;
        
        GRADE_OFFSET = 1;
        
        return FI_G;
        
        }).call(this);

ForgettingCurves = (function() {
                    var FORGOTTEN, ForgettingCurve, REMEMBERED;
                    
                    class ForgettingCurves {
                    constructor(sm1, points = void 0) {
                    var a, i, p, partialPoints, r;
                    this.registerPoint = this.registerPoint.bind(this);
                    this.data = this.data.bind(this);
                    this.sm = sm1;
                    this.curves = (function() {
                                   var j, ref1, results;
                                   results = [];
                                   for (r = j = 0, ref1 = RANGE_REPETITION; (0 <= ref1 ? j < ref1 : j > ref1); r = 0 <= ref1 ? ++j : --j) {
                                   results.push((function() {
                                                 var l, ref2, results1;
                                                 results1 = [];
                                                 for (a = l = 0, ref2 = RANGE_AF; (0 <= ref2 ? l < ref2 : l > ref2); a = 0 <= ref2 ? ++l : --l) {
                                                 partialPoints = points != null ? points[r][a] : (p = r > 0 ? (function() {
                                                                                                               var m, results2;
                                                                                                               results2 = [];
                                                                                                               for (i = m = 0; m <= 20; i = ++m) {
                                                                                                               results2.push([MIN_AF + NOTCH_AF * i, Math.min(REMEMBERED, Math.exp((-(r + 1) / 200) * (i - a * Math.sqrt(2 / (r + 1)))) * (REMEMBERED - this.sm.requestedFI))]);
                                                                                                               }
                                                                                                               return results2;
                                                                                                               }).call(this) : (function() {
                                                                                                                                var m, results2;
                                                                                                                                results2 = [];
                                                                                                                                for (i = m = 0; m <= 20; i = ++m) {
                                                                                                                                results2.push([MIN_AF + NOTCH_AF * i, Math.min(REMEMBERED, Math.exp((-1 / (10 + 1 * (a + 1))) * (i - Math.pow(a, 0.6))) * (REMEMBERED - this.sm.requestedFI))]);
                                                                                                                                }
                                                                                                                                return results2;
                                                                                                                                }).call(this), [[0, REMEMBERED]].concat(p));
                                                 results1.push(new ForgettingCurve(partialPoints));
                                                 }
                                                 return results1;
                                                 }).call(this));
                                   }
                                   return results;
                                   }).call(this);
                    }
                    
                    registerPoint(grade, item, now = new Date()) {
                    var afIndex;
                    afIndex = item.repetition > 0 ? item.afIndex() : item.lapse;
                    return this.curves[item.repetition][afIndex].registerPoint(grade, item.uf(now));
                    }
                    
                    data() {
                    var a, r;
                    return {
                    points: (function() {
                             var j, ref1, results;
                             results = [];
                             for (r = j = 0, ref1 = RANGE_REPETITION; (0 <= ref1 ? j < ref1 : j > ref1); r = 0 <= ref1 ? ++j : --j) {
                             results.push((function() {
                                           var l, ref2, results1;
                                           results1 = [];
                                           for (a = l = 0, ref2 = RANGE_AF; (0 <= ref2 ? l < ref2 : l > ref2); a = 0 <= ref2 ? ++l : --l) {
                                           results1.push(this.curves[r][a].points);
                                           }
                                           return results1;
                                           }).call(this));
                             }
                             return results;
                             }).call(this)
                    };
                    }
                    
                    static load(sm, data) {
                    return new ForgettingCurves(sm, data.points);
                    }
                    
                    };
                    
                    FORGOTTEN = 1;
                    
                    REMEMBERED = 100 + FORGOTTEN;
                    
                    ForgettingCurve = (function() {
                                       var MAX_POINTS_COUNT;
                                       
                                       class ForgettingCurve {
                                       constructor(points1) {
                                       this.registerPoint = this.registerPoint.bind(this);
                                       this.retention = this.retention.bind(this);
                                       this.uf = this.uf.bind(this);
                                       this.points = points1;
                                       }
                                       
                                       registerPoint(grade, uf) {
                                       var isRemembered;
                                       isRemembered = grade >= THRESHOLD_RECALL;
                                       this.points.push([uf, isRemembered ? REMEMBERED : FORGOTTEN]);
                                       this.points = this.points.slice((Math.max(0, this.points.length - MAX_POINTS_COUNT)));
                                       return this._curve = null;
                                       }
                                       
                                       retention(uf) {
                                       if (this._curve == null) {
                                       this._curve = exponentialRegression(this.points);
                                       }
                                       return (Math.max(FORGOTTEN, Math.min(this._curve.y(uf), REMEMBERED))) - FORGOTTEN;
                                       }
                                       
                                       uf(retention) {
                                       if (this._curve == null) {
                                       this._curve = exponentialRegression(this.points);
                                       }
                                       return Math.max(0, this._curve.x(retention + FORGOTTEN));
                                       }
                                       
                                       };
                                       
                                       MAX_POINTS_COUNT = 500;
                                       
                                       return ForgettingCurve;
                                       
                                       }).call(this);
                    
                    return ForgettingCurves;
                    
                    }).call(this);


// R-Factor Matrix
RFM = class RFM {
    constructor(sm1) {
        this.rf = this.rf.bind(this);
        this.sm = sm1;
    }
    
    rf(repetition, afIndex) {
        return this.sm.forgettingCurves.curves[repetition][afIndex].uf(100 - this.sm.requestedFI);
    }
    
};

OFM = (function() {
       var INITIAL_REP_VALUE, afFromIndex, repFromIndex;
       
       
       // Optimum Factor Matrix
       class OFM {
       constructor(sm1) {
       // 8.
       this.update = this.update.bind(this);
       this.of = this.of.bind(this);
       // obtain corresponding A-Factor (column) from n (row) and value
       this.af = this.af.bind(this);
       this.sm = sm1;
       this.update();
       }
       
       update() {
       var a, decay, dfs, ofm0, r;
       // D-factor (a/p^b): the basis of decline of O-Factors, the decay constant of power approximation along RF matrix columns
       dfs = (function() {
              var j, ref1, results;
              results = [];
              for (a = j = 0, ref1 = RANGE_AF; (0 <= ref1 ? j < ref1 : j > ref1); a = 0 <= ref1 ? ++j : --j) {
              results.push(fixedPointPowerLawRegression((function() {
                                                         var l, ref2, results1;
                                                         results1 = [];
                                                         for (r = l = 1, ref2 = RANGE_REPETITION; (1 <= ref2 ? l < ref2 : l > ref2); r = 1 <= ref2 ? ++l : --l) {
                                                         results1.push([repFromIndex(r), this.sm.rfm.rf(r, a)]);
                                                         }
                                                         return results1;
                                                         }).call(this), [repFromIndex(1), afFromIndex(a)]).b);
              }
              return results;
              }).call(this);
       dfs = (function() {
              var j, ref1, results;
              results = [];
              for (a = j = 0, ref1 = RANGE_AF; (0 <= ref1 ? j < ref1 : j > ref1); a = 0 <= ref1 ? ++j : --j) {
              results.push(afFromIndex(a) / Math.pow(2, dfs[a]));
              }
              return results;
              })();
       decay = linearRegression((function() {
                                 var j, ref1, results;
                                 results = [];
                                 for (a = j = 0, ref1 = RANGE_AF; (0 <= ref1 ? j < ref1 : j > ref1); a = 0 <= ref1 ? ++j : --j) {
                                 results.push([a, dfs[a]]);
                                 }
                                 return results;
                                 })());
       this._ofm = function(a) {
       /*
        O-Factor (given repetition, A-Factor and D-Factor) would be modeled by power law
        y = a(x/p)^b, a = A-Factor, b = D-Factor, x = repetition, p = 2 #second repetition number
        = (a/p^b)x^b
        */
       var af, b, model;
       af = afFromIndex(a);
       b = Math.log(af / decay.y(a)) / Math.log(repFromIndex(1));
       model = powerLawModel(af / Math.pow(repFromIndex(1), b), b);
       return {
       y: function(r) {
       return model.y(repFromIndex(r));
       },
       x: function(y) {
       return (model.x(y)) - INITIAL_REP_VALUE;
       }
       };
       };
       ofm0 = exponentialRegression((function() {
                                     var j, ref1, results;
                                     results = [];
                                     for (a = j = 0, ref1 = RANGE_AF; (0 <= ref1 ? j < ref1 : j > ref1); a = 0 <= ref1 ? ++j : --j) {
                                     results.push([a, this.sm.rfm.rf(0, a)]);
                                     }
                                     return results;
                                     }).call(this));
       return this._ofm0 = function(a) {
       return ofm0.y(a);
       };
       }
       
       of(repetition, afIndex) {
       return (repetition === 0 ? typeof this._ofm0 === "function" ? this._ofm0(afIndex) : void 0 : typeof this._ofm === "function" ? this._ofm(afIndex).y(repetition) : void 0);
       }
       
       af(repetition, of_) {
       return afFromIndex((function() {
                           var results = [];
                           for (var j = 0; 0 <= RANGE_AF ? j < RANGE_AF : j > RANGE_AF; 0 <= RANGE_AF ? j++ : j--){ results.push(j); }
                           return results;
                           }).apply(this).reduce((a, b) => {
                                                 if (Math.abs(this.of(repetition, a) - of_) < Math.abs(this.of(repetition, b) - of_)) {
                                                 return a;
                                                 } else {
                                                 return b;
                                                 }
                                                 }));
       }
       
       };
       
       INITIAL_REP_VALUE = 1;
       
       afFromIndex = function(a) {
       return a * NOTCH_AF + MIN_AF;
       };
       
       repFromIndex = function(r) {
       return r + INITIAL_REP_VALUE; // repetition value used for regression
       };
       
       return OFM;
       
       }).call(this);

sum = function(values) {
    return values.reduce(function(a, b) {
                         return a + b;
                         });
};

mse = function(y, points) {
    var i;
    return sum((function() {
                var j, ref1, results;
                results = [];
                for (i = j = 0, ref1 = points.length; (0 <= ref1 ? j < ref1 : j > ref1); i = 0 <= ref1 ? ++j : --j) {
                results.push(Math.pow(y(points[i][0]) - points[i][1], 2));
                }
                return results;
                })()) / points.length;
};

// reference: http://mathworld.wolfram.com/LeastSquaresFittingExponential.html
exponentialRegression = function(points) {
    var X, Y, _y, a, b, i, logY, n, p, sqSumX, sqX, sumLogY, sumSqX, sumX, sumXLogY;
    n = points.length;
    X = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[0]);
         }
         return results;
         })();
    Y = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[1]);
         }
         return results;
         })();
    logY = Y.map(Math.log);
    sqX = X.map(function(v) {
                return v * v;
                });
    sumLogY = sum(logY);
    sumSqX = sum(sqX);
    sumX = sum(X);
    sumXLogY = sum((function() {
                    var j, ref1, results;
                    results = [];
                    for (i = j = 0, ref1 = n; (0 <= ref1 ? j < ref1 : j > ref1); i = 0 <= ref1 ? ++j : --j) {
                    results.push(X[i] * logY[i]);
                    }
                    return results;
                    })());
    sqSumX = sumX * sumX;
    a = (sumLogY * sumSqX - sumX * sumXLogY) / (n * sumSqX - sqSumX);
    b = (n * sumXLogY - sumX * sumLogY) / (n * sumSqX - sqSumX);
    _y = function(x) {
        return Math.exp(a) * Math.exp(b * x);
    };
    return {
    y: _y,
    x: function(y) {
        return (-a + Math.log(y)) / b;
    },
    a: Math.exp(a),
    b: b,
    mse: function() {
        return mse(_y, points);
    }
    };
};

// Least squares method
linearRegression = function(points) {
    var X, Y, a, b, i, n, p, sqSumX, sqX, sumSqX, sumX, sumXY, sumY;
    n = points.length;
    X = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[0]);
         }
         return results;
         })();
    Y = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[1]);
         }
         return results;
         })();
    sqX = X.map(function(v) {
                return v * v;
                });
    sumY = sum(Y);
    sumSqX = sum(sqX);
    sumX = sum(X);
    sumXY = sum((function() {
                 var j, ref1, results;
                 results = [];
                 for (i = j = 0, ref1 = n; (0 <= ref1 ? j < ref1 : j > ref1); i = 0 <= ref1 ? ++j : --j) {
                 results.push(X[i] * Y[i]);
                 }
                 return results;
                 })());
    sqSumX = sumX * sumX;
    a = (sumY * sumSqX - sumX * sumXY) / (n * sumSqX - sqSumX);
    b = (n * sumXY - sumX * sumY) / (n * sumSqX - sqSumX);
    return {
    y: function(x) {
        return a + b * x;
    },
    x: function(y) {
        return (y - a) / b;
    },
    a: a,
    b: b
    };
};

powerLawModel = function(a, b) {
    return {
    y: function(x) {
        return a * Math.pow(x, b);
    },
    x: function(y) {
        return Math.pow(y / a, 1 / b);
    },
    a: a,
    b: b
    };
};

// reference: http://mathworld.wolfram.com/LeastSquaresFittingPowerLaw.html
powerLawRegression = function(points) {
    var X, Y, a, b, i, logX, logY, model, n, p, sqSumLogX, sumLogX, sumLogXLogY, sumLogY, sumSqLogX;
    n = points.length;
    X = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[0]);
         }
         return results;
         })();
    Y = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[1]);
         }
         return results;
         })();
    logX = X.map(Math.log);
    logY = Y.map(Math.log);
    sumLogXLogY = sum((function() {
                       var j, ref1, results;
                       results = [];
                       for (i = j = 0, ref1 = n; (0 <= ref1 ? j < ref1 : j > ref1); i = 0 <= ref1 ? ++j : --j) {
                       results.push(logX[i] * logY[i]);
                       }
                       return results;
                       })());
    sumLogX = sum(logX);
    sumLogY = sum(logY);
    sumSqLogX = sum(logX.map(function(v) {
                             return v * v;
                             }));
    sqSumLogX = sumLogX * sumLogX;
    b = (n * sumLogXLogY - sumLogX * sumLogY) / (n * sumSqLogX - sqSumLogX);
    a = (sumLogY - b * sumLogX) / n;
    model = powerLawModel(Math.exp(a), b);
    model.mse = function() {
        return mse(_y, points);
    };
    return model;
};

fixedPointPowerLawRegression = function(points, fixedPoint) {
    /*
     given fixed point: (p, q)
     the model would be: y = q(x/p)^b
     minimize its residual: ln(y) = b * ln(x/p) + ln(q)
     y_i' = b * x_i'
     x_i' = ln(x_i/p)
     y_i' = ln(y_i) - ln(q)
     */
    var X, Y, b, i, logQ, model, n, p, point, q;
    n = points.length;
    p = fixedPoint[0];
    q = fixedPoint[1];
    logQ = Math.log(q);
    X = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         point = points[j];
         results.push(Math.log(point[0] / p));
         }
         return results;
         })();
    Y = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         point = points[j];
         results.push(Math.log(point[1]) - logQ);
         }
         return results;
         })();
    b = linearRegressionThroughOrigin((function() {
                                       var j, ref1, results;
                                       results = [];
                                       for (i = j = 0, ref1 = n; (0 <= ref1 ? j < ref1 : j > ref1); i = 0 <= ref1 ? ++j : --j) {
                                       results.push([X[i], Y[i]]);
                                       }
                                       return results;
                                       })()).b;
    model = powerLawModel(q / Math.pow(p, b), b);
    return model;
};

linearRegressionThroughOrigin = function(points) {
    var X, Y, b, i, n, p, sumSqX, sumXY;
    n = points.length;
    X = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[0]);
         }
         return results;
         })();
    Y = (function() {
         var j, len, results;
         results = [];
         for (j = 0, len = points.length; j < len; j++) {
         p = points[j];
         results.push(p[1]);
         }
         return results;
         })();
    sumXY = sum((function() {
                 var j, ref1, results;
                 results = [];
                 for (i = j = 0, ref1 = n; (0 <= ref1 ? j < ref1 : j > ref1); i = 0 <= ref1 ? ++j : --j) {
                 results.push(X[i] * Y[i]);
                 }
                 return results;
                 })());
    sumSqX = sum(X.map(function(v) {
                       return v * v;
                       }));
    b = sumXY / sumSqX;
    return {
    y: function(x) {
        return b * x;
    },
    x: function(y) {
        return y / b;
    },
    b: b
    };
};

if (typeof module !== "undefined" && module !== null) {
    module.exports = {
    SM: this.SM,
    _test: {
    exponentialRegression: exponentialRegression,
    linearRegression: linearRegression,
    powerLawRegression: powerLawRegression,
    fixedPointPowerLawRegression: fixedPointPowerLawRegression,
    linearRegressionThroughOrigin: linearRegressionThroughOrigin
    }
    };
}

// Run a simple flash card app on CLI when this module is directly run
main = () => {
    var data, fs, gotoEnterance, mode, sm;
    fs = require('fs');
    console.log('(a)add, (n)next, (N)next advanceably, (s)save, (l)load, (e)exit');
    mode = ['entrance'];
    data = null;
    sm = new this.SM();
    gotoEnterance = function() {
        mode = ['entrance'];
        data = null;
        return process.stdout.write('sm> ');
    };
    return process.stdin.on('readable', () => {
                            var buf, chunk, g, input, item;
                            chunk = process.stdin.read();
                            input = chunk != null ? chunk.toString().trim() : void 0;
                            switch (mode[0]) {
                            case 'entrance':
                            switch (input) {
                            case 'a':
                            case 'add':
                            mode = ['add'];
                            break;
                            case 'n':
                            case 'next':
                            mode = ['next'];
                            break;
                            case 'N':
                            case 'Next':
                            mode = ['next', '_adv'];
                            break;
                            case 's':
                            case 'save':
                            mode = ['save'];
                            break;
                            case 'l':
                            case 'load':
                            mode = ['load'];
                            break;
                            case 'e':
                            case 'exit':
                            mode = ['exit'];
                            break;
                            case 'eval':
                            mode = ['eval'];
                            break;
                            case 'list':
                            mode = ['list'];
                            break;
                            default:
                            gotoEnterance();
                            }
                            }
                            switch (mode[0]) {
                            case 'add':
                            switch (mode[1]) {
                            case void 0:
                            data = {
                            front: null,
                            back: null
                            };
                            console.log('Enter the front of the new card:');
                            return mode[1] = 'front';
                            case 'front':
                            data.front = input;
                            console.log('Enter the back of the new card:');
                            return mode[1] = 'back';
                            case 'back':
                            data.back = input;
                            sm.addItem(data);
                            return gotoEnterance();
                            }
                            break;
                            case 'next':
                            switch (mode[1]) {
                            case void 0:
                            case '_adv':
                            data = sm.nextItem(mode[1] === '_adv');
                            if (data == null) {
                            console.log(`There is no card${(sm.q.length > 0 ? ' that can be shown now. The next card is due at \"' + sm.q[0].dueDate.toLocaleString() + '\".' : '.')}`);
                            return gotoEnterance();
                            } else {
                            console.log(`How much do you remember [${data.value.front}]:`);
                            return mode[1] = 'review';
                            }
                            break;
                            case 'review':
                            g = parseInt(input);
                            if ((0 <= g && g <= 5)) {
                            sm.answer(g, data);
                            console.log(`The answer was [${data.value.back}].`);
                            return gotoEnterance();
                            } else if (input === 'D') {
                            sm.discard(data);
                            return gotoEnterance();
                            } else {
                            return console.log('The value should be from \'0\' (bad) to \'5\' (good). Otherwise \'D\' to discard:');
                            }
                            }
                            break;
                            case 'save':
                            if (mode[1] == null) {
                            console.log('enter file name to save configuration. (default name is [data.json]):');
                            return mode[1] = true;
                            } else {
                            if (input === '') {
                            input = 'data.json';
                            }
                            fs.writeFileSync(input, JSON.stringify(sm.data()));
                            return gotoEnterance();
                            }
                            break;
                            case 'load':
                            if (mode[1] == null) {
                            console.log('enter file name to load configuration. (default name is [data.json]):');
                            return mode[1] = true;
                            } else {
                            if (input === '') {
                            input = 'data.json';
                            }
                            buf = fs.readFileSync(input);
                            data = JSON.parse(buf.toString());
                            sm = this.SM.load(data);
                            return gotoEnterance();
                            }
                            break;
                            case 'exit':
                            if (mode[1] == null) {
                            process.stdin.pause();
                            return mode[1] = 'paused';
                            }
                            break;
                            case 'eval':
                            if (mode[1] == null) {
                            return mode[1] = true;
                            } else {
                            console.log(eval(input));
                            return gotoEnterance();
                            }
                            break;
                            case 'list':
                            console.log((function() {
                                         var j, len, ref1, results;
                                         ref1 = sm.q;
                                         results = [];
                                         for (j = 0, len = ref1.length; j < len; j++) {
                                         item = ref1[j];
                                         results.push(JSON.stringify(item.data()));
                                         }
                                         return results;
                                         })());
                            return gotoEnterance();
                            }
                            });
};

try {
    if ((typeof module !== "undefined" && module !== null) && (typeof require !== "undefined" && require !== null ? require.main : void 0) === module) {
        main();
    }
} catch (error1) {
    error = error1;
    console.error(`An error occured: ${error}`);
}


/**
 * jQuery scrollme plug-in
 * A super lightweight jQuery plug-in for parallax scrolling-ish effects
 *
 * usage:
 *     $(...).scrollme()
 *
 * html5 data parameters:
 *     data-sm-f{from}t{to}
 *         props[, props[, ...]]
 *
 *         props
 *             style name start end [unit] [easing]
 */

(function($) {

    var FINISH_L = 1,  // lower finish flag
        FINISH_H = 2,  // higher finish flag
        IN_PROGRESS = 3;

    var _requestAnimFrame = (function(){
          return  window.requestAnimationFrame       ||
                  window.webkitRequestAnimationFrame ||
                  window.mozRequestAnimationFrame    ||
                  function( callback ){
                    window.setTimeout(callback, 1000 / 60);
                  };
        })(),
        _registered = [],
        _support_separated_axis_bg_position = (function () {
            return (typeof document.createElement('div').style.backgroundPositionX !== 'undefined');
        }()),
        _ticking = false,
        _re_data = /smF(\d+)t(\d+)/,
        _transform_properties = {
            translateX: true,
            translateY: true,
            translateZ: true,
            scaleX: true,
            scaleY: true,
            scale: true,
            rotate: true,
            rotateX: true,
            rotateY: true,
            rotateZ: true,
            skewX: true,
            skewY: true
        },
        _easing = {},
        $window = $(window),
        _finishing_interval = null,
        _finishing_interval_count = 0,
        _scroll_event_binded = false;


    /**
     * Easing functions from CreateJS/TweenJS
     * https://github.com/CreateJS/TweenJS/blob/master/src/tweenjs/Ease.js
     */
    _easing.linear = function(t) {
        return t;
    };
    _easing.sineIn = function(t) {
        return 1-Math.cos(t*Math.PI/2);
    };
    _easing.sineOut = function(t) {
        return Math.sin(t*Math.PI/2);
    };
    _easing.sineInOut = function(t) {
        return -0.5*(Math.cos(Math.PI*t) - 1);
    };
    _easing.getBackIn = function(amount) {
        return function(t) {
            return t*t*((amount+1)*t-amount);
        };
    };
    _easing.getBackOut = function(amount) {
        return function(t) {
            return (--t*t*((amount+1)*t + amount) + 1);
        };
    };
    _easing.backOut = _easing.getBackOut(2);
    _easing.backIn = _easing.getBackIn(2);
    _easing.getElasticIn = function(amplitude,period) {
        var pi2 = Math.PI*2;
        return function(t) {
            if (t===0 || t===1) {
                return t;
            }
            var s = period/pi2*Math.asin(1/amplitude);
            return -(amplitude*Math.pow(2,10*(t-=1))*Math.sin((t-s)*pi2/period));
        };
    };
    _easing.elasticIn = _easing.getElasticIn(1,0.3);
    _easing.getElasticOut = function(amplitude,period) {
        var pi2 = Math.PI*2;
        return function(t) {
            if (t===0 || t===1) {
                return t;
            }
            var s = period/pi2 * Math.asin(1/amplitude);
            return (amplitude*Math.pow(2,-10*t)*Math.sin((t-s)*pi2/period )+1);
        };
    };
    _easing.elasticOut = _easing.getElasticOut(1,0.3);


    $.fn.scrollme = function () {

        $(this).each(function () {
            var $this = $(this),
                data = $this.data(),
                obj;

            // search for the data name matches "smF[number]t[number]"
            $.each(data, function(key, value) {
                var matched = key.match(_re_data);

                if (matched) {
                    // handle range
                    obj = {
                        start: Number(matched[1]),
                        end: Number(matched[2]),
                        props: [],
                        element: $this,
                        status: IN_PROGRESS
                    };

                    // handle multiple properties splitted by comma
                    $.each(value.split(/,/), function(i, prop_spec) {
                        prop_spec = _trim(prop_spec);

                        var extracted = [];
                        $.each(prop_spec.split(/ /), function(i, spec_token) {
                            var trimmed_spec_token = _trim(spec_token);
                            if (trimmed_spec_token !== '') {
                                extracted.push(trimmed_spec_token);
                            }
                        });

                        obj.props.push({
                            name: extracted[0],
                            start: $.isNumeric(extracted[1]) ? Number(extracted[1]) : extracted[1],
                            end: $.isNumeric(extracted[2]) ? Number(extracted[2]) : extracted[2],
                            unit: (extracted[3] && extracted[3] !== '_') ? extracted[3] : '',
                            easing: (extracted[4] && _easing[extracted[4]]) ? 
                                        _easing[extracted[4]] : 
                                        _easing.linear
                        });
                    });

                    // push the result to _registered
                    _registered.push(obj);
                }
            });
        });

        if (_registered.length > 0 && !_scroll_event_binded) {
            _scroll_event_binded = true;
            $window.scroll(function () {
                _onScroll();

                if (_finishing_interval !== null) {
                    clearInterval(_finishing_interval);
                }
                _finishing_interval = setInterval(function () {
                    _onScroll();

                    if (_finishing_interval_count++ >= 3) {
                        _finishing_interval_count = 0;
                        clearInterval(_finishing_interval);
                        _finishing_interval = null;
                    }
                }, 50);
            });
            _onScroll();
        }

        return this;
    };

    function _onScroll () {
        // do not re-request animation frame if it's already running
        if (!_ticking) {
            // ticking flag on
            _ticking = true;
            _requestAnimFrame(_scroll);
        }
    }

    /**
     * The scroll event handler, wrapped with requestAnimationFrame,
     * handle scrolling interpolations from _registered
     */
    function _scroll () {
        var saved_scroll_top = $window.scrollTop(),
            scroll_top;

        $.each(_registered, function(i, obj) {
            var diff_start, frac, transform_list, require_animate;

            scroll_top = saved_scroll_top;
            require_animate = _isRequireAnimate(scroll_top, obj);

            if (require_animate !== false) {
                if (require_animate === FINISH_L) {
                    scroll_top = obj.start;  // do for lower bound
                    obj.status = FINISH_L;
                }
                else if (require_animate === FINISH_H) {
                    scroll_top = obj.end;  // do for upper bound
                    obj.status = FINISH_H;
                }
                else {
                    obj.status = IN_PROGRESS;
                }

                diff_start = scroll_top - obj.start;

                // interpolation fraction
                frac = diff_start / (obj.end - obj.start);

                // multiple properties
                $.each(obj.props, function(i, prop) {
                    var curr_val = prop.start + (prop.end - prop.start) * prop.easing(frac),
                        orig;

                    if (!$.isNumeric(prop.start) || !$.isNumeric(prop.end)) {
                        // non-numeric value only applied when hitting the end threshold
                        if (obj.status === FINISH_H) {
                            obj.element.css(prop.name, prop.end);
                        }
                        else {
                            obj.element.css(prop.name, prop.start);
                        }
                    }
                    else if (prop.name == 'background-position-x' || prop.name == 'background-position-y') {
                        // polly fills separated axis background-position
                        if (_support_separated_axis_bg_position) {
                            obj.element.css(prop.name, curr_val + prop.unit);
                        }
                        else if (prop.name == 'background-position-x') {
                            // lock y, change x
                            orig = obj.element.css('background-position').split(/ /);
                            obj.element.css('background-position', curr_val + prop.unit + ' ' + orig[1]);
                        }
                        else if (prop.name == 'background-position-y') {
                            // lock x, change y
                            orig = obj.element.css('background-position').split(/ /);
                            obj.element.css('background-position', orig[0] + ' ' + curr_val + prop.unit);
                        }
                    }
                    else if (_isTransformProperty(prop.name)){
                        transform_list = transform_list || [];

                        // support percentage unit for translateX, translateY
                        var unit = prop.unit;
                        if (unit == '%') {
                            unit = 'px';
                            curr_val = _calcPixelFromPercentage(prop.name.substr(-1).toLowerCase(), curr_val);
                        }

                        transform_list.push(prop.name + '(' + curr_val + unit + ')');
                    }
                    else {
                        obj.element.css(prop.name, curr_val + prop.unit);
                    }

                });

                // handle transform properties
                if (transform_list && transform_list.length > 0) {
                    obj.element.css('transform', transform_list.join(' '));
                }
            }
        });

        // ticking flag off
        _ticking = false;
    }

    // Author: Ariel Flesler
    // http://flesler.blogspot.com/2008/11/fast-trim-function-for-javascript.html
    // Licensed under BSD
    function _trim(str) {
        var start = -1,
        end = str.length;
        while (str.charCodeAt(--end) < 33) {}
        while (str.charCodeAt(++start) < 33) {} 
        return str.slice(start, end + 1);
    }

    function _isTransformProperty(property_name) {
        return !!(_transform_properties[property_name]);
    }

    /**
     * Calculate pixel value of percentage from window width or height
     * @param  {String} axis       'x' or 'y'
     * @param  {Number} percentage percentage to calculate
     * @return {Number}            result pixel
     */
    function _calcPixelFromPercentage(axis, percentage) {
        switch (axis) {
            case 'x':
                return $window.width() * (percentage / 100);
            case 'y':
                return $window.height() * (percentage / 100);
        }
    }

    /**
     * Determine if the scrolling object at current scroll top needs to be animated
     * @param  {Number}  scroll_top    window.scrollTop
     * @param  {Object}  scrolling_obj data structure of parsed scrolling setting
     * @return {mixed}                 IN_PROGRESS, FINISH_L, FINISH_H or false
     */
    function _isRequireAnimate(scroll_top, scrolling_obj) {
        if (scroll_top >= scrolling_obj.start && scroll_top <= scrolling_obj.end) {
            return IN_PROGRESS;
        }
        if (scroll_top < scrolling_obj.start && scrolling_obj.status !== FINISH_L) {
            return FINISH_L;
        }
        if (scroll_top > scrolling_obj.end && scrolling_obj.status !== FINISH_H) {
            return FINISH_H;
        }
        return false;
    }

})(jQuery);
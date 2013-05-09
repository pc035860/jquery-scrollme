jquery-scrollme
===

A super lightweight jQuery plug-in for parallax scrolling-ish effects

HTML5 data syntax
---

#### basic example
```html
<div data-sm-f0t500="left 0 500 px sineOut">A basic example</div>
```

#### explanation of the HTML5 data

    data-sm-f{from scroll top}t{to scroll top}
      ="{property name} {value start} {value end} {unit} {easing}"

<table>
  <tr>
    <td>from scroll top</td>
    <td>where the scroll tick takes off</td>
  </tr>
  <tr>
    <td>to scroll top</td>
    <td>the tick ends here</td>
  </tr>
  <tr>
    <td>property name</td>
    <td>supported single-valued CSS properties name (examples below)</td>
  </tr>
  <tr>
    <td>value start</td>
    <td>ticking property's start value</td>
  </tr>
  <tr>
    <td>value end</td>
    <td>ticking property's end value</td>
  </tr>
  <tr>
    <td>unit (optional)</td>
    <td>unit of the value, default value `_`, which means empty</td>
  </tr>
  <tr>
    <td>easing (optional)</td>
    <td>easing function name, default value `linear`</td>
  </tr>
</table>


#### multiple properties

simply concatenate properties with `,`

```html
<div data-sm-f0t500="left 0 500 px sineOut, top 0 100 px, scale 1 1.5 _ backOut">A basic example</div>
```



Start ticking
---

After setting up the scollme configuration for each element in the DOM,
simply add the following:

```javascript
$(...).scrollme();
```


Frequently used properties
---

### Background position
###### handle x-axis, y-axis separately

* background-position-x, background-position-y

### Position
* top, left, right, bottom
* margin-left, margin-right, margin-top, margin-bottom

### Transforms
###### transform properties are merged with the order of data specification

* translateX, translateY, translateZ
* rotate, rotateX, rotateY, rotateZ
* skewX, skewY
* scale, scaleX, scaleY

Examples
---
Under construction
/*
show depth file info
node test/info [url]
*/

var DepthReader = require('../depth-reader')
  , Promise     = require('rsvp').Promise
  , Canvas      = require('canvas')
  , path        = require('path')
  , fs          = require('fs');

var fileUrl = process.argv[2] ||
      'http://localhost:9000/images/xdm-photo1.jpg'
  , pathname
  , canvas
  , canvas_
  , sizes = {};

var reader = new DepthReader;
reader.debug = true; // save xmpXapXml/xmpExtXml

reader.loadFile(fileUrl)
  .then(function() {
    if (reader.xmpXapXml) {
      console.log('  writing: xmpxap.xml');
      pathname = path.join(__dirname, 'xmpxap.xml');
      return saveString(reader.xmpXapXml, pathname);
    }
  })
  .then(function() {
    if (reader.xmpExtXml) {
      console.log('  writing: xmpext.xml');
      pathname = path.join(__dirname, 'xmpext.xml');
      return saveString(reader.xmpExtXml, pathname);
    }
  })
  .then(function() {
    console.log('  writing: container.jpg');
    return makeCanvas(reader.fileData)
      .then(function(canvas) {
        sizes.container = {
          width:  canvas.width
        , height: canvas.height
        };
        pathname = path.join(__dirname, 'container.jpg');
        return saveCanvas(canvas, pathname);
      });
  })
  .then(function() {
    console.log('  writing: reference.jpg');
    return makeCanvas(reader.image.data)
      .then(function(canvas) {
        sizes.reference = {
          width:  canvas.width
        , height: canvas.height
        };
        pathname = path.join(__dirname, 'reference.jpg');
        return saveCanvas(canvas, pathname);
      });
  })
  .then(function() {
    console.log('  writing: depthmap.png');
    return makeCanvas(reader.depth.data)
      .then(function(canvas_) {
        // show histogram of original depthmap first
        canvas = canvas_;
        if (!reader.isXDM) {
          return canvas_;
        }
        // save normalized depthmap
        return reader.normalizeDepthMap(64)
          .then(makeCanvas);
      })
      .then(function(canvas) {
        // then show histogram of normalized depthmap
        canvas_ = canvas;
        sizes.depthmap = {
          width:  canvas.width
        , height: canvas.height
        };
        pathname = path.join(__dirname, 'depthmap.png');
        return saveCanvas(canvas, pathname);
      });
  })
  .then(function() {
    if (reader.depth.raw.data) {
      console.log('  writing: rawdepth.png');
      return makeCanvas(reader.depth.raw.data)
        .then(function(canvas) {
          sizes.rawdepth = {
            width:  canvas.width
          , height: canvas.height
          };
          pathname = path.join(__dirname, 'rawdepth.png');
          return saveCanvas(canvas, pathname);
        });
    }
  })
  .then(function() {
    if (reader.confidence.data) {
      console.log('  writing: confidence.png');
      return makeCanvas(reader.confidence.data)
        .then(function(canvas) {
          sizes.confidence = {
            width:  canvas.width
          , height: canvas.height
          };
          pathname = path.join(__dirname, 'confidence.png');
          return saveCanvas(canvas, pathname);
        });
    }
  })
  .then(function() {
    console.log('   is XDM:', reader.isXDM);
    console.log(' revision:', reader.revision.toFixed(1));
    console.log('reference: %dx%d', sizes.reference.width
                                  , sizes.reference.height);
    console.log(' depthmap: %dx%d', sizes.depthmap.width
                                  , sizes.depthmap.height);
    console.log('   metric:', reader.depth.metric);
    console.log('   format:', reader.depth.format);
    console.log('     near:', reader.depth.near);
    console.log('      far:', reader.depth.far);

    var total = canvas.width
              * canvas.height;

    [canvas, canvas_].forEach(function(canvas, i) {
      var range  = getBrightness(canvas, true)
        , histo  = getHistogram (canvas, 'r')
        , maxVal = histo.max.r
        , max    = range.max
        , min    = range.min;

      if (0 === i) { // original depthmap
        console.log('min value:', min);
        console.log('max value:', max);
      }
      console.log('histogram (%s):'
        , !i ? 'original' : 'normalized');

      for (i = min; i <= max; i++) {
        var value = histo.freq.r[i];
        if (value) {
          var isMax = value === maxVal
            , pcnt  = value / total * 100;

          console.log( padZero(i,  3) + ':'
            , pad(pcnt.toFixed(2), 5) + '%'
            , value + (isMax ? ' *' : ''));
        }
      }
    });
  })
  .catch(function(error) {
    console.error('loading failed:', error);
  });

/**
save @string to @pathname
return: Promise
*/
function saveString(string, pathname)
{
  return new Promise(function(resolve, reject) {
    try {
      fs.writeFile(pathname, string, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (err) {
      var msg = 'saveString failed: ' + err.message;
      reject(new Error(msg));
    }
  });
}

function loadImage(src, img) {
  return new Promise(function(resolve, reject) {
    try {
      if (!img) {
        img = new Canvas.Image;
      }
      img.onload = function() {
        resolve(img);
      };
      img.onerror = function() {
        reject(new Error('cannot load image'));
      };
      img.src = src;
    } catch (err) {
      reject(err);
    }
  });
}

/**
draw image onto new canvas
@imgSrc: Canvas.Image.src
return: Canvas
*/
function makeCanvas(imgSrc)
{
  return loadImage(imgSrc)
    .then(function(img) {
      if (!img.width) {
        return null;
      }
      var canvas = new Canvas(img.width, img.height)
        , ctx    = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvas;
    });
}

/**
save @canvas to @pathname
@pathname: .png/.jpg file
return: Promise
*/
function saveCanvas(canvas, pathname)
{
  return new Promise(function(resolve, reject) {
    try {
      var ext      = path.extname(pathname)
        , encoder  = '.png' === ext ?  'pngStream'
                                    : 'jpegStream'
        , writable = fs.createWriteStream(pathname)
        , readable = canvas[encoder]();

      writable.on('finish', resolve)
        .on('error', function(err) {
          var msg = 'stream.Writable error: ' + err.message;
          reject(new Error(msg));
        });
      readable.on('end', function() {
          writable.end();
        })
        .on('error', function(err) {
          var msg = 'Canvas.' + encoder + ' error: ' + err.message;
          reject(new Error(msg));
        })
        .pipe(writable);
    }
    catch (err) {
      var msg = 'saveCanvas failed: ' + err.message;
      reject(new Error(msg));
    }
  });
}

/**
get {min,max} range of the brightness of pixels in @object
using the formula: sqrt(0.299*R^2 + 0.587*G^2 + 0.114*B^2)

@object: Canvas, ImageData, or
         ImageData.data (Canvas.PixelArray)
[@mono]: if true, uses only R value
*/
function getBrightness(object, mono)
{
  var data = getPixelData(object)
    , len  = data.length
    , min  = 255
    , max  = 0
    , val, i;

  for (i = 0; i < len; i += 4) {
    // avoid function overhead
    if (mono) {
      val = data[i];
    } else {
      var r = data[i    ]
        , g = data[i + 1]
        , b = data[i + 2];

      val = Math.round(Math.sqrt(
          0.299 * r*r +
          0.587 * g*g +
          0.114 * b*b));
    }
    if (val > max) {max = val;}
    if (val < min) {min = val;}
  }
  return {min: min, max: max};
}

/**
get the histogram of an image with pixels in @object
returns {freq:{r[0-255],g[],b[],a[]}, max:{r,g,b,a}}

@object:    Canvas, ImageData, or
            ImageData.data (Canvas.PixelArray)
[@channel]: 'r', 'g', 'b', 'a', or undefined
*/
function getHistogram(object, channel)
{
  var data =  getPixelData(object)
    , len  =  data.length
    , ch   =  String(channel || 0).toLowerCase()
    , chan = 'rgba'.indexOf(ch)
    , freq = {}
    , max  = {};

  'rgba'.split('').forEach(function(c, i)
  {
    if (-1 === chan ||
         i === chan) {
      var a = new Int32Array(256)
        , j, m, n, val;

      for (m = 0, j = i; j < len; j += 4) {
        val = data[j];
        if (m < (n = ++a[val])) {
          m = n;
        }
      }
      freq[c] = a;
       max[c] = m;
    }
  });
  return {freq: freq, max: max};
}

/**
get ImageData.data as an Uint8ClampedArray

@object: Canvas, ImageData, or
         ImageData.data (Canvas.PixelArray)
*/
function getPixelData(object)
{
  var type = object.toString.call(object);

  if ('[object CanvasPixelArray]' === type) {
    return object;
  } else if ('[object ImageData]' === type) {
    return object.data;
  }
  var w      = object.width
    , h      = object.height
    , ctx    = object.getContext('2d')
    , pixels = ctx.getImageData(0, 0, w, h);

  return pixels.data;
}

// pad @value converted to string with leading zeros
// so it's at least @width characters long (up to 6)
function padZero(value, width) {
  return pad(value, width, '000000')
}

/**
pad given string with filler characters on left/right

@width:    if > 0, pad left; if < 0, pad right
[@filler]: padding characters (length >= width)
*/
function pad(string, width, filler)
{
  filler = String(filler || '                    ');
  string = String(string || '');
  if (!(width = ~~width)) {
    return string;
  }
  var padLen = Math.abs(width) - string.length
    , padStr = filler.slice(0, padLen);
  return 0 < width ? padStr + string
                   : string + padStr;
}

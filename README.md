XDM Depth Reader
================

This JavaScript library parses JPEG images in the XDM (eXtensible Device Metadata)
format, which succeeds the Google Lens Blur format generated by the Android Camera
app (it can also read the Lens Blur format as it maintains backward compatibility).

The XDM spec is jointly developed by Intel and Google, and is currently in beta.
This document will be updated to reference the published spec when it's available.

This library may be used in both browser and Node.js projects, but some tests fail
if run inside PhantomJS.

## Dependencies

 - [RSVP.js](https://github.com/tildeio/rsvp.js) *(polyfill for Promise)*
 - [node-xhr2](https://github.com/pwnall/node-xhr2) *(polyfill for XMLHttpRequest in Node.js)*
 - [XMLDOM](https://github.com/jindw/xmldom) *(polyfill for DOMParser in Node.js)*

## Usage

First install the dependencies:

The Node.js example and tests require the `Canvas` module, which in turn depends
on the Cairo graphics library.
Follow these [install instructions](https://github.com/LearnBoost/node-canvas/wiki)
prior to running `npm install`.

    npm install

Then include or require them:

Browser:

    <script src="vendor/rsvp.js"></script>
    <script src="depth-reader.js"></script>

Node.js:

    var DepthReader = require('./depth-reader'),
        Image       = require('canvas').Image;

Example:

    var fileUrl = 'http://localhost/images/depth.jpg';
    new DepthReader().loadFile(fileUrl)
        .then(function(reader) {

            var rgbImage   = new Image(),
                depthImage = new Image();

            rgbImage.src = reader.image.data;
            console.log('RGB image dimensions:',
                rgbImage.width + 'x' + rgbImage.height);

            depthImage.src = reader.depth.data;
            console.log('Depthmap image dimensions:',
                depthImage.width + 'x' + depthImage.height);
        })
        .catch(function(error) {
            console.error('loading failed:', error);
        });

## Tests

Install global dependencies:

    npm install -g grunt mocha

Run Node.js tests in the console and browser tests in a web page:

    npm start

## Authors

  - Erhhung Yuan <erhhung.yuan@intel.com>
  - Yu Bai <yu.bai@intel.com>

## License

The MIT License

Copyright (c)2015 Intel Corporation

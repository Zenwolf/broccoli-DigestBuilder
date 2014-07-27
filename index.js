/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Copyright 2014 Matthew Jaquish <mattjaq at yahoo dot com>
Licensed under the Apache License, Version 2.0
http://www.apache.org/licenses/LICENSE-2.0
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

/*
 * This plugin creates a md5 hex digest for a directory tree based on the
 * content of files that match the specified file extensions comma-separated
 * list, which defaults to just 'js'.
 */

'use strict';

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Dependencies
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var async = require('async');
var Writer = require('broccoli-writer');
var Promise = require('rsvp').Promise;


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Util Functions
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function getExtension(filePath) {
    var ext = path.extname(filePath || '').split('.');
    return ext[ext.length - 1];
}

function msg(txt) {
    console.log('>>> ' + txt);
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Constructor
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function DigestBuilder(inputTree, cfg) {

    if ( !(this instanceof DigestBuilder)  ) {
        return new DigestBuilder(inputTree, cfg);
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Configurable properties.
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    // The digest file output path.
    this.outputname = cfg.outputname;

    // The unique permutation that is appended to the digest content.
    this.permutation = cfg.permutation || '';

    // The acceptible file extensions to include in the digest.
    this.extensions = cfg.extensions || ['js'];


    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    // Local properties.
    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    this.inputTree = inputTree;

    // Map of filename:md5hash
    this.md5sums = Object.create(null);

    // Map of filename:hexname
    this.digest = Object.create(null);

    // Paths used when creating the file tree.
    this.srcPath = '';
    this.destPath = '';
    this.outputPath = '';
}

DigestBuilder.prototype = Object.create(Writer.prototype);
DigestBuilder.prototype.constructor = DigestBuilder;

DigestBuilder.prototype.processPath = function(filePath, done) {
    var digestBuilder = this;

    msg('PATH: ' + filePath);

    fs.stat(filePath, function(err, stats) {
        if (err) {
            throw err;
        }

        if (stats.isDirectory()) {
            digestBuilder.processDir(filePath, done);
        }
        else if (digestBuilder.isSupportedExt(filePath)) {
            digestBuilder.processFile(filePath, done);
        }
        else {
            msg('Skipping file: ' + filePath);
            done();
        }
    });
};

DigestBuilder.prototype.isSupportedExt = function(filePath) {
    if (this.extensions.indexOf(getExtension(filePath)) !== -1) {
        return true;
    }

    return false;
};

DigestBuilder.prototype.handleFileData = function(filePath, data) {
    this.md5sums[filePath].update(data);
};

DigestBuilder.prototype.handleFileEnd = function(filePath) {
    var md5sum = this.md5sums[filePath];
    var dirname = path.dirname(filePath);
    var ext = path.extname(filePath);
    var idx = dirname.indexOf(this.srcPath);
    var origName;
    var name;

    dirname = dirname.substring(idx + this.srcPath.length + 1);
    origName = dirname + path.sep + path.basename(filePath, ext);
    name = origName + '-';

    /*
     * Add the permutation at the end so that the same file can exist in
     * multiple environments with a unique identifier.
     */
    md5sum.update(this.permutation);
    name += md5sum.digest('hex');
    this.digest[origName] = name;

    msg(origName + ' : ' + name);
};

/*
 * Creates a new file with the digest serialized as JSON.
 */
DigestBuilder.prototype.createDigest = function(cb) {
    var outputPath = this.outputPath;

    fs.writeFile(outputPath, JSON.stringify(this.digest), function(err) {
        if (err) {
            throw err;
        }

        msg('Saved digest to: ' + outputPath);
        cb();
    });
};

DigestBuilder.prototype.processDir = function(filePath, done) {
    var builder = this;

    fs.readdir(filePath, function(err, files) {
        if (err) {
            throw err;
        }

        async.each(files, function(fileName, cb) {
            builder.processPath(filePath + path.sep + fileName, cb);
        }, done);
    });
};

DigestBuilder.prototype.processFile = function(filePath, done) {
    var builder = this;
    var readStream = new fs.ReadStream(filePath);

    this.md5sums[filePath] = crypto.createHash('md5');

    readStream.addListener('data', function(data) {
        builder.handleFileData(filePath, data);
    });

    readStream.addListener('end', function() {
        builder.handleFileEnd(filePath);
        done();
    });
};

DigestBuilder.prototype.write = function(readTree, destDir) {
    var builder = this;

    return new Promise(function(resolve, reject) {
        builder.outputPath = path.join(destDir, builder.outputname);
        builder.destPath = destDir;

        readTree(builder.inputTree).then(function(srcDir) {
            builder.srcPath = srcDir;
            async.series([
                function(cb) {
                    builder.processPath(srcDir, cb);
                },
                function(cb) {
                    builder.createDigest(cb);
                }
            ], function(err, results) {
                if (err) {
                    reject(err);
                }

                msg('Digested ' + Object.keys(builder.digest).length + ' files.');
                resolve(destDir);
            });
        });
    });
};

module.exports = DigestBuilder;

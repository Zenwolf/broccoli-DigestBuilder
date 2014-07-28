Summary
=======

This is a Broccoli plugin that creates a digest JSON file that maps filenames to the original filenames plus a suffix that is generated from the md5 of each of the files' content. It supports an optional permutation string to alter the md5 values in case you want to build different digests for different environments from the same file names.


Config Example
==============

```javascript
{
  outputname: 'digest.json',
  permutation: 'dev'
}
```


Usage Example
=============

```javascript
var digestBuilder = require('broccoli-DigestBuilder');

//...

var digestFileTree = digestBuilder(anotherFileTree, {
    outputname: 'digest.json',
    permutation: 'dev'
});

```


Example Digest JSON output
==========================

Assuming a directory `src` with one file `Foo.js`.

```json
{
"src/Foo.js": "src/Foo-e2246d0f58599ee36fd42d7676594171.js"
}
```

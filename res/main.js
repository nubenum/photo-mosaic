//==================
//PATHS
//==================
var IMAGICK = ''; //on Windows e.g.: C:/Program Files/imagemagick/magick.exe
var CACHE = './cache/';
//==================

var RES, RESH = 0;
var THRESH = 5;
var PARENT, SOURCE = '';
var WIDTH, HEIGHT = 0;
var THUMBW, THUMBH = 0;
var SOURCENUM = 0;
var RATIO = 2;
var IMPROVE = 1;
var SEGMENTS = true;
var CONTOUR = false;
var OPACITY = 80;
var INDEX = {P:'', P9:'', S:'', S9:'', C:''};
var ID = 0;
var DEF = 100000000;

var DIRS = ['sourceMin', 'tiles', 'sprites', 'rgb', 'dzi', 'contour', 'imgmgck', 'scale'];
var TP = 'png';
var grid, secGrid;

var fs = require('fs');
var dict = require('./res/lang.json');
var exec = require('child_process').exec;		
var os = require('os');		
var rimraf = require('./res/rimraf.js');		

var mem = Math.floor(os.freemem()/6);
mem = '1000000000';
var MEMLIM = '-limit memory '+mem+' -limit map '+mem;


var LANG = 'en';
var langs = ['en', 'de'];

var W = function() {};
W.prototype.postMessage = function(d){
    onmessage({data:d});
};
var worker = new W();

function postMessage(d)
{
    worker.onmessage({data:d});
}

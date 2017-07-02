onmessage = function(e)
{
	e = e.data;

	if (e.type == 'var')
	{
		self[e.name] = e.state;
	}
	if (e.type == 'command')
	{
		if (e.name == 'info') info();
		else if (e.name == 'digest') digest();
		else if (e.name == 'cleanup') cleanup();
		else if (e.name == 'dzi') dzi();
	}
}
function status(t, n, s)
{
	postMessage({type:t, name:n, state:s});
	//postMessage({type:t, name:n, state:s}, '*');
}
function cache(name)
{
    return CACHE+ID+'-'+name+'.'+TP;
}
function imagick(cmd, exe, callback)
{
	return new Promise(function(resolve, reject) {
		var monitor = (cmd.indexOf('-monitor') != -1);
        var prefix = '';
        if (IMAGICK.length > 0) prefix = '"'+IMAGICK+'" ';
		var call = exec(prefix+exe+' -set registry:temporary-path '+CACHE+'imgmgck '+MEMLIM+' '+cmd, function(error, stdout, stderr) {
			if (!monitor && stderr) reject(stderr);
			if (monitor && stderr || !monitor) resolve(stdout);
		});
		call.stderr.on('data', function(data) {
			if (monitor && callback) callback(data);
		});
	});
}
function convert(cmd, callback)
{
	return imagick(cmd, 'convert', callback);
}
function montage(cmd)
{
	return imagick(cmd, 'montage');
}

function saveJSON(file, json)
{
	return new Promise(function (resolve, reject) {
		fs.writeFile(file, JSON.stringify(json), (err) => {
			if (err) reject(err);
			else resolve(true);
		});
	});
}

function cleanup()
{
	for(var i=0;i<DIRS.length;i++)
	{
		if (CACHE.length < 5) continue;
		rimraf(CACHE+DIRS[i], function(error) {
		});
	}
}
function mkDirs()
{
    try {
        fs.mkdirSync(CACHE);
    } catch(e) {}
	for(var i=0;i<DIRS.length;i++)
	{
		try {
			fs.mkdirSync(CACHE+DIRS[i]);
		} catch(e) {}
	}
}

function info()
{
	convert('"'+PARENT+'" -ping -format "%w %h" info:')
	.then(function (data) {
		status('info', data, 0);
	});
}

function readIndexes()
{
    var iterations = [];
	for(var key in INDEX)
	{
		iterations.push(new Promise(function (resolve, reject) {
            var tmp = key;
            var file = key.replace('S', 'source').replace('P', 'parent').replace('C', 'contour');
            fs.readFile(CACHE+'rgb/'+file+'.rgb', (err, data) => {
                if (!err) INDEX[tmp] = data;
                resolve(true);
            });
        }));
	}

	return Promise.all(iterations).then(function(output) {
		return true;
	});
}

function dist1(p, s) {
	return Math.sqrt(
				Math.pow(INDEX.P[p*3]-INDEX.S[s*3], 2) +
				Math.pow(INDEX.P[p*3+1]-INDEX.S[s*3+1], 2) +
				Math.pow(INDEX.P[p*3+2]-INDEX.S[s*3+2], 2)
				 );
}
function dist9(p, s) {
	//console.log(INDEX.S9[s*3],INDEX.S9[s*3+1],INDEX.S9[s*3+2]);
	return Math.sqrt(
					 Math.pow(INDEX.P9[p*3]-INDEX.S9[s*3], 2) +
					 Math.pow(INDEX.P9[p*3+1]-INDEX.S9[s*3+1], 2) +
					 Math.pow(INDEX.P9[p*3+2]-INDEX.S9[s*3+2], 2)
					 );
}
function dist27(p, s) {
	var dist = 0;
	var row = -1;
	var y = Math.floor(p/RES);
	for(var i=0;i<9;i++)
	{
	if (i%3 == 0) row++;
	dist += dist9(y*RES*9+(p%RES)*3+row*RES*3+i%3, s*9+i);
	}
	return dist;
}

function envGrid(g, i, ahead)
{
	if (THRESH <= 0) return new Array(0);
	if (ahead) return g.slice(i-THRESH, i+THRESH).concat(g.slice(i-RES-THRESH, i-RES+THRESH), g.slice(i+RES-THRESH, i+RES+THRESH));
	return g.slice(i-THRESH, i).concat(g.slice(i-RES-THRESH, i-RES+THRESH), g.slice(i-RES*2-THRESH, i-RES*2+THRESH));
}

function max(val)
{
	var max = 10;
	if (val > max) return max;
	if (val < -max) return -max;
	return Math.round(val);
}

function getSpriteId(imgId)
{
	//return Math.floor(imgId/RES/5);
	return Math.floor(imgId/RES);
}

function improveWorker(j) {
		return new Promise(function (resolve, reject) {
			if (j < 0) {
				resolve(true);
			} else {
				var params = '';
				if (THRESH < 0)
				{
					params += ' -rotate '+Math.floor(Math.random()*4)*90+' '+CACHE+'contour/blendmask.png -alpha Off -compose CopyOpacity -composite'; 
				}
				if (IMPROVE > 0)
				{
					var dif = [];
					var avg, big = 0;
					for(var k=0;k<3;k++)
					{
						dif.push((INDEX.P[j*3+k]-INDEX.S[grid[j]*3+k])/(255-INDEX.S[grid[j]*3+k]));
						if (Math.abs(dif[k]) > Math.abs(dif[big])) big = k;
					}
					avg = max((dif[0]+dif[1]+dif[2])/3*100);
					if (IMPROVE < 3) params += ' -brightness-contrast '+avg+'x'+Math.abs(avg);

					var clrs = ['R', 'G', 'B'];
					var clr = max(dif[big]*100-avg);
					if (IMPROVE > 1) params += ' -channel '+clrs[big]+' -brightness-contrast '+clr+'x'+Math.abs(clr);

				}
				convert(CACHE+'sourceMin/p-'+grid[j].padLeft()+'.png '+params+' '+CACHE+'tiles/'+getSpriteId(j)+'/p-'+j.padLeft()+'.png')
				.then(function (workOutput) {
					if (CONTOUR && INDEX.C[j*3] > 1)
                    {
						console.log('contour');
                        var w = WIDTH/RES;
                        var h = w*3/4;
                        var geom = w+'x'+h+'+'+(j%RES*w)+'+'+(Math.floor(j/RES)*h);
                        convert(CACHE+'contour/contour.png -crop '+geom+' -fuzz 1% -fill white -floodfill +0+0 black -write '+CACHE+'contour/mask'+j.padLeft()+'.png "'+PARENT+'" -crop '+geom+' '
                        +'( -clone 1,0 -alpha off -compose CopyOpacity -composite ) '
                        +'( -clone 0 -negate ) '
                        +'( -clone 1,3 -alpha off -compose CopyOpacity -composite ) '
                        +' -delete 0-1,3 +append '
                        +' -scale 2x1! -format %[fx:int(255*p{0,0}.r+.5)],%[fx:int(255*p{0,0}.g+.5)],%[fx:int(255*p{0,0}.b+.5)]_%[fx:int(255*p{1,0}.r+.5)],%[fx:int(255*p{1,0}.g+.5)],%[fx:int(255*p{1,0}.b+.5)] info:- ')
						.then(function (result) {
							var newC = result.split('_').slice(0, 2);

							var replace = [];
							for (var k=0;k<2;k++)
							{
								var res = newC[k].split(',');
								var next = DEF;
								var nextI = DEF;

								for(var l=0;l<SOURCENUM;l++)
								{
									var dist = Math.sqrt(
									Math.pow(res[0]-INDEX.S[l*3], 2) +
									Math.pow(res[1]-INDEX.S[l*3+1], 2) +
									Math.pow(res[2]-INDEX.S[l*3+2], 2)
									);
									if (dist < next && envGrid(grid, j, true).indexOf(l) == -1 && envGrid(secGrid, j, true).indexOf(l) == -1)
									{
										next = dist;
										nextI = l;
									}
								}
								if (nextI != DEF)
								{
									replace.push(nextI);
									if (0 == k) grid[j] = nextI;
									else secGrid[j] = nextI;
								}
								else
								{
									replace.push(Math.floor(Math.random()*SOURCENUM));
									console.log(i, 'contour no match found S<-P');
								}
							}
							return convert(CACHE+'sourceMin/p-'+replace[1].padLeft()+'.png '
							+ '( '+CACHE+'sourceMin/p-'+replace[0].padLeft()+'.png '
							+ '( '+CACHE+'contour/mask'+j.padLeft()+'.png -resize '+(RATIO*100)+'% -blur 0x2 ) '
							+ '-alpha off -compose CopyOpacity -composite ) '
							+ '-gravity center -compose over -composite '+CACHE+'tiles/'+getSpriteId(j)+'/p-'+j.padLeft()+'.png');
						});
					}
					// resolve(brightness(j-1));
					resolve(true);
				});
			}
		});
}
function improve(j)
{
	var iterations = [];
	var batch = 10;
	for(var i=0;i<batch;i++)
	{
		iterations.push(improveWorker(j-i));
	}

	return Promise.all(iterations).then(function(output) {
		status('progress', 'improve', Math.round(100-(j-batch)/grid.length*100));
		if (j < 0)
		{
			status('progress', 'improve', -1);
			return true;
		}
		return improve(j-batch);
	});
}

function sprites(j)
{
	return new Promise(function (resolve, reject) {
		//console.log('sprite',j);
		if (j < 0) resolve(true);
//		else montage('-mode concatenate -tile '+RES+'x "'+CACHE+'tiles/'+j+'/p-*.png" '+CACHE+'sprites/sprite-'+j.padLeft()+'.'+TP)
		else 
		{
			var tiles = '"'+CACHE+'tiles/'+j+'/p-*.png"';
			var sprite = CACHE+'sprites/sprite-'+j.padLeft()+'.'+TP;
			var ret;
			(THRESH < 0
				? convert(tiles+' -background none -gravity east +smush -'+Math.floor(THUMBW/5)+' '+sprite)
				: montage('-mode concatenate -tile '+RES+'x '+tiles+' '+sprite))
			.then(function (op) {
				status('progress', 'merge', Math.round(50-j/getSpriteId(RES*RESH-1)*50));
				resolve(sprites(j-1));
			});
		}
	});
}

Number.prototype.padLeft = function (){
		return Array(6-String(this).length+1).join('0')+this;
}

function digest()
{
	ID = new Date().getTime();

	THUMBW = WIDTH/RES*RATIO;
	THUMBH = Math.ceil(THUMBW*3/4);
	if (THRESH < 0) THUMBH = THUMBW;
	RESH = Math.ceil(HEIGHT*RATIO/THUMBH);
	if (THRESH < 0)
	{
		THUMBW *= 5/4;
		THUMBH = THUMBW;
	} 
	//Math.round(RES*HEIGHT/WIDTH/3*4);

	grid = new Array(RES*RESH);
	secGrid = new Array(RES*RESH);
	mkDirs();

	status('task', '', 0);

	convert('"'+PARENT+'" -sample '+(RATIO*100)+'% '+cache('parent'))
	.then(function (result) {
		status('task', '', 1);
		var lap = 0;

		return convert('-define jpeg:size='+(THUMBW*2)+'x "'+SOURCE+'*.{jpg,jpeg,png}" -thumbnail '+THUMBW+'x'+THUMBH+'^^ -gravity center -extent '+THUMBW+'x'+THUMBH+' -monitor '+CACHE+'sourceMin/p-%06d.png', function (info) {
			status('task', '', 2);
			var perc = parseInt(info.match(/ ([0-9]+)\% /)[1]);
			console.log(info);
			status('progress', 'thumbs', Math.round((perc+lap)/2));
			if (perc == 100) lap += 100;
		});
	})
	.then(function (result) {
		console.log(result);
		status('progress', 'thumbs', -1);
		status('task', '', 3);
		return convert('"'+PARENT+'" -scale '+RES+'x'+RESH+'! '+CACHE+'rgb/parent.rgb');
	})
	.then(function (result) {
		return convert('"'+PARENT+'" -scale '+(RES*3)+'x'+(RESH*3)+'! '+CACHE+'rgb/parent9.rgb');
	})
	.then(function (result) {
		return convert('"'+CACHE+'sourceMin/*.png" -scale 1x1! rgb:- > '+CACHE+'rgb/source.rgb');
	})
	.then(function (result) {
		return convert('"'+CACHE+'sourceMin/*.png" -scale 3x3! rgb:- > '+CACHE+'rgb/source9.rgb');
	})
    .then(function (result) {
		if (CONTOUR) return convert('"'+PARENT+'" -canny 0x1+30%+60% '+CACHE+'contour/contour.png');
        return true;
	})
    .then(function (result) {
		if (CONTOUR) return convert(CACHE+'contour/contour.png -scale '+RES+'x'+RESH+'! '+CACHE+'rgb/contour.rgb');
        return true;
	})
	.then(function (result) {
		return convert('res/blendmask.png -thumbnail '+THUMBW+'x'+THUMBH+'^^ '+CACHE+'contour/blendmask.png');
	})
	.then(function (result) {
		return readIndexes();
	})
	.then(function (result) {
		status('task', '', 4);
		for(var i=0;i<SOURCENUM;i++)
		{
			var next = DEF;
			var nextI = DEF;
			for(var j=0;j<RES*RESH;j++)
			{
			var dist = (SEGMENTS ? dist27(j, i) : dist1(j, i));
			if (dist < next && grid[j] == undefined)
			{
				next = dist;
				nextI = j;
			}
			}
			if (nextI != DEF) grid[nextI] = i;
			else console.log(i, 'no match found S->P');
		}
		console.log('S->P done');
		for(var i=0;i<RES*RESH;i++)
		{
			if (grid[i] == undefined) {
				var next = DEF;
				var nextI = DEF;

				for(var j=0;j<SOURCENUM;j++)
				{
					var dist = (SEGMENTS ? dist27(i, j) : dist1(i, j));
					//if (i==78) console.log('t',i, j, dist, envGrid(grid, i, false));
					if (dist < next && envGrid(grid, i, false).indexOf(j) == -1)
					{
						next = dist;
						nextI = j;
					}
				}
				//if (i==500) console.log(nextI);
				if (nextI != DEF)
				{
					grid[i] = nextI;
				}
				else
				{
					grid[i] = Math.floor(Math.random()*SOURCENUM);
					console.log(i, 'no match found S<-P');
				}

			}
		}
		console.log('S<-P done');

		return saveJSON(CACHE+'grid.txt', grid);
	})
	.then(function (result) {
		status('task', '', 5);
		var iterations = [];
		for(i=0;i<getSpriteId(RES*RESH);i++)
		{

			var dir = CACHE+'tiles/'+i;
			//dir = CACHE+'tiles/';
			try {
				fs.mkdirSync(dir);
			} catch(e) {}
			/*iterations.push(new Promise(function (resolve, reject) {
				fs.link(CACHE+'sourceMin/p-'+grid[i].padLeft()+'.png', dir+'/p-'+i.padLeft()+'.png', function(){
				resolve(true);
				});
			}));*/
		}
		return true;
		/*return Promise.all(iterations).then(function(output) {
			return true;
		});*/
	})
	.then(function (result) {
		return improve(grid.length-1);
	})
	.then(function (result) {
		status('task', '', 6);
//		return sprites(Math.ceil(RESH/5-1));
		return sprites(getSpriteId(RES*RESH-1));

		// var iterations = [];
		// for(var i=0;i<RESH/5;i++)
		// {
		// 	iterations.push(montage('-mode concatenate -tile '+RES+'x "'+CACHE+'tiles/'+i+'/p-*.png" '+CACHE+'sprites/sprite-'+i.padLeft()+'.jpg'));
		// }

		// return Promise.all(iterations).then(function(output) {
		// 	return true;
		// });
	})
	.then(function (result) {
		// return montage('-mode concatenate -tile 1x "'+CACHE+'sprites/sprite-*.jpg" '+CACHE+ID+'-sprite.jpg');
		var param = '-append';
		if (THRESH < 0) param = '-background none -gravity east -smush -'+Math.floor(THUMBW/5);
		
		return convert('"'+CACHE+'sprites/sprite-*.'+TP+'" '+param+' '+cache('sprite'));
		
	})
	.then(function (result) {
		status('progress', 'merge', 75);
		//return convert(CACHE+ID+'-parent.png ( '+CACHE+ID+'-sprite.png -alpha set -channel A -evaluate set '+OPACITY+'% ) -composite '+CACHE+ID+'-out.png');
		return updateOpacity();
	})
	.then(function (result) {
		status('progress', 'merge', -1);
		console.log('yay', (new Date().getTime()-ID)/1000);
	})
	.catch(function (error) {
		status('error', error, 0);
		console.log(error);
	});
}

function opacityWorker()
{
	return convert(cache('parent')+' -gravity center \\( '+cache('sprite')+' -gravity center -alpha set -channel A -evaluate set '+OPACITY+'% \\) -composite '+cache('out'))
}
function updateOpacity()
{
	status('doing', 'opacity', 1);
	return opacityWorker()
	//convert(CACHE+ID+'-parent.jpg '+CACHE+ID+'-sprite.jpg -matte -channel a -evaluate set '+OPACITY+'% -composite '+CACHE+ID+'-out.jpg')
	//convert(CACHE+ID+'-parent.jpg ( '+CACHE+ID+'-sprite.jpg -normalize +level 0,'+OPACITY+'% ) -compose screen -composite '+CACHE+ID+'-out.jpg')
	.then(function (result) {
		return convert(cache('out')+' -scale 960x  '+cache('thumb'))
	})
	.then(function (result) {
		preview();
	});
}

function save(path)
{
	status('doing', 'save', 1);
	opacityWorker()
	.then(function (result) {
		status('doing', 'save', 0);
	});
}

function dzi()
{
	status('doing', 'dzi', 1);
	var size;
	convert(cache('out')+' -ping -format "%w %h" info:')
	.then(function (result) {
		size = result.split(' ');
		var lvls = Math.ceil(Math.log(size[0])/Math.log(2));
		mkDirs();
		try {
			fs.mkdirSync(CACHE+'dzi/dzi_files');
		} catch(e) {}

		return dziWorker(lvls, true);

		// for(var i=lvls;i>=0;i--)
		// {
		// 	try {
		// 		fs.mkdirSync(CACHE+'dzi/'+i);
		// 	} catch(e) {}
		// 	//if (size > result) size = result;
		// 	iterations.push(
		// 		convert(MEMLIM+' '+CACHE+ID+'-out.jpg -strip -resize '+size+'x -crop 1024x1024 -set filename:tile "%[fx:page.x/1024+0]_%[fx:page.y/1024+0]" +repage +adjoin "'+CACHE+'dzi/'+i+'/%[filename:tile].jpg"'));
		// 	size /= 2;
		// }

		// return Promise.all(iterations).then(function(output) {
		// 	return true;
		// });
		// convert(MEMLIM+' '+CACHE+ID+'-out.jpg -resize 512x -crop 1024x1024 -set filename:tile "%[fx:page.x/1024+0]_%[fx:page.y/1024+0]" +repage +adjoin "'+CACHE+'dzi/%[filename:tile].jpg"')
		// .then(function (result) {
		// 	console.log('yay');
		// });
	}).then(function (result) {
		var json = {
				Image: {
					xmlns:    "http://schemas.microsoft.com/deepzoom/2008",
					Url:      "./dzi_files/",
					Format:   "jpg",
					Overlap:  "0",
					TileSize: "1024",
					Size: {
						Width:  size[0],
						Height: size[1]
					}
				}
		};
		return saveJSON(CACHE+'dzi/mosaic.dzi', json);

	}).then(function (result) {
		status('doing', 'dzi', 0);
		alert('Your Deep Zoom Image was successfully created an can be found in the cache/dzi/ directory of this program\'s install location. You can find free software online to view the DZI.');
	});
}

function dziWorker(j, start) {
		return new Promise(function (resolve, reject) {

			if (j == -1)
			{
				resolve(true);
			}
			else
			{
				try {
					fs.mkdirSync(CACHE+'dzi/dzi_files/'+j);
				} catch(e) {}

				var src = (start ? cache('out') : CACHE+'scale/'+j+'.'+TP);

				convert(src+' -strip -sample 50% '+CACHE+'scale/'+(j-1)+'.'+TP)
				.then(function (workOutput) {
					return convert(src+' -strip -crop 1024x1024 -set filename:tile "%[fx:page.x/1024+0]_%[fx:page.y/1024+0]" +repage +adjoin "'+CACHE+'dzi/dzi_files/'+j+'/%[filename:tile].jpg"')
				})
				.then(function (workOutput) {
					resolve(dziWorker(j-1, false));
				});
			}

		});
}


worker.onmessage = function(e)
{
	e = e.data;
	
	if (e.type == 'step')
	{
		if (e.name = 'preview') preview();
	}
	else if (e.type == 'task')
	{
		task(e.state);
	}
	else if (e.type == 'progress')
	{
		var prg = '('+e.state+' %)';
		if (e.state < 0) prg = '';
		document.getElementById(e.name+'_progress').innerHTML = prg;
	}
	else if (e.type == 'doing')
	{
		document.getElementById(e.name+'_container').className = 'task ' + (e.state == 1 ? 'doing' : 'done');	
	}
	else if (e.type == 'error')
	{
		document.getElementById('error').style.display = 'block';
		document.getElementById('l_report').href = 'http://nubenum.de/inc/feedback?subject='+e.name;
	}
	else if (e.type == 'info')
	{
		settings(e.name);
	}
}

function call(t, n, s)
{
	worker.postMessage({type:t, name:n, state:s});
	//postMessage({type:t, name:n, state:s, toWorker:true}, '*');
}

function start()
{
	document.body.className = 'process';
	call('command', 'digest', 0);
}

function translate(lang)
{
	if (langs.indexOf(lang) == -1) lang = 'en';
	LANG = lang;
	for (var el in dict)
	{
	document.getElementById('l_'+el).innerHTML = dict[el][lang];
	}
}

function makeOptions(values, texts, def, id)
{
	if (!texts) texts = values;
	var node = document.getElementById(id);
	while (node.firstChild) node.removeChild(node.firstChild);
	
	for (var i=0;i<values.length;i++)
	{	 
		var opt = document.createElement('option');
		opt.value = values[i];
		opt.innerHTML = texts[i];
		if (values[i] == def)
		{
		opt.innerHTML = texts[i] + ' ('+dict['recommended'][LANG]+')';
		opt.selected = "selected";
		}
		node.appendChild(opt);
	}
}

function divisors()
{
	var divs = [];
	var nextI = 1000;
	for (var i=10;i<=300;i++)
	{
		if (WIDTH%i == 0) {
			divs.push(i);
			if (Math.abs(60-nextI) > Math.abs(60-i)) nextI = i;
		}
	}
	RES = nextI;
	if (divs.length == 0)
	{
		RES = 60;
		divs = [10, 20, 30, 40, 50, 60, 80, 100, 150, 200, 250, 300];
	}
	return divs;
}
function resolutions()
{
	var arr = [1];
	while(arr[arr.length-1]*WIDTH < 30000) arr.push(arr[arr.length-1]*2);
	if (arr[arr.length-4]) RATIO = arr[arr.length-4];
	else RATIO = 1;

	var texts = [];
	for(var i=0;i<arr.length;i++) texts.push(Math.round(arr[i]*WIDTH/118/10)*10+' cm');
	return [arr, texts];
}

function settings(result)
{	
	var dim = result.split(' ');
	WIDTH = dim[0];
	HEIGHT = dim[1];	  
	var res  = resolutions();

	makeOptions(divisors(), false, RES, 'res');
	makeOptions(res[0], res[1], RATIO, 'ratio');
	
	var threshs = [-20, 0, 5, 10];
	// for(var i=10;i<SOURCENUM/2;i+=10) threshs.push(i);
	makeOptions(threshs, false, THRESH, 'thresh');
	
	document.getElementById('advanced').style.display = 'block'; 
}

function unblock()
{
	PARENT = document.getElementById('parent_pick').value;
	SOURCE = document.getElementById('source_pick').value+'/';
	fs.readdir(SOURCE, (err, files) => {	 
		var re = /.*\.(jpg|jpeg|png)$/i
		var fnum = 0;
		for(var i=0;i<files.length;i++)
		{
			if(re.test(files[i])) fnum++;
		}
		if (!err) SOURCENUM = fnum;
		console.log(fnum);
		
		if (SOURCENUM >= 20 && !block) {
			document.getElementById('l_start').disabled = false;
			document.getElementById('l_too_few').style.display = 'none';
		} else {
			document.getElementById('l_start').disabled = true;
			if (SOURCENUM < 20) document.getElementById('l_too_few').style.display = 'block';	
		}
	});
}

function task(cstep) {
	if (cstep != 0) document.getElementById('tasks').children[cstep-1].className = 'done';
	if (cstep != 7) document.getElementById('tasks').children[cstep].className = 'doing';
	//document.getElementById('progress_main').style.width = (cstep/20*100)+'%';
}
	
function preview()
{
	document.body.className = 'preview';
	document.getElementById('preview').src = CACHE+ID+'-thumb.'+TP+'?ts='+(new Date().getTime());	
	document.getElementById('opacity_container').className = 'task';
	var tasks = document.getElementById('tasks').children;
	for (var i=0;i<tasks.length;i++) tasks[i].className = '';
	document.getElementById('save_pick').value = '';
}

function history(makePage)
{
	fs.readdir(CACHE, (err, files) => {
		var re = /^[0-9]+-thumb\.(png|jpg)$/i
		var h = document.getElementById('history');
		while (h.firstChild) h.removeChild(h.firstChild);
		
		var hasHistory = false;
		for(var i=0;i<files.length;i++)
		{
			if(re.test(files[i]))
			{
				if (makePage)
				{
					var img = document.createElement('img');
					var a = document.createElement('a');
					img.src = CACHE+files[i];
					a.href = 'javascript:void(0)';
					a.onclick = function () { ID = this.id; preview(); };
					a.id = files[i].split('-')[0];
					a.appendChild(img);
					h.appendChild(a);
				}
				hasHistory = true;
			}
		}	
		if (hasHistory)
		{
			document.getElementById('l_show_history').style.display = 'block';
		}
	});
}


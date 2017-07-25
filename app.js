
function extractHostname(url) {
	if(url === undefined) return undefined;
	var start = url.indexOf("://");
	start = start > 0 ? start + 3 : 0;
	if(url.startsWith('www.', start)) start += 4;
	
	var end = url.indexOf('/', start);
	if(end === -1) end = url.length;
	
	return url.slice(start, end);
}

function formatAgo(val, desc) {
	return val + ' ' + desc + (val === 1 ? ' ago' : 's ago');
}

function relativeTime(time) {
	var then = new Date(time * 1000);
	var now  = new Date(Date.now());
	var diff = now.getYear() - then.getYear();
	if(diff > 0) return formatAgo(diff, 'year');
	diff = now.getMonth() - then.getMonth();
	if(diff > 0) return formatAgo(diff, 'month');
	diff = now.getDay() - then.getDay();
	if(diff > 0) return formatAgo(diff, 'day');
	diff = now.getHours() - then.getHours();
	if(diff > 0) return formatAgo(diff, 'hour');
	diff = now.getMinutes() - then.getMinutes();
	if(diff > 0) return formatAgo(diff, 'minute');
	return 'now';
}

function smoothScrollTop() {
	var currentScroll = document.documentElement.scrollTop || document.body.scrollTop;
	if (currentScroll > 0) {
		 window.requestAnimationFrame(smoothScrollTop);
		 window.scrollTo(0, currentScroll - (currentScroll/5));
	}
}

function setTitle(extra) {
	document.title = extra ? 'Mithril HN - ' + extra : 'Mithril HN';
}

//==============================================================================
//= OnLoad
//==============================================================================
window.onload = function() {
var root = document.body;
var awaiting = {};
var items = {};
var state = {};

m.render(root, "Loading");

function renderChildrenCount(item) {
	var count = item.kids ? item.kids.length : 0;
	return m('span', '(' + count + (count === 1 ? ' child)' : ' children)'));
}


function renderStory(id) {
	var item = items[id];
	if(item === undefined) {
		getItem(id);
		return m('li.ListItem', '...');
	}
	var comments = {href: '#/item/' + item.id};
	var link = item.url ? {href: '#/item/'+ id} : comments;
	var hostname = extractHostname(item.url)

	return m('li.ListItem', {
		style: 'margin-bottom: 16px'
	}, [
		m('div.Item__title',
			m('a', link, item.title),
			hostname ? m('span.Item__host', ' ' + hostname) : null
		),
		m('div.Item__meta', [
			m('span.Item__score', item.score),
			' points by ', m('span.Item__by', m('a', {href: '#/user/' + item.by}, item.by)),
			' ', m('span.Item__time', relativeTime(item.time)),
			' | ', m('a', comments, item.descendants + ' comments'),
			' | ', m('span', {title: JSON.stringify(item, null, 2)}, 'JSON'),
		]),
	]);
}

function getItem(id) {
	// Check if story exists
	if (items.hasOwnProperty(id)) return;
	if (awaiting.hasOwnProperty(id)) return;
	awaiting[id] = true;

//	console.log('GET id:'+id);

	m.request({
		method: "GET",
		url: "https://hacker-news.firebaseio.com/v0/item/" + id + ".json",
		withCredentials: false,
	}).then(function(data) {
		//console.log(data);
		items[id] = data;
		delete awaiting[id];	
		m.redraw();
	})
}

function renderPaginator(min, val, max) {
	return m('div.Paginator', [
		min < val
			? m('span.Paginator__prev', m('a', {onclick: smoothScrollTop, href: '#/news/' + (val - 1)}, 'prev'))
			: null,
		min < val && val < max ? ' | ' : null,
		val < max
			? m('span.Paginator__next', m('a', {onclick: smoothScrollTop, href: '#/news/' + (val + 1)}, 'next'))
			: null,
	]);
}

var settings = {
	storiesPerPage: 30,
}

function renderNav(selector, href, content) {
	var path = m.route.get();
	if(path.startsWith(href)) selector += '.active';
	return m(selector, {oncreate: m.route.link, href: href}, content);
}

// Components
var Layout = {
	view: function(vnode) {
		var nav = [
			m('a', {oncreate: m.route.link, href: '/news/1'},
				m('img', {src: 'img/logo.png', alt: '', width: 16, height: 16})
			),

			renderNav('a.App__homelink', '/news', 'Mithril HN'),
			' ',
			renderNav('a', '/newest','new'),
			' | ',
			renderNav('a', '/newcomments','comments'),
			' | ',
			renderNav('a', '/show','show'),
			' | ',
			renderNav('a', '/ask','ask'),
			' | ',
			renderNav('a', '/jobs','jobs'),
			renderNav('a[tabindex=0].App__settings', '/settings','settings'),
		];

		return m('.App', [
			m('.App__header', nav),
			m('.App__content', vnode.children),
			m('.App__footer')
		]);
	}
}

var PageView = {
	load: function(view) {
		view.loaded = false;

		m.request({
			method: "GET",
			url: view.url,
			withCredentials: false,
		}).then((function(data){
			view.list = data;
			view.loaded = true;

			m.redraw();
		}).bind(this));
	},
	view: function(vnode) {
		var view = views[vnode.attrs.view];
		var page = Number(vnode.attrs.page) || 1;

		if(!view.loaded) {
			this.load(view);
			return m('p', 'Loading Stories...');
		}

		setTitle(vnode.atts.view);

		var pages = Math.floor(view.list.length / settings.storiesPerPage);
		var itemOnPage = settings.storiesPerPage * (page - 1);
		var subset = view.list.slice(itemOnPage, settings.storiesPerPage * page);

		return m('div.Items', [
			m('ol.Items__list', {start: itemOnPage + 1}, subset.map(renderStory)),
			renderPaginator(1, page, pages)
		]);
	},
}

function renderItem(id) {
	var item = items[id];
	if(item === undefined || item == null) {
		getItem(id);
		return m('div.Item', '...');
	}

	var collapse = function(e) {
		item.hidden = !item.hidden;
	}

	return m('div.Item', [
		// Metadata for the Item
		m('div.Item__meta', [
			// Collapse for the comments
			m('span.Comment__collapse', {tabindex: 0, onclick: collapse}, item.hidden ? '[+]' : '[-]'),
			// Metadata for author, time, permalink, JSON data, Children Information
			' ', m('span.Item__by', m('a', {href: '#/user/' + item.by}, item.by)),
			' ', m('span.Item__time', relativeTime(item.time)),
			' | ', m('a', {href: '#/item/' + item.id}, 'link'),
			' | ', m('span', {title: JSON.stringify(item, null, 2)}, 'JSON'),
			item.hidden ? [' | ', renderChildrenCount(item)] : null,
		]),
		m('div.Comment__text', {style: {display: item.hidden ? 'none' : 'block'}},
			m.trust(item.text),
			m('p', m('a', {href: 'https://news.ycombinator.com/reply?id=' + item.id}, 'reply'))),
		item.hidden || !item.kids ? null
			: m('div.Item-kids', item.kids.map(renderItem)),
	]);
}


var item = {
	view : function(vnode) {
		var id = vnode.attrs.id;
		var item = items[id];

		if(item === undefined) {
			if(awaiting[id] === undefined) getItem(id);
			return 'Loading...';
		}

		setTitle(item.title);

		var header = renderStory(id);
		header.tag = 'div';

		var content = [
			m('div.Item__content', header),
			m('div.Item__kids', item.kids ? item.kids.map(renderItem) : null),
		];

		return m(Layout, content);
	}
};
var todo = m('p', 'Todo');

function component(template, attrs) {
	return { render: function(vnode) { return m(Layout, m(template, attrs)); } };
	//return { view: function() { return m(template, attrs); } };
}

function newView(url) {
	return {
		url: 'https://hacker-news.firebaseio.com/v0/' + url,
	}
}
var views = {
	'news' : newView('topstories.json'),
	'newest': newView('newstories.json'),
	'best': newView('beststories.json'),
//	'newcomments': newView('TODO').json,
	'show': newView('showstories.json'),
	'ask': newView('askstories.json'),
	'job': newView('jobstories.json'),
}

var defaultRoute = '/news/1';
m.route.prefix('#');
m.route(root, defaultRoute, {
	'/item/:id': item,

	// Route All Page access properly
	'/:any' : {
		onmatch: function(args, path) {
			var redirect = path + (path.endsWith('/') ? '1' : '/1');
			console.log(path, 'redirected to', redirect);
			m.route.set(redirect);
		},
	},

	/*
	'/newcomments/:page': {
		render: function(vnode) {
			return m(Layout, m(PageView, vnode.attrs));
		}
	},
	*/
	
	// Serve PageView components
	'/:view/:page' : {
		onmatch: function(args, path) {
			var view = views[args.view];
			if(view === undefined) {
				console.log(path, 'redirected to', defaultRoute);
				m.route.set(defaultRoute);
				return false;
			}

			return true;
		},
		render: function(vnode) {
			return m(Layout, m(PageView, vnode.attrs));
		}
	}

});

} // window.onload


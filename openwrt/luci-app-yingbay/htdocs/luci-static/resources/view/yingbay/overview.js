'use strict';
'require view';
'require rpc';
'require uci';
'require ui';
'require fs';

var callStatus = rpc.declare({
	object: 'luci.yingbay',
	method: 'status',
	expect: {}
});

var callRestart = rpc.declare({
	object: 'luci.yingbay',
	method: 'restart',
	expect: { ok: true }
});

function row(name, value) {
	return E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left', 'width': '33%' }, name),
		E('td', { 'class': 'td left' }, value)
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callStatus(), {}),
			uci.load('yingbay')
		]);
	},

	render: function(data) {
		var st = data[0] || {};
		var port = st.port || uci.get('yingbay', 'main', 'port') || 3000;
		var running = st.running === true || st.running === 1 || st.running === '1';
		var host = window.location.hostname;
		var uiUrl = window.location.protocol + '//' + host + ':' + port + '/';

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('映湾影视中心')),
			E('div', { 'class': 'cbi-map-descr' },
				_('在路由器上挂云盘、直连点播，并完成中兴 IPTV 鉴权、EPG 与 rtp2http 组播转 HTTP。手机浏览器打开放映厅即可观看。')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('运行状态')),
				E('table', { 'class': 'table' }, [
					row(_('服务'), running
						? E('span', { 'style': 'color:#46a546' }, _('运行中'))
						: E('span', { 'style': 'color:#d73502' }, _('未运行'))),
					row(_('端口'), String(port)),
					row(_('放映厅'), E('a', { 'href': uiUrl, 'target': '_blank', 'rel': 'noopener' }, uiUrl)),
					row(_('站点名'), uci.get('yingbay', 'main', 'site_name') || '映湾')
				]),
				E('div', { 'class': 'cbi-page-actions' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': function() {
							window.open(uiUrl, '_blank');
						}
					}, _('打开放映厅')),
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, function() {
							return callRestart().then(function() {
								ui.addNotification(null, E('p', _('正在重启映湾服务')), 'info');
								window.setTimeout(function() { location.reload(); }, 1500);
							});
						})
					}, _('重启服务')),
					E('button', {
						'class': 'btn cbi-button cbi-button-neutral',
						'click': ui.createHandlerFn(this, function() {
							return fs.exec('/etc/init.d/yingbay', ['start']).then(function() {
								window.setTimeout(function() { location.reload(); }, 1200);
							});
						})
					}, _('启动'))
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
